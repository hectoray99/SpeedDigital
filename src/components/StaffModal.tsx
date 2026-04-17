import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Save, UserCircle, Key, User, Percent, Briefcase, Fingerprint } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface StaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employeeData?: any; // Si viene esto, estamos en MODO EDICIÓN
}

export default function StaffModal({ isOpen, onClose, onSuccess, employeeData }: StaffModalProps) {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(false);

    const isEditing = !!employeeData;

    const [formData, setFormData] = useState({
        full_name: '',
        document_number: '',
        username: '', // Solo para Modo Creación
        pin: '', // Solo para Modo Creación
        role: 'staff',
        compensationType: 'fixed',
        commissionPct: ''
    });

    // Cargar datos al abrir en modo edición
    useEffect(() => {
        if (isOpen && isEditing && employeeData) {
            setFormData({
                full_name: employeeData.full_name || '',
                document_number: employeeData.document_number || '',
                username: '',
                pin: '',
                role: employeeData.role || 'staff',
                compensationType: employeeData.compensation_type || 'fixed',
                commissionPct: employeeData.commission_pct?.toString() || ''
            });
        } else if (isOpen && !isEditing) {
            // Resetear para creación limpia
            setFormData({ full_name: '', document_number: '', username: '', pin: '', role: 'staff', compensationType: 'fixed', commissionPct: '' });
        }
    }, [isOpen, isEditing, employeeData]);



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!orgData?.id) return toast.error('Error de sesión. Recargá la página.');
        if (!formData.full_name.trim()) return toast.error('El nombre completo es obligatorio.');
        if (!formData.document_number.trim()) return toast.error('El DNI es obligatorio.');

        setLoading(true);

        try {
            if (isEditing) {
                // 1. Actualizamos el Rol en organization_members
                const { error: roleError } = await supabase
                    .from('organization_members')
                    .update({ role: formData.role })
                    .eq('organization_id', orgData.id)
                    .eq('profile_id', employeeData.auth_profile_id);

                if (roleError) throw roleError;

                // 2. Actualizamos la ficha en crm_people (Columna identifier)
                const { error: crmUpdateError } = await supabase
                    .from('crm_people')
                    .update({
                        full_name: formData.full_name.trim(),
                        identifier: formData.document_number.trim(), // <--- Columna real verificada
                        type: formData.compensationType === 'fixed' ? 'employee' : 'staff',
                        details: {
                            ...employeeData.details, // Mantenemos lo que había
                            auth_profile_id: employeeData.auth_profile_id,
                            compensation_type: formData.compensationType,
                            commission_pct: formData.compensationType === 'commission' ? Number(formData.commissionPct) : 0
                        }
                    })
                    .eq('id', employeeData.crm_id);

                if (crmUpdateError) throw crmUpdateError;

                toast.success('¡Personal actualizado correctamente!');

            } else {
                // MODO CREACIÓN (Auth + Miembros + CRM)
                const safeSlug = orgData.slug ? orgData.slug.toLowerCase().replace(/[^a-z0-9]/g, '') : orgData.id.substring(0, 8);
                const dummyEmail = `${formData.username.toLowerCase().trim()}@${safeSlug}.pos`;
                const securePassword = `${formData.pin}-pos-Secure!`;

                const tempSupabase = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    import.meta.env.VITE_SUPABASE_ANON_KEY,
                    { auth: { persistSession: false, autoRefreshToken: false } }
                );

                const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                    email: dummyEmail,
                    password: securePassword,
                    options: { data: { full_name: formData.full_name.trim(), is_staff: true } }
                });

                if (authError) throw authError;
                if (!authData.user) throw new Error("No se pudo crear el usuario.");

                await new Promise(resolve => setTimeout(resolve, 1500));

                await supabase.from('organization_members').insert([{
                    organization_id: orgData.id,
                    profile_id: authData.user.id,
                    role: formData.role
                }]);

                const { error: crmError } = await supabase
                    .from('crm_people')
                    .insert([{
                        organization_id: orgData.id,
                        full_name: formData.full_name.trim(),
                        identifier: formData.document_number.trim(), // <--- Columna real
                        type: formData.compensationType === 'fixed' ? 'employee' : 'staff',
                        details: {
                            auth_profile_id: authData.user.id,
                            compensation_type: formData.compensationType,
                            commission_pct: formData.compensationType === 'commission' ? Number(formData.commissionPct) : 0
                        }
                    }]);

                if (crmError) throw crmError;
                toast.success('¡Personal registrado con éxito!');
            }

            onSuccess(); // Esto dispara el fetchStaff() en el padre
            onClose();

        } catch (error: any) {
            console.error("Error al guardar:", error);
            toast.error(error.message || 'Error al guardar datos.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-[2rem] bg-white text-left align-middle shadow-2xl transition-all animate-in zoom-in-95 duration-200">

                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-100 rounded-xl"><UserCircle className="w-6 h-6 text-indigo-600" /></div>
                                    {isEditing ? 'Editar Personal' : 'Alta de Personal'}
                                </Dialog.Title>
                                <button onClick={onClose} disabled={loading} className="p-2 bg-white hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 max-h-[75vh] overflow-y-auto hide-scrollbar">

                                <div className="space-y-6">
                                    {/* Datos Personales */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre Completo *</label>
                                            <input
                                                required autoFocus
                                                type="text"
                                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-bold text-slate-800 transition-all"
                                                value={formData.full_name}
                                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                                placeholder="Ej: Marcos Mozo"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                                                <Fingerprint className="w-4 h-4 text-indigo-500" />
                                                DNI (Necesario para el Fichador) *
                                            </label>
                                            <input
                                                required type="text" inputMode="numeric"
                                                className="w-full px-4 py-3.5 bg-indigo-50/50 border-2 border-indigo-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-black text-indigo-900 transition-all tracking-wider"
                                                value={formData.document_number}
                                                onChange={e => setFormData({ ...formData, document_number: e.target.value.replace(/\D/g, '') })}
                                                placeholder="Sin puntos"
                                            />
                                        </div>
                                    </div>

                                    {/* Creación de Usuario (Solo si NO está editando) */}
                                    {!isEditing && (
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><User className="w-4 h-4" /> Usuario POS *</label>
                                                <input
                                                    required type="text"
                                                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-800 transition-all lowercase"
                                                    value={formData.username}
                                                    onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                                                    placeholder="ej: marcos"
                                                />
                                            </div>
                                            <div>
                                                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Key className="w-4 h-4" /> PIN Inicial *</label>
                                                <input
                                                    required type="password" inputMode="numeric" maxLength={6}
                                                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-black text-slate-800 transition-all tracking-[0.3em] text-center"
                                                    value={formData.pin}
                                                    onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                                    placeholder="****"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Modalidad de Contratación */}
                                    <div className="pt-4 border-t border-slate-200">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Modalidad del Contrato *</label>
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <button type="button" onClick={() => setFormData({ ...formData, compensationType: 'fixed' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left flex flex-col items-start gap-2 ${formData.compensationType === 'fixed' ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <Briefcase className="w-5 h-5" />
                                                <div>
                                                    <span className="block text-base leading-none">Sueldo Fijo</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 mt-1 block">Empleado estable</span>
                                                </div>
                                            </button>
                                            <button type="button" onClick={() => setFormData({ ...formData, compensationType: 'commission' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left flex flex-col items-start gap-2 ${formData.compensationType === 'commission' ? 'border-emerald-500 bg-emerald-500 text-white shadow-md' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <Percent className="w-5 h-5" />
                                                <div>
                                                    <span className="block text-base leading-none">A Comisión</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 mt-1 block">Profesor / Externo</span>
                                                </div>
                                            </button>
                                        </div>

                                        {formData.compensationType === 'commission' && (
                                            <div className="animate-in zoom-in-95 duration-300">
                                                <label className="block text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Porcentaje de Ganancia (%) *</label>
                                                <div className="relative shadow-sm rounded-xl">
                                                    <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4" />
                                                    <input
                                                        required
                                                        type="number" min="1" max="100"
                                                        className="w-full pl-11 pr-4 py-3.5 bg-emerald-50 border-2 border-emerald-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white font-black text-emerald-800 transition-all"
                                                        value={formData.commissionPct}
                                                        onChange={e => setFormData({ ...formData, commissionPct: e.target.value })}
                                                        placeholder="Ej: 40"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>


                                    {/* Nivel de Acceso */}
                                    <div className="pt-4 border-t border-slate-200">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nivel de Acceso al Sistema *</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'staff' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left ${formData.role === 'staff' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <span className="block text-base mb-1">Cajero / Mozo</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Salón y Cobros</span>
                                            </button>
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'admin' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left ${formData.role === 'admin' ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <span className="block text-base mb-1">Administrador</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Control Total</span>
                                            </button>
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'chef_dispatcher' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left ${formData.role === 'chef_dispatcher' ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <span className="block text-base mb-1">Encargado Cocina</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Despacho General</span>
                                            </button>
                                            <button type="button" onClick={() => setFormData({ ...formData, role: 'line_cook' })} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left ${formData.role === 'line_cook' ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <span className="block text-base mb-1">Cocinero</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Solo Preparación</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 mt-2">
                                    <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-xl shadow-indigo-500/30 active:scale-95 text-lg">
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                        {isEditing ? 'Guardar Cambios' : 'Registrar Empleado'}
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