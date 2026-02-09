import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function DebtorsListModal({ isOpen, onClose }: Props) {
    const [debtors, setDebtors] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) fetchDebtors();
    }, [isOpen]);

    async function fetchDebtors() {
        // Buscamos operaciones con saldo pendiente (balance > 0)
        const { data } = await supabase
            .from('operations')
            .select(`
                id,
                total_amount,
                balance,
                metadata,
                created_at,
                crm_people (id, full_name, identifier)
            `)
            .gt('balance', 0) // <--- Filtro: Tiene deuda
            .neq('status', 'cancelled')
            .order('created_at', { ascending: true }); // Las más viejas primero

        if (data) setDebtors(data);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">

                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Lista de Deudores
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {debtors.length === 0 ? (
                        <p className="text-center text-slate-500 mt-10">No hay deudas pendientes. ¡Felicidades!</p>
                    ) : (
                        debtors.map((debt, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors group">
                                <div>
                                    <div className="font-bold text-slate-800">
                                        {debt.crm_people?.full_name || 'Desconocido'}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {/* Intentamos leer el concepto del metadata, o ponemos 'Venta' */}
                                        {debt.metadata?.concept || 'Venta General'}
                                        {debt.metadata?.due_date && ` • Vence: ${new Date(debt.metadata.due_date).toLocaleDateString()}`}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-red-500">${debt.balance?.toLocaleString()}</span>
                                    <button
                                        onClick={() => navigate(`/admin/students/${debt.crm_people?.id}`)}
                                        className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-brand-500 hover:text-white transition-colors"
                                        title="Ir al perfil"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}