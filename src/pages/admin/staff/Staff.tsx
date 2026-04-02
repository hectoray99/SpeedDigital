import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Dialog, Transition } from '@headlessui/react';
import { Plus, Users, Loader2, X, UserCircle, Shield, Key, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

export default function Staff() {
    const { orgData, userRole, user } = useAuthStore();
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff' });
    const [isCreating, setIsCreating] = useState(false);

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

    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setIsCreating(true);

        try {
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: { data: { full_name: formData.name, is_staff: true } }
            });
  
            if (authError) throw authError;
            if (!authData.user) throw new Error("No se pudo crear el usuario");

            await new Promise(resolve => setTimeout(resolve, 1000));

            // FORZAMOS LA INYECCIÓN DEL NOMBRE Y EL EMAIL EN EL PERFIL
            await supabase
                .from('profiles')
                .update({ 
                    organization_id: orgData.id,
                    full_name: formData.name,
                    email: formData.email
                })
                .eq('id', authData.user.id);

            const { error: memberError } = await supabase
                .from('organization_members')
                .insert([{
                    organization_id: orgData.id,
                    profile_id: authData.user.id,
                    role: formData.role
                }]);

            if (memberError) throw memberError;

            toast.success('¡Miembro del equipo creado con éxito!');
            setIsModalOpen(false);
            setFormData({ name: '', email: '', password: '', role: 'staff' });
            fetchStaff();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Hubo un error al crear la cuenta');
        } finally {
            setIsCreating(false);
        }
    };

    const handleRemoveStaff = async (profileId: string, profileName: string) => {
        if (profileId === user?.id) {
            return toast.error("No puedes eliminar tu propia cuenta.");
        }

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

    return (
        <div className="pb-12 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Personal</h1>
                    <p className="text-slate-500">Cuentas y niveles de acceso de tu equipo.</p>
                </div>
                {isOwnerOrAdmin && (
                    <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" /> Nuevo Usuario
                    </button>
                )}
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" /> Cargando equipo...
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* CONTENEDOR RESPONSIVE PARA LA TABLA */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                                    <th className="p-4 border-b border-slate-100">Nombre / Usuario</th>
                                    <th className="p-4 border-b border-slate-100">Cargo</th>
                                    <th className="p-4 border-b border-slate-100">Ingreso</th>
                                    <th className="p-4 border-b border-slate-100 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {staffList.map((member, idx) => {
                                    const profileName = member.profiles?.full_name || 'Usuario';
                                    const initial = profileName[0].toUpperCase();
                                    const isMe = member.profile_id === user?.id;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-4 border-b border-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold shrink-0">
                                                        {initial}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 flex items-center gap-2">
                                                            {profileName} 
                                                            {isMe && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">TÚ</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{member.profiles?.email || 'Sin correo'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 border-b border-slate-50">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                                                    member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                                                    member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                    <Shield className="w-3 h-3" /> {member.role === 'staff' ? 'Personal' : member.role}
                                                </span>
                                            </td>
                                            <td className="p-4 border-b border-slate-50 text-slate-500">
                                                {new Date(member.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 border-b border-slate-50 text-right">
                                                {isOwnerOrAdmin && !isMe && (
                                                    <button 
                                                        onClick={() => handleRemoveStaff(member.profile_id, profileName)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Quitar acceso"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL (Sin cambios, funciona perfecto) */}
            <Transition appear show={isModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-xl transition-all">
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                                    <Dialog.Title as="h3" className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <UserCircle className="w-6 h-6 text-brand-500" />
                                        Crear Cuenta de Acceso
                                    </Dialog.Title>
                                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                                </div>

                                <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
                                    <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm mb-4">
                                        Se creará un usuario real. Podrá iniciar sesión con el correo y contraseña que definas aquí.
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo</label>
                                        <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Marcos Mozo" />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-1"><Mail className="w-4 h-4" /> Correo Electrónico (Usuario)</label>
                                        <input required type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="marcos@tudominio.com" />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-1"><Key className="w-4 h-4" /> Contraseña Inicial</label>
                                        <input required type="text" minLength={6} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-2"><Shield className="w-4 h-4" /> Cargo / Permisos</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'staff' })} className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${formData.role === 'staff' ? 'border-brand-500 bg-brand-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>
                                                Personal Base<br/><span className="text-xs font-normal opacity-70">(Mozos, Cocineros)</span>
                                            </button>
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'admin' })} className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${formData.role === 'admin' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>
                                                Administrador<br/><span className="text-xs font-normal opacity-70">(Gerentes, Cajeros)</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 mt-2 border-t border-slate-100">
                                        <button type="submit" disabled={isCreating} className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-brand-500/20">
                                            {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />} 
                                            {isCreating ? 'Creando cuenta...' : 'Crear y Dar Acceso'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}