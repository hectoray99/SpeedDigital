import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { usePortalStore } from '../../../store/portalStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LogOut, Calendar, User, 
    Loader2, Receipt, Clock, FileText, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentData {
    full_name: string;
    email: string;
    identifier: string;
}

export default function StudentPortal() {
    const { slug } = useParams();
    const navigate = useNavigate();
    
    // Auth Local (Zustand)
    const { studentId, orgSlug, logoutStudent } = usePortalStore();

    // Data y Estados
    const [student, setStudent] = useState<StudentData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'turnos' | 'finanzas'>('turnos');

    const [appointments, setAppointments] = useState<any[]>([]);
    const [debts, setDebts] = useState<any[]>([]);

    // =========================================================================
    // INICIALIZACIÓN Y SEGURIDAD
    // =========================================================================
    useEffect(() => {
        // Bloquear acceso si la cookie no coincide con la URL del negocio
        if (!studentId || orgSlug !== slug) {
            logoutStudent(); 
            navigate(`/portal/${slug}/login`, { replace: true });
            return;
        }
        fetchPortalData();
    }, [studentId, orgSlug, slug, navigate]);

    const fetchPortalData = async () => {
        setIsLoading(true);
        try {
            // 1. Datos básicos del Alumno
            const { data: studentData, error: studentError } = await supabase
                .from('crm_people')
                .select('full_name, email, identifier')
                .eq('id', studentId)
                .single();

            if (studentError || !studentData) throw new Error('Cliente no encontrado');
            setStudent(studentData);

            // 2. Traer Turnos Futuros
            const { data: apptsData } = await supabase
                .from('appointments')
                .select('*')
                .eq('person_id', studentId)
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(5);

            if (apptsData) setAppointments(apptsData);

            // 3. Traer Deudas Vigentes
            const { data: debtsData } = await supabase
                .from('operations')
                .select('*')
                .eq('person_id', studentId)
                .gt('balance', 0)
                .neq('status', 'cancelled');

            if (debtsData) setDebts(debtsData);

        } catch (error) {
            toast.error('Hubo un problema al cargar tu información');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        logoutStudent();
        toast.success('Sesión cerrada correctamente');
        navigate(`/portal/${slug}/login`, { replace: true });
    };

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    if (isLoading || !student) {
        return (
            <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
                <Loader2 className="w-12 h-12 animate-spin text-brand-500 mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Cargando tu portal...</p>
            </div>
        );
    }

    const totalDebt = debts.reduce((sum, d) => sum + Number(d.balance || 0), 0);

    return (
        <div className="min-h-[100dvh] bg-slate-50 font-sans selection:bg-brand-500/30 pb-12">
            
            {/* NAVBAR */}
            <nav className="bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="bg-brand-50 p-2.5 rounded-xl text-brand-600 border border-brand-100 shadow-sm">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">Mi Portal</h1>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{slug}</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors active:scale-95"
                        >
                            <span className="hidden sm:inline">Cerrar Sesión</span>
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* CONTENIDO PRINCIPAL */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-10">
                
                {/* TARJETA DE BIENVENIDA */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl shadow-slate-900/20 mb-8 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500 rounded-full mix-blend-screen filter blur-[80px] opacity-40 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-[80px] opacity-30 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-5xl font-black mb-3 md:mb-4 tracking-tight">
                            ¡Hola, {student.full_name.split(' ')[0]}! 👋
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-slate-400 font-medium text-sm md:text-base">
                            <span className="bg-white/10 px-3 py-1 rounded-lg">DNI: {student.identifier}</span>
                            {student.email && (
                                <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="bg-white/10 px-3 py-1 rounded-lg truncate max-w-[200px] md:max-w-none">{student.email}</span>
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* TABS DE NAVEGACIÓN */}
                <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
                    <button
                        onClick={() => setActiveTab('turnos')}
                        className={`flex-1 py-3.5 px-4 font-bold text-sm transition-all rounded-xl flex items-center justify-center gap-2 ${
                            activeTab === 'turnos' 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <Calendar className="w-5 h-5" /> <span className="hidden sm:inline">Próximos</span> Turnos
                    </button>
                    <button
                        onClick={() => setActiveTab('finanzas')}
                        className={`flex-1 py-3.5 px-4 font-bold text-sm transition-all rounded-xl flex items-center justify-center gap-2 relative ${
                            activeTab === 'finanzas' 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <Receipt className="w-5 h-5" /> Mi Cuenta
                        {debts.length > 0 && <span className="bg-red-500 text-white w-2.5 h-2.5 rounded-full absolute top-3.5 right-3.5 md:right-auto md:ml-1 animate-ping"></span>}
                        {debts.length > 0 && <span className="bg-red-500 text-white w-2.5 h-2.5 rounded-full absolute top-3.5 right-3.5 md:right-auto md:ml-1"></span>}
                    </button>
                </div>

                {/* CONTENIDO DE LAS TABS */}
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'turnos' ? (
                            <div className="space-y-4">
                                {appointments.length === 0 ? (
                                    <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center flex flex-col items-center">
                                        <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mb-6 border border-slate-100">
                                            <Clock className="w-10 h-10 text-slate-300" />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-800">Agenda libre</h3>
                                        <p className="text-slate-500 mt-2 font-medium">No tenés reservas próximas asignadas.</p>
                                    </div>
                                ) : (
                                    appointments.map(appt => (
                                        <div key={appt.id} className="bg-white rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm flex items-center gap-4 md:gap-6 hover:border-brand-200 transition-colors group">
                                            
                                            {/* Calendario Icon */}
                                            <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-50 rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-brand-600 border border-brand-100 shrink-0 shadow-sm">
                                                <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{new Date(appt.start_time).toLocaleDateString('es-AR', { weekday: 'short' })}</span>
                                                <span className="text-2xl md:text-3xl font-black leading-none mt-0.5">{new Date(appt.start_time).getDate()}</span>
                                            </div>
                                            
                                            {/* Datos del Turno */}
                                            <div>
                                                <h4 className="font-black text-slate-800 text-lg md:text-xl">{appt.notes || 'Turno Reservado'}</h4>
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mt-2 bg-slate-50 px-3 py-1.5 rounded-lg w-fit">
                                                    <Clock className="w-4 h-4 text-slate-400" />
                                                    {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                
                                {/* Resumen del Saldo */}
                                <div className={`p-8 md:p-10 rounded-3xl border-2 flex flex-col items-center text-center shadow-sm ${totalDebt > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                    {totalDebt > 0 ? (
                                        <>
                                            <p className="text-red-500 font-black uppercase tracking-widest text-xs mb-3">Saldo a pagar</p>
                                            <h3 className="text-5xl md:text-7xl font-black text-red-600 tracking-tight">${totalDebt.toLocaleString()}</h3>
                                            <p className="text-red-600/80 font-bold mt-4 text-sm max-w-sm mx-auto bg-white/50 py-2 px-4 rounded-xl border border-red-100">Acercate a recepción para regularizar tu cuenta y evitar cortes de servicio.</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5 border-4 border-white shadow-sm">
                                                <CheckCircle className="w-10 h-10 text-emerald-500" />
                                            </div>
                                            <h3 className="text-3xl font-black text-emerald-700 mb-2 tracking-tight">Cuenta al día</h3>
                                            <p className="text-emerald-600/80 font-bold">No registrás deudas pendientes.</p>
                                        </>
                                    )}
                                </div>

                                {/* Desglose de Deudas */}
                                {debts.length > 0 && (
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                                            <h4 className="font-black text-slate-800 flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-slate-400" /> Detalle de Conceptos
                                            </h4>
                                        </div>
                                        <div className="divide-y divide-slate-100 p-2">
                                            {debts.map(debt => (
                                                <div key={debt.id} className="p-4 md:p-5 flex justify-between items-center hover:bg-slate-50 rounded-2xl transition-colors">
                                                    <div>
                                                        <p className="font-bold text-slate-800 md:text-lg">{debt.metadata?.concept || 'Cargo del sistema'}</p>
                                                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{new Date(debt.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <span className="font-black text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-100 md:text-lg shadow-sm">
                                                        ${Number(debt.balance || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}