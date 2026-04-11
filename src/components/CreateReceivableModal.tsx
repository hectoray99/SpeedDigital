import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
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
    const { orgData } = useAuthStore(); 
    const [loading, setLoading] = useState(false);
    
    // El formulario arranca con la fecha de hoy por defecto
    const [formData, setFormData] = useState({
        concept: '',
        amount: '',
        due_date: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validación de datos y seguridad
        if (!orgData?.id) return toast.error("Error de sesión. Recargá la página.");
        
        const numericAmount = parseFloat(formData.amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return toast.error('El monto debe ser un número mayor a 0');
        }
        
        if (!formData.concept.trim()) {
            return toast.error('Debes ingresar un concepto válido');
        }

        setLoading(true);

        try {
            // Creamos la "Deuda" (Operación en estado Pendiente)
            const { error } = await supabase.from('operations').insert({
                organization_id: orgData.id,
                person_id: studentId,
                status: 'pending', // Fundamental: Esto significa "Por Pagar"
                total_amount: numericAmount,
                balance: numericAmount, // Debe todo el monto
                metadata: {
                    concept: formData.concept.trim(),
                    due_date: formData.due_date,
                    is_manual_receivable: true // Etiqueta para saber que no provino de un plan automático
                }
            });

            if (error) throw error;

            toast.success('Cargo generado y asignado al alumno.');
            onSuccess();
            onClose();
            setFormData({ concept: '', amount: '', due_date: new Date().toISOString().split('T')[0] });

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error al generar el cargo');
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
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all animate-in zoom-in-95 duration-200">
                            
                            {/* HEADER */}
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 tracking-tight">
                                    Generar Nuevo Cargo
                                </Dialog.Title>
                                <button onClick={onClose} disabled={loading} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* BODY FORMULARIO */}
                            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Concepto a Cobrar *</label>
                                    <div className="relative shadow-sm rounded-xl">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            required
                                            autoFocus
                                            placeholder="Ej: Cuota Febrero 2026, Multa..."
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold text-slate-800"
                                            value={formData.concept}
                                            onChange={e => setFormData({ ...formData, concept: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Monto ($) *</label>
                                        <div className="relative shadow-sm rounded-xl">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                required
                                                type="number"
                                                min="0"
                                                step="1"
                                                placeholder="0.00"
                                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-black text-slate-800"
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Vencimiento *</label>
                                        <div className="relative shadow-sm rounded-xl">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                required
                                                type="date"
                                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold text-slate-700"
                                                value={formData.due_date}
                                                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* FOOTER ACTIONS */}
                                <div className="pt-4 flex gap-3 border-t border-slate-100">
                                    <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={loading} className="flex-[2] py-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-brand-500/20 disabled:opacity-50">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Generar Cargo
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