import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Save, Armchair, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export interface CreateTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateTableModal({ isOpen, onClose, onSuccess }: CreateTableModalProps) {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        capacity: 4
    });

    // Resetear formulario al abrir
    useEffect(() => {
        if (isOpen) {
            setFormData({ name: '', capacity: 4 });
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!orgData?.id) return toast.error('Error de sesión. Recargá la página.');
        if (!formData.name.trim()) return toast.error('El nombre de la mesa es obligatorio.');
        if (formData.capacity <= 0) return toast.error('La capacidad debe ser mayor a 0.');

        setLoading(true);

        try {
            // Se guarda en la tabla 'resources' y se etiqueta como 'is_table' en el JSONB
            const { error } = await supabase.from('resources').insert([{
                organization_id: orgData.id,
                name: formData.name.trim(),
                capacity: Number(formData.capacity),
                is_active: true,
                availability_rules: { is_table: true }
            }]);

            if (error) throw error;

            toast.success('Mesa creada correctamente');
            onSuccess();
            onClose();

        } catch (error: any) {
            toast.error(error.message || 'Error al crear la mesa');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col animate-in zoom-in-95 duration-200">

                            {/* Header */}
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <div className="p-2 bg-brand-100 rounded-xl"><Armchair className="w-5 h-5 text-brand-600" /></div>
                                    Nueva Mesa
                                </Dialog.Title>
                                <button onClick={onClose} disabled={loading} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Body & Footer */}
                            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Identificador / Nombre *</label>
                                    <input
                                        required
                                        autoFocus
                                        placeholder="Ej: Mesa 12, Barra, VIP..."
                                        type="text"
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-slate-800"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                                        <Users className="w-4 h-4 text-slate-400" /> Capacidad (Comensales) *
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-black text-slate-800"
                                        value={formData.capacity}
                                        onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex gap-3">
                                    <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={loading} className="flex-[2] py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-black flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-xl shadow-slate-900/20 active:scale-95 text-lg">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Crear Mesa
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