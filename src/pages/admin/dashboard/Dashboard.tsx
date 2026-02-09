import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Users, TrendingUp, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DebtorsListModal from '../../../components/DebtorsListModal';
import OnboardingWizard from '../../../components/OnboardingWizard';

export default function Dashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Estados de Métricas
    const [stats, setStats] = useState({
        activeStudents: 0,
        monthlyIncome: 0,
        pendingDebt: 0
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [showDebtorsModal, setShowDebtorsModal] = useState(false);

    // Estados para Onboarding
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [orgId, setOrgId] = useState('');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        try {
            setLoading(true);

            // 1. VERIFICAR SI NECESITA ONBOARDING (Configuración inicial)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setOrgId(profile.organization_id);

                    const { data: org } = await supabase
                        .from('organizations')
                        .select('setup_completed')
                        .eq('id', profile.organization_id)
                        .single();

                    // Si setup_completed es falso, lanzamos el Wizard
                    if (org && !org.setup_completed) {
                        setShowOnboarding(true);
                    }
                }
            }

            // 2. MÉTRICAS (Adaptadas a la Nueva Arquitectura)

            // A. Alumnos Activos -> Ahora son 'crm_people' activos
            const { count: studentsCount } = await supabase
                .from('crm_people')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // B. Ingresos del Mes -> Ahora es 'finance_ledger' (type: income)
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

            const { data: movements } = await supabase
                .from('finance_ledger')
                .select('amount, processed_at')
                .eq('type', 'income') // Solo ingresos
                .gte('processed_at', startOfMonth);

            const totalIncome = movements?.reduce((sum, mov) => sum + Number(mov.amount), 0) || 0;

            // C. Deuda Pendiente -> Ahora son 'operations' con balance > 0
            const { data: debts } = await supabase
                .from('operations')
                .select('balance')
                .gt('balance', 0) // Balance mayor a 0 significa deuda
                .neq('status', 'cancelled'); // Ignoramos anuladas

            const totalDebt = debts?.reduce((sum, op) => sum + Number(op.balance), 0) || 0;

            // D. Gráfico de Ingresos Diarios
            const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            const tempChartData = Array.from({ length: daysInMonth }, (_, i) => ({
                day: i + 1,
                amount: 0
            }));

            movements?.forEach(mov => {
                const day = new Date(mov.processed_at).getDate();
                if (tempChartData[day - 1]) {
                    tempChartData[day - 1].amount += mov.amount;
                }
            });

            const today = new Date().getDate();
            setChartData(tempChartData.slice(0, today));

            setStats({
                activeStudents: studentsCount || 0,
                monthlyIncome: totalIncome,
                pendingDebt: totalDebt
            });

        } catch (error) {
            console.error('Error calculando métricas:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            {/* WIZARD DE BIENVENIDA */}
            <OnboardingWizard
                isOpen={showOnboarding}
                orgId={orgId}
                onComplete={() => {
                    setShowOnboarding(false);
                    window.location.reload();
                }}
            />

            <DebtorsListModal
                isOpen={showDebtorsModal}
                onClose={() => setShowDebtorsModal(false)}
            />

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Panel de Control</h1>
                <p className="text-slate-500">Resumen financiero y métricas clave.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* --- TARJETAS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-sm font-medium mb-1">Clientes Activos</p>
                                <h3 className="text-3xl font-bold text-slate-800">{stats.activeStudents}</h3>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                                <Users className="w-8 h-8" />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-slate-500 text-sm font-medium mb-1">Ingresos este Mes</p>
                                <h3 className="text-3xl font-bold text-emerald-600">${stats.monthlyIncome.toLocaleString()}</h3>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 relative z-10">
                                <TrendingUp className="w-8 h-8" />
                            </div>
                        </div>

                        <div
                            onClick={() => setShowDebtorsModal(true)}
                            className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow group relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <p className="text-slate-500 text-sm font-medium mb-1 group-hover:text-red-600 transition-colors">Cobros Pendientes</p>
                                <h3 className="text-3xl font-bold text-red-500">${stats.pendingDebt.toLocaleString()}</h3>
                                <div className="flex items-center gap-1 text-xs text-red-400 mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                    Ver lista de deudores <ArrowRight className="w-3 h-3" />
                                </div>
                            </div>
                            <div className="bg-red-50 p-3 rounded-xl text-red-500 group-hover:bg-red-100 transition-colors relative z-10">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                        </div>
                    </div>

                    {/* --- GRÁFICO --- */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Evolución de Ingresos</h3>
                        <div className="h-[300px] w-full">
                            {chartData.length > 0 && chartData.some(d => d.amount > 0) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                            tickFormatter={(val) => `Día ${val}`}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                            tickFormatter={(val) => `$${val}`}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ stroke: '#10b981', strokeWidth: 2 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="amount"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorIncome)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <TrendingUp className="w-12 h-12 mb-2 opacity-50" />
                                    <p>Aún no hay suficientes datos de ingresos.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- CALL TO ACTION --- */}
                    <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
                        <div className="relative z-10 max-w-lg">
                            <h2 className="text-2xl font-bold mb-2">¿Listo para escalar?</h2>
                            <p className="text-slate-400 mb-6">Mantené tus operaciones al día para ver el crecimiento real.</p>
                            <button
                                onClick={() => navigate('/admin/students')}
                                className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-brand-500/20"
                            >
                                Ir a Gestión
                            </button>
                        </div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                        <div className="absolute bottom-0 right-20 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                    </div>
                </div>
            )}
        </div>
    );
}