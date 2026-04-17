import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { X, User, Phone, Search, Scissors, Calendar as CalendarIcon, Loader2, CheckCircle2, Repeat } from 'lucide-react';
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
        time: '',
        isRecurring: false,
        repeatWeeks: 4 
    });

    useEffect(() => {
        if (isOpen && orgData?.id) {
            fetchInitialData();
            setFormData(prev => ({ 
                ...prev, 
                time: '', 
                clientName: '', 
                clientPhone: '', 
                isRecurring: false, 
                repeatWeeks: 4 
            }));
            setAvailableSlots([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, orgData?.id]);

    useEffect(() => {
        if (formData.date && formData.serviceId && formData.resourceId) {
            calculateSlots();
        } else {
            setAvailableSlots([]); 
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            setAvailableSlots([]);
        } finally {
            setCalculatingSlots(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setLoading(true);

        try {
            let personId = null;
            
            // PASO A: Averiguar si el Cliente ya existe
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

            // PASO B: Si es cliente nuevo, lo creamos
            if (!personId) {
                const { data: newPerson, error: personError } = await supabase
                    .from('crm_people')
                    .insert([{
                        organization_id: orgData.id,
                        full_name: formData.clientName.trim(),
                        phone: sanitizedPhone || null,
                        type: 'client'
                    }])
                    .select('id')
                    .single();
                
                if (personError) throw personError;
                personId = newPerson.id;
            }

            // PASO C: Preparar turnos a insertar
            const service = services.find(s => s.id === formData.serviceId);
            const duration = service?.duration_minutes || 30;

            const datesToBook = formData.isRecurring 
                ? bookingService.getRecurringDates(formData.date, formData.repeatWeeks - 1) 
                : [formData.date];

            const appointmentsToInsert = datesToBook.map(dateStr => {
                const startDateTime = new Date(`${dateStr}T${formData.time}:00-03:00`);
                const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
                
                return {
                    organization_id: orgData.id,
                    person_id: personId,
                    resource_id: formData.resourceId,
                    service_id: formData.serviceId,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    status: 'confirmed' 
                };
            });

            // PASO D: Insertar en BD
            const { error: appointmentError } = await supabase
                .from('appointments')
                .insert(appointmentsToInsert);

            if (appointmentError) throw appointmentError;

            toast.success(formData.isRecurring ? `¡${appointmentsToInsert.length} Turnos agendados con éxito!` : 'Turno agendado con éxito');
            onSuccess(); 

        } catch (error: any) {
            console.error('Error guardando turno:', error);
            toast.error('Hubo un problema al guardar el turno en la base de datos.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-hidden flex justify-end">
                    <Dialog.Panel className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-all animate-in slide-in-from-right duration-300">
                        
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80 shrink-0 backdrop-blur-sm">
                            <div>
                                <Dialog.Title as="h2" className="text-xl font-black text-slate-800">Nuevo Turno</Dialog.Title>
                                <p className="text-sm text-slate-500 font-medium">Agendar reserva manual</p>
                            </div>
                            <button onClick={onClose} disabled={loading} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors shadow-sm border border-transparent hover:border-slate-200 disabled:opacity-50">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

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

                            {/* SECCIÓN 3: CALENDARIO Y RECURRENCIA */}
                            <section className={(!formData.serviceId || !formData.resourceId) ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">3</span>
                                    Día y Hora
                                </h3>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Fecha de Inicio</label>
                                        <div className="relative shadow-sm rounded-2xl">
                                            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input 
                                                type="date" 
                                                disabled={!formData.serviceId || !formData.resourceId}
                                                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-bold text-slate-800 cursor-pointer disabled:cursor-not-allowed transition-all"
                                                value={formData.date}
                                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                                min={new Date().toISOString().split('T')[0]} 
                                            />
                                        </div>
                                    </div>

                                    {formData.date && (
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.isRecurring}
                                                    onChange={(e) => setFormData({...formData, isRecurring: e.target.checked})}
                                                    className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500"
                                                />
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800 flex items-center gap-1.5"><Repeat className="w-4 h-4"/> Hacer turno recurrente</p>
                                                    <p className="text-xs text-slate-500 font-medium">Repetir el mismo día y hora en el futuro.</p>
                                                </div>
                                            </label>

                                            {formData.isRecurring && (
                                                <div className="mt-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">¿Por cuántas semanas?</label>
                                                    <select 
                                                        value={formData.repeatWeeks}
                                                        onChange={(e) => setFormData({...formData, repeatWeeks: Number(e.target.value)})}
                                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-bold text-slate-700 appearance-none transition-all"
                                                    >
                                                        <option value={2}>2 Semanas (15 días)</option>
                                                        <option value={4}>4 Semanas (1 Mes)</option>
                                                        <option value={12}>12 Semanas (3 Meses)</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {formData.date && (
                                        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                                <span>Horarios Disponibles</span>
                                                {calculatingSlots && <Loader2 className="w-4 h-4 animate-spin text-brand-500" />}
                                            </label>
                                            
                                            {!calculatingSlots && availableSlots.length === 0 ? (
                                                <div className="text-center py-6 text-red-500 bg-red-50 rounded-2xl border border-red-100">
                                                    <p className="font-bold text-sm">No hay horarios libres.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {availableSlots.map(time => (
                                                        <button
                                                            key={time}
                                                            type="button"
                                                            onClick={() => setFormData({...formData, time})}
                                                            className={`py-2.5 rounded-xl font-black transition-all border-2 text-sm ${
                                                                formData.time === time
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
                            </section>

                        </div>

                        {/* FOOTER ACTIONS */}
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