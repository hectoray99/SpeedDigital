import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function DebtorsListModal({ isOpen, onClose }: Props) {
    const { orgData } = useAuthStore();
    const [debtors, setDebtors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen && orgData?.id) fetchDebtors();
    }, [isOpen, orgData?.id]);

    async function fetchDebtors() {
        if (!orgData?.id) return; // BLINDAJE DE TYPESCRIPT
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('operations')
                .select(`
                    id,
                    total_amount,
                    balance,
                    metadata,
                    created_at,
                    crm_people (id, full_name, identifier)
                `)
                .eq('organization_id', orgData.id) 
                .gt('balance', 0) 
                .neq('status', 'cancelled')
                .order('created_at', { ascending: true }); 

            if (error) throw error;
            setDebtors(data || []);
        } catch (error) {
            console.error('Error fetching debtors:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={onClose}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Dialog.Panel className="w-full max-w-2xl h-[85vh] md:h-[80vh] transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col animate-in zoom-in-95 duration-200">
                            
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <div className="p-2 bg-red-100 rounded-xl"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                                    Lista de Deudores
                                </Dialog.Title>
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                                {loading ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-brand-500" />
                                        <p className="font-bold text-sm uppercase tracking-widest">Buscando deudas...</p>
                                    </div>
                                ) : debtors.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-emerald-500/60 p-8 text-center">
                                        <AlertCircle className="w-16 h-16 mb-4" />
                                        <h4 className="text-xl font-black text-emerald-700 mb-2">¡Todo al día!</h4>
                                        <p className="font-medium text-emerald-600/80">No hay deudas pendientes en el sistema en este momento.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {debtors.map((debt, idx) => {
                                            const person = debt.crm_people || { full_name: 'Cliente Eliminado', id: null };
                                            return (
                                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 bg-white border border-slate-200 rounded-2xl hover:border-red-200 hover:shadow-md transition-all group gap-4">
                                                    
                                                    <div className="flex-1">
                                                        <div className="font-black text-slate-800 text-lg">
                                                            {person.full_name}
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-500 mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase tracking-wider">
                                                                {debt.metadata?.concept || 'Venta General'}
                                                            </span>
                                                            {debt.metadata?.due_date && (
                                                                <span className="text-red-500/80">
                                                                    Vence: {new Date(debt.metadata.due_date).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-slate-100">
                                                        <div className="text-left sm:text-right">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Debe</p>
                                                            <span className="font-black text-xl text-red-600">${debt.balance?.toLocaleString()}</span>
                                                        </div>
                                                        
                                                        {person.id && (
                                                            <button
                                                                onClick={() => {
                                                                    onClose(); 
                                                                    navigate(`/admin/students/${person.id}`);
                                                                }}
                                                                className="p-3 md:px-4 md:py-3 bg-slate-900 text-white rounded-xl hover:bg-black hover:shadow-lg hover:shadow-slate-900/20 transition-all font-bold text-sm flex items-center gap-2 active:scale-95"
                                                                title="Ir al perfil para cobrar"
                                                            >
                                                                <span className="hidden md:inline">Cobrar</span>
                                                                <ArrowRight className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>

                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}