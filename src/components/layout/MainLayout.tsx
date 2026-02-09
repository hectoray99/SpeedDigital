import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    LayoutDashboard, Users, ShoppingBag, CreditCard, Settings,
    LogOut, Menu, X, Building, UtensilsCrossed, Dumbbell
} from 'lucide-react';

export default function MainLayout() {
    // Estas variables ahora SÍ se usan en el renderizado móvil (ver abajo)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [orgData, setOrgData] = useState({ name: 'Cargando...', industry: 'generic' });

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrgData();
    }, []);

    async function fetchOrgData() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (profile) {
            const { data: org } = await supabase
                .from('organizations')
                .select('name, industry')
                .eq('id', profile.organization_id)
                .single();

            if (org) setOrgData(org);
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const getMenuLabels = (industry: string) => {
        switch (industry) {
            case 'gym':
                return { clients: 'Alumnos', items: 'Planes', icon: Dumbbell };
            case 'gastronomy':
                return { clients: 'Comensales', items: 'Menú', icon: UtensilsCrossed };
            case 'accounting':
                return { clients: 'Clientes', items: 'Servicios', icon: Users };
            default:
                return { clients: 'Personas', items: 'Catálogo', icon: Building };
        }
    };

    const labels = getMenuLabels(orgData.industry);

    const menuItems = [
        { icon: LayoutDashboard, label: 'Panel Principal', path: '/admin/dashboard' },
        { icon: Users, label: labels.clients, path: '/admin/students' },
        { icon: ShoppingBag, label: labels.items, path: '/admin/products' },
        { icon: CreditCard, label: 'Finanzas', path: '/admin/finance' },
        { icon: Settings, label: 'Configuración', path: '/admin/settings' },
    ];

    // Componente interno para reutilizar la lista de links
    const NavLinks = () => (
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)} // Cierra menú al hacer clic en móvil
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <item.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                        <span className="font-medium">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">

            {/* --- HEADER MÓVIL (Ahora usamos Menu) --- */}
            <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-30 sticky top-0 shadow-md">
                <div className="flex items-center gap-2">
                    <labels.icon className="w-5 h-5 text-brand-500" />
                    <span className="font-bold text-lg">{orgData.name}</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2">
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* --- SIDEBAR MÓVIL (Overlay) --- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    {/* Fondo oscuro al hacer click cierra */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    {/* Panel lateral móvil */}
                    <aside className="absolute left-0 top-0 bottom-0 w-3/4 bg-slate-900 text-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h1 className="text-xl font-bold text-white truncate pr-2">{orgData.name}</h1>
                            <button onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <NavLinks />
                        <div className="p-4 border-t border-slate-800">
                            <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors">
                                <LogOut className="w-5 h-5" />
                                <span>Cerrar Sesión</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* --- SIDEBAR ESCRITORIO (Fijo) --- */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white fixed h-full transition-all duration-300 z-20">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-bold text-white break-words leading-tight">
                        {orgData.name}
                    </h1>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 capitalize">
                        <labels.icon className="w-3 h-3" /> {orgData.industry}
                    </p>
                </div>

                <NavLinks />

                <div className="p-4 border-t border-slate-800">
                    <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* --- ÁREA PRINCIPAL --- */}
            <main className={`flex-1 transition-all duration-300 md:ml-64`}>
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}