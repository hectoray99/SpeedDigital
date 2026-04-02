import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
    LayoutDashboard, Users, ShoppingBag, CreditCard, Settings,
    LogOut, Menu, X, Building, UtensilsCrossed, Dumbbell, ExternalLink, Contact, LayoutGrid, ChefHat, Loader2,
    Wallet
} from 'lucide-react';

export default function MainLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    // Ahora consumimos también el userRole y el user
    const { user, orgData, userRole, isLoading, signOut } = useAuthStore();

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!orgData) return null;

    const getMenuLabels = (industry: string) => {
        switch (industry) {
            case 'gym':
                return { clients: 'Alumnos', items: 'Planes', staff: 'Profesores', icon: Dumbbell, publicLabel: 'Pantalla de Asistencia' };
            case 'gastronomy':
                return { clients: 'Comensales', items: 'Menú', staff: 'Mozos/Staff', icon: UtensilsCrossed, publicLabel: 'Menú Digital' };
            case 'accounting':
                return { clients: 'Clientes', items: 'Servicios', staff: 'Asesores', icon: Users, publicLabel: 'Portal de Clientes' };
            default:
                return { clients: 'Personas', items: 'Catálogo', staff: 'Personal', icon: Building, publicLabel: 'Página Pública' };
        }
    };

    const labels = getMenuLabels(orgData.industry);
    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';
    const isGastro = orgData.industry === 'gastronomy';

    // ARRAY DE MENÚ BLINDADO POR ROLES
    const menuItems = [
        // Solo Dueños ven el Dashboard
        ...(isOwnerOrAdmin ? [{ icon: LayoutDashboard, label: 'Panel Principal', path: '/admin/dashboard' }] : []),

        // Gastronomía: Salón y Cocina
        ...(isGastro ? [
            { icon: LayoutGrid, label: 'Salón y Mesas', path: '/admin/salon' },
            { icon: ChefHat, label: 'KDS Cocina', path: '/admin/kitchen' }
        ] : []),

        // Otros rubros: Alumnos/Clientes
        ...(!isGastro ? [
            { icon: Users, label: labels.clients, path: '/admin/students' }
        ] : []),

        // Solo dueños/admins ven el panel de Staff
        ...(isOwnerOrAdmin ? [
            { icon: Contact, label: labels.staff, path: '/admin/staff' }
        ] : []),

        // Todos ven el menú/catálogo (pero adentro le ocultaremos los botones)
        { icon: ShoppingBag, label: labels.items, path: '/admin/products' },

        // Solo Dueños ven Finanzas y Configuración
        ...(isOwnerOrAdmin ? [
            { icon: CreditCard, label: 'Finanzas', path: '/admin/finance' },
            { icon: Settings, label: 'Configuración', path: '/admin/settings' },
        ] : []),
        // Solo dueños/admins ven el panel de Staff y la CAJA
        ...(isOwnerOrAdmin ? [
            { icon: Wallet, label: 'Caja', path: '/admin/caja' },
            { icon: Contact, label: labels.staff, path: '/admin/staff' }
        ] : []),
    ];

    const NavLinks = () => (
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
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

            {orgData.slug && (
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Público</p>
                    <a
                        // Ajustamos la ruta dinámicamente: /m/ para gastronomía (Menú) y /p/ para el resto
                        href={isGastro ? `/m/${orgData.slug}` : `/p/${orgData.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-3 rounded-xl text-brand-400 hover:bg-brand-500/10 hover:text-brand-300 transition-all duration-200 group border border-brand-500/20"
                    >
                        <div className="flex items-center gap-3">
                            <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="font-medium">{labels.publicLabel}</span>
                        </div>
                    </a>
                </div>
            )}
        </nav>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">

            {/* CABECERA MÓVIL */}
            <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-30 sticky top-0 shadow-md">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <labels.icon className="w-5 h-5 text-brand-500" />
                        <span className="font-bold text-lg leading-tight">{orgData.name}</span>
                    </div>
                    {/* Etiqueta de Rol en Móvil */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase w-fit mt-1 ${isOwnerOrAdmin ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                        {userRole || 'STAFF'}
                    </span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2">
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* MENÚ MÓVIL (DESPLEGABLE) */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
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

            {/* BARRA LATERAL ESCRITORIO */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white fixed h-full transition-all duration-300 z-20">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-bold text-white break-words leading-tight">{orgData.name}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-slate-500 flex items-center gap-1 capitalize">
                            <labels.icon className="w-3 h-3" /> {orgData.industry}
                        </p>
                        {/* Etiqueta de Rol en Escritorio */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isOwnerOrAdmin ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                            {userRole || 'STAFF'}
                        </span>
                    </div>
                </div>
                <NavLinks />
                <div className="p-4 border-t border-slate-800">
                    <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <main className={`flex-1 transition-all duration-300 md:ml-64`}>
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet context={{ orgData }} />
                </div>
            </main>
        </div>
    );
}