import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Save, UserCircle, Key, Shield, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface CreateStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateStaffModal({ isOpen, onClose, onSuccess }: CreateStaffModalProps) {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        pin: '',
        role: 'staff'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id || !orgData?.slug) return;
        
        if (formData.pin.length < 4) {
            return toast.error('El PIN debe tener al menos 4 dígitos');
        }

        setLoading(true);

        try {
            const cleanUsername = formData.username.replace(/\s+/g, '').toLowerCase().trim();
            const dummyEmail = `${cleanUsername}@${orgData.slug}.pos`;
            const securePassword = `${formData.pin}-pos`; 

            // Cliente temporal para no desloguear al dueño
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            // 1. Crear usuario en Auth (El Trigger de la BD crea el perfil automáticamente)
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: dummyEmail,
                password: securePassword,
                options: { data: { full_name: formData.full_name, is_staff: true } }
            });
  
            if (authError) {
                // Manejo de error si el usuario ya existe
                if (authError.message.includes('already registered') || authError.status === 422) {
                    throw new Error(`El usuario "${cleanUsername}" ya existe. Por favor, elegí otro distinto (ej: ${cleanUsername}2).`);
                }
                throw authError;
            }

            if (!authData.user) throw new Error("No se pudo crear el usuario");

            // Le damos 1 segundo al Trigger de la BD para que termine de armar el perfil
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. Asignar el rol en organization_members directamente (Ya no intentamos editar el perfil)
            const { error: memberError } = await supabase
                .from('organization_members')
                .insert([{
                    organization_id: orgData.id,
                    profile_id: authData.user.id,
                    role: formData.role
                }]);

            if (memberError) throw memberError;

            toast.success('¡Personal registrado con éxito!');
            setFormData({ full_name: '', username: '', pin: '', role: 'staff' });
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Hubo un error al crear la cuenta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={onClose}>
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all animate-in zoom-in-95">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <div className="p-2 bg-brand-100 rounded-xl"><UserCircle className="w-5 h-5 text-brand-600" /></div>
                                    Crear Cuenta de Personal
                                </Dialog.Title>
                                <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                                
                                <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-2xl text-sm font-medium flex items-start gap-3 shadow-sm">
                                    <Shield className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
                                    <p>Tu empleado no necesita usar su correo personal. Creale un usuario y un PIN rápido para que ingrese desde el local.</p>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre Completo</label>
                                        <input required type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white font-bold text-slate-800 transition-all" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="Ej: Marcos Mozo" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><User className="w-4 h-4" /> Usuario</label>
                                            <input required type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white font-bold text-slate-800 transition-all lowercase" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="ej: marcos" />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Key className="w-4 h-4" /> PIN Acceso</label>
                                            <input required type="text" inputMode="numeric" maxLength={6} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white font-black text-slate-800 transition-all tracking-widest" value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })} placeholder="4 dígitos" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nivel de Acceso</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'staff' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left ${formData.role === 'staff' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}>
                                                <span className="block text-base mb-1 text-slate-800">Personal</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Mozos / Profes</span>
                                            </button>
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'admin' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left ${formData.role === 'admin' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}>
                                                <span className="block text-base mb-1 text-slate-800">Admin</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Gerentes / Caja</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-xl shadow-slate-900/20 active:scale-95 text-lg">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
                                        {loading ? 'Creando cuenta...' : 'Crear y Dar Acceso'}
                                    </button>
                                </div>
                            </form>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}