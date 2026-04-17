import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Wallet, ArrowDownLeft, ArrowUpRight, Calendar, CreditCard, Filter, Loader2, FileText, Hash, User } from 'lucide-react';

export default function Finance() {
    const { orgData } = useAuthStore();
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (orgData?.id) fetchMovements();
    }, [orgData?.id]);

    async function fetchMovements() {
        if (!orgData?.id) return; // BLINDAJE DE TYPESCRIPT
        
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('finance_ledger')
                .select(`
                    *,
                    crm_people (full_name),
                    operations (number)
                `)
                .eq('organization_id', orgData.id)
                .order('processed_at', { ascending: false })
                .limit(50); 

            if (error) throw error;
            if (data) setMovements(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const getPaymentMethodLabel = (method: string) => {
        switch (method) {
            case 'cash': return 'Efectivo';
            case 'card': return 'Tarjeta';
            case 'mercadopago': return 'Transferencia Virtual';
            case 'transfer': return 'Transferencia Bancaria';
            default: return method || 'Desconocido';
        }
    };

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl"><Wallet className="w-6 h-6 text-indigo-600" /></div>
                        Libro Mayor Contable
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium text-sm sm:text-base">Historial global e inmutable de ingresos y egresos de la organización.</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-lg">Historial de Movimientos</h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <Filter className="w-3.5 h-3.5" /> Últimos 50
                    </div>
                </div>

                {loading ? (
                    <div className="p-16 text-center text-slate-400 font-bold flex flex-col items-center gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        Cargando registros contables...
                    </div>
                ) : movements.length === 0 ? (
                    <div className="p-16 text-center text-slate-500 flex flex-col items-center">
                        <FileText className="w-16 h-16 text-slate-200 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700">Sin Movimientos</h3>
                        <p className="mt-2 max-w-sm text-sm font-medium">Las ventas, cobros y pagos registrados en el sistema aparecerán aquí automáticamente.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {movements.map((mov) => (
                            <div key={mov.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4 group">
                                <div className="flex items-start sm:items-center gap-4 w-full">
                                    <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center shadow-sm border ${mov.type === 'income' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-100' : 'bg-red-50 text-red-600 border-red-100 group-hover:bg-red-100'} transition-colors`}>
                                        {mov.type === 'income' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                                    </div>
                                    <div className="w-full">
                                        <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <p className="font-bold text-slate-800 text-base leading-tight">
                                                {mov.notes ? mov.notes : (mov.type === 'income' ? 'Ingreso Registrado' : 'Egreso / Retiro')}
                                            </p>
                                            
                                            {mov.operations?.number && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-slate-800 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                                    <Hash className="w-3 h-3" /> Ticket {mov.operations.number}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-sm font-medium text-slate-500 mt-1 flex flex-wrap items-center gap-2 md:gap-3">
                                            
                                            <span className="flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4 text-slate-400" /> 
                                                {new Date(mov.processed_at).toLocaleDateString()} {new Date(mov.processed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            
                                            <span className="text-slate-300 hidden sm:inline">•</span>
                                            
                                            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-black bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">
                                                <CreditCard className="w-3.5 h-3.5" /> 
                                                {getPaymentMethodLabel(mov.payment_method)}
                                            </span>

                                            {mov.crm_people?.full_name && (
                                                <>
                                                    <span className="text-slate-300 hidden sm:inline">•</span>
                                                    <span className="flex items-center gap-1.5 text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100 text-xs font-bold">
                                                        <User className="w-3.5 h-3.5" />
                                                        {mov.crm_people.full_name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className={`font-black text-2xl px-5 py-2.5 rounded-xl bg-white border shadow-sm shrink-0 ${mov.type === 'income' ? 'text-emerald-600 border-emerald-100' : 'text-slate-800 border-slate-200'}`}>
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