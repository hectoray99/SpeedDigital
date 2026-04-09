import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { 
    Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
    User, Clock, MessageCircle, CheckCircle2, XCircle, AlertCircle, Filter, Plus, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

import NewAppointmentModal from './NewAppointmentModal';
import CheckoutModal from './CheckoutModal'; 

const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
    pending: { label: 'En Espera', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertCircle },
    confirmed: { label: 'Reservado', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
    attended: { label: 'Atendido', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    no_show: { label: 'Ausente', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
    cancelled: { label: 'Cancelado', color: 'text-slate-500 bg-slate-100 border-slate-300', icon: XCircle }
};

export default function Agenda() {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(true);
    
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [selectedAppointmentForCheckout, setSelectedAppointmentForCheckout] = useState<any>(null);
    
    const [appointments, setAppointments] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]); 
    
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
        <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
            
            {/* CABECERA Y NAVEGACIÓN DE FECHA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-5 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-100 hidden sm:block"><CalendarIcon className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 capitalize tracking-tight">{currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{appointments.length} turnos agendados hoy</p>
                    </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1.5 w-full sm:w-auto order-2 sm:order-1">
                        <button onClick={() => changeDay(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all active:scale-95"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                        <button onClick={goToday} className="px-4 py-2 text-sm font-black text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all active:scale-95 mx-1 uppercase tracking-wider">Hoy</button>
                        <button onClick={() => changeDay(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all active:scale-95"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                    </div>
                    <button onClick={() => setIsNewModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all active:scale-95 order-1 sm:order-2 text-sm">
                        <Plus className="w-5 h-5" /> Nuevo Turno
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex overflow-x-auto w-full lg:w-auto hide-scrollbar gap-2 px-1">
                    {statusTabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveStatusFilter(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeStatusFilter === tab.id ? 'bg-slate-800 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                            {tab.label} <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${activeStatusFilter === tab.id ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{tab.count}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center w-full lg:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:bg-white transition-all mx-1 lg:mx-0">
                    <Filter className="w-4 h-4 text-brand-500 mr-3 shrink-0" />
                    <select value={activeResourceFilter} onChange={(e) => setActiveResourceFilter(e.target.value)} className="w-full lg:w-56 bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none">
                        <option value="all">Cualquier Profesional / Espacio</option>
                        {resources.map(res => <option key={res.id} value={res.id}>{res.name}</option>)}
                    </select>
                </div>
            </div>

            {/* LISTA DE TURNOS */}
            <div className="space-y-4">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[2rem] border border-slate-100 shadow-sm gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                        <p className="font-bold tracking-wide">Cargando agenda...</p>
                    </div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-500 bg-white rounded-[2rem] border border-slate-100 shadow-sm px-4 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                            <CalendarIcon className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-xl font-black text-slate-700 mb-2">{appointments.length > 0 ? 'Sin resultados para estos filtros' : 'Agenda Libre'}</p>
                        <p className="text-sm font-medium">{appointments.length > 0 ? 'Probá seleccionando "Todos" o cambiando el profesional.' : 'No hay turnos programados para este día.'}</p>
                    </div>
                ) : (
                    filteredAppointments.map((app, index) => {
                        const status = statusConfig[app.status || 'pending'];
                        const StatusIcon = status.icon;
                        const isPaid = !!app.operation_id; 

                        return (
                            <div key={app.id} className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all flex flex-col md:flex-row md:items-center gap-5 group animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 50}ms` }}>
                                
                                {/* Hora y Estado */}
                                <div className="flex flex-row md:flex-col items-center md:items-start gap-4 w-full md:w-36 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0">
                                    <div className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{formatTime(app.start_time)}</div>
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-widest font-black border shadow-sm ${status.color}`}>
                                        <StatusIcon className="w-3.5 h-3.5" />{status.label}
                                    </div>
                                </div>

                                {/* Info del Cliente */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 truncate mb-1.5">
                                        <User className="w-4 h-4 text-brand-500 shrink-0" /> {app.crm_people?.full_name || 'Cliente sin registrar'}
                                    </h3>
                                    {app.crm_people?.phone && (
                                        <a href={getWhatsAppLink(app.crm_people.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg w-fit transition-colors border border-emerald-100">
                                            <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
                                        </a>
                                    )}
                                </div>

                                {/* Servicio y Recurso */}
                                <div className="flex-1 min-w-0 bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-slate-800 text-sm truncate pr-2">{app.catalog_items?.name || 'Servicio general'}</p>
                                        <p className="font-black text-slate-900 text-base shrink-0">${app.catalog_items?.price?.toLocaleString() || 0}</p>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {app.catalog_items?.duration_minutes || 30}m</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="truncate">{app.resources?.name || 'Cualquiera'}</span>
                                    </p>
                                </div>

                                {/* Acciones (Estado y Cobro) */}
                                <div className="shrink-0 w-full md:w-48 mt-2 md:mt-0 flex flex-col gap-2.5 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                                    <select 
                                        value={app.status || 'pending'}
                                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                        className="w-full p-3 bg-white border border-slate-200 text-slate-700 text-xs uppercase tracking-widest font-black rounded-xl cursor-pointer hover:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-sm text-center appearance-none"
                                    >
                                        <option value="pending">Marcar: Espera</option>
                                        <option value="confirmed">Marcar: Reservado</option>
                                        <option value="attended">Marcar: Atendido</option>
                                        <option value="no_show">Marcar: Ausente</option>
                                        <option value="cancelled">Cancelar Turno</option>
                                    </select>

                                    {!isPaid && app.status !== 'cancelled' && app.status !== 'no_show' ? (
                                        <button 
                                            onClick={() => setSelectedAppointmentForCheckout(app)}
                                            className="w-full px-4 py-3 bg-brand-600 hover:bg-brand-500 text-white text-xs uppercase tracking-widest font-black rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-1.5 active:scale-95"
                                        >
                                            <DollarSign className="w-4 h-4" /> Cobrar Turno
                                        </button>
                                    ) : isPaid ? (
                                        <div className="w-full px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs uppercase tracking-widest font-black rounded-xl flex items-center justify-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4" /> Pagado
                                        </div>
                                    ) : null}
                                </div>

                            </div>
                        );
                    })
                )}
            </div>

            <NewAppointmentModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSuccess={() => { setIsNewModalOpen(false); fetchAgenda(); }} />
            <CheckoutModal isOpen={!!selectedAppointmentForCheckout} onClose={() => setSelectedAppointmentForCheckout(null)} appointment={selectedAppointmentForCheckout} onSuccess={() => { setSelectedAppointmentForCheckout(null); fetchAgenda(); }} />
        </div>
    );
}