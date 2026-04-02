import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { X, Loader2, Save, DollarSign, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    studentId: string;
}

export default function CreateReceivableModal({ isOpen, onClose, onSuccess, studentId }: Props) {
    const { orgData } = useAuthStore(); // Memoria global
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        concept: '',
        amount: '',
        due_date: new Date().toISOString().split('T')[0]
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setLoading(true);

        try {
            const { error } = await supabase.from('operations').insert({
                organization_id: orgData.id, // Inyectamos directo
                person_id: studentId,
                status: 'pending',
                total_amount: parseFloat(formData.amount),
                balance: parseFloat(formData.amount),
                metadata: {
                    concept: formData.concept,
                    due_date: formData.due_date
                }
            });

            if (error) throw error;

            toast.success('Cargo generado correctamente');
            onSuccess();
            onClose();
            setFormData({ concept: '', amount: '', due_date: new Date().toISOString().split('T')[0] });

        } catch (error: any) {
            console.error(error);
            toast.error('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800">Generar Nuevo Cargo</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Concepto *</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                required
                                placeholder="Ej: Cuota Febrero 2026"
                                type="text"
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500/20 outline-none"
                                value={formData.concept}
                                onChange={e => setFormData({ ...formData, concept: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Monto ($) *</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500/20 outline-none"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Vencimiento *</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    required
                                    type="date"
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500/20 outline-none"
                                    value={formData.due_date}
                                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Generar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}