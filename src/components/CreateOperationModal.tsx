import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Search, Trash2, Check, UserPlus, CreditCard, Banknote, SmartphoneNfc, Plus, HandCoins, PackageOpen } from 'lucide-react';
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
            setSearchType('products');
            setIsManualItemMode(false);
            setManualItem({ name: '', price: '' });
        }
    }, [isOpen]);

    // Buscador Inteligente: Carga inicial y filtrado dinámico
    useEffect(() => {
        if (!isOpen) return; // Solo buscar si el modal está abierto

        const timer = setTimeout(async () => {
            if (!orgData?.id) return;
            if (isManualItemMode) return;

            setSearching(true);
            try {
                if (searchType === 'products') {
                    let query = supabase
                        .from('catalog_items')
                        .select('*')
                        .eq('organization_id', orgData.id)
                        .eq('is_active', true)
                        .order('name', { ascending: true }); // Orden alfabético

                    // Si hay búsqueda, filtramos. Si no, mostramos los primeros 50 ítems (Catálogo visual)
                    if (searchTerm.trim().length > 0) {
                        query = query.ilike('name', `%${searchTerm}%`);
                    } else {
                        query = query.limit(50);
                    }
                    
                    const { data } = await query;
                    setSearchResults(data || []);
                } else {
                    let query = supabase
                        .from('crm_people')
                        .select('id, full_name, identifier')
                        .eq('organization_id', orgData.id)
                        .order('full_name', { ascending: true });

                    if (searchTerm.trim().length > 0) {
                        query = query.ilike('full_name', `%${searchTerm}%`);
                    } else {
                        query = query.limit(30);
                    }
                    
                    const { data } = await query;
                    setSearchResults(data || []);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setSearching(false);
            }
        }, 300); // 300ms de retraso (Debounce)

        return () => clearTimeout(timer);
    }, [searchTerm, searchType, orgData?.id, isManualItemMode, isOpen]);

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
        // No borramos la búsqueda para que el cajero pueda seguir sumando botones rápidamente
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
                <div className="fixed inset-0 overflow-hidden flex justify-center items-center p-0 md:p-4">
                    
                    <Dialog.Panel className="w-full h-[100dvh] md:h-[90vh] md:max-w-[1200px] transform overflow-hidden bg-slate-50 md:shadow-2xl transition-all flex flex-col md:flex-row md:rounded-3xl animate-in zoom-in-95">

                        {/* --- PANEL IZQUIERDO: CATÁLOGO DE BOTONES --- */}
                        <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden">
                            
                            <div className="p-4 md:p-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
                                <h2 className="text-lg md:text-xl font-black text-slate-800">Terminal de Venta (POS)</h2>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-500" /></button>
                            </div>

                            <div className="p-4 md:p-5 shrink-0 bg-white border-b border-slate-100 z-10 shadow-sm">
                                {/* Botones Selectores (Catálogo vs Venta Libre) */}
                                <div className="flex items-center gap-2 mb-4 bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-inner">
                                    <button onClick={() => { setIsManualItemMode(false); setSearchType('products'); }} className={`flex-1 py-3 px-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${!isManualItemMode && searchType === 'products' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                                        <PackageOpen className="w-4 h-4" /> Catálogo
                                    </button>
                                    <button onClick={() => { setIsManualItemMode(false); setSearchType('person'); }} className={`flex-1 py-3 px-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${!isManualItemMode && searchType === 'person' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                                        <UserPlus className="w-4 h-4" /> Cliente
                                    </button>
                                    <button onClick={() => setIsManualItemMode(true)} className={`flex-1 py-3 px-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isManualItemMode ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                                        <HandCoins className="w-4 h-4" /> Libre
                                    </button>
                                </div>

                                {!isManualItemMode ? (
                                    /* BUSCADOR NORMAL */
                                    <div className="relative shadow-sm rounded-2xl bg-slate-50 border border-slate-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all flex items-center overflow-hidden">
                                        <div className="pl-4 pr-2 py-4 text-slate-400 shrink-0">
                                            <Search className="w-5 h-5" />
                                        </div>
                                        <input autoFocus type="text" className="w-full pr-4 py-4 outline-none font-medium text-slate-800 bg-transparent text-sm md:text-base" placeholder={searchType === 'products' ? "Buscar producto o servicio..." : "Buscar cliente por nombre..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                        {searching && <Loader2 className="w-5 h-5 animate-spin text-brand-500 mr-4 shrink-0" />}
                                    </div>
                                ) : (
                                    /* INPUTS DE ÍTEM LIBRE */
                                    <form onSubmit={addManualItemToCart} className="flex flex-col gap-3 animate-in fade-in zoom-in-95">
                                        <input type="text" autoFocus required placeholder="Concepto (Ej: Venta Libre, Recargo...)" value={manualItem.name} onChange={e => setManualItem({...manualItem, name: e.target.value})} className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-slate-800 font-bold text-slate-700 shadow-sm" />
                                        <div className="flex gap-3">
                                            <div className="relative flex-1">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                <input type="number" min="1" required placeholder="Precio a cobrar" value={manualItem.price} onChange={e => setManualItem({...manualItem, price: e.target.value})} className="w-full pl-8 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-slate-800 font-black text-slate-800 shadow-sm" />
                                            </div>
                                            <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white px-6 rounded-2xl font-bold active:scale-95 flex items-center justify-center shadow-lg"><Plus className="w-6 h-6" /></button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            {/* ZONA DE RESULTADOS (GRILLA DE BOTONES) */}
                            {!isManualItemMode && (
                                <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-slate-50/50 hide-scrollbar">
                                    {searching && searchResults.length === 0 ? (
                                        <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                                    ) : searchResults.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                            {searchResults.map(item => (
                                                <button 
                                                    key={item.id} 
                                                    onClick={() => { 
                                                        if (searchType === 'products') { 
                                                            addToCart(item); 
                                                        } else { 
                                                            setSelectedPerson(item); 
                                                            setSearchType('products'); 
                                                            setSearchTerm(''); 
                                                        } 
                                                    }} 
                                                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group active:scale-95 min-h-[100px]"
                                                >
                                                    <span className="font-bold text-slate-700 group-hover:text-brand-700 leading-tight text-sm line-clamp-3">
                                                        {searchType === 'products' ? item.name : item.full_name}
                                                    </span>
                                                    {searchType === 'products' ? (
                                                        <span className="font-black text-brand-600 text-lg">${item.price.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                                                            {item.identifier || 'Sin DNI'}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                            {searchType === 'products' ? <PackageOpen className="w-16 h-16 mb-4 opacity-20" /> : <UserPlus className="w-16 h-16 mb-4 opacity-20" />}
                                            <p className="font-bold text-center">No se encontraron resultados.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* --- PANEL DERECHO: TICKET Y PAGOS --- */}
                        <div className="w-full md:w-[400px] flex flex-col bg-slate-100 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.05)] z-10 relative flex-1 md:flex-none h-full overflow-hidden">
                            
                            {/* Info del Cliente */}
                            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><UserPlus className="w-5 h-5" /></div>
                                    {selectedPerson ? (
                                        <div>
                                            <p className="text-sm font-black text-indigo-700 leading-none">{selectedPerson.full_name}</p>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-1">Cliente Asignado al Ticket</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm font-black text-slate-600 leading-none">Consumidor Final</p>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-1">Ticket Anónimo</p>
                                        </div>
                                    )}
                                </div>
                                {selectedPerson && <button onClick={() => setSelectedPerson(null)} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-colors">Quitar</button>}
                            </div>

                            {/* Items del Ticket */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-32 md:pb-4 hide-scrollbar bg-slate-100/50">
                                {cart.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 opacity-60">
                                        <p className="text-sm font-bold uppercase tracking-widest">El ticket está vacío</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className={`p-3.5 rounded-2xl shadow-sm flex items-center justify-between group animate-in slide-in-from-right-2 duration-200 border ${item.is_manual ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                                            <div className="flex-1 pr-3 overflow-hidden">
                                                <p className="font-black text-slate-800 text-sm truncate flex items-center gap-2">
                                                    {item.name} {item.is_manual && <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 text-[8px] uppercase tracking-widest font-black">Libre</span>}
                                                </p>
                                                <p className="text-xs text-slate-500 font-bold mt-1 bg-slate-100 w-fit px-2 py-0.5 rounded-md border border-slate-200">{item.quantity} x ${item.price.toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="font-black text-slate-800 text-base">${(item.price * item.quantity).toLocaleString()}</span>
                                                <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Botonera de Cobro (Siempre Visible Abajo) */}
                            <div className="absolute md:relative bottom-0 left-0 right-0 p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.1)] shrink-0 z-20">
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-slate-400 font-black uppercase tracking-widest text-xs">Total a Pagar</span>
                                    <span className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">${cartTotal.toLocaleString()}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <button onClick={() => setPaymentMethod('cash')} className={`py-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                        <Banknote className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Efectivo</span>
                                    </button>
                                    <button onClick={() => setPaymentMethod('card')} className={`py-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                        <CreditCard className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Tarjeta</span>
                                    </button>
                                    <button onClick={() => setPaymentMethod('mercadopago')} className={`py-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === 'mercadopago' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                        <SmartphoneNfc className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Transf.</span>
                                    </button>
                                </div>

                                <button onClick={handleCheckout} disabled={loading || cart.length === 0} className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-xl shadow-brand-500/30 border-b-4 border-brand-800">
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />} Facturar Venta
                                </button>
                            </div>
                        </div>

                    </Dialog.Panel>
                </div>
            </Dialog>
        </Transition>
    );
}