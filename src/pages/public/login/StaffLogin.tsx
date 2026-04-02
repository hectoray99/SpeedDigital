import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Loader2, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function StaffLogin() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { initializeAuth } = useAuthStore();
    
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [orgData, setOrgData] = useState<any>(null);
    const [orgError, setOrgError] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // 1. Buscamos si existe el local (el slug) en la base de datos
    useEffect(() => {
        async function fetchOrg() {
            if (!slug) return;
            try {
                const { data, error } = await supabase
                    .from('organizations')
                    .select('id, name, industry, logo_url')
                    .eq('slug', slug)
                    .single();

                if (error || !data) throw new Error('Local no encontrado');
                setOrgData(data);
            } catch (error) {
                setOrgError(true);
            } finally {
                setLoadingOrg(false);
            }
        }
        fetchOrg();
    }, [slug]);

    // 2. Procesamos el Login
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData) return;
        setIsLoggingIn(true);

        try {
            // Logueamos en Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Verificamos de forma extra que este usuario REALMENTE pertenezca a este local
            const { data: membership, error: memError } = await supabase
                .from('organization_members')
                .select('role')
                .eq('profile_id', data.user.id)
                .eq('organization_id', orgData.id)
                .single();

            if (memError || !membership) {
                await supabase.auth.signOut();
                throw new Error('No tienes acceso a este negocio.');
            }

            // Si todo está ok, recargamos el estado global y lo mandamos adentro
            toast.success(`Bienvenido al sistema`);
            await initializeAuth();
            
            // Redirigimos inteligentemente según su rol
            if (orgData.industry === 'gastronomy') {
                if (membership.role === 'staff') {
                    navigate('/admin/salon'); // El mozo va directo al salón
                } else {
                    navigate('/admin/dashboard'); // El admin va al panel
                }
            } else {
                navigate('/admin/students'); // Otros rubros van a su pantalla principal
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Credenciales incorrectas');
        } finally {
            setIsLoggingIn(false);
        }
    };

    if (loadingOrg) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    }

    if (orgError) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <ShieldCheck className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-2xl font-black text-slate-800 mb-2">Acceso Denegado</h1>
                <p className="text-slate-500 max-w-md">No pudimos encontrar este negocio. Verifica que el enlace (URL) sea el correcto e intenta nuevamente.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                
                {/* Cabecera del Local */}
                <div className="bg-slate-900 text-white p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-brand-500/10 blur-2xl"></div>
                    <div className="relative z-10">
                        {orgData.logo_url ? (
                            <img src={orgData.logo_url} alt={orgData.name} className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover border-4 border-slate-800" />
                        ) : (
                            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 bg-slate-800 border-4 border-slate-700 flex items-center justify-center text-2xl font-black text-brand-400">
                                {orgData.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <h1 className="text-2xl font-black tracking-tight">{orgData.name}</h1>
                        <p className="text-slate-400 text-sm mt-1">Portal de Personal</p>
                    </div>
                </div>

                {/* Formulario de Login */}
                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Tu Usuario / Correo</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Mail className="w-5 h-5" /></span>
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                                    placeholder="ejemplo@negocio.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Contraseña</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock className="w-5 h-5" /></span>
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoggingIn}
                            className="w-full py-4 mt-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-brand-500/20"
                        >
                            {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>Ingresar a mi turno <ArrowRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </form>
                </div>
                
                {/* Footer Institucional de tu SaaS */}
                <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Desarrollado por <span className="text-slate-600 font-bold">SpeedDigital</span></p>
                </div>
            </div>
        </div>
    );
}