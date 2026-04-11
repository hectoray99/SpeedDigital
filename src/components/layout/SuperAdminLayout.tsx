import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
    LayoutDashboard, Building2, CreditCard, 
    Megaphone, LogOut, ShieldAlert, Ticket
} from 'lucide-react';

export default function SuperAdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useAuthStore();

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    // Definimos el menú una sola vez para usarlo en desktop y mobile
    const menuItems = [
        { icon: LayoutDashboard, label: 'Métricas', path: '/superadmin/dashboard' },
        { icon: Building2, label: 'Locales', path: '/superadmin/organizations' },
        { icon: CreditCard, label: 'Planes', path: '/superadmin/subscriptions' },
        { icon: Ticket, label: 'Promos', path: '/superadmin/promotions' },
        { icon: Megaphone, label: 'Anuncios', path: '/superadmin/announcements' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row font-sans selection:bg-purple-500/30">
            
            {/* =========================================================
                1. HEADER MOBILE (Solo visible en celulares)
            ========================================================= */}
            <header className="md:hidden flex items-center justify-between p-4 bg-slate-950 border-b border-slate-900 sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <ShieldAlert className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-black text-white tracking-tight">SuperAdmin</span>
                </div>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 bg-slate-900 rounded-lg transition-colors" aria-label="Cerrar sesión">
                    <LogOut className="w-5 h-5" />
                </button>
            </header>

            {/* =========================================================
                2. SIDEBAR DESKTOP (Oculto en celulares)
            ========================================================= */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-950 text-slate-300 fixed h-full z-20 border-r border-slate-900">
                <div className="p-6 border-b border-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <ShieldAlert className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight leading-none">SpeedDigital</h1>
                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">SuperAdmin</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                                    isActive 
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner' 
                                    : 'hover:bg-slate-900 hover:text-white border border-transparent'
                                }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-900">
                    <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors font-medium border border-transparent hover:border-red-500/20">
                        <LogOut className="w-5 h-5" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* =========================================================
                3. CONTENIDO PRINCIPAL (Acá se inyectan las páginas de SuperAdmin)
            ========================================================= */}
            <main className="flex-1 transition-all duration-300 md:ml-64 bg-slate-950 min-h-screen pb-24 md:pb-8">
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>

            {/* =========================================================
                4. NAV INFERIOR MOBILE (Estilo App Nativa)
            ========================================================= */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-950 border-t border-slate-900 z-40 pb-4">
                <div className="flex justify-around items-center p-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex flex-col items-center justify-center p-2 min-w-[4rem] transition-colors ${
                                    isActive ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-purple-500/20 mb-1' : 'mb-1'}`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

        </div>
    );
}