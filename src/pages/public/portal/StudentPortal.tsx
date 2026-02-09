import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { LogOut, CheckCircle, AlertTriangle, Calendar, History, Receipt, Lock, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentPortal() {
    const navigate = useNavigate();
    const [session, setSession] = useState<any>(null);

    const [debts, setDebts] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

    useEffect(() => {
        const sessionStr = localStorage.getItem('portal_token');
        if (!sessionStr) {
            navigate('/portal');
            return;
        }
        const sessionData = JSON.parse(sessionStr);
        setSession(sessionData);

        fetchData(sessionData.id);
    }, [navigate]);

    async function fetchData(personId: string) {
        try {
            // 1. Buscar DEUDAS
            const { data: pendingOps } = await supabase
                .from('operations')
                .select('id, total_amount, balance, created_at, metadata')
                .eq('person_id', personId)
                .gt('balance', 0)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: true });

            if (pendingOps) setDebts(pendingOps);

            // 2. Buscar HISTORIAL
            const { data: payments } = await supabase
                .from('finance_ledger')
                .select('id, amount, processed_at, payment_method, operations(metadata)')
                .eq('person_id', personId)
                .eq('type', 'income')
                .order('processed_at', { ascending: false });

            if (payments) setHistory(payments);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('portal_token');
        navigate('/portal');
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium animate-pulse">Cargando tu cuenta...</p>
        </div>
    );

    if (!session) return null;

    const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans">

            {/* HEADER ANIMADO */}
            <motion.header
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 pb-24 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden"
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"
                />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-500/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>

                <div className="relative z-10 flex justify-between items-start mb-8">
                    <div>
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="flex items-center gap-2 mb-2 opacity-80"
                        >
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                            <p className="text-xs font-bold uppercase tracking-widest">Portal de Cliente</p>
                        </motion.div>
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-bold tracking-tight"
                        >
                            Hola, {session.name.split(' ')[0]} 👋
                        </motion.h1>
                        <p className="text-sm text-slate-300 mt-1 opacity-90">{session.org_name}</p>
                    </div>
                    <button onClick={handleLogout} className="bg-white/10 backdrop-blur-md p-3 rounded-xl hover:bg-white/20 transition-all active:scale-95 border border-white/10">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </motion.header>

            {/* TARJETA DE ESTADO */}
            <div className="px-4 -mt-20 relative z-20 mb-8">
                <motion.div
                    initial={{ y: 50, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center justify-between"
                >
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Tu Saldo Pendiente</p>
                        <h2 className={`text-4xl font-black ${totalDebt > 0 ? 'text-slate-900' : 'text-emerald-500'}`}>
                            ${totalDebt.toLocaleString()}
                        </h2>
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg transform rotate-3 ${totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {totalDebt > 0 ? <AlertTriangle className="w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
                    </div>
                </motion.div>
            </div>

            {/* CONTENIDO */}
            <div className="px-4 max-w-3xl mx-auto">
                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 mb-6 sticky top-4 z-30">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${activeTab === 'pending' ? 'text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        {activeTab === 'pending' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-slate-900 rounded-xl"
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <Wallet className="w-4 h-4" /> Pendientes
                            {debts.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{debts.length}</span>}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${activeTab === 'history' ? 'text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        {activeTab === 'history' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-slate-900 rounded-xl"
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <History className="w-4 h-4" /> Historial
                        </span>
                    </button>
                </div>

                <div className="space-y-4 pb-12">
                    <AnimatePresence mode="wait">
                        {activeTab === 'pending' ? (
                            <motion.div
                                key="pending"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {debts.length === 0 ? (
                                    <div className="text-center py-16 px-6 bg-white rounded-3xl border border-slate-100 border-dashed">
                                        <motion.div
                                            animate={{ y: [0, -10, 0] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4"
                                        >
                                            <CheckCircle className="w-10 h-10 text-emerald-500" />
                                        </motion.div>
                                        <h3 className="text-xl font-bold text-slate-900">¡Estás al día!</h3>
                                        <p className="text-slate-500 mt-2 text-sm">No tenés pagos pendientes por ahora.</p>
                                    </div>
                                ) : (
                                    debts.map((item, i) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="bg-red-50 w-12 h-12 rounded-xl flex items-center justify-center text-red-500 shrink-0 group-hover:scale-110 transition-transform">
                                                    <Calendar className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-lg leading-tight">
                                                        {item.metadata?.concept || 'Cuota / Servicio'}
                                                    </p>
                                                    <p className="text-xs text-red-500 font-bold mt-1 uppercase tracking-wide">
                                                        Vence: {new Date(item.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-black text-slate-900 text-xl">${item.balance.toLocaleString()}</span>
                                                <span className="text-xs text-slate-400 font-medium">Pendiente</span>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                            >
                                {history.length === 0 ? (
                                    <div className="text-center py-16 px-6 opacity-60">
                                        <History className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                                        <p>Aún no tenés historial de pagos.</p>
                                    </div>
                                ) : (
                                    history.map((item, i) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="bg-emerald-50 w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                                    <Receipt className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700">Pago Recibido</p>
                                                    <p className="text-xs text-emerald-600 font-medium">
                                                        {new Date(item.processed_at).toLocaleDateString()} • {item.payment_method}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-slate-500 line-through decoration-slate-300 decoration-2 text-lg">
                                                ${item.amount.toLocaleString()}
                                            </span>
                                        </motion.div>
                                    ))
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="text-center text-slate-400 text-xs py-6">
                <Lock className="w-3 h-3 inline-block mr-1 mb-0.5" />
                Portal Seguro v2.0
            </div>
        </div>
    );
}