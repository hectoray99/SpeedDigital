import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

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

            // --- A. Verificar estado de la caja ---
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

            // --- C. Ingresos de Hoy (Leemos del finance_ledger) ---
            const { data: incomeToday } = await supabase
                .from('finance_ledger')
                .select('amount, operation_id')
                .eq('organization_id', orgData.id)
                .eq('type', 'income')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString());

            const revenue = (incomeToday || []).reduce((sum, item) => sum + Number(item.amount), 0);
            
            // Extraer IDs de operaciones únicas para contar los tickets
            const uniqueOpIds = [...new Set((incomeToday || []).map(i => i.operation_id).filter(Boolean))];
            const totalOrders = uniqueOpIds.length;
            const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;

            // --- D. Turnos de Hoy (Leemos de appointments) ---
            const { data: appointmentsToday } = await supabase
                .from('appointments')
                .select('id, status')
                .eq('organization_id', orgData.id)
                .gte('start_time', today.toISOString())
                .lt('start_time', tomorrow.toISOString());

            // --- E. Operaciones de la semana (Para el gráfico) ---
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const { data: incomeWeek } = await supabase
                .from('finance_ledger')
                .select('amount, created_at')
                .eq('organization_id', orgData.id)
                .eq('type', 'income')
                .gte('created_at', sevenDaysAgo.toISOString());

            setMetrics({
                revenueToday: revenue,
                activeTasks: appointmentsToday?.length || 0, // Total de turnos agendados para hoy
                averageTicket: avgTicket,
                totalOrdersToday: totalOrders
            });

            // --- F. Procesar Ranking de Productos ---
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
                            productCounts[name] = (productCounts[name] || 0) + Number(line.quantity);
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

            // --- G. Procesar Datos para el Gráfico ---
            if (incomeWeek) {
                const dailyData: Record<string, number> = {};

                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                    dailyData[dateStr] = 0;
                }

                incomeWeek.forEach(inc => {
                    const dateStr = new Date(inc.created_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                    if (dailyData[dateStr] !== undefined) {
                        dailyData[dateStr] += Number(inc.amount);
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
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                <p>Analizando datos...</p>
            </div>
        );
    }

    const MetricCard = ({ title, value, icon: Icon, subtitle, colorClass, delay }: any) => (
        <div className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 ${delay}`}>
            <div className={`p-4 rounded-2xl ${colorClass} shrink-0`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-slate-500 font-medium text-sm mb-1">{title}</p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h3>
                <p className="text-slate-400 text-xs mt-2 font-medium">{subtitle}</p>
            </div>
        </div>
    );

    return (
        <div className="pb-12 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Panel de Control</h1>
                    <p className="text-slate-500 text-lg">Resumen de actividad y facturación en tiempo real.</p>
                </div>

                <div className={`mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border ${isRegisterOpen ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {isRegisterOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {isRegisterOpen ? 'Turno de Caja: ABIERTO' : 'Turno de Caja: CERRADO'}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard
                    title="Ingresos de Hoy"
                    value={`$${metrics.revenueToday.toLocaleString()}`}
                    icon={DollarSign}
                    colorClass="bg-emerald-50 text-emerald-600"
                    subtitle="Facturación cobrada"
                    delay="delay-0"
                />
                <MetricCard
                    title={dict.activeTitle}
                    value={metrics.activeTasks}
                    icon={dict.activeIcon}
                    colorClass="bg-blue-50 text-blue-600"
                    subtitle={dict.activeSubtitle}
                    delay="delay-100"
                />
                <MetricCard
                    title={dict.ticketTitle}
                    value={`$${Math.round(metrics.averageTicket).toLocaleString()}`}
                    icon={Receipt}
                    colorClass="bg-purple-50 text-purple-600"
                    subtitle="Gasto por cuenta"
                    delay="delay-200"
                />
                <MetricCard
                    title="Operaciones Hoy"
                    value={metrics.totalOrdersToday}
                    icon={TrendingUp}
                    colorClass="bg-brand-50 text-brand-600"
                    subtitle="Tickets cerrados"
                    delay="delay-300"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 delay-500 duration-700">
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Evolución de Ingresos</h2>
                            <p className="text-slate-500 text-sm">Últimos 7 días de facturación</p>
                        </div>
                    </div>

                    <div className="h-[300px] w-full mt-auto">
                        {chartData.length > 0 && chartData.some(d => d.Ventas > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => `$${value}`} dx={-10} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Ingresos']}
                                    />
                                    <Area type="monotone" dataKey="Ventas" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorVentas)" activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <TrendingUp className="w-12 h-12 mb-2 text-slate-300" />
                                <p className="font-medium">Aún no hay ingresos esta semana.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-3xl shadow-xl flex flex-col text-white">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Top Ventas Hoy</h2>
                            <p className="text-slate-400 text-sm">{dict.rankingTitle}</p>
                        </div>
                    </div>

                    <div className="flex-1">
                        {topProducts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                                <dict.activeIcon className="w-10 h-10 mb-3" />
                                <p className="text-center text-sm whitespace-pre-line">{dict.rankingEmpty}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topProducts.map((product, index) => (
                                    <div key={index} className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 
                                            ${index === 0 ? 'bg-amber-400 text-amber-900' :
                                                index === 1 ? 'bg-slate-300 text-slate-800' :
                                                    index === 2 ? 'bg-orange-400 text-orange-950' :
                                                        'bg-slate-700 text-slate-400'}`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-bold text-slate-200 truncate">{product.name}</p>
                                        </div>
                                        <div className="bg-brand-500 text-white px-3 py-1 rounded-lg font-black text-sm shrink-0">
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