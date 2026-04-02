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

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: '', capacity: 4 });
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setLoading(true);

        try {
            // AHORA SÍ: Usamos el esquema exacto de tu base de datos
            const { error } = await supabase.from('resources').insert([{
                organization_id: orgData.id,
                name: formData.name,
                capacity: Number(formData.capacity), // Usamos tu columna nativa
                is_active: true,
                availability_rules: { is_table: true } // Usamos tu JSONB como metadata
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
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col">

                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                                <Dialog.Title as="h3" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Armchair className="w-5 h-5 text-brand-600" />
                                    Nueva Mesa
                                </Dialog.Title>
                                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Identificador de la Mesa</label>
                                    <input
                                        required
                                        placeholder="Ej: Mesa 12, Barra, VIP..."
                                        type="text"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-1">
                                        <Users className="w-4 h-4 text-slate-400" /> Capacidad (Comensales)
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20"
                                        value={formData.capacity}
                                        onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-100 mt-2">
                                    <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 hover:bg-black transition-colors text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50">
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