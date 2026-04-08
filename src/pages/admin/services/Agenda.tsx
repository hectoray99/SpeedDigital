import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { 
    Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
    User, Clock, MessageCircle, CheckCircle2, XCircle, AlertCircle, Filter, Plus, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

import NewAppointmentModal from './NewAppointmentModal';
import CheckoutModal from './CheckoutModal'; // <-- IMPORTAMOS EL CHECKOUT

const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
    pending: { label: 'En Espera', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertCircle },
    confirmed: { label: 'Reservado', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
    attended: { label: 'Atendido', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    no_show: { label: 'Ausente', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
    cancelled: { label: 'Cancelado', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: XCircle }
};

export default function Agenda() {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(true);
    
    // Controles de Modales
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [selectedAppointmentForCheckout, setSelectedAppointmentForCheckout] = useState<any>(null); // Turno a cobrar
    
    // Datos
    const [appointments, setAppointments] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]); 
    
    // Filtros
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
    const [activeResourceFilter, setActiveResourceFilter] = useState<string>('all');

    useEffect(() => {
        if (orgData?.id) {
            supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgData.id)
                .eq('is_active', true)
                .then(({ data }) => setResources(data || []));
        }
    }, [orgData?.id]);

    useEffect(() => {
        if (orgData?.id) fetchAgenda();
    }, [orgData?.id, currentDate]);

    async function fetchAgenda() {
        try {
            setLoading(true);
            const startOfDay = new Date(currentDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(currentDate);
            endOfDay.setHours(23, 59, 59, 999);

            // IMPORTANTE: Sumamos person_id, operation_id y price a la consulta
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id, 
                    start_time, 
                    end_time, 
                    status,
                    resource_id,
                    person_id,
                    operation_id,
                    crm_people ( full_name, phone ),
                    catalog_items ( id, name, duration_minutes, price ),
                    resources ( name )
                `)
                .eq('organization_id', orgData.id)
                .gte('start_time', startOfDay.toISOString())
                .lt('start_time', endOfDay.toISOString())
                .order('start_time', { ascending: true });

            if (error) throw error;
            setAppointments(data || []);

        } catch (error) {
            console.error('Error cargando agenda:', error);
            toast.error('No se pudo cargar la agenda del día');
        } finally {
            setLoading(false);
        }
    }

    const changeDay = (days: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + days);
        setCurrentDate(newDate);
    };
    const goToday = () => setCurrentDate(new Date());

    const handleStatusChange = async (appointmentId: string, newStatus: string) => {
        try {
            setAppointments(prev => prev.map(app => 
                app.id === appointmentId ? { ...app, status: newStatus } : app
            ));
            const { error } = await supabase
                .from('appointments')
                .update({ status: newStatus })
                .eq('id', appointmentId);
            if (error) throw error;
            toast.success('Estado actualizado');
        } catch (error) {
            toast.error('Error al cambiar el estado');
            fetchAgenda();
        }
    };

    const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const getWhatsAppLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

    const filteredAppointments = appointments.filter(app => {
        const matchStatus = activeStatusFilter === 'all' || app.status === activeStatusFilter;
        const matchResource = activeResourceFilter === 'all' || app.resource_id === activeResourceFilter;
        return matchStatus && matchResource;
    });

    const statusTabs = [
        { id: 'all', label: 'Todos', count: appointments.length },
        ...Object.entries(statusConfig).map(([key, config]) => ({
            id: key, label: config.label, count: appointments.filter(a => a.status === key).length
        }))
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-50 text-brand-600 rounded-xl"><CalendarIcon className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 capitalize">{currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
                        <p className="text-sm font-medium text-slate-500">{appointments.length} turnos para hoy</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setIsNewModalOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95">
                        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Turno</span> <span className="sm:hidden">Nuevo</span>
                    </button>
                    <div className="flex items-center gap-2 ml-auto sm:ml-2">
                        <button onClick={goToday} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors hidden sm:block">Hoy</button>
                        <div className="flex items-center bg-slate-100 rounded-lg p-1">
                            <button onClick={() => changeDay(-1)} className="p-2 hover:bg-white rounded-md transition-all shadow-sm"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                            <button onClick={() => changeDay(1)} className="p-2 hover:bg-white rounded-md transition-all shadow-sm"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 hide-scrollbar gap-2">
                    {statusTabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveStatusFilter(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeStatusFilter === tab.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}>
                            {tab.label} <span className={`px-2 py-0.5 rounded-md text-xs ${activeStatusFilter === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center w-full lg:w-auto bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                    <Filter className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <select value={activeResourceFilter} onChange={(e) => setActiveResourceFilter(e.target.value)} className="w-full lg:w-48 bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer">
                        <option value="all">Todos los profesionales</option>
                        {resources.map(res => <option key={res.id} value={res.id}>{res.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-4" /><p>Cargando agenda...</p></div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                        <CalendarIcon className="w-12 h-12 mb-4 text-slate-300 opacity-50" />
                        <p className="text-lg font-medium text-slate-500">{appointments.length > 0 ? 'Sin resultados para estos filtros' : 'Agenda libre'}</p>
                        <p className="text-sm">{appointments.length > 0 ? 'Probá cambiando el estado o el profesional.' : 'No hay turnos programados para este día.'}</p>
                    </div>
                ) : (
                    filteredAppointments.map((app, index) => {
                        const status = statusConfig[app.status || 'pending'];
                        const StatusIcon = status.icon;
                        const isPaid = !!app.operation_id; // Si tiene ID de operación, ya se cobró

                        return (
                            <div key={app.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center gap-4 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 50}ms` }}>
                                
                                <div className="flex flex-row md:flex-col items-center md:items-start gap-3 w-full md:w-32 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0">
                                    <div className="text-xl font-black text-brand-600 tracking-tight">{formatTime(app.start_time)}</div>
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${status.color}`}>
                                        <StatusIcon className="w-3.5 h-3.5" />{status.label}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
                                        <User className="w-4 h-4 text-slate-400 shrink-0" /> {app.crm_people?.full_name || 'Cliente sin nombre'}
                                    </h3>
                                    {app.crm_people?.phone && (
                                        <a href={getWhatsAppLink(app.crm_people.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                                            <MessageCircle className="w-4 h-4" /> {app.crm_people.phone}
                                        </a>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 bg-slate-50 p-3 rounded-xl">
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-slate-700 text-sm truncate pr-2">{app.catalog_items?.name || 'Servicio no especificado'}</p>
                                        <p className="font-black text-emerald-600 text-sm shrink-0">${app.catalog_items?.price?.toLocaleString() || 0}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                                        <Clock className="w-3 h-3" /> {app.catalog_items?.duration_minutes || 30} min <span className="mx-1">•</span> Con {app.resources?.name || 'Cualquiera'}
                                    </p>
                                </div>

                                <div className="shrink-0 w-full md:w-auto mt-2 md:mt-0 flex flex-col gap-2">
                                    <select 
                                        value={app.status || 'pending'}
                                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                        className="w-full md:w-auto p-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl cursor-pointer hover:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                                    >
                                        <option value="pending">Marcar En Espera</option>
                                        <option value="confirmed">Marcar Reservado</option>
                                        <option value="attended">Marcar Atendido</option>
                                        <option value="no_show">Marcar Ausente</option>
                                        <option value="cancelled">Cancelar Turno</option>
                                    </select>

                                    {/* BOTÓN DE COBRO: Solo aparece si NO está pagado y NO está cancelado */}
                                    {!isPaid && app.status !== 'cancelled' && app.status !== 'no_show' && (
                                        <button 
                                            onClick={() => setSelectedAppointmentForCheckout(app)}
                                            className="w-full md:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                                        >
                                            <DollarSign className="w-4 h-4" /> Cobrar
                                        </button>
                                    )}
                                </div>

                            </div>
                        );
                    })
                )}
            </div>

            <NewAppointmentModal 
                isOpen={isNewModalOpen} 
                onClose={() => setIsNewModalOpen(false)} 
                onSuccess={() => { setIsNewModalOpen(false); fetchAgenda(); }} 
            />

            {/* MODAL DE COBRO */}
            <CheckoutModal
                isOpen={!!selectedAppointmentForCheckout}
                onClose={() => setSelectedAppointmentForCheckout(null)}
                appointment={selectedAppointmentForCheckout}
                onSuccess={() => {
                    setSelectedAppointmentForCheckout(null);
                    fetchAgenda(); // Recargamos para que el botón verde desaparezca y el status cambie
                }}
            />

        </div>
    );
}