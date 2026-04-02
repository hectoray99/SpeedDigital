import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom'; // <-- Magia para que el modal cubra todo
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Wallet, Lock, Unlock, ArrowDownToLine, ArrowUpFromLine, Loader2, DollarSign, ReceiptText, TrendingUp, TrendingDown, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function CashRegister() {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [movements, setMovements] = useState<any[]>([]);
    
    // Estados para Apertura
    const [isOpening, setIsOpening] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');

    // Estados para Movimientos Manuales
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [movementType, setMovementType] = useState<'income' | 'expense'>('income');
    const [movementAmount, setMovementAmount] = useState('');
    const [movementNotes, setMovementNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Estados para Cierre de Caja
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [closeAmount, setCloseAmount] = useState('');

    useEffect(() => {
        if (orgData?.id) {
            fetchCurrentSession();
        }
    }, [orgData?.id]);

    useEffect(() => {
        if (activeSession) {
            fetchMovements();
        }
    }, [activeSession]);

    async function fetchCurrentSession() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('cash_sessions')
                .select('*')
                .eq('organization_id', orgData.id)
                .eq('status', 'open')
                .order('opened_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            setActiveSession(data || null);
        } catch (error) {
            console.error('Error:', error);
            toast.error("Error al cargar la caja");
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

    const handleOpenRegister = async () => {
        if (!openingAmount || isNaN(Number(openingAmount))) return toast.error("Ingresá un monto válido");
        try {
            const { error } = await supabase
                .from('cash_sessions')
                .insert([{
                    organization_id: orgData.id,
                    opening_amount: Number(openingAmount),
                    status: 'open'
                }]);
            if (error) throw error;
            toast.success("¡Caja abierta con éxito!");
            setIsOpening(false);
            setOpeningAmount('');
            fetchCurrentSession();
        } catch (error) {
            toast.error("No se pudo abrir la caja");
        }
    };

    const handleManualMovement = async () => {
        if (!movementAmount || isNaN(Number(movementAmount))) return toast.error("Monto inválido");
        if (!movementNotes.trim()) return toast.error("Debes poner un motivo");

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('finance_ledger')
                .insert([{
                    organization_id: orgData.id,
                    type: movementType,
                    amount: Number(movementAmount),
                    payment_method: 'cash',
                    notes: movementNotes.trim()
                }]);

            if (error) throw error;

            toast.success(movementType === 'income' ? "Ingreso registrado" : "Gasto registrado");
            setIsMovementModalOpen(false);
            setMovementAmount('');
            setMovementNotes('');
            fetchMovements(); 
        } catch (error) {
            toast.error("Error al registrar movimiento");
        } finally {
            setIsSaving(false);
        }
    };

    // --- MATEMÁTICAS ---
    const totalIncome = movements.filter(m => m.type === 'income').reduce((acc, m) => acc + Number(m.amount), 0);
    const totalExpense = movements.filter(m => m.type === 'expense').reduce((acc, m) => acc + Number(m.amount), 0);
    const expectedTotal = activeSession ? Number(activeSession.opening_amount) + totalIncome - totalExpense : 0;

    // --- FUNCIÓN DE CIERRE DE CAJA ---
    const handleCloseRegister = async () => {
        if (!closeAmount || isNaN(Number(closeAmount))) return toast.error("Ingresá el dinero real en caja");

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('cash_sessions')
                .update({
                    status: 'closed',
                    closing_expected_amount: expectedTotal,
                    closing_real_amount: Number(closeAmount),
                    closed_at: new Date().toISOString()
                })
                .eq('id', activeSession.id);

            if (error) throw error;

            toast.success("¡Turno cerrado con éxito!");
            setIsCloseModalOpen(false);
            setCloseAmount('');
            setActiveSession(null); // Regresa a la vista de caja cerrada
            setMovements([]);
        } catch (error) {
            console.error(error);
            toast.error("Error al cerrar la caja");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

    if (!activeSession) {
        return (
            <div className="max-w-2xl mx-auto mt-10">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-10 h-10 text-slate-400" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-2">Caja Cerrada</h1>
                    <p className="text-slate-500 mb-8">Abrí la caja para empezar a cobrar comandas y registrar movimientos.</p>
                    
                    {isOpening ? (
                        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4">
                            <label className="block text-left text-sm font-bold text-slate-700 mb-2">Monto inicial en caja</label>
                            <div className="relative mb-4">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input type="number" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="Ej: 50000" autoFocus className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-bold text-lg outline-none" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsOpening(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                                <button onClick={handleOpenRegister} className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all">Abrir Turno</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setIsOpening(true)} className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 rounded-xl font-black text-lg shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2 hover:scale-105">
                            <Unlock className="w-6 h-6" /> Abrir Caja
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-2">
                        <Wallet className="w-8 h-8 text-brand-500" /> Control de Caja
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Turno iniciado a las {new Date(activeSession.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                </div>
                <button onClick={() => setIsCloseModalOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2">
                    <Lock className="w-5 h-5" /> Cerrar Turno
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-300"></div>
                    <p className="text-slate-500 font-bold text-sm mb-2">Fondo de Caja (Apertura)</p>
                    <p className="text-3xl font-black text-slate-800">${Number(activeSession.opening_amount).toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400"></div>
                    <p className="text-slate-500 font-bold text-sm mb-2">Ingresos (Ventas/Manual)</p>
                    <p className="text-3xl font-black text-emerald-600">${totalIncome.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden text-white">
                    <div className="absolute top-0 left-0 w-full h-1 bg-brand-500"></div>
                    <p className="text-slate-400 font-bold text-sm mb-2">Total Esperado en Cajón</p>
                    <p className="text-4xl font-black text-white">${expectedTotal.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2"><ReceiptText className="w-5 h-5 text-slate-400" /> Últimos Movimientos</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {movements.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400"><p>No hay movimientos en este turno.</p></div>
                        ) : (
                            <div className="space-y-1">
                                {movements.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${m.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                {m.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 leading-tight">{m.notes}</p>
                                                <p className="text-xs text-slate-500 font-medium">{new Date(m.processed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • <span className="uppercase ml-1 bg-slate-100 px-1.5 py-0.5 rounded">{m.payment_method}</span></p>
                                            </div>
                                        </div>
                                        <p className={`font-black text-lg ${m.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{m.type === 'income' ? '+' : '-'}${Number(m.amount).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <button onClick={() => { setMovementType('income'); setIsMovementModalOpen(true); }} className="w-full bg-white border border-emerald-200 hover:border-emerald-400 p-4 rounded-2xl shadow-sm transition-all flex items-center gap-4 group">
                        <div className="bg-emerald-100 text-emerald-600 p-3 rounded-xl group-hover:scale-110 transition-transform"><ArrowDownToLine className="w-6 h-6" /></div>
                        <div className="text-left"><h3 className="font-bold text-slate-800 text-lg">Ingreso Manual</h3><p className="text-xs text-slate-500">Registrar un cobro o saldo a favor</p></div>
                    </button>

                    <button onClick={() => { setMovementType('expense'); setIsMovementModalOpen(true); }} className="w-full bg-white border border-red-200 hover:border-red-400 p-4 rounded-2xl shadow-sm transition-all flex items-center gap-4 group">
                        <div className="bg-red-100 text-red-600 p-3 rounded-xl group-hover:scale-110 transition-transform"><ArrowUpFromLine className="w-6 h-6" /></div>
                        <div className="text-left"><h3 className="font-bold text-slate-800 text-lg">Retiro / Gasto</h3><p className="text-xs text-slate-500">Proveedores, adelantos, limpieza</p></div>
                    </button>
                </div>
            </div>

            {/* --- PORTALS: Modales que cubren toda la pantalla --- */}
            
            {isMovementModalOpen && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                {movementType === 'income' ? <><TrendingUp className="text-emerald-500" /> Nuevo Ingreso</> : <><TrendingDown className="text-red-500" /> Registrar Gasto</>}
                            </h2>
                            <button onClick={() => setIsMovementModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Monto del {movementType === 'income' ? 'Ingreso' : 'Gasto'}</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input type="number" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} placeholder="0.00" autoFocus className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-bold text-xl outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Descripción / Motivo</label>
                                <textarea value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} placeholder={movementType === 'income' ? 'Ej: Saldo inicial extra...' : 'Ej: Pago de panadería...'} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 resize-none h-24 font-medium" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setIsMovementModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                                <button onClick={handleManualMovement} disabled={isSaving} className={`flex-1 py-4 rounded-2xl font-black text-white shadow-lg transition-all ${movementType === 'income' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'}`}>
                                    {isSaving ? "Guardando..." : "Confirmar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isCloseModalOpen && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Lock className="text-slate-800" /> Cerrar Turno
                            </h2>
                            <button onClick={() => setIsCloseModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col items-center justify-center">
                                <p className="text-slate-400 font-bold text-sm">El sistema calculó que debe haber:</p>
                                <p className="text-4xl font-black mt-1">${expectedTotal.toLocaleString()}</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1 items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Dinero real contado (Efectivo físico)
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input type="number" value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)} placeholder="Ej: 110000" autoFocus className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-bold text-xl outline-none" />
                                </div>
                                <p className="text-xs text-slate-500 mt-2 text-center">Al confirmar, el turno se cerrará y no podrás agregar más movimientos.</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setIsCloseModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                                <button onClick={handleCloseRegister} disabled={isSaving} className="flex-1 py-4 rounded-2xl font-black text-white bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-900/20 transition-all">
                                    {isSaving ? "Cerrando..." : "Cerrar Caja"}
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