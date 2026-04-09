import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Loader2, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData) return;
        setIsLoggingIn(true);

        try {
            // Reconstruimos las credenciales fantasma del POS
            const cleanUsername = username.replace(/\s+/g, '').toLowerCase().trim();
            const dummyEmail = `${cleanUsername}@${orgData.slug}.pos`;
            const securePassword = `${pin}-pos`;

            const { data, error } = await supabase.auth.signInWithPassword({
                email: dummyEmail,
                password: securePassword,
            });

            if (error) throw new Error('Usuario o PIN incorrecto');

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

            toast.success(`Acceso autorizado`);
            await initializeAuth();
            
            if (orgData.industry === 'gastronomy') {
                if (membership.role === 'staff') {
                    navigate('/admin/salon'); 
                } else {
                    navigate('/admin/dashboard'); 
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

    if (loadingOrg) {
        return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /></div>;
    }

    if (orgError) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 text-center">
                <ShieldCheck className="w-16 h-16 text-slate-600 mb-4" />
                <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Acceso Denegado</h1>
                <p className="text-slate-400 max-w-md font-medium">No pudimos encontrar este negocio. Verifica que el enlace (URL) sea el correcto e intenta nuevamente.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-brand-500/30">
            
            <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md bg-[#0A0A0A] rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden relative z-10 backdrop-blur-xl">
                
                <div className="p-8 text-center relative overflow-hidden border-b border-white/5">
                    <div className="relative z-10">
                        {orgData.logo_url ? (
                            <img src={orgData.logo_url} alt={orgData.name} className="w-24 h-24 rounded-3xl mx-auto mb-5 object-cover border-2 border-white/10 shadow-xl" />
                        ) : (
                            <div className="w-24 h-24 rounded-3xl mx-auto mb-5 bg-white/5 border-2 border-white/10 flex items-center justify-center text-3xl font-black text-white shadow-xl">
                                {orgData.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <h1 className="text-2xl font-black tracking-tight text-white mb-1">{orgData.name}</h1>
                        <p className="text-brand-400 text-xs font-bold uppercase tracking-widest">Portal de Personal</p>
                    </div>
                </div>

                <div className="p-8 md:p-10">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tu Usuario</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><User className="w-5 h-5" /></span>
                                <input 
                                    type="text" 
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white/10 transition-all font-bold text-white lowercase"
                                    placeholder="ej: marcos"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">PIN de Acceso</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Lock className="w-5 h-5" /></span>
                                <input 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={6}
                                    required
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white/10 transition-all font-black tracking-widest text-white text-xl"
                                    placeholder="••••"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoggingIn}
                            className="w-full py-4 mt-4 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-black flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] active:scale-95 text-lg"
                        >
                            {isLoggingIn ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                <>Ingresar al sistema <ArrowRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}