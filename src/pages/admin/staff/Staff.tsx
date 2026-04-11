import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Loader2, Shield, Trash2, Clock, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, Transition } from '@headlessui/react';

import CreateStaffModal from '../../../components/CreateStaffModal';
import ScheduleManager from './ScheduleManager'; 

export default function Staff() {
    const { orgData, userRole, user } = useAuthStore();
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Controles de Modales
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    
    // Gestión de Recursos vinculados (Para la agenda del empleado)
    const [selectedResource, setSelectedResource] = useState<{id: string, name: string} | null>(null);
    const [isLinkingResource, setIsLinkingResource] = useState(false);

    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

    // =========================================================================
    // INICIALIZACIÓN
    // =========================================================================
    useEffect(() => {
        if (orgData?.id) fetchStaff();
    }, [orgData?.id]);

    async function fetchStaff() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('organization_members')
                .select('role, created_at, profile_id, profiles(id, full_name, email)')
                .eq('organization_id', orgData.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setStaffList(data || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
            toast.error('Error al cargar el personal');
        } finally {
            setLoading(false);
        }
    }

    // =========================================================================
    // HANDLERS DE PERSONAL
    // =========================================================================
    const handleRemoveStaff = async (profileId: string, profileName: string) => {
        // Blindaje Anti-AutoBorrado
        if (profileId === user?.id) return toast.error("No podés eliminar tu propia cuenta de Administrador/Dueño.");
        
        if (!confirm(`¿Estás seguro de que deseas quitar el acceso al sistema a ${profileName}?`)) return;

        try {
            // Se quita de la tabla pivote, el usuario sigue existiendo en Auth pero ya no entra al local.
            const { error } = await supabase
                .from('organization_members')
                .delete()
                .eq('profile_id', profileId)
                .eq('organization_id', orgData.id);

            if (error) throw error;
            
            toast.success("Usuario removido correctamente. Ya no tiene acceso a tu local.");
            fetchStaff();
        } catch (error) {
            console.error(error);
            toast.error("Error crítico al remover usuario");
        }
    };

    // =========================================================================
    // HANDLERS DE AGENDA (Vinculación Empleado <-> Recurso Físico)
    // =========================================================================
    const handleOpenSchedule = async (profileName: string) => {
        if (!orgData?.id) return;
        setIsLinkingResource(true);

        try {
            // 1. Buscamos si el Empleado ya fue convertido en "Recurso Agendable" previamente
            const { data: existingResource, error: searchError } = await supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgData.id)
                .eq('name', profileName)
                .maybeSingle();

            if (searchError) throw searchError;

            if (existingResource) {
                // Ya existe, lo abrimos directo
                setSelectedResource(existingResource);
            } else {
                // 2. Si no existe, lo creamos e inicializamos sus horarios por defecto (L a V)
                const { data: newResource, error: insertError } = await supabase
                    .from('resources')
                    .insert([{
                        organization_id: orgData.id,
                        name: profileName,
                        capacity: 1, // Por defecto atiende de a 1 persona
                        is_active: true,
                        availability_rules: {
                            '1': [{ start: '09:00', end: '18:00' }],
                            '2': [{ start: '09:00', end: '18:00' }],
                            '3': [{ start: '09:00', end: '18:00' }],
                            '4': [{ start: '09:00', end: '18:00' }],
                            '5': [{ start: '09:00', end: '18:00' }]
                        }
                    }])
                    .select('id, name')
                    .single();

                if (insertError) throw insertError;
                setSelectedResource(newResource);
            }

            setIsScheduleModalOpen(true);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo vincular la agenda del empleado con el sistema de turnos.');
        } finally {
            setIsLinkingResource(false);
        }
    };

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    return (
        <div className="pb-12 max-w-7xl mx-auto relative animate-in fade-in duration-500">
            
            {/* CABECERA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Personal</h1>
                    <p className="text-slate-500 font-medium mt-1 text-sm md:text-base">Cuentas y niveles de acceso de tu equipo de trabajo.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    {/* Botón de acceso directo al POS/Staff Login público */}
                    {orgData?.slug && (
                        <a 
                            href={`/staff-login/${orgData.slug}`} 
                            target="_blank"
                            rel="noreferrer"
                            className="w-full sm:w-auto bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3.5 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                            title="Abrir enlace de login rápido para empleados"
                        >
                            <ExternalLink className="w-5 h-5 text-slate-400" /> Terminal POS
                        </a>
                    )}

                    {isOwnerOrAdmin && (
                        <button 
                            onClick={() => setIsModalOpen(true)} 
                            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> Nuevo Usuario
                        </button>
                    )}
                </div>
            </div>

            {/* TABLA DE PERSONAL */}
            {loading ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-4 bg-white rounded-3xl shadow-sm border border-slate-100">
                    <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                    <p className="font-bold tracking-widest text-sm uppercase">Cargando equipo...</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold border-b border-slate-100">
                                    <th className="p-5">Nombre / Usuario</th>
                                    <th className="p-5">Cargo</th>
                                    <th className="p-5">Ingreso al local</th>
                                    <th className="p-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-50">
                                {staffList.map((member, idx) => {
                                    const profileName = member.profiles?.full_name || 'Usuario sin nombre';
                                    const isMe = member.profile_id === user?.id;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                            
                                            {/* Datos del Empleado */}
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-sm shrink-0 border border-brand-100 shadow-sm">
                                                        {profileName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 flex items-center gap-2 text-base leading-none mb-1">
                                                            {profileName} 
                                                            {isMe && <span className="text-[9px] font-black bg-slate-800 text-white px-2 py-0.5 rounded uppercase tracking-widest">Tú</span>}
                                                        </p>
                                                        <p className="text-xs font-medium text-slate-500 mt-1 flex items-center">
                                                            {/* Si es un usuario tipo Punto de Venta (Con PIN), lo distinguimos visualmente */}
                                                            {member.profiles?.email?.includes('.pos') ? (
                                                                <span className="text-brand-700 bg-brand-100/50 px-2 py-0.5 rounded border border-brand-200/50 font-bold tracking-wide">Usuario de Terminal (PIN)</span>
                                                            ) : (
                                                                member.profiles?.email
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Rol */}
                                            <td className="p-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                                                    member.role === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    member.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    <Shield className="w-3.5 h-3.5" /> 
                                                    {member.role === 'staff' ? 'Personal' : member.role === 'owner' ? 'Dueño' : member.role}
                                                </span>
                                            </td>

                                            {/* Fecha */}
                                            <td className="p-5 text-slate-500 font-bold text-sm">
                                                {new Date(member.created_at).toLocaleDateString()}
                                            </td>

                                            {/* Acciones */}
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    
                                                    {/* Botón de Horarios (Solo para gimnasios y servicios donde el staff atiende turnos) */}
                                                    {(orgData?.industry === 'services' || orgData?.industry === 'gym' || orgData?.industry === 'sports') && (
                                                        <button 
                                                            onClick={() => handleOpenSchedule(profileName)}
                                                            disabled={isLinkingResource}
                                                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-colors active:scale-95 disabled:opacity-50"
                                                            title="Configurar días de atención"
                                                        >
                                                            {isLinkingResource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                                                            Agenda
                                                        </button>
                                                    )}

                                                    {/* Botón de Borrado (Solo Administradores y no puede auto-borrarse) */}
                                                    {isOwnerOrAdmin && !isMe && (
                                                        <button 
                                                            onClick={() => handleRemoveStaff(member.profile_id, profileName)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                                                            title="Expulsar del local"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODALES EXTERNOS */}
            {/* ========================================================================= */}
            <CreateStaffModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={fetchStaff} 
            />

            <Transition appear show={isScheduleModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => setIsScheduleModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" />
                    
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-0 md:p-4 text-center">
                            <Dialog.Panel className="w-full md:max-w-4xl transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all h-[95dvh] md:h-auto md:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-200">
                                
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0 shadow-sm z-10">
                                    <div>
                                        <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                            <div className="p-2 bg-blue-100 rounded-xl"><Clock className="w-5 h-5 text-blue-600" /></div> 
                                            Agenda de {selectedResource?.name}
                                        </Dialog.Title>
                                        <p className="text-xs font-bold text-slate-500 mt-1.5 uppercase tracking-widest">Configurá los días y horarios que trabaja.</p>
                                    </div>
                                    <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors shadow-sm bg-white border border-slate-200">
                                        <X className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto bg-slate-50 relative p-4 md:p-6 hide-scrollbar">
                                    {selectedResource && orgData && (
                                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 md:p-6 min-h-full">
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