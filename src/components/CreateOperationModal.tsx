import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Search, ShoppingCart, Trash2, Check, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface CreateOperationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateOperationModal({ isOpen, onClose, onSuccess }: CreateOperationModalProps) {
    const { orgData } = useAuthStore(); // Traemos el tenant desde la memoria global
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const [selectedPerson, setSelectedPerson] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedPerson(null);
            setCart([]);
            setPaymentMethod('cash');
            setSearchTerm('');
            setSearchResults([]);
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }

            setSearching(true);
            const table = step === 1 ? 'crm_people' : 'catalog_items';
            const field = step === 1 ? 'full_name' : 'name';

            const { data } = await supabase
                .from(table)
                .select('*')
                .ilike(field, `%${searchTerm}%`)
                .limit(5);

            setSearchResults(data || []);
            setSearching(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, step]);

    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setSearchTerm('');
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(p => p.id !== id));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (!orgData?.id) return;
        setLoading(true);

        try {
            if (!selectedPerson) throw new Error('No se seleccionó cliente');

            const orgId = orgData.id;

            // 1. Crear Operación
            const { data: op, error: opError } = await supabase
                .from('operations')
                .insert([{
                    organization_id: orgId,
                    person_id: selectedPerson.id,
                    status: 'paid',
                    total_amount: cartTotal,
                    balance: 0
                }])
                .select()
                .single();

            if (opError) throw opError;

            // 2. Crear Líneas
            const lines = cart.map(item => ({
                organization_id: orgId,
                operation_id: op.id,
                item_id: item.id,
                quantity: item.quantity,
                unit_price: item.price
            }));

            const { error: linesError } = await supabase.from('operation_lines').insert(lines);
            if (linesError) throw linesError;

            // 3. Registrar en Caja
            const { error: ledgerError } = await supabase.from('finance_ledger').insert([{
                organization_id: orgId,
                operation_id: op.id,
                person_id: selectedPerson.id,
                type: 'income',
                amount: cartTotal,
                payment_method: paymentMethod,
                processed_at: new Date()
            }]);

            if (ledgerError) throw ledgerError;

            toast.success('¡Venta registrada con éxito!');
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all flex flex-col min-h-[500px]">

                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                <Dialog.Title className="text-lg font-bold text-slate-800">
                                    {step === 1 ? 'Seleccionar Cliente' : 'Cargar Productos'}
                                </Dialog.Title>
                                <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                            </div>

                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex gap-2 mb-6">
                                    <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-brand-500' : 'bg-slate-100'}`} />
                                    <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-brand-500' : 'bg-slate-100'}`} />
                                    <div className={`h-1 flex-1 rounded-full ${step >= 3 ? 'bg-brand-500' : 'bg-slate-100'}`} />
                                </div>

                                {step === 1 && (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            <input
                                                autoFocus
                                                type="text"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20 text-lg"
                                                placeholder="Buscar por nombre..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                            />
                                            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-brand-500" />}
                                        </div>

                                        <div className="space-y-2">
                                            {searchResults.map(person => (
                                                <div
                                                    key={person.id}
                                                    onClick={() => { setSelectedPerson(person); setStep(2); setSearchTerm(''); setSearchResults([]); }}
                                                    className="p-3 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 flex justify-between items-center group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                                                            {person.full_name[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900">{person.full_name}</p>
                                                            <p className="text-xs text-slate-500">{person.identifier || 'Sin ID'}</p>
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="flex-1 flex gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20"
                                                    placeholder="Buscar productos..."
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2 h-64 overflow-y-auto">
                                                {searchResults.map(prod => (
                                                    <div
                                                        key={prod.id}
                                                        onClick={() => addToCart(prod)}
                                                        className="p-3 border border-slate-100 rounded-lg hover:border-brand-500 cursor-pointer transition-colors flex justify-between items-center"
                                                    >
                                                        <div>
                                                            <p className="font-medium text-slate-800">{prod.name}</p>
                                                            <p className="text-xs text-slate-500 capitalize">{prod.type}</p>
                                                        </div>
                                                        <span className="font-bold text-brand-600">${prod.price}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="w-72 bg-slate-50 rounded-xl p-4 flex flex-col">
                                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
                                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold">
                                                    {selectedPerson?.full_name[0]}
                                                </div>
                                                <span className="text-sm font-medium truncate">{selectedPerson?.full_name}</span>
                                            </div>

                                            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                                {cart.length === 0 ? (
                                                    <div className="text-center py-8 text-slate-400 text-sm">
                                                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                        Carrito vacío
                                                    </div>
                                                ) : (
                                                    cart.map(item => (
                                                        <div key={item.id} className="flex justify-between items-center text-sm">
                                                            <div>
                                                                <p className="font-medium">{item.name}</p>
                                                                <p className="text-xs text-slate-500">{item.quantity} x ${item.price}</p>
                                                            </div>
                                                            <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <div className="pt-4 border-t border-slate-200">
                                                <div className="flex justify-between items-end mb-4">
                                                    <span className="text-slate-500">Total</span>
                                                    <span className="text-2xl font-bold text-slate-900">${cartTotal.toLocaleString()}</span>
                                                </div>
                                                <button
                                                    disabled={cart.length === 0}
                                                    onClick={() => setStep(3)}
                                                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                                                >
                                                    Continuar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="flex flex-col items-center justify-center flex-1 space-y-6">
                                        <div className="text-center">
                                            <h3 className="text-2xl font-bold text-slate-900">Confirmar Venta</h3>
                                            <p className="text-slate-500">Selecciona el método de pago</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                                            {['cash', 'transfer', 'card', 'mercadopago'].map(method => (
                                                <button
                                                    key={method}
                                                    onClick={() => setPaymentMethod(method)}
                                                    className={`p-4 rounded-xl border-2 font-medium capitalize transition-all ${paymentMethod === method
                                                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                        : 'border-slate-100 hover:border-slate-300 text-slate-600'
                                                        }`}
                                                >
                                                    {method === 'cash' ? 'Efectivo' : method}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="w-full max-w-md pt-6">
                                            <button
                                                onClick={handleCheckout}
                                                disabled={loading}
                                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                            >
                                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                                                Cobrar ${cartTotal.toLocaleString()}
                                            </button>
                                            <button
                                                onClick={() => setStep(2)}
                                                className="w-full mt-4 text-slate-400 hover:text-slate-600 text-sm"
                                            >
                                                Volver al carrito
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}