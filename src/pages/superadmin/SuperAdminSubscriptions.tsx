import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CreditCard, DollarSign, TrendingUp, Star, Search } from 'lucide-react';
import { toast } from 'sonner';

// Precios de ejemplo (en USD) para calcular el MRR (Monthly Recurring Revenue)
const PLAN_PRICES: Record<string, number> = {
    'Gratis': 0,
    'Pro': 15,
    'Premium': 39
};

export default function SuperAdminSubscriptions() {
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    async function fetchSubscriptions() {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_admin_orgs');
            if (error) throw error;
            setOrgs(data || []);
        } catch (error) {
            toast.error('Error al cargar las suscripciones');
        } finally {
            setLoading(false);
        }
    }

    const changePlan = async (orgId: string, newPlan: string, orgName: string) => {
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ plan: newPlan })
                .eq('id', orgId);

            if (error) throw error;
            
            toast.success(`Plan de "${orgName}" actualizado a ${newPlan}`);
            
            // Actualizamos la UI localmente para no tener que recargar toda la base de datos
            setOrgs(orgs.map(org => 
                org.id === orgId ? { ...org, plan: newPlan } : org
            ));

        } catch (error) {
            toast.error('Error al actualizar el plan');
        }
    };

    // Cálculos para las métricas
    const totalMRR = orgs.reduce((acc, org) => acc + (PLAN_PRICES[org.plan] || 0), 0);
    const proUsers = orgs.filter(org => org.plan === 'Pro').length;
    const premiumUsers = orgs.filter(org => org.plan === 'Premium').length;
    
    const filteredOrgs = orgs.filter(org => 
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Cabecera */}
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-brand-500" /> 
                    Suscripciones y Facturación
                </h1>
                <p className="text-slate-400 mt-1">Controlá los planes de tus clientes y monitoreá tus ingresos mensuales recurrentes (MRR).</p>
            </div>

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-brand-500/10 border border-brand-500/20 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-sm font-bold text-brand-400 mb-1">Ingreso Mensual (MRR)</p>
                            <h3 className="text-4xl font-black text-white">${totalMRR} <span className="text-lg text-slate-400 font-medium">USD</span></h3>
                        </div>
                        <div className="p-3 bg-brand-500/20 rounded-xl text-brand-400">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-slate-400 mb-1">Cuentas PRO ($15)</p>
                            <h3 className="text-3xl font-black text-white">{proUsers}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-slate-400 mb-1">Cuentas PREMIUM ($39)</p>
                            <h3 className="text-3xl font-black text-white">{premiumUsers}</h3>
                        </div>
                        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                            <Star className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Buscador */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Buscar cliente para cambiar plan..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none text-white font-medium"
                    />
                </div>
            </div>

            {/* Tabla de Planes */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest">
                                <th className="p-5">Local y Dueño</th>
                                <th className="p-5">Rubro</th>
                                <th className="p-5 text-center">Plan Actual</th>
                                <th className="p-5 text-right">Cambiar Plan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredOrgs.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="p-5">
                                        <p className="text-white font-bold text-base">{org.name}</p>
                                        <p className="text-xs text-slate-500">{org.profiles?.email}</p>
                                    </td>
                                    <td className="p-5">
                                        <span className="bg-slate-800 text-slate-300 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest">
                                            {org.industry}
                                        </span>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                                            org.plan === 'Premium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            org.plan === 'Pro' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                            {org.plan}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right">
                                        {/* Selector Mágico para cambiar de plan */}
                                        <select
                                            value={org.plan}
                                            onChange={(e) => changePlan(org.id, e.target.value, org.name)}
                                            className="bg-slate-950 border border-slate-700 text-white text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block w-full p-2.5 outline-none cursor-pointer"
                                        >
                                            <option value="Gratis">Plan Gratis ($0)</option>
                                            <option value="Pro">Plan Pro ($15)</option>
                                            <option value="Premium">Plan Premium ($39)</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}