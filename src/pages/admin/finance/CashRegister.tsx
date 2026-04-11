import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Wallet, Lock, Unlock, ArrowUpFromLine, Loader2, DollarSign, ReceiptText, TrendingUp, TrendingDown, X, AlertTriangle, ShoppingCart, Scale, Info } from 'lucide-react';
import { toast } from 'sonner';

import CreateOperationModal from '../../../components/CreateOperationModal'; 

export default function CashRegister() {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(true);
    
    // --- ESTADOS PRINCIPALES ---
    const [activeSession, setActiveSession] = useState<any>(null);
    const [movements, setMovements] = useState<any[]>([]);
    
    // --- ESTADOS DE CONTROL DE CAJA ---
    const [isOpening, setIsOpening] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');
    const [lastClosingAmount, setLastClosingAmount] = useState<number | null>(null);

    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [closeAmount, setCloseAmount] = useState('');

    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false); 
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false); 
    const [movementAmount, setMovementAmount] = useState('');
    const [movementNotes, setMovementNotes] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);

    // =========================================================================
    // INICIALIZACIÓN
    // =========================================================================
    useEffect(() => {
        if (orgData?.id) fetchCurrentSession();
    }, [orgData?.id]);

    useEffect(() => {
        if (activeSession) fetchMovements();
    }, [activeSession]);

    async function fetchCurrentSession() {
        try {
            setLoading(true);
            // 1. Buscamos si hay un turno abierto
            const { data: openSession } = await supabase
                .from('cash_sessions')
                .select('*')
                .eq('organization_id', orgData.id)
                .eq('status', 'open')
                .order('opened_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (openSession) {
                setActiveSession(openSession);
            } else {
                // 2. Si NO hay turno abierto, buscamos el último CERRADO para precargar el monto
                const { data: lastSession } = await supabase
                    .from('cash_sessions')
                    .select('closing_real_amount')
                    .eq('organization_id', orgData.id)
                    .eq('status', 'closed')
                    .order('closed_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastSession) {
                    setLastClosingAmount(lastSession.closing_real_amount);
                    setOpeningAmount(lastSession.closing_real_amount.toString());
                } else {
                    setOpeningAmount('0'); // Primer día de uso de la app
                }
                setActiveSession(null);
            }
        } catch (error) {
            toast.error("Error al consultar el estado de la caja.");
        } finally {
            setLoading(false);
        }
    }

    async function fetchMovements() {
        try {
            const { data, error } = await supabase
                .from('finance_ledger')
                .select('*')
                .eq('organization_id', orgData.id)
                .gte('processed_at', activeSession.opened_at)
                .order('processed_at', { ascending: false });

            if (error) throw error;
            setMovements(data || []);
        } catch (error) {
            console.error('Error fetching movements:', error);
        }
    }

    // =========================================================================
    // LÓGICA DE NEGOCIO: APERTURA, RETIROS Y CIERRE (ARQUEO)
    // =========================================================================
    const handleOpenRegister = async () => {
        const amount = Number(openingAmount);
        
        // Validaciones estrictas anti-rotura
        if (openingAmount === '' || isNaN(amount)) return toast.error("Ingresá un monto válido.");
        if (amount < 0) return toast.error("El monto inicial no puede ser negativo.");
        if (amount > 99999999) return toast.error("El monto excede el límite permitido por el sistema.");

        try {
            setIsSaving(true);
            const { error } = await supabase.from('cash_sessions').insert([{
                organization_id: orgData.id,
                opening_amount: amount,
                status: 'open'
            }]);
            
            if (error) throw error;
            
            toast.success("¡Turno abierto exitosamente!");
            setIsOpening(false);
            fetchCurrentSession();
        } catch (error) {
            toast.error("Error crítico: No se pudo abrir la caja.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleExpenseMovement = async () => {
        const amount = Number(movementAmount);
        
        // Validaciones de retiro
        if (!movementAmount || isNaN(amount)) return toast.error("Monto inválido.");
        if (amount <= 0) return toast.error("El retiro debe ser mayor a 0.");
        if (amount > 99999999) return toast.error("Monto fuera del rango permitido.");
        if (!movementNotes.trim()) return toast.error("La justificación es obligatoria para el arqueo.");

        setIsSaving(true);
        try {
            const { error } = await supabase.from('finance_ledger').insert([{
                organization_id: orgData.id,
                type: 'expense',
                amount: amount,
                payment_method: 'cash',
                notes: movementNotes.trim()
            }]);
            
            if (error) throw error;

            toast.success("Retiro registrado en la caja diaria.");
            setIsMovementModalOpen(false);
            setMovementAmount('');
            setMovementNotes('');
            fetchMovements(); 
        } catch (error) {
            toast.error("Error al registrar el movimiento en el servidor.");
        } finally {
            setIsSaving(false);
        }
    };

    // Cálculos Dinámicos del Arqueo
    const totalIncome = movements.filter(m => m.type === 'income').reduce((acc, m) => acc + Number(m.amount), 0);
    const totalExpense = movements.filter(m => m.type === 'expense').reduce((acc, m) => acc + Number(m.amount), 0);
    const expectedTotal = activeSession ? Number(activeSession.opening_amount) + totalIncome - totalExpense : 0;

    const handleCloseRegister = async () => {
        const realAmount = Number(closeAmount);
        
        if (closeAmount === '' || isNaN(realAmount)) return toast.error("Debes ingresar el dinero físico contado.");
        if (realAmount < 0) return toast.error("El monto físico no puede ser negativo.");
        if (realAmount > 999999999) return toast.error("Monto fuera de rango.");

        const diff = realAmount - expectedTotal;

        // Confirmación si hay descuadre en la caja (Faltante o Sobrante)
        if (diff !== 0) {
            const msg = diff > 0 
                ? `¡ATENCIÓN! Hay un SOBRANTE de $${diff.toLocaleString()}. El sistema creará un ajuste automático para cuadrar. ¿Confirmar cierre?` 
                : `¡ATENCIÓN! Hay un FALTANTE de $${Math.abs(diff).toLocaleString()}. El sistema creará un ajuste automático para cuadrar. ¿Confirmar cierre?`;
            if (!window.confirm(msg)) return;
        }

        setIsSaving(true);
        try {
            // Generar Movimiento de Ajuste Contable Automático
            if (diff !== 0) {
                await supabase.from('finance_ledger').insert([{
                    organization_id: orgData.id,
                    type: diff > 0 ? 'income' : 'expense',
                    amount: Math.abs(diff),
                    payment_method: 'cash',
                    notes: diff > 0 ? 'Ajuste: Sobrante de Caja al cierre' : 'Ajuste: Faltante de Caja al cierre',
                    processed_at: new Date()
                }]);
            }

            // Cerrar la sesión
            const { error } = await supabase.from('cash_sessions').update({
                status: 'closed',
                closing_expected_amount: expectedTotal,
                closing_real_amount: realAmount,
                closed_at: new Date().toISOString()
            }).eq('id', activeSession.id);

            if (error) throw error;

            toast.success("¡Turno cerrado y arqueado con éxito!");
            setIsCloseModalOpen(false);
            setCloseAmount('');
            fetchCurrentSession(); 
            setMovements([]);
        } catch (error) {
            toast.error("Falla crítica al cerrar la caja.");
        } finally {
            setIsSaving(false);
        }
    };

    // =========================================================================
    // RENDERIZADO
    // =========================================================================
    if (loading) return <div className="p-16 flex flex-col items-center justify-center text-slate-400 animate-in fade-in"><Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" /><p className="font-bold tracking-widest text-sm uppercase">Calculando saldos...</p></div>;

    // --- VISTA 1: CAJA CERRADA ---
    if (!activeSession) {
        return (
            <div className="max-w-2xl mx-auto mt-8 md:mt-16 px-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 text-center flex flex-col items-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-slate-200"></div>
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
                        <Lock className="w-10 h-10 text-slate-300" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Caja Cerrada</h1>
                    
                    {isOpening ? (
                        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 mt-6">
                            {lastClosingAmount !== null && (
                                <div className="mb-6 bg-blue-50 text-blue-700 p-3 rounded-xl text-sm font-medium flex gap-3 text-left">
                                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>La caja del turno anterior se cerró con <b>${lastClosingAmount.toLocaleString()}</b>. Modificalo si hiciste algún retiro/depósito intermedio.</p>
                                </div>
                            )}
                            <label className="block text-left text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Monto Físico Inicial</label>
                            <div className="relative mb-6 shadow-sm rounded-2xl">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                                <input 
                                    type="number" min="0" max="99999999"
                                    value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} 
                                    autoFocus 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 focus:bg-white font-black text-2xl outline-none transition-all text-slate-800" 
                                />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsOpening(false)} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                                <button onClick={handleOpenRegister} disabled={isSaving} className="flex-[2] py-4 rounded-xl font-black text-white bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />} Abrir Turno
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-slate-500 mb-10 font-medium">Abrí el turno verificando el dinero inicial para empezar a cobrar/vender.</p>
                            <button onClick={() => setIsOpening(true)} className="bg-brand-600 hover:bg-brand-500 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl shadow-brand-500/30 transition-all flex items-center gap-3 active:scale-95">
                                <Unlock className="w-6 h-6" /> Iniciar Jornada
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // --- VISTA 2: CAJA ABIERTA (OPERATIVA) ---
    return (
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
            
            {/* Modal para ventas rápidas que no sean de mesas (Ej: Mostrador) */}
            <CreateOperationModal isOpen={isSaleModalOpen} onClose={() => setIsSaleModalOpen(false)} onSuccess={fetchMovements} />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-brand-100 rounded-xl"><Wallet className="w-6 h-6 text-brand-600" /></div> 
                        Control de Caja
                    </h1>
                    <p className="text-slate-500 font-bold text-sm mt-2 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Turno abierto: {new Date(activeSession.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                </div>
                <button onClick={() => setIsCloseModalOpen(true)} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                    <Lock className="w-5 h-5" /> Cerrar Turno
                </button>
            </div>

            {/* Dashboards Rápidos de Caja */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-200 group-hover:bg-slate-300 transition-colors"></div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Fondo Inicial</p>
                    <p className="text-3xl md:text-4xl font-black text-slate-800">${Number(activeSession.opening_amount).toLocaleString()}</p>
                </div>
                
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-400 group-hover:bg-emerald-500 transition-colors"></div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2 flex items-center justify-between">
                        Ingresos <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-black">+{movements.filter(m => m.type === 'income').length}</span>
                    </p>
                    <p className="text-3xl md:text-4xl font-black text-emerald-600">${totalIncome.toLocaleString()}</p>
                </div>
                
                <div className="bg-slate-900 p-6 md:p-8 rounded-3xl shadow-2xl shadow-slate-900/20 flex flex-col justify-between relative overflow-hidden text-white border border-slate-800">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500 rounded-full mix-blend-screen filter blur-[60px] opacity-40"></div>
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-500"></div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2 relative z-10">Esperado en Cajón</p>
                    <p className="text-4xl md:text-5xl font-black text-white relative z-10">${expectedTotal.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                
                {/* Listado de Movimientos del Turno */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px] md:h-[600px]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><ReceiptText className="w-5 h-5 text-slate-400" /> Movimientos del Turno</h2>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded-full">{movements.length} act.</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 hide-scrollbar">
                        {movements.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <ReceiptText className="w-12 h-12 mb-3 opacity-20" />
                                <p className="font-bold">Aún no hay transacciones en este turno.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {movements.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100 group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl shadow-sm border ${m.type === 'income' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-100' : 'bg-red-50 text-red-500 border-red-100 group-hover:bg-red-100'} transition-colors`}>
                                                {m.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 leading-tight text-base">{m.notes}</p>
                                                <p className="text-xs text-slate-400 font-bold mt-1 tracking-wide">{new Date(m.processed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • <span className="uppercase text-slate-500">{m.payment_method}</span></p>
                                            </div>
                                        </div>
                                        <p className={`font-black text-xl px-4 py-2 rounded-xl bg-white border shadow-sm shrink-0 ${m.type === 'income' ? 'text-emerald-600 border-emerald-100' : 'text-red-500 border-red-100'}`}>
                                            {m.type === 'income' ? '+' : '-'}${Number(m.amount).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Botonera de Acciones Rápidas */}
                <div className="space-y-4">
                    <button onClick={() => setIsSaleModalOpen(true)} className="w-full bg-brand-600 hover:bg-brand-500 text-white p-6 rounded-3xl shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center flex-col gap-3 group active:scale-95">
                        <ShoppingCart className="w-12 h-12 group-hover:scale-110 transition-transform" />
                        <div>
                            <h3 className="font-black text-2xl mb-1">Terminal Venta (POS)</h3>
                            <p className="text-brand-200 text-sm font-medium">Facturar en mostrador rápido</p>
                        </div>
                    </button>

                    <button onClick={() => setIsMovementModalOpen(true)} className="w-full bg-white border border-slate-200 hover:border-red-300 p-6 rounded-3xl shadow-sm hover:shadow-md hover:shadow-red-500/10 transition-all flex items-center gap-5 group active:scale-95">
                        <div className="bg-red-50 text-red-500 p-4 rounded-2xl border border-red-100 group-hover:scale-110 transition-transform"><ArrowUpFromLine className="w-8 h-8" /></div>
                        <div className="text-left">
                            <h3 className="font-black text-slate-800 text-xl mb-1">Retirar Efectivo</h3>
                            <p className="text-sm font-medium text-slate-500">Pagos a proveedores / caja chica</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* SUB-MODALES PORTALS (Gasto y Cierre) */}
            {/* ========================================================================= */}

            {/* MODAL DE RETIRO MANUAL */}
            {isMovementModalOpen && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div> Registrar Gasto
                            </h2>
                            <button onClick={() => setIsMovementModalOpen(false)} disabled={isSaving} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="p-6 md:p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Monto Retirado de Caja *</label>
                                <div className="relative shadow-sm rounded-xl">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input type="number" min="0" max="99999999" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} placeholder="0.00" autoFocus className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white font-black text-2xl outline-none transition-all text-slate-800" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Justificación *</label>
                                <textarea value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} placeholder="Ej: Proveedor de pan, artículos de limpieza..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white resize-none h-24 font-bold text-slate-700 transition-all shadow-sm" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setIsMovementModalOpen(false)} disabled={isSaving} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50">Cancelar</button>
                                <button onClick={handleExpenseMovement} disabled={isSaving} className="flex-[2] py-4 rounded-xl font-black text-white shadow-lg transition-all active:scale-95 bg-red-500 hover:bg-red-400 shadow-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Confirmar Retiro"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL DE CIERRE Y ARQUEO */}
            {isCloseModalOpen && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-slate-800 rounded-lg"><Scale className="w-5 h-5 text-white" /></div> Arqueo de Caja
                            </h2>
                            <button onClick={() => setIsCloseModalOpen(false)} disabled={isSaving} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        
                        <div className="p-6 md:p-8 space-y-6">
                            <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2rem] flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500 rounded-full mix-blend-screen filter blur-[40px] opacity-50 pointer-events-none"></div>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest relative z-10">Deberías tener en caja:</p>
                                <p className="text-5xl font-black mt-2 tracking-tight relative z-10">${expectedTotal.toLocaleString()}</p>
                            </div>
                            
                            <div>
                                <label className=" text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Dinero real físico contado
                                </label>
                                <div className="relative shadow-sm rounded-xl">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                                    <input type="number" min="0" max="999999999" value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)} placeholder="Ej: 110000" autoFocus className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 focus:bg-white font-black text-3xl outline-none transition-all text-slate-800" />
                                </div>
                                
                                {closeAmount !== '' && (
                                    <div className={`p-4 rounded-xl mt-4 text-sm font-bold text-center border animate-in fade-in duration-300 ${
                                        Number(closeAmount) - expectedTotal === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                        Number(closeAmount) - expectedTotal > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                        'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                        {Number(closeAmount) - expectedTotal === 0 && '¡Caja cuadrada perfectamente!'}
                                        {Number(closeAmount) - expectedTotal > 0 && `Sobrante de $${(Number(closeAmount) - expectedTotal).toLocaleString()}`}
                                        {Number(closeAmount) - expectedTotal < 0 && `Faltante de $${Math.abs(Number(closeAmount) - expectedTotal).toLocaleString()}`}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button onClick={() => setIsCloseModalOpen(false)} disabled={isSaving} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50">Cancelar</button>
                                <button onClick={handleCloseRegister} disabled={isSaving || !closeAmount} className="flex-[2] py-4 rounded-xl font-black text-white bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Cerrar Turno"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}