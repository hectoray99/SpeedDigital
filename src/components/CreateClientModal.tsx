import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Hash, Loader2, Phone } from 'lucide-react';

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateClientModal({ isOpen, onClose, onSuccess }: CreateClientModalProps) {
    const { orgData } = useAuthStore();

    const [formData, setFormData] = useState({
        full_name: '',
        identifier: '',
        email: '',
        phone: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return toast.error('Error de sesión. Recargá la página.');

        // --- BLINDAJE DE DATOS (REGEX) ---
        const nameRegex = /^[a-zA-ZÀ-ÿ\s']+$/; 
        const phoneRegex = /^[0-9+\-\s()]+$/; 

        if (!nameRegex.test(formData.full_name.trim())) {
            return toast.error('El nombre solo puede contener letras y espacios.');
        }
        
        if (formData.phone && !phoneRegex.test(formData.phone.trim())) {
            return toast.error('El teléfono contiene caracteres inválidos.');
        }

        setIsLoading(true);

        try {
            // Guardar al CRM Principal
            const { error } = await supabase
                .from('crm_people')
                .insert([{
                    organization_id: orgData.id,
                    full_name: formData.full_name.trim(),
                    identifier: formData.identifier.trim(),
                    email: formData.email.trim() || null,
                    phone: formData.phone.trim() || null,
                    type: 'client',
                    portal_password: formData.identifier.trim() // El DNI es la pass por defecto
                }]);

            if (error) {
                if (error.code === '23505') throw new Error('Ya existe un cliente con ese DNI o Email.');
                throw error;
            }

            toast.success('Cliente registrado correctamente');
            setFormData({ full_name: '', identifier: '', email: '', phone: '' });
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Error al crear cliente:', error);
            toast.error(error.message || 'Hubo un error al registrar al cliente');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative"
                >
                    <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                        <h3 className="text-xl font-black text-slate-800">Nuevo Cliente</h3>
                        <button onClick={onClose} disabled={isLoading} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre Completo *</label>
                            <div className="relative shadow-sm rounded-xl">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text" required autoFocus
                                    placeholder="Ej: Laura Giménez"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-slate-800"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">DNI / Identificación *</label>
                            <div className="relative shadow-sm rounded-xl">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text" required
                                    placeholder="Ej: 32111222"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-slate-800"
                                    value={formData.identifier}
                                    onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email</label>
                                <div className="relative shadow-sm rounded-xl">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        placeholder="correo@..."
                                        className="w-full pl-9 pr-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-sm text-slate-800"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Teléfono</label>
                                <div className="relative shadow-sm rounded-xl">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Ej: 3704..."
                                        className="w-full pl-9 pr-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium text-sm text-slate-800"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3 border-t border-slate-100">
                            <button type="button" onClick={onClose} disabled={isLoading} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">
                                Cancelar
                            </button>
                            <button type="submit" disabled={isLoading} className="flex-[2] py-4 bg-brand-600 hover:bg-brand-500 shadow-xl shadow-brand-500/20 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Cliente'}
                            </button>
                        </div>
                        
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}