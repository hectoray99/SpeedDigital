import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
    LayoutDashboard, Users, ShoppingBag, CreditCard, Settings,
    LogOut, Menu, X, Building, UtensilsCrossed, Dumbbell,
    ExternalLink, Contact, LayoutGrid, ChefHat, Loader2,
    Wallet, CalendarDays, MapPin, Sparkles, Activity, Clock,
    ChevronLeft, ChevronDown, Calculator
} from 'lucide-react';

export default function MainLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => 
        localStorage.getItem('sidebar-collapsed') === 'true'
    );

    // Estado de secciones (abiertas por defecto)
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('open-sections');
        return saved ? JSON.parse(saved) : {
            Principal: true, Operativo: true, Gestión: true, Equipo: true, Sistema: true
        };
    });

    const location = useLocation();
    const navigate = useNavigate();
    const { user, orgData, userRole, isLoading, signOut } = useAuthStore();

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
    }, [isCollapsed]);

    useEffect(() => {
        localStorage.setItem('open-sections', JSON.stringify(openSections));
    }, [openSections]);

    const toggleSection = (title: string) => {
        setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    if (!orgData) return null;

    const getMenuLabels = (industry: string) => {
        switch (industry) {
            case 'gym': return { clients: 'Alumnos', items: 'Planes', staff: 'Profesores', icon: Dumbbell, publicLabel: 'Pantalla de Asistencia' };
            case 'gastronomy': return { clients: 'Comensales', items: 'Menú', staff: 'Mozos/Staff', icon: UtensilsCrossed, publicLabel: 'Menú Digital' };
            case 'services': return { clients: 'Clientes/Pacientes', items: 'Catálogo', staff: 'Profesionales', icon: CalendarDays, publicLabel: 'Reservar Turno' };
            case 'sports': return { clients: 'Clientes', items: 'Catálogo', staff: 'Personal', icon: MapPin, publicLabel: 'Reservar Cancha' };
            default: return { clients: 'Personas', items: 'Catálogo', staff: 'Personal', icon: Building, publicLabel: 'Página Pública' };
        }
    };

    const labels = getMenuLabels(orgData.industry);
    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';
    const isGastro = orgData.industry === 'gastronomy';
    const isServices = ['services', 'sports', 'gym'].includes(orgData.industry);

    const menuSections = [
        { title: "Principal", items: isOwnerOrAdmin ? [{ icon: LayoutDashboard, label: 'Panel Principal', path: '/admin/dashboard' }] : [] },
        { title: "Operativo", items: isServices ? [
            { icon: Activity, label: 'Monitor Operativo', path: '/admin/master-calendar' },
            { icon: CalendarDays, label: 'Agenda de Turnos', path: '/admin/agenda' },
            { icon: MapPin, label: orgData.industry === 'sports' ? 'Canchas / Espacios' : 'Agendas / Recursos', path: '/admin/resources' },
            { icon: orgData.industry === 'gym' ? Dumbbell : Sparkles, label: orgData.industry === 'gym' ? 'Disciplinas y Clases' : 'Servicios Agendables', path: '/admin/disciplines' }
        ] : isGastro ? [
            { icon: LayoutGrid, label: 'Salón y Mesas', path: '/admin/salon' },
            { icon: ChefHat, label: 'KDS Cocina', path: '/admin/kitchen' }
        ] : [] },
        { title: "Gestión", items: [
            ...(!isGastro ? [{ icon: Users, label: labels.clients, path: '/admin/clients' }] : []),
            { icon: ShoppingBag, label: labels.items, path: '/admin/products' },
            ...(isOwnerOrAdmin ? [
                { icon: Wallet, label: 'Caja', path: '/admin/caja' },
                { icon: CreditCard, label: 'Finanzas', path: '/admin/finance' },
            ] : [])
        ]},
        { title: "Equipo", items: isOwnerOrAdmin ? [
            { icon: Contact, label: labels.staff, path: '/admin/staff' },
            { icon: Calculator, label: 'Liquidación', path: '/admin/payroll' },
            { icon: CalendarDays, label: 'Reporte de Asistencias', path: '/admin/attendance' },
            { icon: Clock, label: 'Reloj Fichador', path: '/admin/timeclock' },
        ] : [] },
        { title: "Sistema", items: isOwnerOrAdmin ? [
            { icon: Settings, label: 'Configuración', path: '/admin/settings' },
        ] : [] }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans selection:bg-brand-200 selection:text-brand-900 overflow-x-hidden">

            {/* =========================================================
                SIDEBAR DESKTOP
                ========================================================= */}
            <aside className={`hidden md:flex flex-col bg-slate-900 text-slate-300 fixed h-full transition-all duration-300 z-40 shadow-2xl shadow-slate-900/20 ${isCollapsed ? 'w-20' : 'w-[17rem]'}`}>
                
                {/* Header del Sidebar (AQUÍ ESTÁ LA MAGIA PARA EVITAR QUE SE ENCIMEN) */}
                <div className={`h-16 flex items-center border-b border-slate-800 shrink-0 transition-all ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
                    {isCollapsed ? (
                        <button 
                            onClick={() => setIsCollapsed(false)}
                            className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center hover:bg-brand-500/20 transition-colors cursor-pointer"
                            title="Expandir menú"
                        >
                            <labels.icon className="w-5 h-5 text-brand-400" />
                        </button>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                                    <labels.icon className="w-5 h-5 text-brand-400" />
                                </div>
                                <span className="font-black text-white text-lg tracking-tight truncate">{orgData.name}</span>
                            </div>
                            <button 
                                onClick={() => setIsCollapsed(true)} 
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Colapsar menú"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto hide-scrollbar py-4 px-3 space-y-5">
                    {menuSections.map((section, idx) => {
                        const filteredItems = section.items.filter(Boolean);
                        if (filteredItems.length === 0) return null;
                        const isOpen = openSections[section.title] ?? true;

                        return (
                            <div key={section.title} className="space-y-1">
                                {!isCollapsed ? (
                                    <button onClick={() => toggleSection(section.title)} className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors group">
                                        {section.title}
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-400' : 'opacity-0 group-hover:opacity-100'}`} />
                                    </button>
                                ) : (
                                    <div className={`h-px bg-slate-800 mx-2 my-4 ${idx === 0 ? 'hidden' : 'block'}`} />
                                )}

                                <div className={`space-y-1 overflow-hidden transition-all duration-300 ${!isOpen && !isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                                    {filteredItems.map((item: any) => {
                                        const isActive = location.pathname.startsWith(item.path);
                                        return (
                                            <Link key={item.path} to={item.path} className={`flex items-center rounded-xl transition-all duration-200 group relative ${isCollapsed ? 'justify-center py-3' : 'px-3 py-2.5 gap-3'} ${isActive ? 'bg-brand-500/10 text-brand-400 font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 font-medium'}`}>
                                                {isActive && !isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-brand-500 rounded-r-full" />}
                                                <item.icon className={`shrink-0 transition-transform duration-300 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} ${isActive && !isCollapsed ? 'scale-110' : 'group-hover:scale-110'}`} />
                                                {!isCollapsed && <span className="text-sm tracking-wide truncate">{item.label}</span>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {orgData.slug && (
                        <div className={`pt-4 mt-4 border-t border-slate-800 ${isCollapsed ? 'flex justify-center' : ''}`}>
                            <a href={isGastro ? `/m/${orgData.slug}` : `/p/${orgData.slug}`} target="_blank" rel="noopener noreferrer" className={`flex items-center rounded-xl text-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-300 transition-colors border border-emerald-400/20 ${isCollapsed ? 'p-3 justify-center' : 'px-3 py-2.5 gap-3'}`} title={isCollapsed ? labels.publicLabel : ''}>
                                <ExternalLink className={isCollapsed ? 'w-5 h-5' : 'w-4 h-4 shrink-0'} />
                                {!isCollapsed && <span className="font-bold text-sm truncate">{labels.publicLabel}</span>}
                            </a>
                        </div>
                    )}
                </nav>

                <div className="p-3 border-t border-slate-800 shrink-0">
                    <button onClick={handleLogout} className={`flex items-center rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full ${isCollapsed ? 'p-3 justify-center' : 'px-3 py-2.5 gap-3'}`} title={isCollapsed ? 'Cerrar Sesión' : ''}>
                        <LogOut className={isCollapsed ? 'w-5 h-5' : 'w-5 h-5 shrink-0'} />
                        {!isCollapsed && <span className="font-medium text-sm">Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            {/* =========================================================
                HEADER MOBILE
                ========================================================= */}
            <header className="md:hidden bg-white/90 backdrop-blur-md text-slate-800 h-16 w-full flex justify-between items-center px-4 sticky top-0 z-30 border-b border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                        <labels.icon className="w-5 h-5 text-brand-600" />
                    </div>
                    <span className="font-black text-lg tracking-tight truncate max-w-[200px]">{orgData.name}</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 shrink-0">
                    <Menu className="w-6 h-6 text-slate-600" />
                </button>
            </header>

            {/* =========================================================
                DRAWER MOBILE (Desliza desde la derecha)
                ========================================================= */}
            <div className={`md:hidden fixed inset-0 z-[100] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                
                <div className={`absolute right-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out shadow-[-20px_0_40px_rgba(0,0,0,0.3)] ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="h-16 border-b border-slate-800 flex items-center justify-between px-5 shrink-0">
                        <span className="font-black text-white text-lg truncate">{orgData.name}</span>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <nav className="flex-1 p-4 overflow-y-auto space-y-6 hide-scrollbar">
                        {menuSections.map((section) => {
                            const filteredItems = section.items.filter(Boolean);
                            if (filteredItems.length === 0) return null;
                            return (
                                <div key={section.title} className="space-y-2">
                                    <p className="px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">{section.title}</p>
                                    <div className="space-y-1">
                                        {filteredItems.map((item: any) => {
                                            const isActive = location.pathname.startsWith(item.path);
                                            return (
                                                <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-medium ${isActive ? 'bg-brand-500/10 text-brand-400 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                                                    <item.icon className="w-5 h-5 shrink-0" />
                                                    <span>{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>
                    <div className="p-4 border-t border-slate-800 space-y-2 shrink-0">
                        {orgData.slug && (
                            <a href={isGastro ? `/m/${orgData.slug}` : `/p/${orgData.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-2xl font-bold transition-all">
                                <ExternalLink className="w-5 h-5" /> {labels.publicLabel}
                            </a>
                        )}
                        <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-3.5 bg-slate-800 text-slate-300 hover:bg-red-500 hover:text-white rounded-2xl font-bold transition-all">
                            <LogOut className="w-5 h-5" /> Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>

            {/* =========================================================
                ÁREA DE CONTENIDO PRINCIPAL
                ========================================================= */}
            <main className={`flex-1 flex flex-col min-w-0 w-full transition-all duration-300 ease-in-out ${isCollapsed ? 'md:ml-20' : 'md:ml-[17rem]'}`}>
                <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 md:p-8 lg:p-10">
                    <Outlet context={{ orgData }} />
                </div>
            </main>

        </div>
    );
}