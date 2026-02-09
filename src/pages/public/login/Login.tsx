import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Zap, Loader2, ArrowLeft, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Estados para Email/Password
    const [isSignUp, setIsSignUp] = useState(false); // false = Login, true = Registro
    const [formData, setFormData] = useState({ email: '', password: '' });

    // Verificar Sesión al entrar
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                navigate('/admin/dashboard', { replace: true });
            }
        };
        checkSession();
    }, [navigate]);

    // 1. MANEJO DE AUTH CON EMAIL
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isSignUp) {
                // --- REGISTRO ---
                const { error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                });
                if (error) throw error;
                toast.success('Cuenta creada. ¡Revisá tu email para confirmar!');
            } else {
                // --- LOGIN ---
                const { error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });
                if (error) throw error;
                // Si sale bien, el useEffect de arriba o el AuthGuard nos lleva al dashboard
                navigate('/admin/dashboard');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error de autenticación');
        } finally {
            setLoading(false);
        }
    };

    // 2. MANEJO DE AUTH CON GOOGLE
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
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">

            <div className="absolute top-8 left-8">
                <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-brand-600 transition-colors font-medium">
                    <ArrowLeft className="w-4 h-4" /> Volver al inicio
                </Link>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="inline-block bg-brand-600 p-3 rounded-2xl shadow-lg shadow-brand-500/30 mb-6">
                    <Zap className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900">
                    {isSignUp ? 'Creá tu cuenta gratis' : 'Ingresá a tu cuenta'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    {isSignUp ? 'Empezá a gestionar tu academia hoy.' : 'Gestioná tu academia de forma inteligente.'}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">

                    {/* FORMULARIO DE EMAIL */}
                    <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Email</label>
                            <div className="mt-1 relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    placeholder="hola@tuacademia.com"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                            <div className="mt-1 relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-black focus:outline-none transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? 'Registrarme' : 'Ingresar')}
                        </button>
                    </form>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-slate-500">O continuá con</span>
                        </div>
                    </div>

                    {/* BOTÓN GOOGLE */}
                    <div>
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-slate-300 rounded-xl shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google
                        </button>
                    </div>

                    {/* TOGGLE LOGIN / SIGNUP */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm font-medium text-brand-600 hover:text-brand-500 transition-colors"
                        >
                            {isSignUp ? '¿Ya tenés cuenta? Ingresá' : '¿No tenés cuenta? Registrate gratis'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}