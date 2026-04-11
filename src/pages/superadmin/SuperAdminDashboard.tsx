import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Users, Activity, TrendingUp, Loader2, Clock } from 'lucide-react';

interface Stats {
    totalOrgs: number;
    activeOrgs: number;
    totalUsers: number;
    newThisWeek: number;
}

export default function SuperAdminDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({
        totalOrgs: 0, activeOrgs: 0, totalUsers: 0, newThisWeek: 0
    });
    const [recentOrgs, setRecentOrgs] = useState<any[]>([]);

    useEffect(() => {
        fetchGlobalMetrics();
    }, []);

    async function fetchGlobalMetrics() {
        try {
            setIsLoading(true);

            // Consultas optimizadas con { count: 'exact', head: true } para no traer toda la data a la UI
            const { count: totalOrgs } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
            const { count: activeOrgs } = await supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('is_active', true);
            const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const { count: newThisWeek } = await supabase
                .from('organizations')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', sevenDaysAgo.toISOString());

            // Los últimos 5 locales creados
            const { data: recent } = await supabase
                .from('organizations')
                .select('id, name, industry, created_at, is_active')
                .order('created_at', { ascending: false })
                .limit(5);

            setStats({
                totalOrgs: totalOrgs || 0,
                activeOrgs: activeOrgs || 0,
                totalUsers: totalUsers || 0,
                newThisWeek: newThisWeek || 0
            });
            
            setRecentOrgs(recent || []);
        } catch (error) {
            console.error('Error fetching metrics:', error);
        } finally {
            setIsLoading(false);
        }
    }

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    if (isLoading) return <div className="flex justify-center items-center h-[60vh] animate-in fade-in"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>;

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            
            {/* CABECERA */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Panel de Control Global</h1>
                <p className="text-slate-400 mt-2 text-sm md:text-base">Métricas generales de tu plataforma SaaS en tiempo real.</p>
            </div>

            {/* --- TARJETAS DE MÉTRICAS (KPIs) --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Locales Totales</p>
                            <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight">{stats.totalOrgs}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20">
                            <Building2 className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Locales Activos</p>
                            <h3 className="text-3xl md:text-5xl font-black text-emerald-400 tracking-tight">{stats.activeOrgs}</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Usuarios Totales</p>
                            <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight">{stats.totalUsers}</h3>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 border border-purple-500/20">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-[#181132] border border-purple-500/20 p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[40px] -mr-8 -mt-8 group-hover:bg-purple-500/30 transition-colors"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-xs font-bold text-purple-300 uppercase tracking-widest mb-2">Nuevos (7 Días)</p>
                            <h3 className="text-3xl md:text-5xl font-black text-purple-400 tracking-tight">+{stats.newThisWeek}</h3>
                        </div>
                        <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-400 shadow-inner">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- LISTA DE ÚLTIMOS REGISTROS --- */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl mt-8">
                <div className="p-6 border-b border-slate-800 flex items-center gap-3 bg-slate-950/50">
                    <Clock className="w-5 h-5 text-purple-500" />
                    <h2 className="text-lg font-bold text-white">Últimos Locales Registrados</h2>
                </div>
                
                <div className="divide-y divide-slate-800/50">
                    {recentOrgs.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 font-medium">Aún no hay locales registrados.</div>
                    ) : (
                        recentOrgs.map((org) => (
                            <div key={org.id} className="p-5 md:p-6 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h4 className="text-white font-black text-lg">{org.name}</h4>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="uppercase text-[10px] tracking-widest font-black bg-slate-950 px-2.5 py-1 rounded-lg text-slate-400 border border-slate-800">
                                            {org.industry}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Registrado el {new Date(org.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border w-full sm:w-auto text-center shrink-0 ${
                                    org.is_active 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    {org.is_active ? 'Cuenta Activa' : 'Suspendido'}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}