import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
    LayoutDashboard, Users, ShoppingBag, CreditCard, Settings,
    LogOut, Menu, X, Building, UtensilsCrossed, Dumbbell, 
    ExternalLink, Contact, LayoutGrid, ChefHat, Loader2,
    Wallet, CalendarDays, MapPin
} from 'lucide-react';

export default function MainLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const { user, orgData, userRole, isLoading, signOut } = useAuthStore();

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    }

    if (!user) return <Navigate to="/login" replace />;
    if (!orgData) return null;

    const getMenuLabels = (industry: string) => {
        switch (industry) {
            case 'gym':
                return { clients: 'Alumnos', items: 'Planes', staff: 'Profesores', icon: Dumbbell, publicLabel: 'Pantalla de Asistencia' };
            case 'gastronomy':
                return { clients: 'Comensales', items: 'Menú', staff: 'Mozos/Staff', icon: UtensilsCrossed, publicLabel: 'Menú Digital' };
            case 'services': 
                return { clients: 'Clientes/Pacientes', items: 'Servicios', staff: 'Profesionales', icon: CalendarDays, publicLabel: 'Reservar Turno' };
            case 'sports': 
                return { clients: 'Clientes', items: 'Servicios', staff: 'Personal', icon: MapPin, publicLabel: 'Reservar Cancha' };
            case 'accounting':
                return { clients: 'Clientes', items: 'Servicios', staff: 'Asesores', icon: Users, publicLabel: 'Portal de Clientes' };
            default:
                return { clients: 'Personas', items: 'Catálogo', staff: 'Personal', icon: Building, publicLabel: 'Página Pública' };
        }
    };

    const labels = getMenuLabels(orgData.industry);
    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';
    const isGastro = orgData.industry === 'gastronomy';
    const isServices = orgData.industry === 'services' || orgData.industry === 'sports';
    
    const menuItems = [
        ...(isOwnerOrAdmin ? [{ icon: LayoutDashboard, label: 'Panel Principal', path: '/admin/dashboard' }] : []),
        ...(isGastro ? [
            { icon: LayoutGrid, label: 'Salón y Mesas', path: '/admin/salon' },
            { icon: ChefHat, label: 'KDS Cocina', path: '/admin/kitchen' }
        ] : []),
        ...(isServices ? [
            { icon: CalendarDays, label: 'Agenda de Turnos', path: '/admin/agenda' },
            { icon: MapPin, label: orgData.industry === 'sports' ? 'Canchas / Espacios' : 'Agendas / Recursos', path: '/admin/resources' }
        ] : []),
        ...(!isGastro ? [
            { icon: Users, label: labels.clients, path: '/admin/students' } 
        ] : []),
        { icon: ShoppingBag, label: labels.items, path: '/admin/products' },
        ...(isOwnerOrAdmin ? [
            { icon: Wallet, label: 'Caja', path: '/admin/caja' },
            { icon: CreditCard, label: 'Finanzas', path: '/admin/finance' },
            { icon: Contact, label: labels.staff, path: '/admin/staff' },
            { icon: Settings, label: 'Configuración', path: '/admin/settings' },
        ] : []),
    ];

    const NavLinks = () => (
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto hide-scrollbar">
            {menuItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <item.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                        <span className="font-bold text-sm tracking-wide">{item.label}</span>
                    </Link>
                );
            })}

            {orgData.slug && (
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Público</p>
                    <a
                        href={isGastro ? `/m/${orgData.slug}` : `/p/${orgData.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-3 rounded-xl text-brand-400 hover:bg-brand-500/10 hover:text-brand-300 transition-all duration-200 group border border-brand-500/20"
                    >
                        <div className="flex items-center gap-3">
                            <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm tracking-wide">{labels.publicLabel}</span>
                        </div>
                    </a>
                </div>
            )}
        </nav>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">

            {/* --- TOPBAR MÓVIL --- */}
            <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-30 sticky top-0 shadow-md">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <labels.icon className="w-5 h-5 text-brand-400" />
                        <span className="font-black text-lg tracking-tight leading-tight">{orgData.name}</span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase w-fit mt-1 tracking-wider ${isOwnerOrAdmin ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-400'}`}>
                        {userRole || 'STAFF'}
                    </span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-white">
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* --- MENÚ MÓVIL DESPLEGABLE --- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] md:hidden flex">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMobileMenuOpen(false)} />
                    <aside className="relative w-4/5 max-w-sm bg-slate-900 text-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 border-r border-slate-800">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <h1 className="text-xl font-black text-white truncate pr-2 tracking-tight">{orgData.name}</h1>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <NavLinks />
                        <div className="p-4 border-t border-slate-800 bg-slate-950">
                            <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-colors">
                                <LogOut className="w-5 h-5" />
                                Cerrar Sesión
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* --- BARRA LATERAL ESCRITORIO --- */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white fixed h-full transition-all duration-300 z-20 border-r border-slate-800">
                <div className="p-6 border-b border-slate-800 bg-slate-950">
                    <h1 className="text-xl font-black text-white break-words leading-tight tracking-tight">{orgData.name}</h1>
                    <div className="flex items-center gap-2 mt-3">
                        <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                            <labels.icon className="w-3.5 h-3.5" /> {orgData.industry}
                        </p>
                    </div>
                </div>
                <NavLinks />
                <div className="p-4 border-t border-slate-800 bg-slate-950">
                    <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl font-bold transition-colors">
                        <LogOut className="w-5 h-5" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* --- CONTENIDO PRINCIPAL --- */}
            <main className="flex-1 transition-all duration-300 md:ml-64">
                <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
                    <Outlet context={{ orgData }} />
                </div>
            </main>
            
        </div>
    );
}