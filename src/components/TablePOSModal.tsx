import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase'; // <-- FIX PATH
import { useAuthStore } from '../store/authStore'; // <-- FIX PATH
import { X, Search, Plus, Minus, MessageSquare, UtensilsCrossed, Send, Receipt, Banknote, CreditCard, SmartphoneNfc, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TablePOSModalProps {
    isOpen: boolean;
    onClose: () => void;
    table: any;
}

interface CartItem {
    cartItemId: string; 
    product: any;
    quantity: number;
    note: string;
}

export default function TablePOSModal({ isOpen, onClose, table }: TablePOSModalProps) {
    const { orgData } = useAuthStore();
    
    // Estados del Catálogo
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('Todas');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Estados del Pedido Activo
    const [cart, setCart] = useState<CartItem[]>([]);
    const [existingItems, setExistingItems] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Estados de Sub-Modales
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
    const [currentNoteText, setCurrentNoteText] = useState('');
    
    // --- ESTADOS DE PAGO Y PROPINA ---
    const [isCheckout, setIsCheckout] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [tipAmount, setTipAmount] = useState(''); 

    useEffect(() => {
        if (isOpen && orgData?.id) {
            fetchMenu();
            setCart([]);
            setActiveCategory('Todas');
            setSearch('');
            setNoteModalOpen(false);
            setIsCheckout(false);
            setTipAmount('');

            if (table?.activeOrder) {
                fetchExistingItems();
            } else {
                setExistingItems([]);
            }
        }
    }, [isOpen, orgData?.id, table]);

    async function fetchExistingItems() {
        try {
            const { data, error } = await supabase
                .from('operation_lines')
                .select('*, catalog_items(name)')
                .eq('operation_id', table.activeOrder.id);
            if (error) throw error;
            setExistingItems(data || []);
        } catch (error) {
            console.error("Error al cargar ticket:", error);
        }
    }

    async function fetchMenu() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .eq('organization_id', orgData!.id)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setProducts(data || []);
            
            const uniqueCategories = Array.from(new Set((data || []).map(p => p.properties?.category).filter(Boolean))) as string[];
            setCategories(['Todas', ...uniqueCategories]);
        } catch (error) {
            toast.error("Error al cargar el menú");
        } finally {
            setLoading(false);
        }
    }

    const addToCart = (product: any) => {
        setCart(prev => {
            const existingIndex = prev.findIndex(item => item.product.id === product.id && !item.note);
            if (existingIndex >= 0) {
                const newCart = [...prev];
                newCart[existingIndex].quantity++;
                return newCart;
            }
            return [...prev, { cartItemId: crypto.randomUUID(), product, quantity: 1, note: '' }];
        });
    };

    const updateQuantity = (cartItemId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartItemId === cartItemId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeItem = (cartItemId: string) => {
        setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    };

    const openNoteModal = (cartItemId: string) => {
        const item = cart.find(i => i.cartItemId === cartItemId);
        if (item) {
            setSelectedCartItemId(cartItemId);
            setCurrentNoteText(item.note || '');
            setNoteModalOpen(true);
        }
    };

    const saveNote = () => {
        if (!selectedCartItemId) return;
        setCart(prev => {
            const newCart = [...prev];
            const itemIndex = newCart.findIndex(i => i.cartItemId === selectedCartItemId);
            const item = newCart[itemIndex];
            const trimmedNote = currentNoteText.trim();
            
            if (item.quantity > 1 && trimmedNote !== item.note) {
                newCart[itemIndex].quantity--;
                newCart.push({ cartItemId: crypto.randomUUID(), product: item.product, quantity: 1, note: trimmedNote });
            } else {
                newCart[itemIndex].note = trimmedNote;
            }
            return newCart;
        });
        setNoteModalOpen(false);
    };

    const sendToKitchen = async () => {
        if (cart.length === 0) return toast.error("La comanda está vacía");
        setIsSaving(true);
        try {
            const newCartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
            let currentOperationId = table?.activeOrder?.id;

            if (!currentOperationId) {
                const { data: operation, error: opError } = await supabase
                    .from('operations')
                    .insert([{
                        organization_id: orgData!.id,
                        status: 'pending', 
                        total_amount: newCartTotal,
                        metadata: { table_id: table.id, table_name: table.name }
                    }])
                    .select().single();
                if (opError) throw opError;
                currentOperationId = operation.id;
            } else {
                const updatedTotal = table.activeOrder.total_amount + newCartTotal;
                await supabase.from('operations').update({ total_amount: updatedTotal }).eq('id', currentOperationId);
            }

            const lines = cart.map(item => ({
                organization_id: orgData!.id,
                operation_id: currentOperationId,
                item_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.price,
                notes: item.note || null
            }));

            const { error: linesError } = await supabase.from('operation_lines').insert(lines);
            if (linesError) throw linesError;

            toast.success("¡Enviado a cocina!");
            onClose();
        } catch (error) {
            toast.error("Error al enviar comanda");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCheckout = async () => {
        setIsSaving(true);
        try {
            const finalTotal = table.activeOrder.total_amount;
            const tip = Number(tipAmount) || 0;

            const { error: opError } = await supabase
                .from('operations')
                .update({ status: 'paid', balance: 0 })
                .eq('id', table.activeOrder.id);
            if (opError) throw opError;

            // 1. Ingreso Base de la Mesa
            const { error: financeError } = await supabase
                .from('finance_ledger')
                .insert([{
                    organization_id: orgData!.id,
                    operation_id: table.activeOrder.id,
                    type: 'income',
                    amount: finalTotal,
                    payment_method: paymentMethod,
                    notes: `Cobro de ${table.name}`
                }]);
            if (financeError) throw financeError;

            // 2. Ingreso de la Propina (Separada para el Tronco)
            if (tip > 0) {
                await supabase.from('finance_ledger').insert([{
                    organization_id: orgData!.id,
                    operation_id: table.activeOrder.id,
                    type: 'income',
                    amount: tip,
                    payment_method: paymentMethod,
                    notes: 'PROPINA_TRONCO'
                }]);
            }

            toast.success("¡Mesa Cobrada con Éxito!");
            onClose();
        } catch (error) {
            toast.error("Error al cobrar la mesa");
        } finally {
            setIsSaving(false);
        }
    };

    // FIX: (p: any) para que TypeScript sepa que es dinámico
    const filteredProducts = products.filter((p: any) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = activeCategory === 'Todas' || p.properties?.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const newCartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const existingTotal = table?.activeOrder?.total_amount || 0;
    const finalTotal = existingTotal + newCartTotal;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99990]" onClose={() => !isSaving && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-hidden">
                    <div className="flex min-h-[100dvh] md:min-h-full items-end md:items-center justify-center p-0 md:p-4">
                        <Dialog.Panel className="w-full md:max-w-6xl h-[95vh] md:h-[85vh] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row transform transition-all animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95">
                            
                            {/* --- PANEL IZQUIERDO --- */}
                            <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-r md:border-b-0 border-slate-200 flex flex-col h-1/2 md:h-full z-20">
                                <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0 shadow-sm">
                                    <div>
                                        <Dialog.Title as="h2" className="text-xl font-black">{table?.name}</Dialog.Title>
                                        <p className="text-xs text-slate-400 font-medium tracking-wide">
                                            {table?.activeOrder ? 'Mesa Ocupada' : `Capacidad: ${table?.capacity} personas`}
                                        </p>
                                    </div>
                                    <button onClick={onClose} disabled={isSaving} className="p-2 bg-slate-800 hover:bg-red-500 hover:text-white rounded-xl transition-colors disabled:opacity-50">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar pb-32 md:pb-4">
                                    {existingItems.map((item, idx) => (
                                        <div key={`exist_${idx}`} className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col gap-1 opacity-70">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 pr-2">
                                                    <p className="font-bold text-slate-600 leading-tight">{item.catalog_items?.name || 'Ítem'}</p>
                                                    <p className="text-slate-500 font-bold text-sm">${(item.unit_price * item.quantity).toLocaleString()}</p>
                                                </div>
                                                <span className="font-black text-slate-400 bg-slate-100 px-2 py-1 rounded text-xs">{item.quantity}x</span>
                                            </div>
                                            {item.notes && <p className="text-xs font-bold text-slate-500 italic mt-1">* {item.notes}</p>}
                                        </div>
                                    ))}

                                    {existingItems.length > 0 && cart.length > 0 && (
                                        <div className="flex items-center gap-2 py-2">
                                            <div className="h-px bg-slate-200 flex-1"></div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nuevos Platos</span>
                                            <div className="h-px bg-slate-200 flex-1"></div>
                                        </div>
                                    )}

                                    {cart.length === 0 && existingItems.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <UtensilsCrossed className="w-12 h-12 mb-2 opacity-50" />
                                            <p className="font-bold">La mesa está vacía</p>
                                        </div>
                                    ) : (
                                        cart.map((item) => (
                                            <div key={item.cartItemId} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 border-l-4 border-l-brand-400">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 pr-2">
                                                        <p className="font-bold text-slate-800 leading-tight">{item.product.name}</p>
                                                        <p className="text-brand-600 font-black text-sm">${(item.product.price * item.quantity).toLocaleString()}</p>
                                                        {item.note && (
                                                            <p className="text-xs font-bold text-orange-600 bg-orange-50 p-1.5 rounded border border-orange-100 mt-1 inline-block">Nota: {item.note}</p>
                                                        )}
                                                    </div>
                                                    <button onClick={() => openNoteModal(item.cartItemId)} disabled={isSaving} className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${item.note ? 'text-orange-500 bg-orange-50' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`}>
                                                        <MessageSquare className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                                                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                                        <button onClick={() => item.quantity > 1 ? updateQuantity(item.cartItemId, -1) : removeItem(item.cartItemId)} disabled={isSaving} className="p-1.5 hover:bg-white rounded-md text-slate-600 disabled:opacity-50"><Minus className="w-4 h-4" /></button>
                                                        <span className="w-8 text-center font-bold text-sm text-slate-800">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item.cartItemId, 1)} disabled={isSaving} className="p-1.5 hover:bg-white rounded-md text-slate-600 disabled:opacity-50"><Plus className="w-4 h-4" /></button>
                                                    </div>
                                                    <button onClick={() => removeItem(item.cartItemId)} disabled={isSaving} className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">Quitar</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="absolute md:relative bottom-0 left-0 w-full p-4 md:p-5 bg-white border-t border-slate-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] shrink-0 z-30">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Total Mesa</span>
                                        <span className="text-3xl font-black text-slate-800 tracking-tight">${finalTotal.toLocaleString()}</span>
                                    </div>
                                    
                                    {cart.length > 0 ? (
                                        <button onClick={sendToKitchen} disabled={isSaving} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50 text-lg">
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Enviar a Cocina
                                        </button>
                                    ) : table?.activeOrder ? (
                                        <button onClick={() => setIsCheckout(true)} disabled={isSaving} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50 text-lg">
                                            <Receipt className="w-5 h-5" /> Cobrar Mesa
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            {/* --- PANEL DERECHO --- */}
                            <div className="w-full md:w-2/3 bg-slate-100 flex flex-col h-1/2 md:h-full overflow-hidden relative z-10">
                                {!isCheckout ? (
                                    <>
                                        <div className="bg-white p-4 shadow-sm z-10 shrink-0">
                                            <div className="relative mb-3">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                                <input type="text" placeholder="Buscar plato o bebida..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white font-medium outline-none transition-all text-slate-800"/>
                                            </div>
                                            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                                                {categories.map(cat => (
                                                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-400/20 ${activeCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                                            {loading ? (
                                                <div className="h-full flex flex-col justify-center items-center text-slate-400 opacity-60 gap-2">
                                                    <Loader2 className="w-8 h-8 animate-spin" /> Cargando menú...
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                                    {filteredProducts.map((product: any) => (
                                                        <button key={product.id} onClick={() => addToCart(product)} disabled={isSaving} className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-brand-400 hover:shadow-md cursor-pointer transition-all active:scale-95 flex flex-col justify-between min-h-[130px] text-left focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50">
                                                            <h3 className="font-bold text-slate-700 leading-tight line-clamp-2 text-sm md:text-base">{product.name}</h3>
                                                            <div className="flex justify-between items-end mt-4 w-full">
                                                                <span className="font-black text-brand-600 text-lg">${product.price.toLocaleString()}</span>
                                                                <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600"><Plus className="w-4 h-4" /></div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    /* --- PANTALLA CHECKOUT Y PROPINA --- */
                                    <div className="flex-1 flex flex-col p-6 md:p-10 bg-slate-50 animate-in fade-in slide-in-from-right-8 duration-300 overflow-y-auto">
                                        <div className="flex items-center gap-4 mb-8">
                                            <button onClick={() => setIsCheckout(false)} className="p-2.5 bg-white rounded-xl shadow-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Finalizar Pago</h2>
                                        </div>

                                        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm text-center mb-8 flex flex-col items-center">
                                            
                                            {/* NUEVO: INPUT DE PROPINA */}
                                            <div className="w-full flex flex-col items-center mb-6 pb-6 border-b border-slate-100">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Agregar Propina (Opcional)</label>
                                                <div className="relative w-48">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">$</span>
                                                    <input 
                                                        type="number" min="0" step="100"
                                                        className="w-full pl-10 pr-4 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/20 text-emerald-800 font-black text-xl transition-all text-center"
                                                        value={tipAmount}
                                                        onChange={e => setTipAmount(e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            <p className="text-slate-500 font-bold mb-2 uppercase tracking-widest text-sm">Total Final a Cobrar</p>
                                            <p className="text-5xl md:text-6xl font-black text-slate-800 tracking-tight">${(finalTotal + (Number(tipAmount) || 0)).toLocaleString()}</p>
                                        </div>

                                        <h3 className="font-bold text-slate-700 mb-4 ml-1">Seleccionar Método de Pago</h3>
                                        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-auto">
                                            <button onClick={() => setPaymentMethod('cash')} className={`p-4 md:p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 md:gap-3 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md scale-105' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>
                                                <Banknote className="w-6 h-6 md:w-8 md:h-8" />
                                                <span className="font-bold text-xs md:text-sm uppercase tracking-wide">Efectivo</span>
                                            </button>
                                            <button onClick={() => setPaymentMethod('card')} className={`p-4 md:p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 md:gap-3 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-105' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200'}`}>
                                                <CreditCard className="w-6 h-6 md:w-8 md:h-8" />
                                                <span className="font-bold text-xs md:text-sm uppercase tracking-wide">Tarjeta</span>
                                            </button>
                                            <button onClick={() => setPaymentMethod('mercadopago')} className={`p-4 md:p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 md:gap-3 transition-all focus:outline-none focus:ring-4 focus:ring-sky-500/20 ${paymentMethod === 'mercadopago' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-md scale-105' : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200'}`}>
                                                <SmartphoneNfc className="w-6 h-6 md:w-8 md:h-8" />
                                                <span className="font-bold text-xs md:text-sm uppercase tracking-wide text-center">Transf.</span>
                                            </button>
                                        </div>

                                        <button onClick={handleCheckout} disabled={isSaving} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl mt-8 shadow-xl shadow-emerald-500/30 transition-all text-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                                            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Receipt className="w-6 h-6" />} Confirmar Cobro
                                        </button>
                                    </div>
                                )}

                                {/* NOTAS DE COCINA */}
                                <Transition appear show={noteModalOpen} as={Fragment}>
                                    <Dialog as="div" className="relative z-[99999]" onClose={() => setNoteModalOpen(false)}>
                                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />
                                        <div className="fixed inset-0 flex items-center justify-center p-4">
                                            <Dialog.Panel className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                                                <div className="p-6 md:p-8 space-y-4">
                                                    <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                                        <MessageSquare className="w-5 h-5 text-orange-500" /> Nota para cocina
                                                    </Dialog.Title>
                                                    <textarea 
                                                        autoFocus 
                                                        value={currentNoteText} 
                                                        onChange={(e) => setCurrentNoteText(e.target.value)} 
                                                        placeholder="Ej: Sin cebolla, extra mayo, la carne a punto..." 
                                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/20 resize-none h-32 font-medium text-slate-700 transition-all" 
                                                    />
                                                    <div className="flex gap-3 pt-2">
                                                        <button onClick={() => setNoteModalOpen(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                                                        <button onClick={saveNote} className="flex-1 py-3.5 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-500/20 active:scale-95 transition-all">Guardar Nota</button>
                                                    </div>
                                                </div>
                                            </Dialog.Panel>
                                        </div>
                                    </Dialog>
                                </Transition>
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}