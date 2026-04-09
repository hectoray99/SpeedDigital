import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Zap, Loader2, ArrowLeft, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                navigate('/admin/dashboard', { replace: true });
            }
        };
        checkSession();
    }, [navigate]);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                });
                if (error) throw error;
                toast.success('Cuenta creada. ¡Revisá tu email para confirmar!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });
                if (error) throw error;
                navigate('/admin/dashboard');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error de autenticación');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            toast.error('Error al conectar con Google');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-brand-500/30 selection:text-white text-slate-200">
            
            {/* FONDO ANIMADO Y TEXTURA */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[100vw] h-[100vw] md:w-[70vw] md:h-[70vw] bg-indigo-600/10 rounded-full blur-[100px] md:blur-[150px] animate-pulse duration-[8s]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[100vw] h-[100vw] md:w-[60vw] md:h-[60vw] bg-brand-600/10 rounded-full blur-[100px] md:blur-[150px] animate-pulse duration-[12s]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
            </div>

            <div className="absolute top-8 left-4 md:left-8 z-20">
                <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
                    <ArrowLeft className="w-4 h-4" /> Volver al inicio
                </Link>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 mt-8 md:mt-0">
                <div className="inline-flex bg-gradient-to-tr from-brand-600 to-indigo-600 p-4 rounded-3xl shadow-xl shadow-brand-500/30 mb-8 border border-white/10">
                    <Zap className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
                    {isSignUp ? 'Creá tu cuenta gratis' : 'Ingresá a tu cuenta'}
                </h2>
                <p className="text-base text-slate-400">
                    {isSignUp ? 'Empezá a gestionar tu negocio hoy mismo.' : 'Gestioná tu negocio de forma inteligente.'}
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-[#0A0A0A] py-10 px-6 sm:px-10 shadow-2xl rounded-[2.5rem] border border-white/10 backdrop-blur-xl">

                    <form onSubmit={handleEmailAuth} className="space-y-5 mb-8">
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    placeholder="hola@tunegocio.com"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-brand-500 focus:bg-white/10 focus:ring-2 focus:ring-brand-500/20 outline-none text-white font-medium transition-all"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-brand-500 focus:bg-white/10 focus:ring-2 focus:ring-brand-500/20 outline-none text-white font-medium transition-all"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-500/20 text-base font-bold text-white bg-brand-600 hover:bg-brand-500 transition-all disabled:opacity-50 active:scale-95 mt-2"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? 'Registrarme' : 'Ingresar')}
                        </button>
                    </form>

                    <div className="relative mb-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-[#0A0A0A] text-slate-500 font-medium">O continuá con</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex justify-center items-center gap-3 py-4 px-4 border border-white/10 rounded-xl shadow-sm bg-white/5 text-base font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50 active:scale-95"
                    >
                        <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google
                    </button>

                    <div className="mt-8 text-center">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors"
                        >
                            {isSignUp ? '¿Ya tenés cuenta? Ingresá' : '¿No tenés cuenta? Registrate gratis'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}