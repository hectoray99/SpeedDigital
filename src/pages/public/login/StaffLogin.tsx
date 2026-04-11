import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Loader2, Lock, User, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function StaffLogin() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { initializeAuth } = useAuthStore();
    
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [orgData, setOrgData] = useState<any>(null);
    const [orgError, setOrgError] = useState(false);

    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // =========================================================================
    // INICIALIZACIÓN (Buscar Organización por Slug)
    // =========================================================================
    useEffect(() => {
        async function fetchOrg() {
            if (!slug) return;
            try {
                const { data, error } = await supabase
                    .from('organizations')
                    .select('id, name, industry, logo_url, slug')
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

    // =========================================================================
    // LÓGICA DE INGRESO (Reconstruir Credenciales de Supabase)
    // =========================================================================
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData) return;
        setIsLoggingIn(true);

        try {
            // Reconstruimos las credenciales fantasma del POS (Ej: juan -> juan@bacanal.pos)
            const cleanUsername = username.replace(/\s+/g, '').toLowerCase().trim();
            const dummyEmail = `${cleanUsername}@${orgData.slug}.pos`;
            
            // Reconstruimos la contraseña segura
            const securePassword = `${pin}-pos-Secure!`; 
            // Fallback (Por si el empleado se creó con la lógica vieja)
            const oldSecurePassword = `${pin}-pos`;

            let authError;
            
            // Intentamos loguear con la password nueva (segura) sin extraer 'data' (Fix del Linter)
            const { error } = await supabase.auth.signInWithPassword({
                email: dummyEmail,
                password: securePassword,
            });
            authError = error;

            // Si falla, intentamos con la password vieja (legacy) sin extraer 'oldData'
            if (authError) {
                const { error: oldError } = await supabase.auth.signInWithPassword({
                    email: dummyEmail,
                    password: oldSecurePassword,
                });
                if (!oldError) {
                    authError = null;
                }
            }

            if (authError) throw new Error('Usuario o PIN incorrecto');

            // Validar que el empleado pertenezca específicamente a este local
            const { data: membership, error: memError } = await supabase
                .from('organization_members')
                .select('role')
                .eq('profile_id', (await supabase.auth.getUser()).data.user?.id)
                .eq('organization_id', orgData.id)
                .single();

            if (memError || !membership) {
                await supabase.auth.signOut();
                throw new Error('No tienes acceso a este negocio.');
            }

            toast.success(`Acceso autorizado`);
            await initializeAuth();
            
            // Enrutamiento Inteligente según el rol y la industria
            if (orgData.industry === 'gastronomy') {
                if (membership.role === 'staff') {
                    navigate('/admin/salon'); // Mozos van directo al salón
                } else {
                    navigate('/admin/dashboard'); // Admins al panel general
                }
            } else {
                navigate('/admin/dashboard'); 
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Credenciales incorrectas');
        } finally {
            setIsLoggingIn(false);
        }
    };

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    if (loadingOrg) {
        return <div className="min-h-[100dvh] bg-[#050505] flex items-center justify-center animate-in fade-in duration-500"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    }

    if (orgError) {
        return (
            <div className="min-h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-4 text-center animate-in zoom-in-95 duration-500">
                <ShieldAlert className="w-20 h-20 text-red-500/50 mb-6" />
                <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Acceso Denegado</h1>
                <p className="text-slate-400 max-w-md font-medium text-lg leading-relaxed">No pudimos encontrar este negocio. Verificá que el enlace en la URL sea el correcto y volvé a intentarlo.</p>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-brand-500/30 text-slate-200">
            
            {/* FONDO ANIMADO Y TEXTURA */}
            <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[15s]"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

            {/* CAJA PRINCIPAL */}
            <div className="w-full max-w-md bg-[#0A0A0A]/90 rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden relative z-10 backdrop-blur-xl animate-in slide-in-from-bottom-8 duration-500">
                
                <div className="p-8 text-center relative overflow-hidden border-b border-white/5">
                    <div className="relative z-10">
                        {orgData.logo_url ? (
                            <img src={orgData.logo_url} alt={orgData.name} className="w-24 h-24 rounded-3xl mx-auto mb-5 object-cover border-2 border-white/10 shadow-xl" />
                        ) : (
                            <div className="w-24 h-24 rounded-3xl mx-auto mb-5 bg-white/5 border-2 border-white/10 flex items-center justify-center text-4xl font-black text-white shadow-xl">
                                {orgData.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2">{orgData.name}</h1>
                        <p className="text-brand-400 text-[10px] font-black uppercase tracking-widest bg-brand-500/10 py-1.5 px-3 rounded-full w-fit mx-auto border border-brand-500/20">
                            Portal de Personal
                        </p>
                    </div>
                </div>

                <div className="p-8 md:p-10">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Tu Usuario</label>
                            <div className="relative shadow-sm rounded-2xl">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><User className="w-5 h-5" /></span>
                                <input 
                                    type="text" 
                                    autoFocus
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-brand-500 focus:bg-white/10 focus:ring-2 focus:ring-brand-500/30 transition-all font-bold text-white lowercase text-lg"
                                    placeholder="ej: marcos"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">PIN de Acceso</label>
                            <div className="relative shadow-sm rounded-2xl">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Lock className="w-5 h-5" /></span>
                                <input 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={6}
                                    required
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-brand-500 focus:bg-white/10 focus:ring-2 focus:ring-brand-500/30 transition-all font-black tracking-widest text-white text-2xl placeholder:text-2xl placeholder:tracking-widest"
                                    placeholder="••••"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoggingIn}
                            className="w-full py-4.5 mt-6 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-black flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-[0_0_30px_-5px_rgba(79,70,229,0.5)] hover:shadow-[0_0_40px_-5px_rgba(79,70,229,0.6)] active:scale-95 text-lg border-b-4 border-brand-800"
                        >
                            {isLoggingIn ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                <>Ingresar al sistema <ArrowRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </form>
                </div>
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs font-medium z-10">
                <ShieldCheck className="w-4 h-4" /> Sesión encriptada
            </div>
        </div>
    );
}