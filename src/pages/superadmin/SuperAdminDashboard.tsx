// src/pages/superadmin/SuperAdminDashboard.tsx
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
        totalOrgs: 0,
        activeOrgs: 0,
        totalUsers: 0,
        newThisWeek: 0
    });
    const [recentOrgs, setRecentOrgs] = useState<any[]>([]);

    useEffect(() => {
        fetchGlobalMetrics();
    }, []);

    async function fetchGlobalMetrics() {
        try {
            setIsLoading(true);

            // 1. Total de Organizaciones
            const { count: totalOrgs } = await supabase
                .from('organizations')
                .select('*', { count: 'exact', head: true });

            // 2. Organizaciones Activas
            const { count: activeOrgs } = await supabase
                .from('organizations')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // 3. Total de Usuarios (Perfiles)
            const { count: totalUsers } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            // 4. Nuevas organizaciones (Últimos 7 días)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const { count: newThisWeek } = await supabase
                .from('organizations')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', sevenDaysAgo.toISOString());

            // 5. Últimas 5 organizaciones registradas (para la lista)
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

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Panel de Control</h1>
                <p className="text-slate-400 mt-1">Métricas globales de SpeedDigital en tiempo real.</p>
            </div>

            {/* --- TARJETAS DE MÉTRICAS (KPIs) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-slate-400 mb-1">Locales Totales</p>
                            <h3 className="text-3xl font-black text-white">{stats.totalOrgs}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Building2 className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-slate-400 mb-1">Locales Activos</p>
                            <h3 className="text-3xl font-black text-emerald-400">{stats.activeOrgs}</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-slate-400 mb-1">Usuarios Totales</p>
                            <h3 className="text-3xl font-black text-white">{stats.totalUsers}</h3>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/20 rounded-full blur-2xl -mr-4 -mt-4"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-sm font-bold text-slate-400 mb-1">Nuevos (7 Días)</p>
                            <h3 className="text-3xl font-black text-brand-400">+{stats.newThisWeek}</h3>
                        </div>
                        <div className="p-3 bg-brand-500/10 rounded-xl text-brand-400">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                </div>

            </div>

            {/* --- LISTA DE ÚLTIMOS REGISTROS --- */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden mt-8">
                <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-purple-500" />
                    <h2 className="text-lg font-bold text-white">Últimos Locales Registrados</h2>
                </div>
                
                <div className="divide-y divide-slate-800/50">
                    {recentOrgs.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 font-medium">
                            Aún no hay locales registrados.
                        </div>
                    ) : (
                        recentOrgs.map((org) => (
                            <div key={org.id} className="p-4 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-bold text-lg">{org.name}</h4>
                                    <p className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
                                        <span className="uppercase text-[10px] tracking-wider font-bold bg-slate-800 px-2 py-0.5 rounded-md text-slate-300">
                                            {org.industry}
                                        </span>
                                        • Registrado el {new Date(org.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                                        org.is_active 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                        {org.is_active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
}