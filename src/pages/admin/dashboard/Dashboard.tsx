import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { DollarSign, Utensils, Receipt, TrendingUp, Loader2, Users } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export default function Dashboard() {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        revenueToday: 0,
        activeTables: 0,
        averageTicket: 0,
        totalOrdersToday: 0
    });
    const [chartData, setChartData] = useState<any[]>([]);

    const isGastro = orgData?.industry === 'gastronomy';

    useEffect(() => {
        if (orgData?.id) {
            fetchDashboardData();
        }
    }, [orgData?.id]);

    async function fetchDashboardData() {
        try {
            setLoading(true);

            // 1. Fecha de hoy (inicio y fin del día)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // 2. Traer operaciones de HOY
            const { data: opsToday, error: opsError } = await supabase
                .from('operations')
                .select('id, total_amount, status, created_at')
                .eq('organization_id', orgData.id)
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString());

            if (opsError) throw opsError;

            // 3. Traer datos para el gráfico (Últimos 7 días)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const { data: opsWeek } = await supabase
                .from('operations')
                .select('total_amount, created_at')
                .eq('organization_id', orgData.id)
                .eq('status', 'paid')
                .gte('created_at', sevenDaysAgo.toISOString());

            // Cálculos para Gastronomía
            if (opsToday) {
                const paidToday = opsToday.filter(op => op.status === 'paid');
                const pendingToday = opsToday.filter(op => op.status === 'pending');

                const revenue = paidToday.reduce((sum, op) => sum + op.total_amount, 0);
                const avgTicket = paidToday.length > 0 ? revenue / paidToday.length : 0;

                setMetrics({
                    revenueToday: revenue,
                    activeTables: pendingToday.length,
                    averageTicket: avgTicket,
                    totalOrdersToday: opsToday.length
                });
            }

            // Armar datos del gráfico agrupados por día
            if (opsWeek) {
                const dailyData: Record<string, number> = {};

                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                    dailyData[dateStr] = 0;
                }

                opsWeek.forEach(op => {
                    const dateStr = new Date(op.created_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                    if (dailyData[dateStr] !== undefined) {
                        dailyData[dateStr] += op.total_amount;
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
        return <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400"><Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" /><p>Analizando datos...</p></div>;
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
            <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Panel de Control</h1>
                <p className="text-slate-500 text-lg">Resumen de actividad y facturación en tiempo real.</p>
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
                    title={isGastro ? "Mesas Activas" : "Clientes Activos"}
                    value={isGastro ? metrics.activeTables : "0"}
                    icon={isGastro ? Utensils : Users}
                    colorClass="bg-blue-50 text-blue-600"
                    subtitle="Comandas pendientes"
                    delay="delay-100"
                />
                <MetricCard
                    title={isGastro ? "Ticket Promedio" : "Suscripción Prom."}
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
                    subtitle="Cuentas creadas"
                    delay="delay-300"
                />
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-8 delay-500 duration-700">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Evolución de Ingresos</h2>
                        <p className="text-slate-500 text-sm">Últimos 7 días de facturación</p>
                    </div>
                </div>

                <div className="h-[350px] w-full">
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
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickFormatter={(value) => `$${value}`}
                                    dx={-10}
                                />
                                {/* ACÁ ESTÁ EL ARREGLO DE TYPESCRIPT */}
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Ingresos']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Ventas"
                                    stroke="#0ea5e9"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorVentas)"
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <TrendingUp className="w-12 h-12 mb-4 text-slate-200" />
                            <p>Aún no hay suficientes datos de ingresos para esta semana.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}