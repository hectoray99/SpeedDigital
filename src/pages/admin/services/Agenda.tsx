import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { 
    Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
    MessageCircle, Filter, Plus, Trash2, DollarSign, CheckCircle2,
    Clock, XCircle, AlertCircle, LayoutGrid, List
} from 'lucide-react';
import { toast } from 'sonner';

import NewAppointmentModal from './NewAppointmentModal';
import CheckoutModal from './CheckoutModal'; 

const statusConfig: Record<string, { label: string, rowBg: string, borderColor: string, timeColor: string, icon: any }> = {
    pending: { label: 'En Espera', rowBg: 'bg-[#FFF9E6]', borderColor: 'border-amber-400', timeColor: 'text-amber-600', icon: AlertCircle },
    confirmed: { label: 'Reservado', rowBg: 'bg-white', borderColor: 'border-slate-200', timeColor: 'text-blue-600', icon: Clock },
    attended: { label: 'Atendido', rowBg: 'bg-[#F0FDF4]', borderColor: 'border-emerald-400', timeColor: 'text-emerald-600', icon: CheckCircle2 },
    no_show: { label: 'Ausente', rowBg: 'bg-red-50', borderColor: 'border-red-400', timeColor: 'text-red-600', icon: XCircle },
    cancelled: { label: 'Cancelado', rowBg: 'bg-slate-50 opacity-60', borderColor: 'border-slate-300', timeColor: 'text-slate-400', icon: XCircle }
};

function getMonday(d: Date) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

export default function Agenda() {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
    
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [selectedAppointmentForCheckout, setSelectedAppointmentForCheckout] = useState<any>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [appointments, setAppointments] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]); 
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
    const [activeResourceFilter, setActiveResourceFilter] = useState<string>('all');

    useEffect(() => {
        const orgId = orgData?.id;
        if (orgId) {
            supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .then(({ data }) => setResources(data || []));
        }
    }, [orgData?.id]);

    useEffect(() => {
        if (orgData?.id) fetchAgenda();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgData?.id, currentDate, viewMode]);

    async function fetchAgenda() {
        const orgId = orgData?.id;
        if (!orgId) return;

        try {
            setLoading(true);
            
            let startOfDay = new Date(currentDate);
            let endOfDay = new Date(currentDate);

            if (viewMode === 'weekly') {
                const mon = getMonday(currentDate);
                startOfDay = new Date(mon);
                startOfDay.setHours(0, 0, 0, 0);

                endOfDay = new Date(mon);
                endOfDay.setDate(mon.getDate() + 5); 
                endOfDay.setHours(23, 59, 59, 999);
            } else {
                startOfDay.setHours(0, 0, 0, 0);
                endOfDay.setHours(23, 59, 59, 999);
            }

            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id, start_time, end_time, status, resource_id, person_id, operation_id, created_at,
                    crm_people ( full_name, phone ),
                    catalog_items ( id, name, duration_minutes, price ),
                    resources ( name )
                `)
                .eq('organization_id', orgId)
                .gte('start_time', startOfDay.toISOString())
                .lt('start_time', endOfDay.toISOString())
                .order('start_time', { ascending: true });

            if (error) throw error;
            setAppointments(data || []);
        } catch (error) {
            toast.error('Error al cargar la agenda');
        } finally {
            setLoading(false);
        }
    }

    const navigateDate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'weekly') {
            newDate.setDate(newDate.getDate() + (direction * 7));
        } else {
            newDate.setDate(newDate.getDate() + direction);
        }
        setCurrentDate(newDate);
    };

    const promptDeleteAppointment = (id: string) => {
        setAppointmentToDelete(id);
        setDeleteModalOpen(true);
    };

    const confirmDeleteAppointment = async () => {
        const orgId = orgData?.id;
        if (!orgId || !appointmentToDelete) return;

        setIsDeleting(true);
        try {
            setAppointments(prev => prev.filter(app => app.id !== appointmentToDelete));
            const { error } = await supabase.from('appointments').delete().eq('id', appointmentToDelete).eq('organization_id', orgId);
            if (error) throw error;
            toast.success('Turno eliminado correctamente');
        } catch (error) {
            toast.error('No se pudo eliminar el turno');
            fetchAgenda(); 
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setAppointmentToDelete(null);
        }
    };

    const handleStatusChange = async (appointmentId: string, newStatus: string) => {
        const orgId = orgData?.id;
        if (!orgId) return;

        try {
            setAppointments(prev => prev.map(app => app.id === appointmentId ? { ...app, status: newStatus } : app));
            const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId).eq('organization_id', orgId);
            if (error) throw error;
            toast.success('Estado actualizado');
        } catch (error) {
            toast.error('Error al actualizar estado');
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

    const weekDays = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(getMonday(currentDate));
        d.setDate(d.getDate() + i);
        return d;
    });

    const getDayName = (date: Date) => date.toLocaleDateString('es-AR', { weekday: 'long' });

    return (
        <div className="max-w-screen-2xl mx-auto pb-12 animate-in fade-in duration-500 bg-white min-h-[80vh] shadow-sm">
            
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 p-6 border-b border-slate-200">
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-slate-800 capitalize flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-brand-600" />
                            {viewMode === 'daily' 
                                ? currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
                                : `Semana del ${weekDays[0].getDate()} al ${weekDays[5].getDate()} de ${weekDays[0].toLocaleDateString('es-AR', { month: 'long' })}`
                            }
                        </h1>
                    </div>
                    <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors ml-2 hidden sm:block">Hoy</button>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                        <button onClick={() => setViewMode('daily')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'daily' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <List className="w-4 h-4" /> Día
                        </button>
                        <button onClick={() => setViewMode('weekly')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'weekly' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <LayoutGrid className="w-4 h-4" /> Semana
                        </button>
                    </div>

                    <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-brand-400 transition-colors shrink-0">
                        <Filter className="w-4 h-4 text-slate-400 mr-2" />
                        <select value={activeResourceFilter} onChange={(e) => setActiveResourceFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer w-full sm:w-auto">
                            <option value="all">Todos los Profesionales</option>
                            {resources.map(res => <option key={res.id} value={res.id}>{res.name}</option>)}
                        </select>
                    </div>

                    <button onClick={() => setIsNewModalOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 w-full sm:w-auto">
                        <Plus className="w-4 h-4" /> Nuevo Turno
                    </button>
                </div>
            </div>

            <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/50 px-6 hide-scrollbar">
                {statusTabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveStatusFilter(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeStatusFilter === tab.id ? 'border-brand-600 text-brand-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        {tab.label} <span className="text-xs opacity-50">({tab.count})</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-col min-h-[500px]">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center text-slate-400 gap-4"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /><p className="text-sm font-bold uppercase tracking-widest">Cargando Agenda...</p></div>
                ) : filteredAppointments.length === 0 && viewMode === 'daily' ? (
                    <div className="py-32 text-center text-slate-500"><p className="text-xl font-black text-slate-300">No hay turnos para este día.</p></div>
                ) : (
                    <>
                        {viewMode === 'daily' && (
                            <div className="flex flex-col">
                                {filteredAppointments.map((app) => {
                                    const status = statusConfig[app.status || 'pending'];
                                    const StatusIcon = status.icon;
                                    const isPaid = !!app.operation_id;

                                    return (
                                        <div key={app.id} className={`flex flex-col md:flex-row md:items-center py-4 px-6 border-b border-slate-100 border-l-4 ${status.borderColor} ${status.rowBg} hover:brightness-[0.98] transition-all group gap-4`}>
                                            <div className="w-32 shrink-0 flex flex-col">
                                                <div className={`flex items-center gap-1.5 text-lg font-black ${status.timeColor}`}>
                                                    <StatusIcon className="w-4 h-4 opacity-70" /> {formatTime(app.start_time)}
                                                </div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-5.5 mt-0.5">{status.label}</span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <span className="text-slate-900 font-bold block truncate text-base">{app.crm_people?.full_name || 'Sin nombre'}</span>
                                                <div className="flex items-center gap-3 mt-1">
                                                    {app.crm_people?.phone && (
                                                        <a href={getWhatsAppLink(app.crm_people.phone)} target="_blank" rel="noreferrer" className="text-[12px] text-emerald-600 font-bold flex items-center gap-1 hover:underline">
                                                            <MessageCircle className="w-3.5 h-3.5" /> +{app.crm_people.phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <span className="text-slate-700 text-sm font-medium block truncate">{app.catalog_items?.name || 'Servicio General'}</span>
                                                <span className="text-[12px] text-slate-500 block mt-1 font-medium">{app.resources?.name || 'Sin asignar'} • ${app.catalog_items?.price?.toLocaleString() || 0}</span>
                                            </div>

                                            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 shrink-0 w-full md:w-auto">
                                                {!isPaid && app.status !== 'cancelled' && app.status !== 'no_show' ? (
                                                    <button onClick={() => setSelectedAppointmentForCheckout(app)} className="py-2 px-4 md:w-36 bg-brand-50 text-brand-700 border border-brand-200 text-[11px] uppercase tracking-widest font-black rounded-lg transition-all flex items-center justify-center gap-1.5 hover:bg-brand-100 active:scale-95">
                                                        <DollarSign className="w-3.5 h-3.5" /> Cobrar
                                                    </button>
                                                ) : isPaid ? (
                                                    <div className="py-2 px-4 md:w-36 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] uppercase tracking-widest font-black rounded-lg flex items-center justify-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Pagado
                                                    </div>
                                                ) : (
                                                    <div className="md:w-36"></div> 
                                                )}

                                                <div className="flex items-center gap-2">
                                                    <select value={app.status || 'pending'} onChange={(e) => handleStatusChange(app.id, e.target.value)} className="flex-1 md:w-32 text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-2 outline-none cursor-pointer hover:border-slate-300">
                                                        <option value="pending">En Espera</option>
                                                        <option value="confirmed">Reservado</option>
                                                        <option value="attended">Atendido</option>
                                                        <option value="no_show">Ausente</option>
                                                        <option value="cancelled">Cancelado</option>
                                                    </select>
                                                    <button onClick={() => promptDeleteAppointment(app.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-200 md:opacity-0 group-hover:opacity-100" title="Eliminar turno">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {viewMode === 'weekly' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-0 border-t border-slate-200 h-full">
                                {weekDays.map((day) => {
                                    const dateStr = day.toISOString().split('T')[0];
                                    const dayApps = filteredAppointments.filter(app => app.start_time.startsWith(dateStr));
                                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                                    return (
                                        <div key={dateStr} className={`flex flex-col border-r border-b xl:border-b-0 border-slate-200 min-h-[500px] ${isToday ? 'bg-brand-50/20' : 'bg-slate-50/20'}`}>
                                            
                                            <div className={`p-4 border-b border-slate-200 text-center sticky top-0 z-10 backdrop-blur-md ${isToday ? 'bg-brand-50' : 'bg-white/80'}`}>
                                                <h3 className={`text-xs font-black uppercase tracking-widest ${isToday ? 'text-brand-600' : 'text-slate-400'}`}>
                                                    {getDayName(day)}
                                                </h3>
                                                <p className={`text-3xl font-black mt-1 ${isToday ? 'text-brand-700' : 'text-slate-800'}`}>
                                                    {day.getDate()}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-1">
                                                    {dayApps.length} Turnos
                                                </p>
                                            </div>

                                            <div className="flex flex-col gap-3 p-3 overflow-y-auto">
                                                {dayApps.length === 0 ? (
                                                    <div className="text-center py-10 opacity-50"><CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-xs font-bold text-slate-400">Libre</p></div>
                                                ) : (
                                                    dayApps.map(app => {
                                                        const status = statusConfig[app.status || 'pending'];
                                                        const isPaid = !!app.operation_id;

                                                        return (
                                                            <div key={app.id} className={`flex flex-col p-3 border-l-4 ${status.borderColor} ${status.rowBg} rounded-r-xl border-y border-r border-slate-200 shadow-sm gap-1.5 hover:shadow-md transition-shadow relative group`}>
                                                                <div className="flex justify-between items-start">
                                                                    <span className={`text-sm font-black flex items-center gap-1 ${status.timeColor}`}>
                                                                        <status.icon className="w-3.5 h-3.5" /> {formatTime(app.start_time)}
                                                                    </span>
                                                                    
                                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-md absolute right-2 top-2 p-0.5 shadow-sm border border-slate-100">
                                                                        {!isPaid && app.status !== 'cancelled' && app.status !== 'no_show' && (
                                                                            <button onClick={() => setSelectedAppointmentForCheckout(app)} className="text-brand-600 hover:bg-brand-50 p-1.5 rounded-md transition-colors" title="Cobrar">
                                                                                <DollarSign className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => promptDeleteAppointment(app.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors" title="Eliminar">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                
                                                                <span className="font-bold text-slate-800 text-[13px] truncate leading-tight pr-4">{app.crm_people?.full_name || 'Sin nombre'}</span>
                                                                <span className="text-[11px] text-slate-500 font-medium truncate">{app.catalog_items?.name}</span>
                                                                
                                                                <select
                                                                    value={app.status || 'pending'}
                                                                    onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                                                    className="mt-2 text-[11px] font-bold bg-white border border-slate-200 rounded-md px-1.5 py-1.5 outline-none cursor-pointer w-full text-slate-600 shadow-sm appearance-none text-center"
                                                                >
                                                                    <option value="pending">Espera</option>
                                                                    <option value="confirmed">Reservado</option>
                                                                    <option value="attended">Atendido</option>
                                                                    <option value="no_show">Ausente</option>
                                                                    <option value="cancelled">Cancelado</option>
                                                                </select>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            <NewAppointmentModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSuccess={() => { setIsNewModalOpen(false); fetchAgenda(); }} />
            <CheckoutModal isOpen={!!selectedAppointmentForCheckout} onClose={() => setSelectedAppointmentForCheckout(null)} appointment={selectedAppointmentForCheckout} onSuccess={() => { setSelectedAppointmentForCheckout(null); fetchAgenda(); }} />

            <Transition appear show={deleteModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isDeleting && setDeleteModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-3xl bg-white p-6 text-left align-middle shadow-xl transition-all animate-in zoom-in-95">
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100 shadow-inner">
                                        <Trash2 className="w-8 h-8 text-red-500" />
                                    </div>
                                    <Dialog.Title as="h3" className="text-xl font-black text-slate-800 mb-2">
                                        ¿Eliminar Turno?
                                    </Dialog.Title>
                                    <p className="text-sm text-slate-500 font-medium mb-8 px-2">
                                        Esta acción borrará el turno de forma permanente de tu agenda. No podrás recuperar esta información.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                                        onClick={() => setDeleteModalOpen(false)}
                                        disabled={isDeleting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors flex justify-center items-center gap-2 shadow-lg shadow-red-500/30 active:scale-95"
                                        onClick={confirmDeleteAppointment}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Eliminar'}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}