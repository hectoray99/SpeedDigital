import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Dialog, Transition } from '@headlessui/react';
import { Plus, Loader2, X, MapPin, Trash2, Clock, CheckCircle2, XCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import ScheduleManager from '../staff/ScheduleManager';

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

    // =========================================================================
    // INICIALIZACIÓN
    // =========================================================================
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

    // =========================================================================
    // HANDLERS (Crear, Editar, Borrar)
    // =========================================================================
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
                    capacity: 1, // Por defecto atiende 1 a 1 (o alquila 1 cancha entera)
                    is_active: true,
                    // Le creamos un horario base de Lunes a Viernes de 9 a 18 (Se edita luego en ScheduleManager)
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
            toast.error('Error al guardar el registro en la base de datos.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            // Optimistic Update local
            setResources(resources.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
            
            const { error } = await supabase
                .from('resources')
                .update({ is_active: !currentStatus })
                .eq('id', id)
                .eq('organization_id', orgData.id); // Blindaje
                
            if (error) throw error;
            toast.success(currentStatus ? "Pausado. Ya no recibirá turnos." : "Activado correctamente.");
        } catch (error) {
            toast.error("Error al cambiar estado");
            fetchResources(); // Rollback en caso de error
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar a "${name}"? ADVERTENCIA: Se borrarán sus turnos futuros.`)) return;
        
        try {
            const { error } = await supabase
                .from('resources')
                .delete()
                .eq('id', id)
                .eq('organization_id', orgData.id); // Blindaje
                
            if (error) throw error;
            
            toast.success('Registro eliminado definitivamente.');
            fetchResources();
        } catch (error) {
            toast.error('No se pudo eliminar el registro. Puede tener datos asociados.');
        }
    };

    const openSchedule = (resource: any) => {
        setSelectedResource(resource);
        setIsScheduleModalOpen(true);
    };

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    return (
        <div className="pb-12 max-w-6xl mx-auto relative animate-in fade-in duration-500">
            
            {/* CABECERA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-brand-100 rounded-xl"><ui.icon className="w-6 h-6 text-brand-600" /></div>
                        {ui.title}
                    </h1>
                    <p className="text-slate-500 font-medium mt-2">{ui.subtitle}</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)} 
                    className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    <Plus className="w-5 h-5" /> {ui.btnNew}
                </button>
            </div>

            {/* GRILLA DE RECURSOS (Tabla en Desktop, Tarjetas en Móvil) */}
            {loading ? (
                <div className="p-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                    <p className="font-bold tracking-wide uppercase text-sm text-slate-400">Cargando datos...</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold border-b border-slate-100">
                                    <th className="p-5">Nombre / Identificador</th>
                                    <th className="p-5 text-center">Estado</th>
                                    <th className="p-5 text-right">Configuración y Horarios</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-50">
                                {resources.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-16 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <ui.icon className="w-12 h-12 text-slate-200 mb-2" />
                                                <p className="font-bold text-lg text-slate-600">No hay registros creados.</p>
                                                <p className="text-sm">Agregá tu primer espacio o profesional para empezar a recibir turnos.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    resources.map((resource) => (
                                        <tr key={resource.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-5 font-black text-slate-800 text-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-slate-100 rounded-lg text-slate-400 group-hover:text-brand-500 group-hover:bg-brand-50 transition-colors">
                                                        <ui.icon className="w-5 h-5" />
                                                    </div>
                                                    {resource.name}
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <button onClick={() => toggleStatus(resource.id, resource.is_active)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border shadow-sm ${resource.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                                                    {resource.is_active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                    {resource.is_active ? 'Recibiendo Turnos' : 'Pausado'}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button 
                                                        onClick={() => openSchedule(resource)}
                                                        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors border border-brand-100 active:scale-95"
                                                    >
                                                        <Clock className="w-4 h-4" /> <span className="hidden sm:inline">Definir Horarios</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(resource.id, resource.name)}
                                                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors md:opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-100"
                                                        title="Eliminar"
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

            {/* ========================================================================= */}
            {/* MODALES FLOTANTES */}
            {/* ========================================================================= */}
            
            {/* MODAL 1: CREAR RECURSO NUEVO */}
            <Transition appear show={isModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isSaving && setIsModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-end md:items-center justify-center p-0 md:p-4 text-center">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95">
                                
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0 shadow-sm">
                                    <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <div className="p-2 bg-brand-100 rounded-xl"><ui.icon className="w-5 h-5 text-brand-600" /></div>
                                        {ui.btnNew}
                                    </Dialog.Title>
                                    <button onClick={() => setIsModalOpen(false)} disabled={isSaving} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>
                                
                                <form onSubmit={handleCreateResource} className="flex flex-col">
                                    <div className="p-6 md:p-8 space-y-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{ui.inputLabel} *</label>
                                            <input 
                                                required 
                                                type="text" 
                                                autoFocus
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white font-bold text-slate-800 transition-all" 
                                                value={resourceName} 
                                                onChange={e => setResourceName(e.target.value)} 
                                                placeholder={ui.inputPlaceholder} 
                                            />
                                        </div>
                                    </div>
                                    <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                                        <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancelar</button>
                                        <button type="submit" disabled={isSaving || !resourceName.trim()} className="flex-[2] py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-black flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-xl shadow-slate-900/20 active:scale-95 text-lg">
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} 
                                            Crear e Ir a Horarios
                                        </button>
                                    </div>
                                </form>

                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* MODAL 2: CONFIGURAR HORARIOS (ScheduleManager) */}
            <Transition appear show={isScheduleModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => setIsScheduleModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-0 md:p-4 text-center">
                            <Dialog.Panel className="w-full md:max-w-4xl transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all h-[95dvh] md:h-auto md:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95">
                                
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0 shadow-sm z-10">
                                    <div>
                                        <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                            <div className="p-2 bg-blue-100 rounded-xl"><Clock className="w-5 h-5 text-blue-600" /></div>
                                            Horarios de {selectedResource?.name}
                                        </Dialog.Title>
                                        <p className="text-xs font-bold text-slate-500 mt-1.5 uppercase tracking-widest">Configurá los días y rangos horarios de disponibilidad.</p>
                                    </div>
                                    <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors shadow-sm bg-white border border-slate-200">
                                        <X className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto bg-slate-50 relative p-4 md:p-6">
                                    {selectedResource && orgData && (
                                        // IMPORTANTE: ScheduleManager asume que su contenedor tiene espacio. 
                                        // Le damos un contenedor con bg-white y bordes para que resalte.
                                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-2 md:p-6 min-h-full">
                                            <ScheduleManager resourceId={selectedResource.id} orgId={orgData.id} />
                                        </div>
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