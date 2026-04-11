import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Search, ShoppingCart, Trash2, Check, UserPlus, CreditCard, Banknote, SmartphoneNfc, Plus, HandCoins } from 'lucide-react';
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

    // =========================================================================
    // ESTADOS: BÚSQUEDA Y CARRITO
    // =========================================================================
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchType, setSearchType] = useState<'products' | 'person'>('products');

    const [selectedPerson, setSelectedPerson] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');

    // Estado para registrar ventas fuera del catálogo (Ej: Venta suelta)
    const [isManualItemMode, setIsManualItemMode] = useState(false);
    const [manualItem, setManualItem] = useState({ name: '', price: '' });

    // =========================================================================
    // EFECTOS: INICIALIZACIÓN Y BÚSQUEDA ASÍNCRONA
    // =========================================================================
    
    // Resetear estados al abrir el modal
    useEffect(() => {
        if (isOpen) {
            setSelectedPerson(null);
            setCart([]);
            setPaymentMethod('cash');
            setSearchTerm('');
            setSearchResults([]);
            setSearchType('products');
            setIsManualItemMode(false);
            setManualItem({ name: '', price: '' });
        }
    }, [isOpen]);

    // Buscador "Debounced" para no saturar la BD en cada tecla
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length < 2 || isManualItemMode) {
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
                        .limit(10);
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
        }, 300); // 300ms de retraso (Debounce)

        return () => clearTimeout(timer);
    }, [searchTerm, searchType, orgData?.id, isManualItemMode]);

    // =========================================================================
    // FUNCIONES: MANEJO DEL CARRITO (TICKET)
    // =========================================================================
    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                // Si ya existe, sumamos cantidad
                return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            // Si no existe, lo agregamos nuevo
            return [...prev, { ...product, quantity: 1 }];
        });
        setSearchTerm('');
        setSearchResults([]);
        toast.success(`${product.name} agregado`, { duration: 1000, position: 'bottom-center' });
    };

    const addManualItemToCart = (e: React.FormEvent) => {
        e.preventDefault();
        const price = Number(manualItem.price);
        const name = manualItem.name.trim();
        
        if (!name) return toast.error("El concepto no puede estar vacío");
        if (isNaN(price) || price <= 0) return toast.error("Ingresá un precio mayor a 0");

        // Agregamos un item temporal al carrito
        addToCart({
            id: `manual_${Date.now()}`,
            name: name,
            price: price,
            is_manual: true
        });
        setIsManualItemMode(false);
        setManualItem({ name: '', price: '' });
    };

    const removeFromCart = (id: string) => setCart(prev => prev.filter(p => p.id !== id));

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // =========================================================================
    // PROCESAMIENTO DEL COBRO
    // =========================================================================
    const handleCheckout = async () => {
        if (!orgData?.id) return;
        if (cart.length === 0) return toast.error("El carrito está vacío");

        setLoading(true);

        try {
            // 1. Crear la cabecera de la Operación (Ticket principal)
            const { data: op, error: opError } = await supabase
                .from('operations')
                .insert([{
                    organization_id: orgData.id,
                    person_id: selectedPerson?.id || null, 
                    status: 'paid', // Se asume pagado en mostrador
                    total_amount: cartTotal,
                    balance: 0, // No queda deuda
                    metadata: { concept: 'Venta Mostrador' }
                }])
                .select()
                .single();

            if (opError) throw opError;

            // 2. Crear las Líneas del Ticket
            const lines = cart.map(item => ({
                organization_id: orgData.id,
                operation_id: op.id,
                item_id: item.is_manual ? null : item.id, // Ítems manuales no tienen ID real
                quantity: item.quantity,
                unit_price: item.price
            }));

            const { error: linesError } = await supabase.from('operation_lines').insert(lines);
            if (linesError) throw linesError;

            // 3. Crear el Registro de Ingreso en la Caja Diaria (Finanzas)
            let notesText = `Venta Mostrador ${selectedPerson ? `(${selectedPerson.full_name})` : '(Consumidor Final)'}`;
            
            const manualItemsText = cart.filter(i => i.is_manual).map(i => i.name).join(', ');
            if (manualItemsText) {
                notesText += ` | Ítems Libres: ${manualItemsText}`; // Para que quede registro de lo que se vendió libremente
            }

            const { error: ledgerError } = await supabase.from('finance_ledger').insert([{
                organization_id: orgData.id,
                operation_id: op.id,
                person_id: selectedPerson?.id || null,
                type: 'income',
                amount: cartTotal,
                payment_method: paymentMethod,
                processed_at: new Date(),
                notes: notesText
            }]);

            if (ledgerError) throw ledgerError;

            toast.success('¡Venta registrada con éxito!');
            onSuccess(); // Recarga la caja del componente padre
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error('Error al registrar la venta');
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // RENDER: TERMINAL TIPO PUNTO DE VENTA (POS)
    // =========================================================================
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                <div className="fixed inset-0 overflow-hidden">
                    <div className="flex min-h-[100dvh] md:min-h-full items-end md:items-center justify-center p-0 md:p-4">
                        <Dialog.Panel className="w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-5xl transform overflow-hidden bg-slate-50 md:shadow-2xl transition-all flex flex-col md:flex-row md:rounded-3xl animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95">

                            {/* --- PANEL IZQUIERDO: BÚSQUEDA Y RESULTADOS --- */}
                            <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-200">
                                
                                <div className="p-4 md:p-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
                                    <h2 className="text-lg md:text-xl font-black text-slate-800">Terminal de Venta</h2>
                                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-500" /></button>
                                </div>

                                <div className="p-4 md:p-6 shrink-0 relative z-20 bg-slate-50">
                                    {/* Botones Selectores (Catálogo vs Venta Libre) */}
                                    <div className="flex items-center gap-2 mb-4 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                                        <button onClick={() => setIsManualItemMode(false)} className={`flex-1 py-3 px-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${!isManualItemMode ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                                            Catálogo
                                        </button>
                                        <button onClick={() => setIsManualItemMode(true)} className={`flex-1 py-3 px-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isManualItemMode ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                                            <HandCoins className="w-4 h-4" /> Ítem Libre
                                        </button>
                                    </div>

                                    {!isManualItemMode ? (
                                        /* BUSCADOR NORMAL */
                                        <div className="relative shadow-sm rounded-2xl bg-white border border-slate-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all flex items-center overflow-hidden">
                                            <button onClick={() => { setSearchType(searchType === 'products' ? 'person' : 'products'); setSearchTerm(''); setSearchResults([]); }} className={`px-4 py-4 border-r border-slate-100 font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0 ${searchType === 'products' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {searchType === 'products' ? <Search className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                            </button>
                                            <input autoFocus type="text" className="w-full px-4 py-4 outline-none font-medium text-slate-800 bg-transparent text-sm md:text-base" placeholder={searchType === 'products' ? "Buscar planes, servicios..." : "Buscar cliente..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                            {searching && <Loader2 className="w-5 h-5 animate-spin text-brand-500 mr-4 shrink-0" />}
                                        </div>
                                    ) : (
                                        /* INPUTS DE ÍTEM LIBRE */
                                        <form onSubmit={addManualItemToCart} className="bg-white p-4 rounded-2xl border border-brand-200 shadow-md shadow-brand-500/10 flex flex-col gap-3 animate-in fade-in zoom-in-95">
                                            <input type="text" autoFocus required placeholder="Concepto (Ej: Venta Libre)" value={manualItem.name} onChange={e => setManualItem({...manualItem, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 font-bold text-slate-700" />
                                            <div className="flex gap-3">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                    <input type="number" min="1" required placeholder="Precio a cobrar" value={manualItem.price} onChange={e => setManualItem({...manualItem, price: e.target.value})} className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 font-black text-slate-800" />
                                                </div>
                                                <button type="submit" className="bg-brand-600 text-white px-5 rounded-xl font-bold active:scale-95 flex items-center justify-center"><Plus className="w-5 h-5" /></button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Resultados Desplegables */}
                                    {searchResults.length > 0 && !isManualItemMode && (
                                        <div className="absolute top-[calc(100%-10px)] left-4 right-4 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-64 overflow-y-auto z-50 divide-y divide-slate-50">
                                            {searchResults.map(item => (
                                                <button key={item.id} onClick={() => { if (searchType === 'products') { addToCart(item); } else { setSelectedPerson(item); setSearchTerm(''); setSearchResults([]); setSearchType('products'); } }} className="w-full p-4 flex items-center justify-between hover:bg-brand-50 transition-colors text-left group">
                                                    <div>
                                                        <p className="font-bold text-slate-800 group-hover:text-brand-700">{searchType === 'products' ? item.name : item.full_name}</p>
                                                        {searchType === 'person' && <p className="text-xs text-slate-500 font-medium">ID: {item.identifier || '-'}</p>}
                                                    </div>
                                                    {searchType === 'products' ? <span className="font-black text-brand-600">${item.price.toLocaleString()}</span> : <UserPlus className="w-5 h-5 text-slate-300 group-hover:text-brand-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 opacity-50 p-6">
                                    <div className="text-center">
                                        <ShoppingCart className="w-16 h-16 mb-4 mx-auto opacity-20" />
                                        <p className="font-bold">Buscá un ítem del sistema <br/> o cargalo manualmente.</p>
                                    </div>
                                </div>
                            </div>

                            {/* --- PANEL DERECHO: TICKET Y PAGOS --- */}
                            <div className="w-full md:w-[400px] flex flex-col bg-slate-100 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.05)] z-10 relative flex-1 md:flex-none h-full overflow-hidden">
                                
                                {/* Info del Cliente */}
                                <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500"><UserPlus className="w-4 h-4" /></div>
                                        {selectedPerson ? (
                                            <div>
                                                <p className="text-sm font-bold text-brand-700 leading-none">{selectedPerson.full_name}</p>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Cliente Asignado</p>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-bold text-slate-500">Consumidor Final</p>
                                        )}
                                    </div>
                                    {selectedPerson && <button onClick={() => setSelectedPerson(null)} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">Quitar</button>}
                                </div>

                                {/* Items del Ticket */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-32 md:pb-4">
                                    {cart.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 opacity-60">
                                            <p className="text-sm font-bold">El ticket está vacío</p>
                                        </div>
                                    ) : (
                                        cart.map(item => (
                                            <div key={item.id} className={`p-3 rounded-2xl border shadow-sm flex items-center justify-between group ${item.is_manual ? 'bg-amber-50/80 border-amber-200' : 'bg-white border-slate-200'}`}>
                                                <div className="flex-1 pr-2 overflow-hidden">
                                                    <p className="font-bold text-slate-800 text-sm truncate flex items-center gap-2">
                                                        {item.name} {item.is_manual && <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 text-[8px] uppercase tracking-widest font-black">Libre</span>}
                                                    </p>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5">{item.quantity} x ${item.price.toLocaleString()}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="font-black text-slate-800">${(item.price * item.quantity).toLocaleString()}</span>
                                                    <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Botonera de Cobro (Siempre Visible Abajo) */}
                                <div className="absolute md:relative bottom-0 left-0 right-0 p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)] shrink-0 z-20">
                                    <div className="flex justify-between items-end mb-4">
                                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Total</span>
                                        <span className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">${cartTotal.toLocaleString()}</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <button onClick={() => setPaymentMethod('cash')} className={`py-2 md:py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                            <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider">Efectivo</span>
                                        </button>
                                        <button onClick={() => setPaymentMethod('card')} className={`py-2 md:py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                            <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider">Tarjeta</span>
                                        </button>
                                        <button onClick={() => setPaymentMethod('mercadopago')} className={`py-2 md:py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'mercadopago' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                            <SmartphoneNfc className="w-4 h-4 md:w-5 md:h-5" />
                                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider">Transf.</span>
                                        </button>
                                    </div>

                                    <button onClick={handleCheckout} disabled={loading || cart.length === 0} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-xl shadow-slate-900/20">
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />} Cobrar Ticket
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