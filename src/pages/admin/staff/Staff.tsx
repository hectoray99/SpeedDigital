import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Loader2, Shield, Trash2, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import CreateStaffModal from '../../../components/CreateStaffModal';
import ScheduleManager from './ScheduleManager'; 
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X } from 'lucide-react';

export default function Staff() {
    const { orgData, userRole, user } = useAuthStore();
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<{id: string, name: string} | null>(null);
    const [isLinkingResource, setIsLinkingResource] = useState(false);

    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

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

    const handleRemoveStaff = async (profileId: string, profileName: string) => {
        if (profileId === user?.id) return toast.error("No podés eliminar tu propia cuenta.");
        if (!confirm(`¿Estás seguro de que deseas quitar el acceso a ${profileName}?`)) return;

        try {
            const { error } = await supabase
                .from('organization_members')
                .delete()
                .eq('profile_id', profileId)
                .eq('organization_id', orgData.id);

            if (error) throw error;
            toast.success("Usuario removido correctamente");
            fetchStaff();
        } catch (error) {
            console.error(error);
            toast.error("Error al remover usuario");
        }
    };

    const handleOpenSchedule = async (profileName: string) => {
        if (!orgData?.id) return;
        setIsLinkingResource(true);

        try {
            const { data: existingResource } = await supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgData.id)
                .eq('name', profileName)
                .maybeSingle();

            if (existingResource) {
                setSelectedResource(existingResource);
            } else {
                const { data: newResource, error } = await supabase
                    .from('resources')
                    .insert([{
                        organization_id: orgData.id,
                        name: profileName,
                        capacity: 1,
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

                if (error) throw error;
                setSelectedResource(newResource);
            }

            setIsScheduleModalOpen(true);
        } catch (error) {
            console.error(error);
            toast.error('Error al vincular la agenda');
        } finally {
            setIsLinkingResource(false);
        }
    };

    return (
        <div className="pb-12 max-w-7xl mx-auto relative animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Personal</h1>
                    <p className="text-slate-500">Cuentas y niveles de acceso de tu equipo.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    {/* Botón de acceso directo al POS/Staff Login */}
                    {orgData?.slug && (
                        <a 
                            href={`/staff-login/${orgData.slug}`} 
                            target="_blank"
                            rel="noreferrer"
                            className="w-full sm:w-auto bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3.5 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <ExternalLink className="w-5 h-5" /> Abrir Pantalla POS
                        </a>
                    )}

                    {isOwnerOrAdmin && (
                        <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                            <Plus className="w-5 h-5" /> Nuevo Usuario
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" /> Cargando equipo...
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
                                    <th className="p-5 border-b border-slate-100">Nombre / Usuario</th>
                                    <th className="p-5 border-b border-slate-100">Cargo</th>
                                    <th className="p-5 border-b border-slate-100">Ingreso</th>
                                    <th className="p-5 border-b border-slate-100 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-50">
                                {staffList.map((member, idx) => {
                                    const profileName = member.profiles?.full_name || 'Usuario';
                                    const isMe = member.profile_id === user?.id;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-sm shrink-0 border border-brand-100">
                                                        {profileName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 flex items-center gap-2 text-base">
                                                            {profileName} 
                                                            {isMe && <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md tracking-widest">TÚ</span>}
                                                        </p>
                                                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                                                            {member.profiles?.email?.includes('.pos') ? (
                                                                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Usuario POS</span>
                                                            ) : member.profiles?.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border shadow-sm ${
                                                    member.role === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                    member.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    <Shield className="w-3.5 h-3.5" /> {member.role === 'staff' ? 'Personal' : member.role}
                                                </span>
                                            </td>
                                            <td className="p-5 text-slate-500 font-medium text-sm">
                                                {new Date(member.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {(orgData?.industry === 'services' || orgData?.industry === 'gym') && (
                                                        <button 
                                                            onClick={() => handleOpenSchedule(profileName)}
                                                            disabled={isLinkingResource}
                                                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-100 rounded-lg transition-colors"
                                                            title="Configurar agenda y turnos"
                                                        >
                                                            {isLinkingResource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                                                            Horarios
                                                        </button>
                                                    )}

                                                    {isOwnerOrAdmin && !isMe && (
                                                        <button 
                                                            onClick={() => handleRemoveStaff(member.profile_id, profileName)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                            title="Quitar acceso"
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

            <CreateStaffModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchStaff} />

            <Transition appear show={isScheduleModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => setIsScheduleModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-xl transition-all animate-in zoom-in-95">
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                    <div>
                                        <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                            <Clock className="w-6 h-6 text-brand-500" /> Agenda de {selectedResource?.name}
                                        </Dialog.Title>
                                        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Configurá los días y rangos horarios.</p>
                                    </div>
                                    <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>
                                <div className="p-6 bg-white flex justify-center items-center">
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