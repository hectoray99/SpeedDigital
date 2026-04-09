// =============================================================================
// PublicRouter.tsx
// Enrutador Público Multi-Tenant (SaaS).
// Detecta la industria de la organización mediante el 'slug' y renderiza:
// - GIMNASIOS: Un Kiosco de Check-in con DNI.
// - SERVICIOS/CANCHAS: Un Asistente (Wizard) de Reservas paso a paso.
// =============================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { bookingService } from '../../../services/bookingService';
import { Loader2, Calendar as CalendarIcon, Clock, User, Phone, CheckCircle2, MapPin, ChevronRight, ArrowLeft, Dumbbell, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function PublicRouter() {
    const { slug } = useParams();
    const [loading, setLoading] = useState(true);
    const [org, setOrg] = useState<any>(null);

    // =========================================================================
    // ESTADOS: MÓDULO RESERVAS (Canchas / Servicios)
    // =========================================================================
    const [services, setServices] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [step, setStep] = useState(1);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedResource, setSelectedResource] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [calculatingSlots, setCalculatingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // =========================================================================
    // ESTADOS: MÓDULO CHECK-IN (Gimnasios)
    // =========================================================================
    const [dniInput, setDniInput] = useState('');
    const [checkInState, setCheckInState] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [checkInMessage, setCheckInMessage] = useState('');
    const [checkInStudent, setCheckInStudent] = useState<string>('');

    // =========================================================================
    // CICLO DE VIDA: Inicialización
    // =========================================================================
    useEffect(() => {
        if (slug) fetchOrganization();
    }, [slug]);

    // Calcula horarios libres si estamos en modo Reservas
    useEffect(() => {
        if (org && org.industry !== 'gym' && selectedDate && selectedService && selectedResource) {
            calculateSlots();
        }
    }, [selectedDate, selectedService, selectedResource, org]);

    // =========================================================================
    // FUNCIONES: Carga de Datos
    // =========================================================================
    async function fetchOrganization() {
        try {
            const { data: orgData, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error || !orgData) throw new Error('Local no encontrado');
            setOrg(orgData);

            // Solo cargamos catálogo si NO es un gimnasio (el gym solo necesita DNI)
            if (orgData.industry !== 'gym') {
                const [servRes, resRes] = await Promise.all([
                    supabase.from('catalog_items').select('*').eq('organization_id', orgData.id).eq('type', 'service').eq('is_active', true),
                    supabase.from('resources').select('*').eq('organization_id', orgData.id).eq('is_active', true)
                ]);
                setServices(servRes.data || []);
                setResources(resRes.data || []);
            }
        } catch (error) {
            toast.error('No pudimos cargar esta página');
        } finally {
            setLoading(false);
        }
    }

    async function calculateSlots() {
        setCalculatingSlots(true);
        setSelectedTime('');
        const slots = await bookingService.getAvailableSlots(org.id, selectedDate, selectedService.id, selectedResource.id);
        setAvailableSlots(slots);
        setCalculatingSlots(false);
    }

    // =========================================================================
    // ACCIÓN: Crear Reserva (Canchas/Servicios)
    // =========================================================================
    const handleBooking = async () => {
        if (!clientName || !clientPhone) return toast.error('Completá tus datos para continuar');
        setSubmitting(true);

        try {
            // Buscar o crear persona
            let personId = null;
            const { data: existingPerson } = await supabase
                .from('crm_people')
                .select('id')
                .eq('organization_id', org.id)
                .eq('phone', clientPhone)
                .maybeSingle();

            if (existingPerson) {
                personId = existingPerson.id;
            } else {
                const { data: newPerson, error: personError } = await supabase
                    .from('crm_people')
                    .insert([{ organization_id: org.id, full_name: clientName, phone: clientPhone, type: 'client' }])
                    .select('id').single();
                if (personError) throw personError;
                personId = newPerson.id;
            }

            // Calcular bloque de tiempo
            const duration = selectedService.duration_minutes || 60;
            const startDateTime = new Date(`${selectedDate}T${selectedTime}:00-03:00`);
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

            // Guardar Turno
            const { error: appointmentError } = await supabase
                .from('appointments')
                .insert([{
                    organization_id: org.id,
                    person_id: personId,
                    resource_id: selectedResource.id,
                    service_id: selectedService.id,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    status: 'pending' // Pendiente de pago/confirmación
                }]);

            if (appointmentError) throw appointmentError;
            setStep(5); // Pantalla de éxito

        } catch (error) {
            console.error(error);
            toast.error('Hubo un problema al procesar tu reserva.');
        } finally {
            setSubmitting(false);
        }
    };

    // =========================================================================
    // ACCIÓN: Procesar Check-In (Gimnasios)
    // =========================================================================
    const handleGymCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dniInput.trim()) return;

        setCheckInState('checking');
        
        try {
            // 1. Buscamos al alumno por su DNI
            const { data: student, error } = await supabase
                .from('crm_people')
                .select('full_name, details, is_active')
                .eq('organization_id', org.id)
                .eq('identifier', dniInput.trim())
                .maybeSingle();

            if (error || !student) {
                setCheckInState('error');
                setCheckInMessage('DNI no registrado en el sistema.');
                resetCheckIn(4000);
                return;
            }

            if (!student.is_active) {
                setCheckInState('error');
                setCheckInMessage('Tu cuenta está inactiva. Pasá por recepción.');
                resetCheckIn(4000);
                return;
            }

            // 2. Validar Planes Activos
            const details = student.details as any;
            let plans = details?.active_plans || [];
            if (plans.length === 0 && details?.active_plan) plans = [details.active_plan];

            if (plans.length === 0) {
                setCheckInState('error');
                setCheckInMessage('No tenés ningún plan activo. Pasá por recepción.');
                resetCheckIn(4000);
                return;
            }

            // Verificar si algún plan no está vencido
            const hasValidPlan = plans.some((p: any) => new Date() <= new Date(p.expires_at));

            if (!hasValidPlan) {
                setCheckInState('error');
                setCheckInMessage('Tu plan está vencido. Pasá por recepción para renovar.');
                resetCheckIn(4000);
                return;
            }

            // 3. ¡Acceso Concedido!
            setCheckInStudent(student.full_name);
            setCheckInState('success');
            resetCheckIn(4000);

            // TODO Futuro: Registrar la asistencia en una tabla 'attendance_logs'

        } catch (error) {
            setCheckInState('error');
            setCheckInMessage('Error de conexión. Intentá de nuevo.');
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

    // =========================================================================
    // RENDER: Estados de Carga
    // =========================================================================
    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    if (!org) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center"><h1 className="text-2xl font-black text-slate-800">404 - Local no encontrado</h1><p className="text-slate-500 mt-2">Revisá que el link esté bien escrito.</p></div>;

    const isSports = org.industry === 'sports' || org.industry === 'gym';

    // =========================================================================
    // RENDER 1: MODO GIMNASIO (Kiosco de Asistencia)
    // =========================================================================
    if (org.industry === 'gym') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
                {/* Elementos decorativos de fondo */}
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse delay-1000"></div>

                <div className="z-10 w-full max-w-md text-center space-y-8">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-32 h-32 rounded-3xl object-cover mx-auto shadow-2xl border-4 border-slate-800" />
                    ) : (
                        <div className="w-32 h-32 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-2xl border border-slate-700">
                            <Dumbbell className="w-16 h-16 text-brand-500" />
                        </div>
                    )}
                    
                    <div>
                        <h1 className="text-4xl font-black tracking-tight">{org.name}</h1>
                        <p className="text-slate-400 font-medium mt-2 text-lg">Control de Acceso</p>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl relative min-h-[250px] flex flex-col justify-center">
                        
                        {checkInState === 'idle' && (
                            <form onSubmit={handleGymCheckIn} className="animate-in zoom-in-95 duration-300">
                                <label className="block text-sm font-bold text-slate-300 mb-4">Ingresá tu DNI para dar el presente</label>
                                <input 
                                    autoFocus
                                    type="number" 
                                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 text-center text-3xl font-black text-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 outline-none transition-all placeholder:text-slate-700"
                                    placeholder="DNI"
                                    value={dniInput}
                                    onChange={(e) => setDniInput(e.target.value)}
                                />
                                <button 
                                    type="submit"
                                    disabled={!dniInput}
                                    className="w-full mt-6 bg-brand-500 hover:bg-brand-600 text-white p-5 rounded-2xl font-black text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20 active:scale-95"
                                >
                                    Confirmar Asistencia
                                </button>
                            </form>
                        )}

                        {checkInState === 'checking' && (
                            <div className="flex flex-col items-center justify-center animate-in fade-in duration-300">
                                <Loader2 className="w-16 h-16 animate-spin text-brand-500 mb-4" />
                                <p className="font-bold text-slate-300 text-lg">Verificando pase...</p>
                            </div>
                        )}

                        {checkInState === 'success' && (
                            <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-500/30">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                                </div>
                                <h2 className="text-3xl font-black text-emerald-400 mb-2">¡Adelante!</h2>
                                <p className="text-slate-300 text-xl font-bold">{checkInStudent}</p>
                                <p className="text-emerald-500/80 font-medium mt-1">Suscripción al día</p>
                            </div>
                        )}

                        {checkInState === 'error' && (
                            <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
                                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-4 border-4 border-red-500/30">
                                    <AlertTriangle className="w-12 h-12 text-red-400" />
                                </div>
                                <h2 className="text-2xl font-black text-red-400 mb-2">Acceso Denegado</h2>
                                <p className="text-slate-300 text-center font-medium px-4">{checkInMessage}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // RENDER 2: MODO RESERVAS (Canchas y Servicios)
    // =========================================================================
    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header del Local */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-xl object-cover border border-slate-100" />
                    ) : (
                        <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm">
                            {org.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="font-black text-slate-800 leading-none">{org.name}</h1>
                        <p className="text-xs font-bold text-brand-500 mt-0.5">Reserva Online</p>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 pt-6">
                
                {/* WIZARD PASO 1: SERVICIO */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-xl font-black text-slate-800 mb-4">¿Qué vas a reservar?</h2>
                        <div className="space-y-3">
                            {services.map(service => (
                                <button 
                                    key={service.id} 
                                    onClick={() => { setSelectedService(service); setStep(2); }}
                                    className="w-full bg-white p-4 rounded-2xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all text-left flex justify-between items-center group"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-lg">{service.name}</p>
                                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" /> {service.duration_minutes || 60} min
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-emerald-600">${service.price.toLocaleString()}</span>
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* WIZARD PASO 2: RECURSO */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-slate-600 mb-4">
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <h2 className="text-xl font-black text-slate-800 mb-4">{isSports ? '¿En qué espacio?' : '¿Con quién?'}</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {resources.map(resource => (
                                <button 
                                    key={resource.id} 
                                    onClick={() => { setSelectedResource(resource); setStep(3); }}
                                    className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2 group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                        {isSports ? <MapPin className="w-6 h-6" /> : <User className="w-6 h-6" />}
                                    </div>
                                    <span className="font-bold text-slate-700">{resource.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* WIZARD PASO 3: FECHA Y HORA */}
                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-slate-600 mb-4">
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        
                        <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 mb-6 flex justify-between items-center text-sm font-medium text-brand-800">
                            <span>{selectedService.name}</span>
                            <span>{isSports ? 'en' : 'con'} {selectedResource.name}</span>
                        </div>

                        <h2 className="text-xl font-black text-slate-800 mb-4">Elegí fecha y hora</h2>
                        
                        <div className="space-y-6">
                            <div className="relative">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input 
                                    type="date" 
                                    className="w-full pl-12 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-500/20 outline-none font-bold text-slate-700 cursor-pointer"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]} 
                                />
                            </div>

                            {selectedDate && (
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <label className="text-sm font-bold text-slate-500 mb-3 flex items-center justify-between">
                                        <span>Horarios disponibles</span>
                                        {calculatingSlots && <Loader2 className="w-4 h-4 animate-spin text-brand-500" />}
                                    </label>
                                    
                                    {!calculatingSlots && availableSlots.length === 0 ? (
                                        <p className="text-center text-sm text-red-500 font-medium py-4">No hay turnos libres para esta fecha.</p>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {availableSlots.map(time => (
                                                <button
                                                    key={time}
                                                    onClick={() => setSelectedTime(time)}
                                                    className={`py-3 rounded-xl font-black transition-all border-2 ${
                                                        selectedTime === time
                                                            ? 'border-brand-500 bg-brand-50 text-brand-600 shadow-sm'
                                                            : 'border-slate-100 text-slate-600 hover:border-brand-300'
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

                        <button 
                            disabled={!selectedDate || !selectedTime}
                            onClick={() => setStep(4)}
                            className="w-full mt-8 bg-slate-800 hover:bg-slate-900 text-white p-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-slate-800/20"
                        >
                            Continuar <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* WIZARD PASO 4: DATOS DE CONTACTO */}
                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-slate-600 mb-4">
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>

                        <h2 className="text-xl font-black text-slate-800 mb-6">Tus datos para la reserva</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Nombre y Apellido</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full pl-12 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-500/20 outline-none font-medium"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">WhatsApp</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input 
                                        type="tel" 
                                        placeholder="Ej: 3704123456"
                                        className="w-full pl-12 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-500/20 outline-none font-medium"
                                        value={clientPhone}
                                        onChange={(e) => setClientPhone(e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 font-medium ml-1 mt-1.5">Te enviaremos la confirmación a este número.</p>
                            </div>
                        </div>

                        <button 
                            disabled={submitting || !clientName || !clientPhone}
                            onClick={handleBooking}
                            className="w-full mt-8 bg-brand-500 hover:bg-brand-600 text-white p-4 rounded-xl font-black text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-brand-500/30"
                        >
                            {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                            Confirmar Reserva
                        </button>
                    </div>
                )}

                {/* WIZARD PASO 5: ÉXITO */}
                {step === 5 && (
                    <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center text-center py-12">
                        <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner border-4 border-emerald-50">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-2">¡Reserva Exitosa!</h2>
                        <p className="text-slate-500 font-medium text-lg mb-8 max-w-xs">
                            Tu turno para <b>{selectedService.name}</b> el <b>{selectedDate.split('-').reverse().join('/')}</b> a las <b>{selectedTime}</b> fue agendado.
                        </p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="text-brand-600 font-bold hover:text-brand-700 hover:underline bg-brand-50 px-6 py-3 rounded-xl transition-colors"
                        >
                            Hacer otra reserva
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}