import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { bookingService } from '../../../services/bookingService';
import { Loader2, Calendar as CalendarIcon, Clock, User, Phone, CheckCircle2, MapPin, ChevronRight, ArrowLeft, Dumbbell, AlertTriangle, Delete, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function PublicRouter() {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [org, setOrg] = useState<any>(null);

    const [services, setServices] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [step, setStep] = useState(1);

    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedResource, setSelectedResource] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>('');

    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');

    const [paymentMethod, setPaymentMethod] = useState<'local' | 'online'>('local');
    const [calculatingSlots, setCalculatingSlots] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const [dniInput, setDniInput] = useState('');
    const [checkInState, setCheckInState] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [checkInMessage, setCheckInMessage] = useState('');
    const [checkInStudent, setCheckInStudent] = useState<string>('');

    const requiresDeposit = selectedService?.properties?.requires_deposit === true;
    const depositPct = Number(selectedService?.properties?.deposit_percentage) || 50;
    const rawPrice = Number(selectedService?.price) || 0;
    const depositAmount = requiresDeposit ? Math.round((rawPrice * depositPct) / 100) : rawPrice;

    useEffect(() => {
        if (slug) fetchOrganization();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    useEffect(() => {
        const mpStatus = searchParams.get('mp_status');
        const appId = searchParams.get('app_id') || searchParams.get('external_reference');

        if (mpStatus === 'approved' && appId) {
            confirmOnlinePayment(appId);
        } else if (mpStatus === 'failure' || mpStatus === 'rejected') {
            toast.error("El pago no se completó. Tu turno no fue reservado.");
            setSearchParams({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        if (org && org.industry !== 'gym' && selectedDate && selectedService && selectedResource) {
            calculateSlots();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, selectedService, selectedResource, org]);

    // 🔥 EL FIX MÁS IMPORTANTE: Forzamos 'local' si NO pide seña, o 'online' si SI pide.
    useEffect(() => {
        if (requiresDeposit) {
            setPaymentMethod('online');
        } else {
            setPaymentMethod('local');
        }
    }, [requiresDeposit]);

    async function fetchOrganization() {
        try {
            const { data: orgData, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error || !orgData) throw new Error('Local no encontrado');
            setOrg(orgData);

            if (orgData.industry !== 'gym') {
                const [servRes, resRes] = await Promise.all([
                    supabase.from('catalog_items').select('*').eq('organization_id', orgData.id).eq('type', 'service').eq('is_active', true),
                    supabase.from('resources').select('*').eq('organization_id', orgData.id).eq('is_active', true)
                ]);
                setServices(servRes.data || []);
                setResources(resRes.data || []);
            }
        } catch (error) {
            toast.error('No pudimos cargar esta página. Verificá el enlace.');
        } finally {
            setLoading(false);
        }
    }

    async function calculateSlots() {
        setCalculatingSlots(true);
        setSelectedTime('');
        try {
            const slots = await bookingService.getAvailableSlots(org.id, selectedDate, selectedService.id, selectedResource.id);
            setAvailableSlots(slots);
        } catch (error) {
            toast.error("Error calculando horarios. Intentá otra fecha.");
        } finally {
            setCalculatingSlots(false);
        }
    }

    const confirmOnlinePayment = async (appId: string) => {
        toast.loading("Procesando pago y confirmando turno...", { id: 'confirm_mp' });
        try {
            const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appId);
            if (error) throw error;

            const { data: appData } = await supabase.from('appointments').select('start_time').eq('id', appId).single();
            if (appData) {
                const dateObj = new Date(appData.start_time);
                setSelectedDate(dateObj.toISOString().split('T')[0]);
                setSelectedTime(dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }

            setStep(5);
            setSearchParams({});
            toast.success("¡Pago recibido con éxito!", { id: 'confirm_mp' });
        } catch (error) {
            console.error(error);
            toast.error("El turno se pagó pero hubo un problema al confirmar. Contactanos al WhatsApp.", { id: 'confirm_mp', duration: 8000 });
        }
    };

    const handleBooking = async () => {
        if (clientName.trim().length < 3) {
            return toast.error('Por favor, ingresá un nombre válido (mínimo 3 letras).');
        }
        if (clientPhone.length < 8) {
            return toast.error('El número de teléfono parece estar incompleto.');
        }

        try {
            const cleanPhone = clientPhone.replace(/\D/g, '');
            let personId = null;
            const { data: existingPerson } = await supabase.from('crm_people').select('id').eq('organization_id', org.id).eq('phone', cleanPhone).maybeSingle();

            if (existingPerson) {
                personId = existingPerson.id;
            } else {
                const { data: newPerson } = await supabase.from('crm_people').insert([{ organization_id: org.id, full_name: clientName.trim(), phone: cleanPhone, type: 'client' }]).select('id').single();
                personId = newPerson?.id;
            }

            const duration = selectedService.properties?.duration_minutes || selectedService.duration_minutes || 60;
            const startDateTime = new Date(`${selectedDate}T${selectedTime}:00-03:00`);
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

            const { data: newAppointment, error: appError } = await supabase.from('appointments').insert([{
                organization_id: org.id,
                person_id: personId,
                resource_id: selectedResource.id,
                service_id: selectedService.id,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                status: paymentMethod === 'online' ? 'pending' : 'confirmed'
            }]).select('id').single();

            if (appError || !newAppointment) throw new Error("Error guardando turno");

            if (paymentMethod === 'online') {
                toast.loading('Redirigiendo a Mercado Pago...', { id: 'mp_loading' });

                const { data: mpData, error: mpError } = await supabase.functions.invoke('mp-checkout', {
                    body: {
                        title: requiresDeposit ? `Seña: ${selectedService.name}` : `Pago: ${selectedService.name}`,
                        unit_price: depositAmount,
                        appointment_id: newAppointment.id,
                        return_url: window.location.href.split('?')[0]
                    }
                });

                toast.dismiss('mp_loading');
                if (mpError) {
                    toast.error('El servidor rechazó la petición de pago. Revisá la consola (F12).');
                    return;
                }
                if (!mpData?.init_point && !mpData?.sandbox_init_point) {
                    toast.error('Mercado Pago no devolvió el link. Revisá la consola (F12).');
                    return;
                }

                window.location.href = mpData.init_point || mpData.sandbox_init_point;
            } else {
                setStep(5);
            }
        } catch (error: any) {
            console.error(error);
            toast.error('Hubo un problema al procesar tu reserva.');
        } finally {
            setSubmitting(false);
        }
    };

    // =========================================================================
    // LÓGICA MODO GYM
    // =========================================================================
    const handleKeypadPress = (num: string) => {
        if (dniInput.length < 10) setDniInput(prev => prev + num);
        if (checkInState === 'error') setCheckInState('idle');
    };

    const handleKeypadDelete = () => setDniInput(prev => prev.slice(0, -1));

    const handleGymCheckIn = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!dniInput.trim()) return;

        setCheckInState('checking');

        try {
            const { data: student, error } = await supabase
                .from('crm_people')
                .select('id, full_name, details, is_active')
                .eq('organization_id', org.id)
                .eq('identifier', dniInput.trim())
                .maybeSingle();

            if (error || !student) {
                setCheckInMessage('DNI no registrado en el sistema.');
                setCheckInState('error');
                resetCheckIn(4000);
                return;
            }

            if (!student.is_active) {
                setCheckInMessage('Tu cuenta está inactiva. Pasá por recepción.');
                setCheckInState('error');
                resetCheckIn(4000);
                return;
            }

            const details = student.details as any;
            let plans = details?.active_plans || [];
            if (plans.length === 0 && details?.active_plan) plans = [details.active_plan];

            if (plans.length === 0) {
                setCheckInMessage('No tenés ningún plan asignado. Pasá por recepción.');
                setCheckInState('error');
                resetCheckIn(4000);
                return;
            }

            const { data: debts } = await supabase
                .from('operations')
                .select('balance')
                .eq('person_id', student.id)
                .eq('organization_id', org.id)
                .gt('balance', 0)
                .neq('status', 'cancelled');

            const totalDebt = debts?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

            if (totalDebt > 0) {
                setCheckInMessage('Deuda Pendiente detectada.');
                setCheckInState('error');
                resetCheckIn(4000);
                return;
            }

            const currentHour = new Date().getHours();
            const now = new Date();
            let isAllowed = false;
            let matchedPlan = null;
            let matchedPlanIndex = -1;

            for (let i = 0; i < plans.length; i++) {
                const plan = plans[i];
                const expiresDate = new Date(plan.expires_at);

                if (now > expiresDate) continue;
                if (plan.mode === 'classes' && plan.remaining_classes <= 0) continue;
                if (plan.schedule === 'morning' && (currentHour < 5 || currentHour >= 12)) continue;
                if (plan.schedule === 'afternoon' && (currentHour < 12 || currentHour >= 18)) continue;
                if (plan.schedule === 'night' && (currentHour < 18)) continue;

                isAllowed = true;
                matchedPlan = plan;
                matchedPlanIndex = i;
                break;
            }

            if (!isAllowed) {
                setCheckInMessage('No hay planes válidos para este horario o están vencidos.');
                setCheckInState('error');
                resetCheckIn(4000);
                return;
            }

            if (matchedPlan && matchedPlan.mode === 'classes') {
                plans[matchedPlanIndex].remaining_classes -= 1;
                const updatedDetails = { ...student.details, active_plans: plans };
                await supabase.from('crm_people').update({ details: updatedDetails }).eq('id', student.id);
            }

            setCheckInStudent(student.full_name);
            setCheckInState('success');
            resetCheckIn(4000);

        } catch (err: any) {
            setCheckInMessage('Error de conexión. Intentá de nuevo.');
            setCheckInState('error');
            resetCheckIn(4000);
        }
    };

    const resetCheckIn = (delay: number) => {
        setTimeout(() => {
            setCheckInState('idle');
            setDniInput('');
            setCheckInMessage('');
            setCheckInStudent('');
        }, delay);
    };

    if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    if (!org) return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 p-6 text-center animate-in zoom-in-95"><h1 className="text-2xl font-black text-slate-800">404 - Local no encontrado</h1><p className="text-slate-500 mt-2 font-medium">Revisá que el link o código QR estén bien escritos.</p></div>;

    const isSports = org.industry === 'sports' || org.industry === 'gym';

    if (org.industry === 'gym') {
        return (
            <div className="min-h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-4 md:p-6 text-white relative overflow-hidden font-sans selection:bg-brand-500/30">
                <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] md:w-[40vw] md:h-[40vw] bg-brand-500 rounded-full mix-blend-screen filter blur-[100px] md:blur-[150px] opacity-20 animate-pulse duration-[8s] -z-10"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] md:w-[40vw] md:h-[40vw] bg-emerald-500 rounded-full mix-blend-screen filter blur-[100px] md:blur-[150px] opacity-20 animate-pulse delay-1000 duration-[12s] -z-10"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay -z-10"></div>

                <div className="z-10 w-full max-w-md text-center space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] object-cover mx-auto shadow-2xl border border-white/10" />
                    ) : (
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-[#0A0A0A] rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl border border-white/10">
                            <Dumbbell className="w-12 h-12 md:w-16 md:h-16 text-brand-500" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">{org.name}</h1>
                        <p className="text-brand-400 font-black mt-2 text-xs uppercase tracking-widest bg-brand-500/10 px-3 py-1.5 rounded-full inline-flex border border-brand-500/20">Control de Acceso</p>
                    </div>

                    <div className="bg-[#0A0A0A]/80 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative min-h-[300px] flex flex-col justify-center overflow-hidden">
                        {checkInState === 'idle' && (
                            <form onSubmit={handleGymCheckIn} className="animate-in zoom-in-95 duration-300">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Ingresá tu DNI para dar el presente</label>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center min-h-[5rem] flex items-center justify-center shadow-inner mb-6">
                                    {dniInput ? (
                                        <span className="text-4xl font-black tracking-[0.2em] text-white">{dniInput}</span>
                                    ) : (
                                        <span className="text-xl font-medium text-slate-600 tracking-wide">Escribí tu DNI</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-3 md:gap-4">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                        <button key={num} type="button" onClick={() => handleKeypadPress(num.toString())} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-2xl md:text-3xl font-black py-5 md:py-6 rounded-2xl transition-colors active:scale-95 shadow-sm">
                                            {num}
                                        </button>
                                    ))}
                                    <button type="button" onClick={handleKeypadDelete} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-5 md:py-6 rounded-2xl transition-colors active:scale-95 flex items-center justify-center shadow-sm">
                                        <Delete className="w-8 h-8" />
                                    </button>
                                    <button type="button" onClick={() => handleKeypadPress('0')} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-2xl md:text-3xl font-black py-5 md:py-6 rounded-2xl transition-colors active:scale-95 shadow-sm">
                                        0
                                    </button>
                                    <button type="submit" disabled={!dniInput} className="bg-brand-600 hover:bg-brand-500 disabled:bg-white/5 disabled:text-slate-600 disabled:border-transparent border border-brand-500/50 text-white py-5 md:py-6 rounded-2xl transition-all active:scale-95 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] disabled:shadow-none">
                                        <ChevronRight className="w-8 h-8" />
                                    </button>
                                </div>
                            </form>
                        )}

                        {checkInState === 'checking' && (
                            <div className="flex flex-col items-center justify-center animate-in fade-in duration-300 py-10">
                                <Loader2 className="w-16 h-16 animate-spin text-brand-500 mb-6" />
                                <p className="font-bold text-slate-300 text-lg tracking-wide">Verificando pase en la base de datos...</p>
                            </div>
                        )}

                        {checkInState === 'success' && (
                            <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 py-6">
                                <div className="w-28 h-28 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border-4 border-emerald-500/30 shadow-[0_0_50px_-10px_rgba(16,185,129,0.5)]">
                                    <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                                </div>
                                <h2 className="text-4xl font-black text-emerald-400 mb-2 tracking-tight">¡Adelante!</h2>
                                <p className="text-white text-2xl font-bold">{checkInStudent}</p>
                                <p className="text-emerald-500/80 font-black uppercase tracking-widest text-xs mt-3 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Suscripción al día</p>
                            </div>
                        )}

                        {checkInState === 'error' && (
                            <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-300 py-6">
                                <div className="w-28 h-28 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border-4 border-red-500/30 shadow-[0_0_50px_-10px_rgba(239,68,68,0.5)]">
                                    <AlertTriangle className="w-14 h-14 text-red-400" />
                                </div>
                                <h2 className="text-3xl font-black text-red-400 mb-3 tracking-tight">Acceso Denegado</h2>
                                <p className="text-slate-300 text-center font-medium px-4 leading-relaxed text-lg">{checkInMessage}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Validador de Nombre: Solo letras y espacios
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Solo permite letras (incluyendo acentos y ñ) y espacios
        const filteredValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
        setClientName(filteredValue);
    };

    // Validador de Teléfono: Solo números
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Solo permite números
        const filteredValue = value.replace(/\D/g, '');
        // Limitamos a 15 dígitos por seguridad
        if (filteredValue.length <= 15) {
            setClientPhone(filteredValue);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 pb-12 font-sans selection:bg-brand-500/20">
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-sm" />
                    ) : (
                        <div className="w-12 h-12 bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-sm">
                            {org.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="font-black text-slate-800 text-lg leading-none tracking-tight">{org.name}</h1>
                        <p className="text-[10px] font-black text-brand-500 mt-1 uppercase tracking-widest">Reserva Online</p>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 pt-8">
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">¿Qué vas a reservar?</h2>
                        <div className="space-y-4">
                            {services.map(service => {
                                const svcDuration = service.properties?.duration_minutes || service.duration_minutes || 60;
                                return (
                                    <button
                                        key={service.id}
                                        onClick={() => { setSelectedService(service); setStep(2); }}
                                        className="w-full bg-white p-5 md:p-6 rounded-2xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all text-left flex justify-between items-center group active:scale-95"
                                    >
                                        <div className="flex-1 pr-4">
                                            <p className="font-black text-slate-800 text-lg leading-tight mb-1 truncate">{service.name}</p>
                                            <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" /> {svcDuration} min
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <span className="font-black text-emerald-600 text-xl">${service.price.toLocaleString()}</span>
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-600 mb-6 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit shadow-sm transition-colors active:scale-95">
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">{isSports ? '¿En qué espacio?' : '¿Con quién?'}</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {resources.map(resource => (
                                <button
                                    key={resource.id}
                                    onClick={() => { setSelectedResource(resource); setStep(3); }}
                                    className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 group active:scale-95"
                                >
                                    <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition-colors shadow-inner">
                                        {isSports ? <MapPin className="w-6 h-6" /> : <User className="w-6 h-6" />}
                                    </div>
                                    <span className="font-black text-slate-700">{resource.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col min-h-[70vh]">
                        <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-600 mb-6 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit shadow-sm transition-colors active:scale-95">
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 mb-8 shadow-sm">
                            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Resumen de reserva</p>
                            <div className="flex justify-between items-center text-sm font-bold text-brand-900">
                                <span>{selectedService.name}</span>
                                <span className="flex items-center gap-1 opacity-70"><ChevronRight className="w-3 h-3" /> {isSports ? 'en' : 'con'} {selectedResource.name}</span>
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">Elegí fecha y hora</h2>
                        <div className="space-y-8 flex-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Fecha</label>
                                <div className="relative shadow-sm rounded-2xl">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="date"
                                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-bold text-slate-800 cursor-pointer transition-all"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                            </div>
                            {selectedDate && (
                                <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                        <span>Horarios Disponibles</span>
                                        {calculatingSlots && <Loader2 className="w-4 h-4 animate-spin text-brand-500" />}
                                    </label>
                                    {!calculatingSlots && availableSlots.length === 0 ? (
                                        <div className="text-center py-6 text-red-500 bg-red-50 rounded-2xl border border-red-100">
                                            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="font-bold text-sm">No hay horarios libres.</p>
                                            <p className="text-xs mt-1">Por favor, elegí otra fecha.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                            {availableSlots.map(time => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => setSelectedTime(time)}
                                                    className={`py-2.5 rounded-xl font-black transition-all border-2 text-sm ${selectedTime === time
                                                        ? 'border-brand-500 bg-brand-50 text-brand-600 shadow-md shadow-brand-500/20'
                                                        : 'border-slate-100 text-slate-600 hover:border-brand-300 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="sticky bottom-4 mt-8 bg-slate-50/80 backdrop-blur-sm pt-4">
                            <button
                                disabled={!selectedDate || !selectedTime}
                                onClick={() => setStep(4)}
                                className="w-full bg-slate-900 hover:bg-black text-white p-5 rounded-2xl font-black text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95"
                            >
                                Siguiente paso <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col min-h-[70vh]">
                        <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-600 mb-6 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit shadow-sm transition-colors active:scale-95">
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Confirmar Reserva</h2>
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="font-black text-slate-800 text-lg">{selectedService.name}</p>
                                    <p className="text-sm font-bold text-slate-500 mt-1">{selectedDate.split('-').reverse().join('/')} a las {selectedTime}hs</p>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-xl text-slate-800">${selectedService.price.toLocaleString()}</span>
                                    {requiresDeposit && (
                                        <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest mt-1">Seña obligatoria: ${depositAmount.toLocaleString()}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6 flex-1">
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tus Datos *</label>
                                {/* Input de Nombre */}
                                <div className="relative shadow-sm rounded-xl">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Nombre completo (Solo letras)"
                                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-bold text-slate-800 transition-all"
                                        value={clientName}
                                        onChange={handleNameChange} // Usamos la nueva función
                                    />
                                </div>

                                {/* Input de Teléfono */}
                                <div className="relative shadow-sm rounded-xl">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="tel"
                                        placeholder="WhatsApp (Solo números)"
                                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-medium text-slate-800 transition-all"
                                        value={clientPhone}
                                        onChange={handlePhoneChange} // Usamos la nueva función
                                    />
                                </div>
                            </div>

                            {/* 🔥 MOSTRAR SECCIÓN SOLO SI HAY SEÑA OBLIGATORIA */}
                            {requiresDeposit && (
                                <div className="pt-4 border-t border-slate-200">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Para asegurar el turno</label>
                                    <div className="bg-brand-50 border border-brand-200 p-5 rounded-2xl flex items-start gap-4">
                                        <CreditCard className="w-6 h-6 text-brand-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-black text-brand-800">Seña Online Obligatoria</p>
                                            <p className="text-xs text-brand-700 font-medium mt-1 leading-relaxed">
                                                Para confirmar este turno, el sistema requiere abonar una seña de <b>${depositAmount.toLocaleString()}</b>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                        <div className="sticky bottom-4 mt-8 bg-slate-50/80 backdrop-blur-sm pt-4">
                            <button
                                disabled={submitting || !clientName || !clientPhone}
                                onClick={handleBooking}
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-5 rounded-2xl font-black text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-xl shadow-brand-500/30 active:scale-95 border-b-4 border-brand-800"
                            >
                                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                {requiresDeposit ? `Pagar Seña ($${depositAmount.toLocaleString()})` : 'Confirmar Reserva'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center text-center py-16 md:py-24">
                        <div className="w-32 h-32 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-inner border-4 border-emerald-50 relative">
                            <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-20"></div>
                            <CheckCircle2 className="w-16 h-16" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-3 tracking-tight">¡Reserva Exitosa!</h2>
                        <p className="text-slate-500 font-bold text-lg mb-10 max-w-xs leading-relaxed">
                            Tu turno para <br /><span className="text-brand-600">{selectedService?.name}</span><br /> el <b>{selectedDate.split('-').reverse().join('/')}</b> a las <b>{selectedTime}hs</b> fue agendado.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-brand-600 font-black hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-8 py-4 rounded-xl transition-colors shadow-sm active:scale-95"
                        >
                            Agendar otro turno
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}