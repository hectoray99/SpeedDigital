import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { bookingService } from '../../../services/bookingService';
import { Loader2, Calendar as CalendarIcon, Clock, User, Phone, CheckCircle2, MapPin, ChevronRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function PublicRouter() {
    const { slug } = useParams();
    const [loading, setLoading] = useState(true);
    const [org, setOrg] = useState<any>(null);
    
    // Datos del catálogo
    const [services, setServices] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    
    // Estado del Wizard
    const [step, setStep] = useState(1);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedResource, setSelectedResource] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>('');
    
    // Datos del cliente
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    
    // Algoritmo de horarios
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [calculatingSlots, setCalculatingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // 1. Cargar el Local por el Slug
    useEffect(() => {
        if (slug) fetchOrganization();
    }, [slug]);

    async function fetchOrganization() {
        try {
            const { data: orgData, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error || !orgData) throw new Error('Local no encontrado');
            setOrg(orgData);
            
            // Cargar servicios y canchas
            const [servRes, resRes] = await Promise.all([
                supabase.from('catalog_items').select('*').eq('organization_id', orgData.id).eq('type', 'service').eq('is_active', true),
                supabase.from('resources').select('*').eq('organization_id', orgData.id).eq('is_active', true)
            ]);

            setServices(servRes.data || []);
            setResources(resRes.data || []);
        } catch (error) {
            toast.error('No pudimos cargar esta página');
        } finally {
            setLoading(false);
        }
    }

    // 2. Calcular horarios cuando elige fecha, cancha y servicio
    useEffect(() => {
        if (org && selectedDate && selectedService && selectedResource) {
            calculateSlots();
        }
    }, [selectedDate, selectedService, selectedResource]);

    async function calculateSlots() {
        setCalculatingSlots(true);
        setSelectedTime('');
        const slots = await bookingService.getAvailableSlots(org.id, selectedDate, selectedService.id, selectedResource.id);
        setAvailableSlots(slots);
        setCalculatingSlots(false);
    }

    // 3. Confirmar la reserva
    const handleBooking = async () => {
        if (!clientName || !clientPhone) return toast.error('Completá tus datos para continuar');
        setSubmitting(true);

        try {
            // A. Buscar o crear el cliente
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

            // B. Calcular hora de fin
            const duration = selectedService.duration_minutes || 60;
            const startDateTime = new Date(`${selectedDate}T${selectedTime}:00-03:00`); 
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

            // C. Insertar Turno
            const { error: appointmentError } = await supabase
                .from('appointments')
                .insert([{
                    organization_id: org.id,
                    person_id: personId,
                    resource_id: selectedResource.id,
                    service_id: selectedService.id,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    status: 'pending' // Entra como 'En Espera' para que el dueño lo vea
                }]);

            if (appointmentError) throw appointmentError;
            
            // Avanzar a la pantalla de éxito
            setStep(5);

        } catch (error) {
            console.error(error);
            toast.error('Hubo un problema al procesar tu reserva. Intentá de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    if (!org) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center"><h1 className="text-2xl font-black text-slate-800">404 - Local no encontrado</h1><p className="text-slate-500 mt-2">Revisá que el link esté bien escrito.</p></div>;

    const isSports = org.industry === 'sports' || org.industry === 'gym';

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* CABECERA DEL LOCAL */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-xl object-cover" />
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
                
                {/* WIZARD: PASO 1 - SERVICIO */}
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

                {/* WIZARD: PASO 2 - CANCHA / PROFESIONAL */}
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

                {/* WIZARD: PASO 3 - FECHA Y HORA */}
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

                {/* WIZARD: PASO 4 - DATOS DEL CLIENTE */}
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

                {/* WIZARD: PASO 5 - ÉXITO */}
                {step === 5 && (
                    <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center text-center py-12">
                        <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-2">¡Reserva Exitosa!</h2>
                        <p className="text-slate-500 font-medium text-lg mb-8 max-w-xs">
                            Tu turno para <b>{selectedService.name}</b> el <b>{selectedDate.split('-').reverse().join('/')}</b> a las <b>{selectedTime}</b> fue agendado.
                        </p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="text-brand-600 font-bold hover:text-brand-700 hover:underline"
                        >
                            Hacer otra reserva
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}