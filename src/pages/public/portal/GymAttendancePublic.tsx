import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, User, CheckCircle, AlertCircle, Calendar, ArrowRight, Clock, Hash } from 'lucide-react';
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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { data: person, error: personError } = await supabase
                .from('crm_people')
                .select('id, full_name, details')
                .eq('organization_id', orgData.id)
                .eq('identifier', identifier.trim())
                .eq('is_active', true)
                .maybeSingle();

            if (personError) throw personError;
            if (!person) throw new Error('No se encontró el alumno o está inactivo.');

            // --- 1. EXTRAER MÚLTIPLES PLANES (CON RETROCOMPATIBILIDAD) ---
            let activePlans = person.details?.active_plans || [];

            // Si no tiene el Array nuevo, pero sí tiene un plan viejo, lo convertimos
            if (activePlans.length === 0 && person.details?.active_plan) {
                activePlans = [person.details.active_plan];
            }

            if (activePlans.length === 0) {
                throw new Error('El alumno no tiene ningún plan activo asignado.');
            }

            // --- 2. VERIFICAR DEUDAS GLOBALES ---
            const { data: debts } = await supabase
                .from('operations')
                .select('balance')
                .eq('person_id', person.id)
                .eq('organization_id', orgData.id)
                .gt('balance', 0);

            const totalDebt = debts?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

            // --- 3. BUSCAR UN PLAN VÁLIDO PARA ESTA HORA ---
            let isAllowed = false;
            let rejectReason = 'No hay planes válidos para este horario o están vencidos.';
            let matchedPlan = null;
            let matchedPlanIndex = -1;

            if (totalDebt > 0) {
                rejectReason = 'Deuda Pendiente';
            } else {
                const currentHour = new Date().getHours();
                const now = new Date();

                // Recorremos todos los planes que tiene contratados
                for (let i = 0; i < activePlans.length; i++) {
                    const plan = activePlans[i];
                    const expiresDate = new Date(plan.expires_at);

                    // A) Ver si está vencido
                    if (now > expiresDate) continue;

                    // B) Ver si se quedó sin clases (solo si es por paquete)
                    if (plan.mode === 'classes' && plan.remaining_classes <= 0) continue;

                    // C) Ver chequeo de horario
                    if (plan.schedule === 'morning' && (currentHour < 5 || currentHour >= 12)) continue;
                    if (plan.schedule === 'afternoon' && (currentHour < 12 || currentHour >= 18)) continue;
                    if (plan.schedule === 'night' && (currentHour < 18)) continue;

                    // Si pasó todos los filtros, ¡este es el plan a usar!
                    isAllowed = true;
                    matchedPlan = plan;
                    matchedPlanIndex = i;
                    break;
                }
            }

            // --- 4. ACCIÓN SI ENTRO CON ÉXITO ---
            if (isAllowed && matchedPlan) {
                await supabase.from('appointments').insert([{
                    organization_id: orgData.id,
                    person_id: person.id,
                    start_time: new Date().toISOString(),
                    end_time: new Date().toISOString(),
                    status: 'attended',
                    notes: `Asistencia: ${matchedPlan.name}`
                }]);

                // Si es por clases, le descontamos 1
                if (matchedPlan.mode === 'classes') {
                    activePlans[matchedPlanIndex].remaining_classes -= 1;
                    const updatedDetails = { ...person.details, active_plans: activePlans };

                    await supabase.from('crm_people').update({ details: updatedDetails }).eq('id', person.id);
                    matchedPlan.remaining_classes = activePlans[matchedPlanIndex].remaining_classes;
                }
            } else {
                // Si no le permitimos pasar, mostramos info del primer plan vencido para darle contexto
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
            console.error(err);
            setError(err.message);
            setTimeout(() => setError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden text-white">
            <div className="absolute top-8 left-0 right-0 text-center z-10">
                {orgData.logo_url && (
                    <img src={orgData.logo_url} alt="Logo" className="h-16 w-auto mx-auto mb-4 rounded-xl shadow-lg" />
                )}
                <h1 className="text-3xl font-black uppercase tracking-widest text-slate-100 drop-shadow-md">
                    {orgData.name}
                </h1>
            </div>

            <div className="w-full max-w-md relative z-20 mt-10">
                <AnimatePresence mode="wait">
                    {!studentData || !accessStatus ? (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white/10 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-white/20 text-center"
                        >
                            <h2 className="text-2xl font-bold mb-6">Control de Acceso</h2>
                            <form onSubmit={handleSearch} className="flex flex-col gap-4">
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Ingresá tu DNI..."
                                        className="w-full bg-white/5 border border-white/20 text-white placeholder-slate-400 text-center text-3xl font-bold py-5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all tracking-widest"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !identifier}
                                    className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                                    Marcar Ingreso
                                </button>
                                {error && (
                                    <p className="text-red-400 text-sm font-medium mt-2 animate-bounce">{error}</p>
                                )}
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="bg-white rounded-3xl shadow-2xl overflow-hidden text-slate-900 border-4 border-slate-900/10"
                        >
                            <div className={`p-6 text-center ${!accessStatus.allowed ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                {!accessStatus.allowed ? (
                                    <AlertCircle className="w-16 h-16 mx-auto mb-2 animate-pulse" />
                                ) : (
                                    <CheckCircle className="w-16 h-16 mx-auto mb-2" />
                                )}
                                <h2 className="text-2xl font-black uppercase tracking-wider">
                                    {!accessStatus.allowed ? accessStatus.reason : 'Acceso Permitido'}
                                </h2>
                            </div>

                            <div className="p-8 text-center">
                                <div className="relative w-40 h-40 mx-auto mb-6">
                                    {studentData.details?.photo_url ? (
                                        <img
                                            src={studentData.details.photo_url}
                                            alt={studentData.full_name}
                                            className={`w-full h-full object-cover rounded-full border-8 shadow-lg ${!accessStatus.allowed ? 'border-red-100' : 'border-emerald-100'}`}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center border-8 border-slate-50">
                                            <User className="w-16 h-16 text-slate-400" />
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-3xl font-black text-slate-800 mb-2">{studentData.full_name}</h3>
                                <p className="text-slate-500 font-medium mb-6">DNI: {identifier}</p>

                                {!accessStatus.allowed ? (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                                        <p className="font-bold mb-1">Por favor, pasá por recepción.</p>
                                        {accessStatus.debtAmount > 0 && (
                                            <p className="text-xl font-black">Deuda: ${accessStatus.debtAmount.toLocaleString()}</p>
                                        )}
                                        {accessStatus.planInfo && new Date() > new Date(accessStatus.planInfo.expires_at) && (
                                            <p className="text-sm mt-1">El plan <span className="font-bold">{accessStatus.planInfo.name}</span> está vencido.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 space-y-2 text-sm">
                                        <p className="font-bold text-brand-600 text-base mb-2">{accessStatus.planInfo.name}</p>

                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                            <span className="flex items-center gap-1 text-slate-500"><Calendar className="w-4 h-4" /> Vence:</span>
                                            <span className="font-semibold">{new Date(accessStatus.planInfo.expires_at).toLocaleDateString()}</span>
                                        </div>

                                        {accessStatus.planInfo.mode === 'classes' && (
                                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                                <span className="flex items-center gap-1 text-slate-500"><Hash className="w-4 h-4" /> Clases restantes:</span>
                                                <span className="font-bold text-emerald-600 text-lg">{accessStatus.planInfo.remaining_classes}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-1">
                                            <span className="flex items-center gap-1 text-slate-500"><Clock className="w-4 h-4" /> Turno:</span>
                                            <span className="font-semibold capitalize">
                                                {accessStatus.planInfo.schedule === 'free' ? 'Libre' :
                                                    accessStatus.planInfo.schedule === 'morning' ? 'Mañana (5 a 12)' :
                                                        accessStatus.planInfo.schedule === 'afternoon' ? 'Tarde (12 a 18)' : 'Noche (18 a 00)'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="h-1.5 w-full bg-slate-100">
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

            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-blob"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500 rounded-full mix-blend-screen filter blur-[128px] opacity-10 animate-blob animation-delay-2000"></div>
        </div>
    );
}