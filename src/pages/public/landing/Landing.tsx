import { Link } from 'react-router-dom';
import {
    Zap, Users, BarChart3, ArrowRight, Menu, X,
    ShieldCheck, Globe, Smartphone, Coffee, Dumbbell,
    Briefcase, Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

export default function Landing() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentVertical, setCurrentVertical] = useState(0);

    const verticals = [
        { label: "Gimnasio", icon: <Dumbbell className="w-6 h-6 text-emerald-400" />, color: "text-emerald-400" },
        { label: "Restaurante", icon: <Coffee className="w-6 h-6 text-orange-400" />, color: "text-orange-400" },
        { label: "Consultora", icon: <Briefcase className="w-6 h-6 text-blue-400" />, color: "text-blue-400" },
        { label: "Negocio", icon: <Zap className="w-6 h-6 text-yellow-400" />, color: "text-yellow-400" },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentVertical((prev) => (prev + 1) % verticals.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const fadeInUp: Variants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
    };

    const staggerContainer: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-brand-500/30 selection:text-brand-200 overflow-x-hidden">

            {/* --- FONDO ANIMADO CORREGIDO --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Orbes de luz con más blur para evitar bordes duros */}
                <div className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse duration-[8s]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-brand-600/10 rounded-full blur-[150px] animate-pulse duration-[12s]" />

                {/* CORRECCIÓN: La textura de ruido ahora cubre toda la pantalla (inset-0) */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
            </div>

            {/* --- NAVBAR --- */}
            <nav className="fixed w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative bg-black p-2 rounded-xl border border-white/10">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">SpeedDigital</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium hover:text-white transition-colors">Características</a>
                        <a href="#testimonials" className="text-sm font-medium hover:text-white transition-colors">Clientes</a>
                        <div className="h-6 w-px bg-white/10"></div>
                        <Link to="/login" className="text-sm font-bold text-white hover:text-brand-300 transition-colors">Login</Link>
                        <Link to="/login" className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-200 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]">
                            Prueba Gratis
                        </Link>
                    </div>

                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-slate-300">
                        {isMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="md:hidden bg-black border-b border-white/10 overflow-hidden"
                        >
                            <div className="p-6 space-y-4">
                                <a href="#features" className="block text-lg font-medium text-slate-300">Características</a>
                                <Link to="/login" className="block text-center w-full bg-brand-600 text-white py-4 rounded-xl font-bold">Comenzar Ahora</Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* --- HERO SECTION --- */}
            <section className="relative z-10 pt-44 pb-32 px-6">
                <div className="max-w-7xl mx-auto text-center">

                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={staggerContainer}
                        className="space-y-8"
                    >
                        <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-pointer border-t-white/20 shadow-lg">
                            <Sparkles className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold uppercase tracking-widest text-brand-100">La evolución del SaaS</span>
                        </motion.div>

                        <motion.h1 variants={fadeInUp} className="text-5xl md:text-8xl font-black text-white tracking-tight leading-[1.1]">
                            Gestiona tu
                            <div className="h-[1.1em] overflow-hidden relative inline-flex ml-4 align-top">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={currentVertical}
                                        initial={{ y: 50, opacity: 0, filter: "blur(10px)" }}
                                        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                                        exit={{ y: -50, opacity: 0, filter: "blur(10px)" }}
                                        transition={{ duration: 0.5, ease: "backOut" }}
                                        className={`inline-flex items-center gap-3 ${verticals[currentVertical].color}`}
                                    >
                                        {verticals[currentVertical].label}
                                        {verticals[currentVertical].icon}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                                sin complicaciones.
                            </span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            SpeedDigital no es una plantilla genérica. Es un sistema <b>inteligente</b> que adapta su interfaz, base de datos y terminología según tu industria.
                        </motion.p>

                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <Link to="/login" className="group relative px-8 py-4 bg-brand-600 text-white rounded-full font-bold text-lg overflow-hidden shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.7)] transition-shadow">
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                                <span className="relative flex items-center gap-2">
                                    Empezar Ahora <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                            <button className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-bold text-lg backdrop-blur-sm transition-all flex items-center gap-2 group">
                                Ver Demo en vivo <Globe className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                            </button>
                        </motion.div>
                    </motion.div>

                </div>
            </section>

            {/* --- BENTO GRID FEATURES --- */}
            <section id="features" className="py-20 px-6 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16">
                        <h2 className="text-3xl font-bold text-white mb-4">Todo lo que necesitas. <span className="text-slate-500">Nada que no.</span></h2>
                        <p className="text-slate-400 max-w-xl">Hemos eliminado el desorden. SpeedDigital te da las herramientas exactas para tu negocio, ni una más, ni una menos.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="md:col-span-2 bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 flex flex-col justify-between overflow-hidden relative group hover:border-white/20 transition-colors"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                                <Users className="w-40 h-40" />
                            </div>
                            <div>
                                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 border border-blue-500/20">
                                    <Users className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">CRM Adaptativo</h3>
                                <p className="text-slate-400 max-w-sm">Si eres un gym, gestiona "Alumnos". Si eres consultor, gestiona "Clientes". El sistema aprende y cambia los campos por ti.</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5 mt-6 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-500"></div>
                                    <div className="h-2 w-24 bg-white/20 rounded-full"></div>
                                </div>
                                <div className="h-2 w-full bg-white/10 rounded-full mb-2"></div>
                                <div className="h-2 w-2/3 bg-white/10 rounded-full"></div>
                            </div>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="md:row-span-2 bg-gradient-to-b from-[#0F0F0F] to-black border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden hover:border-white/20 transition-colors"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/20 via-transparent to-transparent opacity-50"></div>
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 border border-emerald-500/20 z-10">
                                <Smartphone className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2 z-10">Portal Autogestión</h3>
                            <p className="text-slate-400 text-sm mb-8 z-10">Tus clientes escanean un QR y ven su deuda en segundos.</p>

                            <div className="w-48 bg-slate-900 border-[6px] border-slate-800 rounded-[2rem] h-full relative shadow-2xl translate-y-4">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-800 rounded-b-xl"></div>
                                <div className="p-4 pt-8 space-y-3">
                                    <div className="h-20 bg-emerald-500/20 rounded-xl border border-emerald-500/30 flex items-center justify-center">
                                        <span className="text-emerald-400 font-bold text-xl">$0</span>
                                    </div>
                                    <div className="h-8 bg-white/5 rounded-lg w-full"></div>
                                    <div className="h-8 bg-white/5 rounded-lg w-full"></div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 flex flex-col justify-between group hover:border-white/20 transition-colors"
                        >
                            <div>
                                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 border border-purple-500/20">
                                    <BarChart3 className="w-6 h-6 text-purple-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Finanzas Claras</h3>
                            </div>
                            <p className="text-slate-400 text-sm mt-2">Control de caja diario y reporte de deudores automático.</p>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 flex flex-col justify-between group hover:border-white/20 transition-colors"
                        >
                            <div>
                                <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center mb-4 border border-sky-500/20">
                                    <Globe className="w-6 h-6 text-sky-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white">100% Cloud</h3>
                            </div>
                            <p className="text-slate-400 text-sm mt-2">Accede desde tu casa, el local o de viaje. Tus datos siempre seguros.</p>
                        </motion.div>

                    </div>
                </div>
            </section>

            {/* --- CTA SECTION CORREGIDA --- */}
            <section className="py-32 px-6 relative z-10 overflow-hidden">
                {/* CORRECCIÓN: Gradiente suave en lugar de bloque sólido */}
                <div className="absolute inset-0 bg-gradient-to-b from-brand-900/10 to-transparent pointer-events-none"></div>

                <div className="max-w-4xl mx-auto text-center relative">
                    {/* Blob de fondo centrado y suave */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-[120px] -z-10"></div>

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight">
                        Deja de usar Excel. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-indigo-300">Empieza a usar SpeedDigital.</span>
                    </h2>

                    <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
                        <Link to="/login" className="px-10 py-5 bg-white text-black rounded-full font-bold text-xl hover:bg-slate-200 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)]">
                            Crear Cuenta Gratis
                        </Link>
                        <p className="text-slate-400 text-sm flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Cancelas cuando quieras
                        </p>
                    </div>
                </div>
            </section>

            {/* --- FOOTER SIMPLE --- */}
            <footer className="border-t border-white/10 bg-black py-12 text-center text-slate-500 text-sm relative z-10">
                <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                    <Zap className="w-5 h-5" />
                    <span className="font-bold text-white">SpeedDigital</span>
                </div>
                <p>&copy; 2026 SpeedDigital. Hecho con pasión en Formosa, Argentina.</p>
            </footer>

        </div>
    );
}