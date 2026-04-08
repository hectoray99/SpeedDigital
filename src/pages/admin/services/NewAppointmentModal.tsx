import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <-- IMPORTAMOS PORTAL
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
    
    const [services, setServices] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [calculatingSlots, setCalculatingSlots] = useState(false);

    const [formData, setFormData] = useState({
        clientName: '',
        clientPhone: '',
        serviceId: '',
        resourceId: '', 
        date: new Date().toISOString().split('T')[0],
        time: ''
    });

    useEffect(() => {
        if (isOpen && orgData?.id) {
            fetchInitialData();
            setFormData(prev => ({ ...prev, time: '' }));
            setAvailableSlots([]);
        }
    }, [isOpen, orgData?.id]);

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
                .eq('organization_id', orgData.id)
                .eq('type', 'service')
                .eq('is_active', true);
            
            const { data: resourcesData } = await supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgData.id)
                .eq('is_active', true);

            setServices(servicesData || []);
            setResources(resourcesData || []);
        } catch (error) {
            toast.error('Error al cargar catálogos');
        }
    }

    async function calculateSlots() {
        setCalculatingSlots(true);
        setFormData(prev => ({ ...prev, time: '' })); 
        
        const slots = await bookingService.getAvailableSlots(
            orgData.id, 
            formData.date, 
            formData.serviceId, 
            formData.resourceId
        );
        
        setAvailableSlots(slots);
        setCalculatingSlots(false);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let personId = null;
            
            if (formData.clientPhone) {
                const { data: existingPerson } = await supabase
                    .from('crm_people')
                    .select('id')
                    .eq('organization_id', orgData.id)
                    .eq('phone', formData.clientPhone)
                    .maybeSingle();
                
                if (existingPerson) personId = existingPerson.id;
            }

            if (!personId) {
                const { data: newPerson, error: personError } = await supabase
                    .from('crm_people')
                    .insert([{
                        organization_id: orgData.id,
                        full_name: formData.clientName,
                        phone: formData.clientPhone || null,
                        type: 'client'
                    }])
                    .select('id')
                    .single();
                
                if (personError) throw personError;
                personId = newPerson.id;
            }

            const service = services.find(s => s.id === formData.serviceId);
            const duration = service?.duration_minutes || 30;

            const startDateTime = new Date(`${formData.date}T${formData.time}:00-03:00`); 
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

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
            toast.error('Hubo un problema al guardar el turno');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // ACA ESTÁ LA MAGIA DEL PORTAL (z-[99999] y directo al body)
    return createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Nuevo Turno</h2>
                        <p className="text-sm text-slate-500 font-medium">Agendar reserva manual</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    <section>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                            Datos del Cliente
                        </h3>
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Nombre completo..." 
                                    className="w-full pl-10 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium"
                                    value={formData.clientName}
                                    onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                                />
                            </div>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input 
                                    type="tel" 
                                    placeholder="WhatsApp (Opcional)" 
                                    className="w-full pl-10 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium"
                                    value={formData.clientPhone}
                                    onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                                />
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">2</span>
                            El Servicio
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">¿Qué se va a hacer?</label>
                                <div className="relative">
                                    <Scissors className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <select 
                                        className="w-full pl-10 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium appearance-none cursor-pointer"
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
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">¿Con quién?</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <select 
                                        className="w-full pl-10 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium appearance-none cursor-pointer"
                                        value={formData.resourceId}
                                        onChange={(e) => setFormData({...formData, resourceId: e.target.value})}
                                    >
                                        <option value="" disabled>Seleccionar profesional...</option>
                                        {resources.map(r => (
                                            <option key={r.id} value={r.id}>Con {r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={(!formData.serviceId || !formData.resourceId) ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">3</span>
                            Día y Hora
                        </h3>

                        <div className="space-y-6">
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input 
                                    type="date" 
                                    disabled={!formData.serviceId || !formData.resourceId}
                                    className="w-full pl-10 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-50"
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    min={new Date().toISOString().split('T')[0]} 
                                />
                            </div>

                            <div>
                                <label className=" text-xs font-bold text-slate-500 mb-3 ml-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Horarios disponibles</span>
                                    {calculatingSlots && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />}
                                </label>
                                
                                {/* MENSAJES INTELIGENTES DE UI */}
                                {!formData.serviceId || !formData.resourceId ? (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-medium text-slate-500">
                                        Elegí un servicio y un profesional para ver los horarios.
                                    </div>
                                ) : !calculatingSlots && availableSlots.length === 0 ? (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-sm font-medium text-red-600">
                                        No hay horarios disponibles para este día. Chequeá la configuración en Personal.
                                    </div>
                                ) : null}

                                <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {availableSlots.map((time) => (
                                        <button
                                            key={time}
                                            type="button"
                                            onClick={() => setFormData({...formData, time})}
                                            className={`py-2 rounded-lg text-sm font-bold transition-all border ${
                                                formData.time === time
                                                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/30'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-600'
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

                <div className="p-6 border-t border-slate-100 bg-white z-10">
                    <button 
                        onClick={handleSubmit}
                        disabled={loading || !formData.clientName || !formData.serviceId || !formData.resourceId || !formData.time}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-brand-500/20"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                        Confirmar y Agendar
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
}