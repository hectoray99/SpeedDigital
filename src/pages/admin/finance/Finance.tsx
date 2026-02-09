import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Wallet, ArrowDownLeft, ArrowUpRight, Calendar } from 'lucide-react';
import CreateOperationModal from '../../../components/CreateOperationModal';

export default function Finance() {
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

    useEffect(() => {
        fetchMovements();
    }, []);

    async function fetchMovements() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('finance_ledger')
                .select(`
                    *,
                    crm_people (full_name)
                `)
                .order('processed_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            if (data) setMovements(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <CreateOperationModal
                isOpen={isSaleModalOpen}
                onClose={() => setIsSaleModalOpen(false)}
                onSuccess={fetchMovements}
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Finanzas</h1>
                    <p className="text-slate-500">Control de caja y movimientos.</p>
                </div>
                <button
                    onClick={() => setIsSaleModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Venta
                </button>
            </div>

            {/* Lista de Movimientos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-slate-500" />
                    <h3 className="font-semibold text-slate-700">Últimos Movimientos</h3>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400">Cargando caja...</div>
                ) : movements.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No hay movimientos registrados.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {movements.map((mov) => (
                            <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mov.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                        {mov.type === 'income' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">
                                            {mov.type === 'income' ? 'Cobro a ' : 'Pago a '}
                                            {mov.crm_people?.full_name || 'Desconocido'}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(mov.processed_at).toLocaleDateString()} • {mov.payment_method}
                                        </div>
                                    </div>
                                </div>
                                <span className={`font-bold text-lg ${mov.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                    {mov.type === 'income' ? '+' : '-'}${Number(mov.amount).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}