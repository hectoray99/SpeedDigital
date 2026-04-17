import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Loader2, Shield, Trash2, Clock, ExternalLink, X, Briefcase, Percent, Edit2, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, Transition } from '@headlessui/react';

import StaffModal from '../../../components/StaffModal';
import ScheduleManager from './ScheduleManager';

export default function Staff() {
    const { orgData, userRole, user } = useAuthStore();
    const [staffList, setStaffList] = useState<any[]>([]);
    const [crmStaff, setCrmStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<any | null>(null);

    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<{ id: string, name: string } | null>(null);
    const [isLinkingResource, setIsLinkingResource] = useState(false);

    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

    useEffect(() => {
        if (orgData?.id) fetchStaff();
    }, [orgData?.id]);

    async function fetchStaff() {
        if (!orgData?.id) return; // BLINDAJE DE TYPESCRIPT
        
        try {
            setLoading(true);
            const { data: members, error: memError } = await supabase
                .from('organization_members')
                .select('role, created_at, profile_id, profiles(id, full_name, email)')
                .eq('organization_id', orgData.id)
                .order('created_at', { ascending: true });

            if (memError) throw memError;

            const { data: crmData, error: crmError } = await supabase
                .from('crm_people')
                .select('id, full_name, type, identifier, details, is_active')
                .eq('organization_id', orgData.id)
                .in('type', ['employee', 'staff']);

            if (crmError) throw crmError;

            setStaffList(members || []);
            setCrmStaff(crmData || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
            toast.error('Error al cargar el personal');
        } finally {
            setLoading(false);
        }
    }

    const openCreateModal = () => {
        setEmployeeToEdit(null);
        setIsStaffModalOpen(true);
    };

    const openEditModal = (memberAuth: any, crmProfile: any) => {
        if (!crmProfile) {
            toast.error("No se encontró la ficha técnica de este empleado.");
            return;
        }

        setEmployeeToEdit({
            auth_profile_id: memberAuth.profile_id,
            crm_id: crmProfile.id,
            full_name: crmProfile.full_name || memberAuth.profiles?.full_name,
            document_number: crmProfile.identifier || '',
            role: memberAuth.role,
            compensation_type: crmProfile.details?.compensation_type || 'fixed',
            commission_pct: crmProfile.details?.commission_pct || '',
            details: crmProfile.details
        });
        setIsStaffModalOpen(true);
    };

    const handleRemoveStaff = async (profileId: string, profileName: string) => {
        if (!orgData?.id) return; // BLINDAJE DE TYPESCRIPT
        
        if (profileId === user?.id) return toast.error("No podés eliminar tu propia cuenta.");
        if (!confirm(`¿Estás seguro de quitar el acceso al sistema a ${profileName}?`)) return;

        try {
            const { error: memError } = await supabase
                .from('organization_members')
                .delete()
                .eq('profile_id', profileId)
                .eq('organization_id', orgData.id);

            if (memError) throw memError;

            const crmMatch = crmStaff.find(c => c.details?.auth_profile_id === profileId);
            if (crmMatch) {
                await supabase
                    .from('crm_people')
                    .update({ is_active: false })
                    .eq('id', crmMatch.id);
            }

            toast.success("Usuario removido correctamente.");
            fetchStaff();
        } catch (error) {
            toast.error("Error crítico al remover usuario");
        }
    };

    const handleOpenSchedule = async (profileName: string) => {
        if (!orgData?.id) return;
        setIsLinkingResource(true);

        try {
            const { data: existingResource, error: searchError } = await supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgData.id)
                .eq('name', profileName)
                .maybeSingle();

            if (searchError) throw searchError;

            if (existingResource) {
                setSelectedResource(existingResource);
            } else {
                const { data: newResource, error: insertError } = await supabase
                    .from('resources')
                    .insert([{
                        organization_id: orgData.id,
                        name: profileName,
                        capacity: 1,
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
            toast.error('No se pudo vincular la agenda del empleado.');
        } finally {
            setIsLinkingResource(false);
        }
    };

    return (
        <div className="pb-12 max-w-7xl mx-auto relative animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Equipo y Personal</h1>
                    <p className="text-slate-500 font-medium mt-1 text-sm md:text-base">Controlá accesos, modalidades y el DNI para el Reloj.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    {orgData?.slug && (
                        <a href={`/staff-login/${orgData.slug}`} target="_blank" rel="noreferrer" className="w-full sm:w-auto bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-6 py-3.5 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
                            <ExternalLink className="w-5 h-5 text-slate-400" /> Web Fichador
                        </a>
                    )}
                    {isOwnerOrAdmin && (
                        <button onClick={openCreateModal} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl font-black shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 active:scale-95">
                            <Plus className="w-5 h-5" /> Alta de Personal
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-4 bg-white rounded-3xl shadow-sm border border-slate-200">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                    <p className="font-bold tracking-widest text-xs uppercase">Sincronizando equipo...</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest font-black border-b border-slate-200">
                                    <th className="p-5 pl-6">Colaborador / DNI</th>
                                    <th className="p-5">Permisos Base</th>
                                    <th className="p-5">Tipo Contrato</th>
                                    <th className="p-5 text-right pr-6">Administración</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {staffList.map((member, idx) => {
                                    const profileName = member.profiles?.full_name || 'Usuario sin nombre';
                                    const isMe = member.profile_id === user?.id;

                                    const crmData = crmStaff.find(c => c.details?.auth_profile_id === member.profile_id);
                                    const compType = crmData?.details?.compensation_type;
                                    const commPct = crmData?.details?.commission_pct;
                                    const documentNumber = crmData?.identifier;
                                    const hasDNI = !!documentNumber;

                                    return (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors group ${crmData && !crmData.is_active ? 'opacity-50 grayscale' : ''}`}>
                                            <td className="p-5 pl-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shrink-0 border border-indigo-100 shadow-sm">
                                                        {profileName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 flex items-center gap-2 text-base leading-none mb-1.5">
                                                            {profileName}
                                                            {isMe && <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">Vos</span>}
                                                        </p>
                                                        <p className={`text-xs font-bold mt-1 flex items-center gap-1 ${hasDNI ? 'text-slate-500' : 'text-amber-500'}`}>
                                                            <Fingerprint className="w-3.5 h-3.5" />
                                                            {hasDNI ? `DNI: ${documentNumber}` : '⚠️ Falta cargar DNI (No puede fichar)'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border shadow-sm ${member.role === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                        member.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                    <Shield className="w-3.5 h-3.5" />
                                                    {member.role === 'staff' ? 'Personal' : member.role === 'owner' ? 'Dueño' : member.role}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                {compType === 'fixed' ? (
                                                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm bg-slate-50 border border-slate-200 w-fit px-3 py-1.5 rounded-xl">
                                                        <Briefcase className="w-4 h-4 text-slate-400" /> Sueldo Fijo
                                                    </div>
                                                ) : compType === 'commission' ? (
                                                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-200 w-fit px-3 py-1.5 rounded-xl">
                                                        <Percent className="w-4 h-4" /> A Comisión ({commPct}%)
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                                                        Pendiente Configurar
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-5 text-right pr-6">
                                                <div className="flex items-center justify-end gap-3">
                                                    {isOwnerOrAdmin && (
                                                        <button onClick={() => openEditModal(member, crmData)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all active:scale-95">
                                                            <Edit2 className="w-3.5 h-3.5" /> Editar
                                                        </button>
                                                    )}
                                                    {(orgData?.industry === 'services' || orgData?.industry === 'gym' || orgData?.industry === 'sports') && (
                                                        <button onClick={() => handleOpenSchedule(profileName)} disabled={isLinkingResource} className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all active:scale-95 disabled:opacity-50">
                                                            {isLinkingResource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Agenda
                                                        </button>
                                                    )}
                                                    {isOwnerOrAdmin && !isMe && (
                                                        <button onClick={() => handleRemoveStaff(member.profile_id, profileName)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-200 ml-2" title="Expulsar del sistema">
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

            <StaffModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} onSuccess={fetchStaff} employeeData={employeeToEdit} />

            <Transition appear show={isScheduleModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => setIsScheduleModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" />

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col max-h-[92vh]">

                                <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <Clock className="w-6 h-6 text-indigo-600" />
                                        </div>
                                        <div>
                                            <Dialog.Title className="text-2xl font-black text-slate-900">
                                                Agenda de {selectedResource?.name}
                                            </Dialog.Title>
                                            <p className="text-sm text-slate-500 mt-1">Configurá sus días y horarios de trabajo</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setIsScheduleModalOpen(false)}
                                        className="p-3 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-2xl transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
                                    {selectedResource && orgData && (
                                        <div className="bg-white rounded-3xl shadow border border-slate-100 p-6 md:p-8 min-h-full">
                                            <ScheduleManager 
                                                resourceId={selectedResource.id} 
                                                orgId={orgData.id} 
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end">
                                    <button
                                        onClick={() => setIsScheduleModalOpen(false)}
                                        className="px-6 py-3 font-semibold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
                                    >
                                        Cerrar
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