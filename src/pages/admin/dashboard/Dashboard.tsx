import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import AnnouncementBanner from '../../../components/AnnouncementBanner';

import {
    DollarSign, Utensils, Receipt, TrendingUp,
    Loader2, Award, Lock, Unlock, Dumbbell, CalendarCheck
} from 'lucide-react';

export default function Dashboard() {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(true);

    const [metrics, setMetrics] = useState({
        revenueToday: 0,      
        activeTasks: 0,       
        averageTicket: 0,     
        totalOrdersToday: 0   
    });

    const [chartData, setChartData] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);

    const isGastro = orgData?.industry === 'gastronomy';
    const isGym = orgData?.industry === 'gym';
    const isSports = orgData?.industry === 'sports' || isGym;

    const dict = {
        activeTitle: isGastro ? "Mesas Activas" : (isGym ? "Clientes en Salón" : "Turnos de Hoy"),
        activeSubtitle: isGastro ? "Comandas pendientes" : (isGym ? "Entrenando ahora" : "En agenda"),
        activeIcon: isGastro ? Utensils : (isGym ? Dumbbell : CalendarCheck),

        ticketTitle: isGastro ? "Ticket Promedio" : "Reserva Prom.",

        rankingTitle: isGastro ? "Platos más pedidos" : (isSports ? "Servicios más reservados" : "Servicios Estrella"),
        rankingEmpty: isGastro
            ? "Cobrá la primera mesa\npara ver el ranking."
            : "Cobrá el primer turno\npara ver el ranking."
    };

    useEffect(() => {
        if (orgData?.id) {
            fetchDashboardData();
        }
    }, [orgData?.id]);

    async function fetchDashboardData() {
        try {
            setLoading(true);

            // --- A. Verificar estado de la caja (Abierta o Cerrada) ---
            const { data: sessionData } = await supabase
                .from('cash_sessions')
                .select('id')
                .eq('organization_id', orgData.id)
                .eq('status', 'open')
                .maybeSingle();

            setIsRegisterOpen(!!sessionData);

            // --- B. Definir rango de tiempo (Hoy) ---
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // --- C. Ingresos de Hoy ---
            const { data: incomeToday } = await supabase
                .from('finance_ledger')
                .select('amount, operation_id')
                .eq('organization_id', orgData.id)
                .eq('type', 'income')
                .gte('processed_at', today.toISOString())
                .lt('processed_at', tomorrow.toISOString());

            const validIncome = incomeToday || [];
            const revenue = validIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const uniqueOpIds = [...new Set(validIncome.map(i => i.operation_id).filter(Boolean))];
            const totalOrders = uniqueOpIds.length;
            const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;

            // --- D. Tareas Activas (Turnos) ---
            const { data: appointmentsToday } = await supabase
                .from('appointments')
                .select('id, status')
                .eq('organization_id', orgData.id)
                .gte('start_time', today.toISOString())
                .lt('start_time', tomorrow.toISOString());

            // --- E. Operaciones de la semana (Para el Gráfico) ---
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const { data: incomeWeek } = await supabase
                .from('finance_ledger')
                .select('amount, processed_at')
                .eq('organization_id', orgData.id)
                .eq('type', 'income')
                .gte('processed_at', sevenDaysAgo.toISOString());

            setMetrics({
                revenueToday: revenue,
                activeTasks: appointmentsToday?.length || 0, 
                averageTicket: avgTicket,
                totalOrdersToday: totalOrders
            });

            // --- F. Procesar Ranking (Top 5 Productos) ---
            if (uniqueOpIds.length > 0) {
                const { data: lines } = await supabase
                    .from('operation_lines')
                    .select('quantity, catalog_items(name)')
                    .in('operation_id', uniqueOpIds);

                if (lines) {
                    const productCounts: Record<string, number> = {};
                    lines.forEach(line => {
                        const catalogData = line.catalog_items as any;
                        const name = Array.isArray(catalogData) ? catalogData[0]?.name : catalogData?.name;
                        if (name) {
                            productCounts[name] = (productCounts[name] || 0) + Number(line.quantity || 0);
                        }
                    });

                    const sortedTop = Object.entries(productCounts)
                        .map(([name, qty]) => ({ name, qty }))
                        .sort((a, b) => b.qty - a.qty)
                        .slice(0, 5);

                    setTopProducts(sortedTop);
                }
            } else {
                setTopProducts([]);
            }

            // --- G. Procesar Gráfico (Últimos 7 días) ---
            if (incomeWeek) {
                const dailyData: Record<string, number> = {};
                const baseDate = new Date(); // Optimización: Una sola fecha base

                for (let i = 6; i >= 0; i--) {
                    const d = new Date(baseDate);
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                    dailyData[dateStr] = 0;
                }

                incomeWeek.forEach(inc => {
                    const dateStr = new Date(inc.processed_at || new Date()).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                    if (dailyData[dateStr] !== undefined) {
                        dailyData[dateStr] += Number(inc.amount || 0);
                    }
                });

                const formattedChartData = Object.keys(dailyData).map(key => ({
                    name: key,
                    Ventas: dailyData[key]
                }));

                setChartData(formattedChartData);
            }

        } catch (error) {
            console.error('Error fetching dashboard:', error);
            toast.error('Error al cargar métricas');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-4 animate-in fade-in duration-500">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="font-bold tracking-wide uppercase text-sm">Analizando datos del local...</p>
            </div>
        );
    }

    const MetricCard = ({ title, value, icon: Icon, subtitle, colorClass }: any) => (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex items-start gap-4">
            <div className={`p-4 rounded-2xl ${colorClass} shrink-0`}>
                <Icon className="w-7 h-7" />
            </div>
            <div>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1.5">{title}</p>
                <h3 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight truncate">{value}</h3>
                <p className="text-slate-400 text-sm mt-2 font-medium">{subtitle}</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            <AnnouncementBanner />
            
            {/* --- CABECERA --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2">Panel de Control</h1>
                    <p className="text-slate-500 text-base md:text-lg">Resumen de actividad y facturación de hoy.</p>
                </div>

                <div className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border shadow-sm ${isRegisterOpen ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {isRegisterOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {isRegisterOpen ? 'Turno de Caja: ABIERTO' : 'Turno de Caja: CERRADO'}
                </div>
            </div>

            {/* --- TARJETAS DE MÉTRICAS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-10">
                <MetricCard
                    title="Ingresos de Hoy"
                    value={`$${metrics.revenueToday.toLocaleString()}`}
                    icon={DollarSign}
                    colorClass="bg-emerald-50 text-emerald-600"
                    subtitle="Facturación cobrada"
                />
                <MetricCard
                    title={dict.activeTitle}
                    value={metrics.activeTasks}
                    icon={dict.activeIcon}
                    colorClass="bg-blue-50 text-blue-600"
                    subtitle={dict.activeSubtitle}
                />
                <MetricCard
                    title={dict.ticketTitle}
                    value={`$${Math.round(metrics.averageTicket).toLocaleString()}`}
                    icon={Receipt}
                    colorClass="bg-purple-50 text-purple-600"
                    subtitle="Gasto por cuenta"
                />
                <MetricCard
                    title="Operaciones Hoy"
                    value={metrics.totalOrdersToday}
                    icon={TrendingUp}
                    colorClass="bg-brand-50 text-brand-600"
                    subtitle="Tickets cerrados"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                
                {/* --- GRÁFICO (Evolución de Ingresos) --- */}
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-800">Evolución de Ingresos</h2>
                            <p className="text-slate-500 text-sm font-medium mt-1">Últimos 7 días de facturación</p>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[250px]">
                        {chartData.length > 0 && chartData.some(d => d.Ventas > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', color: '#1e293b' }}
                                        itemStyle={{ color: '#4f46e5' }}
                                        formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Ingresos']}
                                    />
                                    <Area type="monotone" dataKey="Ventas" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorVentas)" activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <TrendingUp className="w-12 h-12 mb-3 text-slate-300" />
                                <p className="font-bold text-center">Aún no hay ingresos esta semana.</p>
                                <p className="text-sm mt-1 text-center">Cuando cobres, el gráfico aparecerá aquí.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- RANKING (Top 5 Productos) --- */}
                <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl flex flex-col text-white relative overflow-hidden border border-slate-800 min-h-[400px]">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500 rounded-full mix-blend-screen filter blur-[80px] opacity-30 pointer-events-none"></div>
                    
                    <div className="flex items-center gap-4 mb-8 relative z-10">
                        <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl shrink-0">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black">Top Ventas Hoy</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{dict.rankingTitle}</p>
                        </div>
                    </div>

                    <div className="flex-1 relative z-10">
                        {topProducts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-80 mt-10">
                                <dict.activeIcon className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-center font-bold whitespace-pre-line leading-relaxed">{dict.rankingEmpty}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topProducts.map((product, index) => (
                                    <div key={index} className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner
                                            ${index === 0 ? 'bg-amber-400 text-amber-900 shadow-amber-500/20' :
                                              index === 1 ? 'bg-slate-300 text-slate-800 shadow-slate-400/20' :
                                              index === 2 ? 'bg-orange-400 text-orange-950 shadow-orange-500/20' :
                                              'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-bold text-slate-200 truncate">{product.name}</p>
                                        </div>
                                        <div className="bg-brand-500 text-white px-3 py-1.5 rounded-lg font-black text-sm shrink-0">
                                            {product.qty}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}