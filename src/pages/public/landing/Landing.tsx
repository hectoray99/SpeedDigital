import { Link } from 'react-router-dom';
import {
    Zap, BarChart3, ArrowRight, Menu, X,
    ShieldCheck, Globe, Smartphone, Coffee, Dumbbell,
    Briefcase, Sparkles, CheckCircle2, Star, CalendarDays, Receipt, ChevronRight, Loader2, Tag, Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { supabase } from '../../../lib/supabase'; 

// ============================================================================
// DATOS ESTÁTICOS Y CONFIGURACIÓN VISUAL
// ============================================================================
const VERTICALS = [
    { label: "Servicios", icon: <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />, color: "text-blue-400" },
    { label: "Gimnasio", icon: <Dumbbell className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />, color: "text-emerald-400" },
    { label: "Restaurante", icon: <Coffee className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400" />, color: "text-orange-400" },
];

const PLAN_UI_CONFIG: Record<string, any> = {
    'free': {
        description: "Ideal para probar la plataforma y empezar a organizar tu negocio sin riesgos.",
        features: ["1 Local / Sucursal", "Hasta 50 clientes registrados", "Agenda y Control de Caja básico", "Soporte por email"],
        buttonText: "Empezar Gratis",
        isPopular: false
    },
    'premium': {
        description: "Control total, herramientas avanzadas y autogestión para potenciar tus ventas.",
        features: ["Clientes ilimitados", "Portal web para tus clientes (Reservas/QR)", "Estadísticas y Reportes Financieros", "Soporte prioritario por WhatsApp"],
        buttonText: "Actualizar a Premium",
        isPopular: true
    }
};

export default function Landing() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentVertical, setCurrentVertical] = useState(0);
    const [activeFeatureTab, setActiveFeatureTab] = useState('services'); 

    // Estado para los planes dinámicos
    const [pricingPlans, setPricingPlans] = useState<any[]>([]);
    const [publicPromo, setPublicPromo] = useState<any | null>(null); 
    const [loadingPlans, setLoadingPlans] = useState(true);

    // Bucle para animar las industrias en el Hero
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentVertical((prev) => (prev + 1) % VERTICALS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Bloquear scroll si el menú móvil está abierto
    useEffect(() => {
        if (isMenuOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
    }, [isMenuOpen]);

    // ============================================================================
    // FETCH DATA (Planes y Promos)
    // ============================================================================
    useEffect(() => {
        async function fetchPlans() {
            try {
                // 1. Buscamos Planes Activos
                const { data: plansData, error: plansError } = await supabase
                    .from('billing_plans')
                    .select('code, name, price, interval')
                    .eq('is_active', true)
                    .order('price', { ascending: true });

                if (plansError) throw plansError;

                // 2. Buscamos CAMPAÑA PÚBLICA ACTIVA
                const { data: promoData } = await supabase.from('promotions')
                    .select('*')
                    .eq('is_active', true)
                    .eq('is_public', true)
                    .order('created_at', { ascending: false })
                    .limit(10);
                
                const validPromo = promoData?.find(p => {
                    const isNotExpired = !p.expires_at || new Date(p.expires_at) > new Date();
                    const isNotExhausted = !p.max_uses || p.current_uses < p.max_uses;
                    return isNotExpired && isNotExhausted;
                });

                if (validPromo) setPublicPromo(validPromo);
                
                // 3. Formateamos y unimos DB + UI
                const formattedPlans = (plansData || []).map(plan => {
                    const uiConfig = PLAN_UI_CONFIG[plan.code] || PLAN_UI_CONFIG['free']; 
                    
                    let displayPrice = plan.price;
                    let originalPrice = null;

                    if (validPromo && plan.price > 0) {
                        if (validPromo.type === 'percentage') {
                            displayPrice = plan.price - (plan.price * (validPromo.value / 100));
                            originalPrice = plan.price;
                        } else if (validPromo.type === 'fixed') {
                            displayPrice = Math.max(0, plan.price - validPromo.value);
                            originalPrice = plan.price;
                        }
                    }

                    return {
                        id: plan.code,
                        name: plan.name,
                        price: displayPrice.toLocaleString('es-AR'), 
                        originalPrice: originalPrice ? originalPrice.toLocaleString('es-AR') : null,
                        rawPrice: displayPrice,
                        ...uiConfig
                    };
                });

                setPricingPlans(formattedPlans);
            } catch (error) {
                console.error('Error cargando planes:', error);
            } finally {
                setLoadingPlans(false);
            }
        }

        fetchPlans();
    }, []);

    // Variantes de animación
    const fadeInUp: Variants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
    };
    
    const fadeIn: Variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 1 } }
    };

    const staggerContainer: Variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
    };

    // ============================================================================
    // RENDER 
    // ============================================================================
    return (
        <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-brand-500/30 selection:text-brand-200 overflow-x-hidden relative pt-20 md:pt-0">

            {/* --- BANNER DE CAMPAÑA PÚBLICA --- */}
            <AnimatePresence>
                {publicPromo && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="fixed top-0 left-0 w-full z-[60] bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white shadow-[0_4px_20px_rgba(79,70,229,0.3)]"
                    >
                        <div className="max-w-7xl mx-auto px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center text-xs sm:text-sm font-bold">
                            <span className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full uppercase tracking-widest text-[10px] sm:text-xs shadow-inner shrink-0">
                                <Tag className="w-3 h-3 md:w-4 md:h-4 text-brand-200" /> Oferta Especial
                            </span>
                            <span>{publicPromo.description || `¡Aprovechá la campaña activa con beneficios exclusivos!`}</span>
                            
                            {publicPromo.max_uses && (
                                <span className="flex items-center gap-1 text-amber-200 font-black shrink-0">
                                    <Clock className="w-4 h-4" /> ¡Quedan solo {publicPromo.max_uses - (publicPromo.current_uses || 0)} cupos!
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- FONDO ANIMADO --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[100vw] h-[100vw] md:w-[70vw] md:h-[70vw] bg-brand-600/10 rounded-full blur-[100px] md:blur-[150px] animate-pulse duration-[8s]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[100vw] h-[100vw] md:w-[60vw] md:h-[60vw] bg-indigo-600/10 rounded-full blur-[100px] md:blur-[150px] animate-pulse duration-[12s]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
            </div>

            {/* --- NAVBAR --- */}
            <nav className={`fixed w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl transition-all duration-300 ${publicPromo ? 'top-auto md:top-[44px]' : 'top-0'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3 z-50">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
                            <div className="relative bg-black p-2 rounded-xl border border-white/10">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">SpeedDigital</span>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#how-it-works" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Soluciones</a>
                        <a href="#pricing" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Precios</a>
                        <div className="h-6 w-px bg-white/10"></div>
                        <Link to="/login" className="text-sm font-bold text-white hover:text-brand-300 transition-colors">Iniciar Sesión</Link>
                        <Link to={`/login${publicPromo ? `?promo=${publicPromo.code}` : ''}`} className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-slate-200 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]">
                            Crear Cuenta
                        </Link>
                    </div>

                    {/* Mobile Toggle */}
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-slate-300 z-50 focus:outline-none">
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>

                {/* Mobile Menu Dropdown */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "100vh", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="absolute top-0 left-0 w-full bg-[#050505]/95 backdrop-blur-2xl border-b border-white/10 md:hidden pt-24 px-6 flex flex-col"
                        >
                            <div className="flex flex-col gap-6 text-center">
                                <a href="#how-it-works" onClick={() => setIsMenuOpen(false)} className="text-xl font-medium text-slate-300 hover:text-white py-2 transition-colors">Soluciones</a>
                                <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-xl font-medium text-slate-300 hover:text-white py-2 transition-colors">Precios</a>
                                <div className="h-px w-full bg-white/10 my-2"></div>
                                <Link to="/login" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold text-white py-2 hover:text-brand-400 transition-colors">Iniciar Sesión</Link>
                                <Link to={`/login${publicPromo ? `?promo=${publicPromo.code}` : ''}`} onClick={() => setIsMenuOpen(false)} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg mt-4 shadow-lg shadow-brand-500/20 active:scale-95 transition-all">
                                    Comenzar Ahora
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* --- HERO SECTION --- */}
            <section className="relative z-10 pt-32 pb-10 md:pt-48 md:pb-20 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-6 md:space-y-8">
                        
                        <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm shadow-lg mx-auto">
                            <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-brand-400" />
                            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-brand-100">El software que se adapta a vos</span>
                        </motion.div>

                        <motion.h1 variants={fadeInUp} className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tight leading-[1.1] md:leading-[1.1]">
                            El sistema para tu <br className="md:hidden" />
                            
                            {/* CONTENEDOR FIXEADO PARA EVITAR SALTO DE LÍNEA */}
                            <div className="h-[1.2em] overflow-hidden relative inline-flex w-full md:w-[350px] lg:w-[450px] justify-center md:justify-start md:ml-4 align-top">
                                <AnimatePresence mode="popLayout">
                                    <motion.span
                                        key={currentVertical}
                                        initial={{ y: "100%", opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: "-100%", opacity: 0 }}
                                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                        className={`absolute inset-0 flex items-center justify-center md:justify-start gap-2 md:gap-3 ${VERTICALS[currentVertical].color}`}
                                    >
                                        {VERTICALS[currentVertical].label}
                                        {VERTICALS[currentVertical].icon}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                            <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 block mt-2 md:mt-0">
                                en un solo lugar.
                            </span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed px-4 font-medium">
                            SpeedDigital adapta su interfaz, base de datos y terminología según tu industria. Tenemos herramientas exactas para tu negocio, ni una más, ni una menos. Olvidate del papel, los Excel interminables y los turnos perdidos.
                        </motion.p>

                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 px-4 w-full max-w-md mx-auto sm:max-w-none">
                            <Link to={`/login${publicPromo ? `?promo=${publicPromo.code}` : ''}`} className="w-full sm:w-auto group relative px-8 py-4 bg-brand-600 text-white rounded-full font-bold text-base md:text-lg overflow-hidden shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.7)] transition-all active:scale-95">
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                                <span className="relative flex items-center justify-center gap-2">
                                    Empezar mi prueba gratis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* --- APP MOCKUP --- */}
            <motion.section 
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}
                className="relative z-10 px-4 sm:px-6 max-w-6xl mx-auto -mt-4 md:mt-0 pb-20"
            >
                <div className="relative rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl overflow-hidden aspect-video md:aspect-[21/9]">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10"></div>
                    <img 
                        src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" 
                        alt="SpeedDigital Dashboard" 
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                        <div className="bg-black/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center max-w-sm mx-4">
                            <BarChart3 className="w-12 h-12 text-brand-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Panel de Control en vivo</h3>
                            <p className="text-slate-300 text-sm font-medium">Monitoreá tus ingresos, la caja y la actividad de tu local desde cualquier dispositivo.</p>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* --- DEEP DIVE: SOLUCIONES POR RUBRO --- */}
            <section id="how-it-works" className="py-24 px-4 sm:px-6 relative z-10 bg-black/40 border-y border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Hecho a medida de tu industria.</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">No te cobramos por módulos que no usás. El sistema adapta su interfaz y funciones según el rubro de tu negocio.</p>
                    </div>

                    {/* Tabs de Selección */}
                    <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-12">
                        <button onClick={() => setActiveFeatureTab('services')} className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${activeFeatureTab === 'services' ? 'bg-blue-500 text-white shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                            <Briefcase className="w-5 h-5" /> Negocios de Servicios
                        </button>
                        <button onClick={() => setActiveFeatureTab('gym')} className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${activeFeatureTab === 'gym' ? 'bg-emerald-500 text-white shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                            <Dumbbell className="w-5 h-5" /> Gimnasios y Clubes
                        </button>
                        <button onClick={() => setActiveFeatureTab('gastro')} className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${activeFeatureTab === 'gastro' ? 'bg-orange-500 text-white shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)]' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                            <Coffee className="w-5 h-5" /> Gastronomía
                        </button>
                    </div>

                    {/* Contenido Dinámico de las Tabs */}
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] p-6 md:p-12 overflow-hidden relative min-h-[500px]">
                        <AnimatePresence mode="wait">
                            {activeFeatureTab === 'services' && (
                                <motion.div key="services" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid md:grid-cols-2 gap-12 items-center h-full">
                                    <div className="space-y-6">
                                        <div className="inline-block p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20"><CalendarDays className="w-8 h-8" /></div>
                                        <h3 className="text-3xl font-black text-white">Vendé tu tiempo, sin perder el tuyo.</h3>
                                        <p className="text-slate-400 text-lg leading-relaxed font-medium">Peluquerías, Consultorios Clínicos, Talleres Mecánicos, Estudios de Abogados o Clínicas Veterinarias. <b>Cualquier negocio que funcione con turnos</b> puede usar SpeedDigital.</p>
                                        <ul className="space-y-4 pt-4">
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0" /> <span><b>Agenda inteligente:</b> El sistema sabe cuánto dura cada servicio y evita superposiciones automáticamente.</span></li>
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0" /> <span><b>Gestión de Profesionales:</b> Asigná servicios a empleados específicos y manejá sus horarios individuales.</span></li>
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0" /> <span><b>Portal Público:</b> Tus clientes entran a un link web y reservan solos viendo tu disponibilidad real 24/7.</span></li>
                                        </ul>
                                    </div>
                                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl h-full min-h-[300px]">
                                        <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1974&auto=format&fit=crop" alt="Agenda" className="w-full h-full object-cover opacity-70" />
                                    </div>
                                </motion.div>
                            )}

                            {activeFeatureTab === 'gym' && (
                                <motion.div key="gym" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid md:grid-cols-2 gap-12 items-center h-full">
                                    <div className="space-y-6">
                                        <div className="inline-block p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20"><ShieldCheck className="w-8 h-8" /></div>
                                        <h3 className="text-3xl font-black text-white">Control total de accesos y cuotas.</h3>
                                        <p className="text-slate-400 text-lg leading-relaxed font-medium">Diseñado para <b>Gimnasios, Academias de Danza, Crossfits y Clubes Deportivos</b>. Sabé exactamente quién entra y quién debe.</p>
                                        <ul className="space-y-4 pt-4">
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /> <span><b>Control de Asistencia:</b> Pantalla de recepción para que el alumno ponga su DNI y el sistema verifique si puede pasar.</span></li>
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /> <span><b>Planes Complejos:</b> Cobrá mensualidad libre, o vendé "Paquetes de clases" que se descuentan solos al asistir.</span></li>
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /> <span><b>Alertas de Deuda:</b> Avisos visuales rojos si el alumno tiene la cuota vencida al querer ingresar al local.</span></li>
                                        </ul>
                                    </div>
                                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl h-full min-h-[300px]">
                                        <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop" alt="Gym" className="w-full h-full object-cover opacity-70" />
                                    </div>
                                </motion.div>
                            )}

                            {activeFeatureTab === 'gastro' && (
                                <motion.div key="gastro" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid md:grid-cols-2 gap-12 items-center h-full">
                                    <div className="space-y-6">
                                        <div className="inline-block p-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20"><Receipt className="w-8 h-8" /></div>
                                        <h3 className="text-3xl font-black text-white">Del salón a la cocina en un clic.</h3>
                                        <p className="text-slate-400 text-lg leading-relaxed font-medium">La solución moderna para <b>Restaurantes, Bares, Cervecerías y Cafeterías</b>. Acelerá tu despacho y evitá errores en las comandas.</p>
                                        <ul className="space-y-4 pt-4">
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-orange-400 shrink-0" /> <span><b>Mapa de Mesas:</b> Visualizá en verde las mesas libres y en rojo las ocupadas con el total de su cuenta en tiempo real.</span></li>
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-orange-400 shrink-0" /> <span><b>KDS (Pantalla de Cocina):</b> Reemplazá las comandas de papel. La cocina recibe los pedidos en una tablet y los marca como listos.</span></li>
                                            <li className="flex items-start gap-3 text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-orange-400 shrink-0" /> <span><b>Menú Digital QR:</b> Generamos tu carta online automáticamente con fotos y precios actualizados al instante.</span></li>
                                        </ul>
                                    </div>
                                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl h-full min-h-[300px]">
                                        <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1974&auto=format&fit=crop" alt="Restaurante" className="w-full h-full object-cover opacity-70" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </section>

            {/* --- CARACTERÍSTICAS GLOBALES --- */}
            <section className="py-20 px-4 sm:px-6 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <motion.div whileHover={{ y: -5 }} className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 flex flex-col justify-center group hover:border-white/20 transition-colors shadow-lg">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 border border-emerald-500/20">
                                <Smartphone className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Portal de Clientes</h3>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">Tus clientes tienen su propio acceso para ver sus deudas, historial y agendar turnos desde el celular.</p>
                        </motion.div>

                        <motion.div whileHover={{ y: -5 }} className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 flex flex-col justify-center group hover:border-white/20 transition-colors shadow-lg">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 border border-purple-500/20">
                                <BarChart3 className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Caja y Finanzas</h3>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">Apertura y cierre de turnos, registro de gastos (proveedores, sueldos) e historial contable 100% auditable.</p>
                        </motion.div>

                        <motion.div whileHover={{ y: -5 }} className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 flex flex-col justify-center group hover:border-white/20 transition-colors shadow-lg">
                            <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center mb-6 border border-sky-500/20">
                                <Globe className="w-6 h-6 text-sky-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">100% en la Nube</h3>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">No tenés que instalar nada. Entrá desde la compu de la caja, desde tu notebook en casa, o desde tu celular de viaje.</p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* --- PRICING SECTION --- */}
            <section id="pricing" className="py-24 px-4 sm:px-6 relative z-10 bg-black/50 border-y border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Precios claros. Sin comisiones ocultas.</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto text-lg font-medium">Elegí la forma en que querés llevar tu negocio. Podés empezar gratis y escalar cuando estés listo.</p>
                    </div>

                    {loadingPlans ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto relative">
                            {/* Confetti / Resplandor si hay promo */}
                            {publicPromo && (
                                <div className="absolute inset-0 bg-brand-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
                            )}

                            {pricingPlans.map((plan) => (
                                <div 
                                    key={plan.id} 
                                    className={`relative flex flex-col p-8 md:p-10 rounded-[2.5rem] bg-[#0A0A0A] border transition-all duration-300 ${
                                        plan.isPopular 
                                        ? 'border-brand-500 shadow-2xl shadow-brand-500/20 md:-translate-y-4 bg-gradient-to-b from-brand-900/40 to-[#0A0A0A]' 
                                        : 'border-white/10'
                                    }`}
                                >
                                    {plan.isPopular && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-2 bg-brand-500 text-white text-[11px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg shadow-brand-500/30">
                                            <Star className="w-3.5 h-3.5 fill-current" /> El más elegido
                                        </div>
                                    )}
                                    
                                    <div className="mb-8 border-b border-white/10 pb-8">
                                        <h3 className="text-2xl font-black text-white mb-3">{plan.name}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed font-medium">{plan.description}</p>
                                    </div>
                                    
                                    <div className="mb-10 relative">
                                        {/* PRECIO VIEJO TACHADO */}
                                        {plan.originalPrice && plan.rawPrice > 0 && (
                                            <div className="absolute -top-6 left-0 flex items-center gap-2">
                                                <span className="text-lg font-black text-slate-600 line-through decoration-red-500/50 decoration-2">${plan.originalPrice}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/30">Descuento Activado</span>
                                            </div>
                                        )}

                                        {/* MESES GRATIS BADGE */}
                                        {publicPromo?.type === 'free_months' && plan.rawPrice > 0 && (
                                            <div className="absolute -top-8 left-0 animate-bounce">
                                                <span className="text-[11px] font-black uppercase tracking-widest bg-emerald-500 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-emerald-500/30 border border-emerald-400">
                                                    🎉 ¡Incluye {publicPromo.value} {publicPromo.value === 1 ? 'Mes Gratis' : 'Meses Gratis'}!
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-end gap-1.5">
                                            <span className={`font-bold pb-1 text-2xl ${plan.originalPrice ? 'text-brand-400' : 'text-slate-400'}`}>$</span>
                                            <span className={`text-5xl md:text-6xl font-black tracking-tight ${plan.originalPrice ? 'text-brand-400' : 'text-white'}`}>{plan.price}</span>
                                        </div>
                                        <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-wider">ARS / mes (Precio Final)</p>
                                    </div>
                                    
                                    <ul className="space-y-4 mb-10 flex-1">
                                        {plan.features.map((feature: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                                                <CheckCircle2 className={`w-5 h-5 shrink-0 ${plan.isPopular ? 'text-brand-400' : 'text-slate-500'}`} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Link 
                                        to={`/login${publicPromo ? `?promo=${publicPromo.code}` : ''}`} 
                                        className={`w-full py-4 md:py-5 rounded-2xl font-black text-lg text-center transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                            plan.isPopular 
                                            ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-xl shadow-brand-600/30' 
                                            : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                                        }`}
                                    >
                                        {plan.buttonText} <ChevronRight className="w-5 h-5" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* --- CTA SECTION --- */}
            <section className="py-24 md:py-32 px-4 sm:px-6 relative z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-brand-900/10 to-transparent pointer-events-none"></div>

                <div className="max-w-4xl mx-auto text-center relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-brand-600/20 rounded-full blur-[100px] md:blur-[120px] -z-10"></div>

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 md:mb-8 leading-tight">
                        Dejá de usar Excel. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-indigo-300">Empezá a usar SpeedDigital.</span>
                    </h2>

                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 md:gap-6 w-full max-w-sm sm:max-w-none mx-auto">
                        <Link to={`/login${publicPromo ? `?promo=${publicPromo.code}` : ''}`} className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-white text-black rounded-full font-bold text-lg hover:bg-slate-200 transition-all active:scale-95 shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)] hover:shadow-[0_0_50px_-5px_rgba(255,255,255,0.6)]">
                            Crear Cuenta Gratis
                        </Link>
                        <p className="text-slate-400 text-sm flex items-center justify-center gap-2 mt-2 sm:mt-0 font-medium">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" /> Cancelás cuando quieras
                        </p>
                    </div>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="border-t border-white/10 bg-black py-12 px-6 text-center text-slate-500 text-sm relative z-10">
                <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                    <Zap className="w-5 h-5" />
                    <span className="font-bold text-white text-lg">SpeedDigital</span>
                </div>
                <p className="font-medium">&copy; {new Date().getFullYear()} SpeedDigital SaaS. Hecho con pasión en Formosa, Argentina.</p>
            </footer>

        </div>
    );
}