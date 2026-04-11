import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, User, CheckCircle, AlertCircle, Calendar, Clock, Hash, Delete, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GymAttendanceProps {
    orgData: any;
}

export default function GymAttendancePublic({ orgData }: GymAttendanceProps) {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [studentData, setStudentData] = useState<any>(null);
    const [accessStatus, setAccessStatus] = useState<{
        allowed: boolean;
        reason: string;
        debtAmount: number;
        planInfo: any;
    } | null>(null);

    // =========================================================================
    // AUTO-RESET: Vuelve al teclado después de 8 segundos de mostrar el resultado
    // =========================================================================
    useEffect(() => {
        if (studentData) {
            const timer = setTimeout(() => {
                resetScreen();
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [studentData]);

    const resetScreen = () => {
        setStudentData(null);
        setIdentifier('');
        setAccessStatus(null);
        setError(null);
    };

    // =========================================================================
    // TECLADO VIRTUAL
    // =========================================================================
    const handleKeypadPress = (num: string) => {
        if (identifier.length < 10) setIdentifier(prev => prev + num);
        setError(null);
    };

    const handleKeypadDelete = () => {
        setIdentifier(prev => prev.slice(0, -1));
    };

    // =========================================================================
    // VERIFICACIÓN DEL DNI EN LA BASE DE DATOS
    // =========================================================================
    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!identifier.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Buscamos el alumno en este local
            const { data: person, error: personError } = await supabase
                .from('crm_people')
                .select('id, full_name, details')
                .eq('organization_id', orgData.id)
                .eq('identifier', identifier.trim())
                .eq('is_active', true)
                .maybeSingle();

            if (personError) throw personError;
            if (!person) throw new Error('No se encontró el alumno o está inactivo.');

            // 2. Extraemos planes (soportando versiones viejas del JSONB)
            let activePlans = person.details?.active_plans || [];
            if (activePlans.length === 0 && person.details?.active_plan) {
                activePlans = [person.details.active_plan];
            }

            if (activePlans.length === 0) {
                throw new Error('El alumno no tiene ningún plan activo asignado.');
            }

            // 3. Verificamos deudas
            const { data: debts } = await supabase
                .from('operations')
                .select('balance')
                .eq('person_id', person.id)
                .eq('organization_id', orgData.id)
                .gt('balance', 0);

            const totalDebt = debts?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

            let isAllowed = false;
            let rejectReason = 'No hay planes válidos para este horario o están vencidos.';
            let matchedPlan = null;
            let matchedPlanIndex = -1;

            if (totalDebt > 0) {
                rejectReason = 'Deuda Pendiente';
            } else {
                // 4. Verificamos Horarios de Acceso
                const currentHour = new Date().getHours();
                const now = new Date();

                for (let i = 0; i < activePlans.length; i++) {
                    const plan = activePlans[i];
                    const expiresDate = new Date(plan.expires_at);

                    if (now > expiresDate) continue; // Vencido
                    if (plan.mode === 'classes' && plan.remaining_classes <= 0) continue; // Sin saldo de clases
                    // Controles horarios
                    if (plan.schedule === 'morning' && (currentHour < 5 || currentHour >= 12)) continue;
                    if (plan.schedule === 'afternoon' && (currentHour < 12 || currentHour >= 18)) continue;
                    if (plan.schedule === 'night' && (currentHour < 18)) continue;

                    isAllowed = true;
                    matchedPlan = plan;
                    matchedPlanIndex = i;
                    break;
                }
            }

            // 5. Aplicar Reglas: Descontar clase si corresponde
            if (isAllowed && matchedPlan) {
                await supabase.from('appointments').insert([{
                    organization_id: orgData.id,
                    person_id: person.id,
                    start_time: new Date().toISOString(),
                    end_time: new Date().toISOString(),
                    status: 'attended',
                    notes: `Asistencia: ${matchedPlan.name}`
                }]);

                if (matchedPlan.mode === 'classes') {
                    activePlans[matchedPlanIndex].remaining_classes -= 1;
                    const updatedDetails = { ...person.details, active_plans: activePlans };
                    await supabase.from('crm_people').update({ details: updatedDetails }).eq('id', person.id);
                    matchedPlan.remaining_classes = activePlans[matchedPlanIndex].remaining_classes;
                }
            } else {
                // Si fue rechazado, mostramos el primer plan para dar contexto en la tarjeta roja
                matchedPlan = activePlans[0];
            }

            setAccessStatus({
                allowed: isAllowed,
                reason: rejectReason,
                debtAmount: totalDebt,
                planInfo: matchedPlan
            });
            setStudentData(person);

        } catch (err: any) {
            setError(err.message);
            setTimeout(() => setError(null), 4000);
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white font-sans selection:bg-brand-500/30">
            
            {/* FONDO ANIMADO Y TEXTURA */}
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-brand-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse duration-[8s] -z-10"></div>
            <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-indigo-600 rounded-full mix-blend-screen filter blur-[120px] opacity-10 animate-pulse duration-[12s] -z-10"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay -z-10"></div>

            {/* HEADER LOGO */}
            <div className="absolute top-8 left-0 right-0 text-center z-10 px-4">
                {orgData.logo_url && (
                    <img src={orgData.logo_url} alt="Logo" className="h-16 w-auto mx-auto mb-4 rounded-2xl shadow-2xl border border-white/10 object-cover" />
                )}
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md">
                    {orgData.name}
                </h1>
            </div>

            {/* CONTENEDOR CENTRAL */}
            <div className="w-full max-w-md relative z-20 mt-16 md:mt-24">
                <AnimatePresence mode="wait">
                    {!studentData || !accessStatus ? (
                        <motion.div
                            key="teclado_input"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-[#0A0A0A]/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-2xl border border-white/10 text-center"
                        >
                            <h2 className="text-xl md:text-2xl font-bold mb-6 text-slate-200">Control de Acceso</h2>
                            
                            <form onSubmit={handleSearch} className="flex flex-col gap-6">
                                {/* PANTALLITA DEL DNI */}
                                <div className="bg-black border-2 border-white/5 rounded-2xl p-4 md:p-5 text-center min-h-[5rem] flex items-center justify-center shadow-inner">
                                    {identifier ? (
                                        <span className="text-3xl md:text-4xl font-black tracking-[0.2em] text-white">
                                            {identifier}
                                        </span>
                                    ) : (
                                        <span className="text-xl font-medium text-slate-600 tracking-wide">
                                            Ingresá tu DNI
                                        </span>
                                    )}
                                </div>

                                {/* TECLADO NUMÉRICO */}
                                <div className="grid grid-cols-3 gap-3 md:gap-4">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => handleKeypadPress(num.toString())}
                                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-2xl md:text-3xl font-bold py-4 md:py-5 rounded-2xl transition-colors active:scale-95 shadow-sm"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleKeypadDelete}
                                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-4 md:py-5 rounded-2xl transition-colors active:scale-95 flex items-center justify-center shadow-sm"
                                    >
                                        <Delete className="w-8 h-8" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleKeypadPress('0')}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-2xl md:text-3xl font-bold py-4 md:py-5 rounded-2xl transition-colors active:scale-95 shadow-sm"
                                    >
                                        0
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !identifier}
                                        className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 border border-brand-500/50 disabled:border-transparent text-white py-4 md:py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] disabled:shadow-none"
                                    >
                                        {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <ChevronRight className="w-8 h-8" />}
                                    </button>
                                </div>

                                {/* MENSAJE DE ERROR RAPIDO (EJ: Alumno no encontrado) */}
                                {error && (
                                    <p className="text-red-400 text-sm font-bold mt-2 animate-in fade-in slide-in-from-top-2">{error}</p>
                                )}
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="resultado_accesso"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden text-slate-900 border border-slate-200"
                        >
                            {/* CABECERA (Verde o Roja) */}
                            <div className={`p-8 text-center transition-colors duration-500 ${!accessStatus.allowed ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                {!accessStatus.allowed ? (
                                    <AlertCircle className="w-20 h-20 mx-auto mb-4 animate-in zoom-in" />
                                ) : (
                                    <CheckCircle className="w-20 h-20 mx-auto mb-4 animate-in zoom-in" />
                                )}
                                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest leading-tight">
                                    {!accessStatus.allowed ? accessStatus.reason : 'Acceso Permitido'}
                                </h2>
                            </div>

                            {/* FOTO Y DATOS DEL ALUMNO */}
                            <div className="p-8 text-center bg-slate-50">
                                <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto mb-6">
                                    {studentData.details?.photo_url ? (
                                        <img
                                            src={studentData.details.photo_url}
                                            alt={studentData.full_name}
                                            className={`w-full h-full object-cover rounded-full border-8 shadow-xl ${!accessStatus.allowed ? 'border-red-100' : 'border-emerald-100'}`}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center border-8 border-slate-100 shadow-sm">
                                            <User className="w-16 h-16 text-slate-300" />
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-1">{studentData.full_name}</h3>
                                <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-sm">DNI: {identifier}</p>

                                {/* DETALLES DEL RECHAZO O ÉXITO */}
                                {!accessStatus.allowed ? (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 shadow-sm">
                                        <p className="font-bold text-lg mb-2">Por favor, pasá por recepción.</p>
                                        
                                        {accessStatus.debtAmount > 0 && (
                                            <p className="text-2xl font-black bg-white/50 py-2 rounded-xl border border-red-100 inline-block px-4">Deuda: ${accessStatus.debtAmount.toLocaleString()}</p>
                                        )}
                                        
                                        {accessStatus.planInfo && new Date() > new Date(accessStatus.planInfo.expires_at) && (
                                            <p className="text-sm mt-3 bg-white/50 py-2 rounded-xl border border-red-100">El plan <span className="font-bold">{accessStatus.planInfo.name}</span> está vencido.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 text-slate-700 shadow-sm text-left">
                                        <p className="font-black text-brand-600 text-lg mb-4 text-center">{accessStatus.planInfo.name}</p>

                                        <div className="space-y-3 text-sm font-medium">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                <span className="flex items-center gap-2 text-slate-500"><Calendar className="w-4 h-4" /> Vencimiento:</span>
                                                <span className="font-bold bg-slate-100 px-2 py-1 rounded-md">{new Date(accessStatus.planInfo.expires_at).toLocaleDateString()}</span>
                                            </div>

                                            {accessStatus.planInfo.mode === 'classes' && (
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                    <span className="flex items-center gap-2 text-slate-500"><Hash className="w-4 h-4" /> Clases restantes:</span>
                                                    <span className="font-black text-emerald-600 text-lg bg-emerald-50 px-3 py-0.5 rounded-md">{accessStatus.planInfo.remaining_classes}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-1">
                                                <span className="flex items-center gap-2 text-slate-500"><Clock className="w-4 h-4" /> Turno:</span>
                                                <span className="font-bold capitalize bg-slate-100 px-2 py-1 rounded-md">
                                                    {accessStatus.planInfo.schedule === 'free' ? 'Libre' :
                                                        accessStatus.planInfo.schedule === 'morning' ? 'Mañana (5-12hs)' :
                                                            accessStatus.planInfo.schedule === 'afternoon' ? 'Tarde (12-18hs)' : 'Noche (18-00hs)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* BARRA DE PROGRESO INFERIOR (8 SEGUNDOS) */}
                            <div className="h-2 w-full bg-slate-100">
                                <motion.div
                                    className={`h-full ${!accessStatus.allowed ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    initial={{ width: "100%" }}
                                    animate={{ width: "0%" }}
                                    transition={{ duration: 8, ease: "linear" }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}