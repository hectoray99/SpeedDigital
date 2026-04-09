import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Search, ShoppingCart, Trash2, Check, UserPlus, CreditCard, Banknote, SmartphoneNfc } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface CreateOperationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateOperationModal({ isOpen, onClose, onSuccess }: CreateOperationModalProps) {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(false);

    // Búsqueda combinada (Personas y Productos)
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchType, setSearchType] = useState<'products' | 'person'>('products');

    // Estado del Carrito y Venta
    const [selectedPerson, setSelectedPerson] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');

    useEffect(() => {
        if (isOpen) {
            setSelectedPerson(null);
            setCart([]);
            setPaymentMethod('cash');
            setSearchTerm('');
            setSearchResults([]);
            setSearchType('products');
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }

            setSearching(true);
            try {
                if (searchType === 'products') {
                    const { data } = await supabase
                        .from('catalog_items')
                        .select('*')
                        .eq('organization_id', orgData.id)
                        .eq('is_active', true)
                        .ilike('name', `%${searchTerm}%`)
                        .limit(8);
                    setSearchResults(data || []);
                } else {
                    const { data } = await supabase
                        .from('crm_people')
                        .select('id, full_name, identifier')
                        .eq('organization_id', orgData.id)
                        .ilike('full_name', `%${searchTerm}%`)
                        .limit(5);
                    setSearchResults(data || []);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, searchType, orgData?.id]);

    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setSearchTerm('');
        setSearchResults([]);
        
        // Efecto visual y de sonido (opcional, si tenés un sonido)
        toast.success(`${product.name} agregado`, { duration: 1000, position: 'bottom-center' });
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(p => p.id !== id));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (!orgData?.id) return;
        if (cart.length === 0) return toast.error("El carrito está vacío");

        setLoading(true);

        try {
            // 1. Crear Operación (El cliente es opcional, si es null queda en null)
            const { data: op, error: opError } = await supabase
                .from('operations')
                .insert([{
                    organization_id: orgData.id,
                    person_id: selectedPerson?.id || null, // <--- Cliente opcional
                    status: 'paid',
                    total_amount: cartTotal,
                    balance: 0,
                    metadata: { concept: 'Venta Mostrador' }
                }])
                .select()
                .single();

            if (opError) throw opError;

            // 2. Crear Líneas del ticket
            const lines = cart.map(item => ({
                organization_id: orgData.id,
                operation_id: op.id,
                item_id: item.id,
                quantity: item.quantity,
                unit_price: item.price
            }));

            const { error: linesError } = await supabase.from('operation_lines').insert(lines);
            if (linesError) throw linesError;

            // 3. Registrar el ingreso en la Caja Diaria
            const { error: ledgerError } = await supabase.from('finance_ledger').insert([{
                organization_id: orgData.id,
                operation_id: op.id,
                person_id: selectedPerson?.id || null,
                type: 'income',
                amount: cartTotal,
                payment_method: paymentMethod,
                processed_at: new Date(),
                notes: `Venta Mostrador ${selectedPerson ? `(${selectedPerson.full_name})` : '(Consumidor Final)'}`
            }]);

            if (ledgerError) throw ledgerError;

            toast.success('¡Venta registrada con éxito!');
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error('Error al registrar la venta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={onClose}>
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />
                <div className="fixed inset-0 overflow-hidden">
                    <div className="flex min-h-full items-center justify-center p-0 md:p-4">
                        <Dialog.Panel className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl transform overflow-hidden bg-white shadow-2xl transition-all flex flex-col md:flex-row md:rounded-3xl animate-in zoom-in-95">

                            {/* --- PANEL IZQUIERDO: BUSCADOR Y CATÁLOGO --- */}
                            <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-100 h-1/2 md:h-auto">
                                <div className="p-4 md:p-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                                    <h2 className="text-xl font-black text-slate-800">Terminal de Venta</h2>
                                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors md:hidden"><X className="w-6 h-6 text-slate-400" /></button>
                                </div>

                                <div className="p-4 md:p-6 shrink-0 relative">
                                    <div className="relative shadow-sm rounded-2xl bg-white border border-slate-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all flex items-center overflow-hidden z-20">
                                        
                                        {/* Selector de tipo de búsqueda */}
                                        <button 
                                            onClick={() => {
                                                setSearchType(searchType === 'products' ? 'person' : 'products');
                                                setSearchTerm('');
                                                setSearchResults([]);
                                            }}
                                            className={`px-4 py-3.5 border-r border-slate-100 font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0 ${searchType === 'products' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            title="Cambiar filtro de búsqueda"
                                        >
                                            {searchType === 'products' ? <Search className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                            <span className="hidden sm:inline">{searchType === 'products' ? 'Productos' : 'Clientes'}</span>
                                        </button>
                                        
                                        <input
                                            autoFocus
                                            type="text"
                                            className="w-full px-4 py-3.5 outline-none font-medium text-slate-800 bg-transparent"
                                            placeholder={searchType === 'products' ? "Buscar producto o servicio..." : "Buscar por nombre del cliente..."}
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                        {searching && <Loader2 className="w-5 h-5 animate-spin text-brand-500 mr-4" />}
                                    </div>

                                    {/* Resultados Flotantes */}
                                    {searchResults.length > 0 && (
                                        <div className="absolute top-full left-4 right-4 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-64 overflow-y-auto z-30 animate-in fade-in slide-in-from-top-2">
                                            {searchResults.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        if (searchType === 'products') {
                                                            addToCart(item);
                                                        } else {
                                                            setSelectedPerson(item);
                                                            setSearchTerm('');
                                                            setSearchResults([]);
                                                            setSearchType('products'); // Vuelve a productos automáticamente
                                                        }
                                                    }}
                                                    className="w-full p-4 flex items-center justify-between hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0 text-left group"
                                                >
                                                    <div>
                                                        <p className="font-bold text-slate-800 group-hover:text-brand-700">{searchType === 'products' ? item.name : item.full_name}</p>
                                                        {searchType === 'person' && <p className="text-xs text-slate-500 font-medium">ID/DNI: {item.identifier || 'Sin registrar'}</p>}
                                                    </div>
                                                    {searchType === 'products' ? (
                                                        <span className="font-black text-brand-600">${item.price.toLocaleString()}</span>
                                                    ) : (
                                                        <UserPlus className="w-5 h-5 text-slate-300 group-hover:text-brand-500" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-0 flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <Search className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="font-bold text-center">Usá el buscador de arriba <br/> para escanear o buscar productos.</p>
                                </div>
                            </div>

                            {/* --- PANEL DERECHO: TICKET Y COBRO --- */}
                            <div className="w-full md:w-[400px] bg-white flex flex-col h-1/2 md:h-auto shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.05)] z-10 relative">
                                
                                <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                    <h3 className="font-black flex items-center gap-2">
                                        <ShoppingCart className="w-5 h-5 text-brand-400" /> Ticket Actual
                                    </h3>
                                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors hidden md:block"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>

                                {/* Selección de Cliente (Opcional) */}
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-slate-200 rounded-lg text-slate-500"><UserPlus className="w-4 h-4" /></div>
                                        {selectedPerson ? (
                                            <div>
                                                <p className="text-sm font-bold text-brand-700 leading-none">{selectedPerson.full_name}</p>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cliente Asignado</p>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-bold text-slate-500">Consumidor Final</p>
                                        )}
                                    </div>
                                    {selectedPerson && (
                                        <button onClick={() => setSelectedPerson(null)} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">Quitar</button>
                                    )}
                                </div>

                                {/* Carrito */}
                                <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
                                    {cart.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                            <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
                                            <p className="text-sm font-bold">Ticket vacío</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {cart.map(item => (
                                                <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group">
                                                    <div className="flex-1 pr-2 overflow-hidden">
                                                        <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                                        <p className="text-xs text-slate-500 font-medium">{item.quantity} x ${item.price.toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="font-black text-slate-800">${(item.price * item.quantity).toLocaleString()}</span>
                                                        <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Área de Cobro */}
                                <div className="p-4 md:p-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] shrink-0">
                                    
                                    <div className="flex justify-between items-end mb-4">
                                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Total a Pagar</span>
                                        <span className="text-4xl font-black text-slate-800 tracking-tight">${cartTotal.toLocaleString()}</span>
                                    </div>

                                    {/* Métodos de Pago Compactos */}
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <button onClick={() => setPaymentMethod('cash')} className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}>
                                            <Banknote className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Efectivo</span>
                                        </button>
                                        <button onClick={() => setPaymentMethod('card')} className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}>
                                            <CreditCard className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Tarjeta</span>
                                        </button>
                                        <button onClick={() => setPaymentMethod('mercadopago')} className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'mercadopago' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}>
                                            <SmartphoneNfc className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Transf.</span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleCheckout}
                                        disabled={loading || cart.length === 0}
                                        className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                    >
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                                        Cobrar Ticket
                                    </button>
                                </div>
                            </div>

                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}