import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Dialog, Transition } from '@headlessui/react';
import { Plus, Loader2, X, MapPin, Trash2, Clock, CheckCircle2, XCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import ScheduleManager from '../staff/ScheduleManager'; // Asegurate de poner bien la ruta a tu ScheduleManager

export default function Resources() {
    const { orgData } = useAuthStore();
    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Controles de Modales
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    
    const [selectedResource, setSelectedResource] = useState<{id: string, name: string} | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [resourceName, setResourceName] = useState('');

    // Textos dinámicos según el rubro (Canchas vs Profesionales)
    const isSports = orgData?.industry === 'sports' || orgData?.industry === 'gym';
    const ui = {
        title: isSports ? 'Canchas y Espacios' : 'Profesionales y Agendas',
        subtitle: isSports ? 'Administrá tus canchas y sus horarios de disponibilidad.' : 'Administrá tu equipo y sus horarios de atención.',
        btnNew: isSports ? 'Nueva Cancha' : 'Nuevo Profesional',
        inputLabel: isSports ? 'Nombre de la Cancha / Espacio' : 'Nombre del Profesional',
        inputPlaceholder: isSports ? 'Ej: Cancha 1 (Sintético)' : 'Ej: Fede Barber',
        icon: isSports ? MapPin : User
    };

    useEffect(() => {
        if (orgData?.id) fetchResources();
    }, [orgData?.id]);

    async function fetchResources() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('resources')
                .select('*')
                .eq('organization_id', orgData.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setResources(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    }

    const handleCreateResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id || !resourceName.trim()) return;
        
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('resources')
                .insert([{
                    organization_id: orgData.id,
                    name: resourceName.trim(),
                    capacity: 1, // Por defecto
                    is_active: true,
                    // Le creamos un horario base de L a V
                    availability_rules: {
                        '1': [{ start: '09:00', end: '18:00' }],
                        '2': [{ start: '09:00', end: '18:00' }],
                        '3': [{ start: '09:00', end: '18:00' }],
                        '4': [{ start: '09:00', end: '18:00' }],
                        '5': [{ start: '09:00', end: '18:00' }]
                    }
                }]);

            if (error) throw error;
            
            toast.success(`${ui.btnNew} creado exitosamente`);
            setIsModalOpen(false);
            setResourceName('');
            fetchResources();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase.from('resources').update({ is_active: !currentStatus }).eq('id', id);
            if (error) throw error;
            toast.success(currentStatus ? "Pausado" : "Activado");
            setResources(resources.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
        } catch (error) {
            toast.error("Error al cambiar estado");
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar "${name}"? Se borrarán sus turnos futuros.`)) return;
        try {
            const { error } = await supabase.from('resources').delete().eq('id', id);
            if (error) throw error;
            toast.success('Eliminado correctamente');
            fetchResources();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const openSchedule = (resource: any) => {
        setSelectedResource(resource);
        setIsScheduleModalOpen(true);
    };

    return (
        <div className="pb-12 max-w-6xl mx-auto relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 animate-in fade-in slide-in-from-top-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ui.icon className="w-8 h-8 text-brand-500" />
                        {ui.title}
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">{ui.subtitle}</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)} 
                    className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> {ui.btnNew}
                </button>
            </div>

            {loading ? (
                <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-100">
                                    <th className="p-4">Nombre</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4 text-right">Configuración</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {resources.length === 0 ? (
                                    <tr><td colSpan={3} className="p-12 text-center text-slate-400 font-medium">No hay registros creados.</td></tr>
                                ) : (
                                    resources.map((resource) => (
                                        <tr key={resource.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 group">
                                            <td className="p-4 font-bold text-slate-800 text-base">
                                                {resource.name}
                                            </td>
                                            <td className="p-4">
                                                <button onClick={() => toggleStatus(resource.id, resource.is_active)} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${resource.is_active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                    {resource.is_active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                    {resource.is_active ? 'Disponible' : 'Pausado'}
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => openSchedule(resource)}
                                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors border border-brand-200"
                                                    >
                                                        <Clock className="w-4 h-4" /> Horarios de atención
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(resource.id, resource.name)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL CREAR RECURSO */}
            <Transition appear show={isModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => setIsModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all">
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                                    <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <ui.icon className="w-6 h-6 text-brand-500" />
                                        {ui.btnNew}
                                    </Dialog.Title>
                                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>
                                <form onSubmit={handleCreateResource} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">{ui.inputLabel}</label>
                                        <input 
                                            required 
                                            type="text" 
                                            autoFocus
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 font-medium" 
                                            value={resourceName} 
                                            onChange={e => setResourceName(e.target.value)} 
                                            placeholder={ui.inputPlaceholder} 
                                        />
                                    </div>
                                    <div className="pt-4 mt-2">
                                        <button type="submit" disabled={isSaving || !resourceName.trim()} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-brand-500/20">
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} 
                                            Crear y configurar horarios
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* MODAL CONFIGURAR HORARIOS */}
            <Transition appear show={isScheduleModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => setIsScheduleModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all">
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                                    <div>
                                        <Dialog.Title as="h3" className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                            <Clock className="w-6 h-6 text-brand-500" />
                                            Horarios de {selectedResource?.name}
                                        </Dialog.Title>
                                        <p className="text-sm text-slate-500 mt-1">Configurá los días y rangos horarios de disponibilidad.</p>
                                    </div>
                                    <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                                </div>
                                
                                <div className="p-6 bg-slate-50 flex justify-center items-center">
                                    {selectedResource && orgData && (
                                        <ScheduleManager resourceId={selectedResource.id} orgId={orgData.id} />
                                    )}
                                </div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}