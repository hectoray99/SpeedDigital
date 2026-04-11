import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { X, User, Phone, Search, Scissors, Calendar as CalendarIcon, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { bookingService } from '../../../services/bookingService';

interface NewAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function NewAppointmentModal({ isOpen, onClose, onSuccess }: NewAppointmentModalProps) {
    const { orgData } = useAuthStore();
    
    // Selectores
    const [services, setServices] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    
    // Status
    const [loading, setLoading] = useState(false);
    const [calculatingSlots, setCalculatingSlots] = useState(false);

    // Formulario
    const [formData, setFormData] = useState({
        clientName: '',
        clientPhone: '',
        serviceId: '',
        resourceId: '', 
        date: new Date().toISOString().split('T')[0],
        time: ''
    });

    // =========================================================================
    // INICIALIZACIÓN Y BÚSQUEDAS (Efectos)
    // =========================================================================

    // 1. Cargar servicios y profesionales al abrir el modal
    useEffect(() => {
        if (isOpen && orgData?.id) {
            fetchInitialData();
            // Resetear el estado para que un turno anterior no quede pegado
            setFormData(prev => ({ ...prev, time: '', clientName: '', clientPhone: '' }));
            setAvailableSlots([]);
        }
    }, [isOpen, orgData?.id]);

    // 2. Si cambian Fecha, Servicio o Profesional, recalcular los Horarios Disponibles
    useEffect(() => {
        if (formData.date && formData.serviceId && formData.resourceId) {
            calculateSlots();
        } else {
            setAvailableSlots([]); 
        }
    }, [formData.date, formData.serviceId, formData.resourceId]);

    async function fetchInitialData() {
        try {
            const { data: servicesData } = await supabase
                .from('catalog_items')
                .select('id, name, duration_minutes, price')
                .eq('organization_id', orgData?.id)
                .eq('type', 'service')
                .eq('is_active', true);
            
            const { data: resourcesData } = await supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgData?.id)
                .eq('is_active', true);

            setServices(servicesData || []);
            setResources(resourcesData || []);
        } catch (error) {
            toast.error('Error al cargar catálogos.');
        }
    }

    async function calculateSlots() {
        setCalculatingSlots(true);
        setFormData(prev => ({ ...prev, time: '' })); 
        
        try {
            const slots = await bookingService.getAvailableSlots(
                orgData?.id!, 
                formData.date, 
                formData.serviceId, 
                formData.resourceId
            );
            setAvailableSlots(slots);
        } catch (error) {
            console.error("Error calculando horarios", error);
            setAvailableSlots([]);
        } finally {
            setCalculatingSlots(false);
        }
    }

    // =========================================================================
    // CREACIÓN DEL TURNO (Base de datos)
    // =========================================================================
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setLoading(true);

        try {
            let personId = null;
            
            // PASO A: Averiguar si el Cliente ya existe (Por Teléfono)
            const sanitizedPhone = formData.clientPhone.trim();
            if (sanitizedPhone) {
                const { data: existingPerson } = await supabase
                    .from('crm_people')
                    .select('id')
                    .eq('organization_id', orgData.id)
                    .eq('phone', sanitizedPhone)
                    .maybeSingle();
                
                if (existingPerson) personId = existingPerson.id;
            }

            // PASO B: Si es un cliente nuevo, lo creamos en el CRM
            if (!personId) {
                const { data: newPerson, error: personError } = await supabase
                    .from('crm_people')
                    .insert([{
                        organization_id: orgData.id,
                        full_name: formData.clientName.trim(),
                        phone: sanitizedPhone || null, // Guardamos Null explícito si está vacío
                        type: 'client'
                    }])
                    .select('id')
                    .single();
                
                if (personError) throw personError;
                personId = newPerson.id;
            }

            // PASO C: Calcular el rango de tiempo del turno
            const service = services.find(s => s.id === formData.serviceId);
            const duration = service?.duration_minutes || 30;

            // Formatear fechas respetando la zona horaria UTC de Supabase pero leyendo desde la selección local
            const startDateTime = new Date(`${formData.date}T${formData.time}:00-03:00`); // Argentina Time (Ejemplo)
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

            // PASO D: Insertar el Turno
            const { error: appointmentError } = await supabase
                .from('appointments')
                .insert([{
                    organization_id: orgData.id,
                    person_id: personId,
                    resource_id: formData.resourceId,
                    service_id: formData.serviceId,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    status: 'confirmed' 
                }]);

            if (appointmentError) throw appointmentError;

            toast.success('Turno agendado con éxito');
            onSuccess(); 

        } catch (error: any) {
            console.error('Error guardando turno:', error);
            toast.error('Hubo un problema al guardar el turno en la base de datos.');
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // RENDER PRINCIPAL DEL MODAL
    // =========================================================================
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-hidden flex justify-end">
                    <Dialog.Panel className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-all animate-in slide-in-from-right duration-300">
                        
                        {/* HEADER (Sticky) */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80 shrink-0 backdrop-blur-sm">
                            <div>
                                <Dialog.Title as="h2" className="text-xl font-black text-slate-800">Nuevo Turno</Dialog.Title>
                                <p className="text-sm text-slate-500 font-medium">Agendar reserva manual</p>
                            </div>
                            <button onClick={onClose} disabled={loading} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors shadow-sm border border-transparent hover:border-slate-200 disabled:opacity-50">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* BODY (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
                            
                            {/* SECCIÓN 1: CLIENTE */}
                            <section>
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                                    Datos del Cliente
                                </h3>
                                <div className="space-y-4">
                                    <div className="relative shadow-sm rounded-xl">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input 
                                            type="text" 
                                            autoFocus
                                            placeholder="Nombre completo..." 
                                            className="w-full pl-11 p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white outline-none font-bold text-slate-800 transition-all"
                                            value={formData.clientName}
                                            onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                                        />
                                    </div>
                                    <div className="relative shadow-sm rounded-xl">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input 
                                            type="tel" 
                                            placeholder="WhatsApp (Opcional)" 
                                            className="w-full pl-11 p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white outline-none font-medium text-slate-800 transition-all"
                                            value={formData.clientPhone}
                                            onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SECCIÓN 2: SERVICIO Y RECURSO */}
                            <section>
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">2</span>
                                    El Servicio
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">¿Qué se va a hacer? *</label>
                                        <div className="relative shadow-sm rounded-xl">
                                            <Scissors className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <select 
                                                className="w-full pl-11 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white outline-none font-bold text-slate-700 appearance-none cursor-pointer transition-all"
                                                value={formData.serviceId}
                                                onChange={(e) => setFormData({...formData, serviceId: e.target.value})}
                                            >
                                                <option value="" disabled>Seleccionar servicio...</option>
                                                {services.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">¿Con quién o dónde? *</label>
                                        <div className="relative shadow-sm rounded-xl">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <select 
                                                className="w-full pl-11 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white outline-none font-bold text-slate-700 appearance-none cursor-pointer transition-all"
                                                value={formData.resourceId}
                                                onChange={(e) => setFormData({...formData, resourceId: e.target.value})}
                                            >
                                                <option value="" disabled>Asignar recurso...</option>
                                                {resources.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECCIÓN 3: CALENDARIO Y SLOTS (Se opaca si faltan datos arriba) */}
                            <section className={(!formData.serviceId || !formData.resourceId) ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">3</span>
                                    Día y Hora
                                </h3>

                                <div className="space-y-6">
                                    <div className="relative shadow-sm rounded-xl">
                                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input 
                                            type="date" 
                                            disabled={!formData.serviceId || !formData.resourceId}
                                            className="w-full pl-11 p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white outline-none font-bold text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-all"
                                            value={formData.date}
                                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                                            min={new Date().toISOString().split('T')[0]} 
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-3 ml-1 flex items-center justify-between">
                                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Horarios disponibles *</span>
                                            {calculatingSlots && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />}
                                        </label>
                                        
                                        {/* MENSAJES INTELIGENTES DE UI */}
                                        {!formData.serviceId || !formData.resourceId ? (
                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-medium text-slate-500">
                                                Elegí un servicio y un profesional para ver los horarios.
                                            </div>
                                        ) : !calculatingSlots && availableSlots.length === 0 ? (
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-sm font-bold text-red-600">
                                                No hay horarios disponibles para este día. Chequeá la agenda del profesional.
                                            </div>
                                        ) : null}

                                        {/* GRILLA DE BOTONES DE HORA */}
                                        <div className="grid grid-cols-4 gap-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                            {availableSlots.map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => setFormData({...formData, time})}
                                                    className={`py-2.5 rounded-xl text-sm font-black transition-all border-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                                                        formData.time === time
                                                            ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                                                            : 'bg-white text-slate-600 border-slate-100 hover:border-brand-300 hover:text-brand-600'
                                                    }`}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                        </div>

                        {/* FOOTER ACTIONS (Sticky Bottom) */}
                        <div className="p-6 border-t border-slate-100 bg-white z-10 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                            <button 
                                onClick={handleSubmit}
                                disabled={loading || !formData.clientName || !formData.serviceId || !formData.resourceId || !formData.time}
                                className="w-full bg-slate-900 hover:bg-black text-white p-4.5 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-slate-900/20"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                                Confirmar y Agendar
                            </button>
                        </div>

                    </Dialog.Panel>
                </div>
            </Dialog>
        </Transition>
    );
}