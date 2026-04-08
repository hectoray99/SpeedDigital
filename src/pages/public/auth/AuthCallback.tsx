import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';

export default function AuthCallback() {
    const navigate = useNavigate();
    const { initializeAuth } = useAuthStore(); 

    useEffect(() => {
        let isMounted = true;

        const processAuth = async () => {
            try {
                // 1. CHEQUEO ACTIVO: Verificamos si la sesión ya se armó en la URL
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) throw error;

                if (session) {
                    await initializeAuth();
                    if (isMounted) navigate('/admin/dashboard', { replace: true });
                }
            } catch (error) {
                console.error("Error en AuthCallback:", error);
                if (isMounted) navigate('/login', { replace: true });
            }
        };

        // Ejecutamos el chequeo activo apenas carga
        processAuth();

        // 2. LISTENER PASIVO: Por si el chequeo activo fue muy rápido y la red está lenta
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                try {
                    await initializeAuth();
                    if (isMounted) navigate('/admin/dashboard', { replace: true });
                } catch (error) {
                    console.error("Error cargando perfil post-Google:", error);
                    if (isMounted) navigate('/login', { replace: true });
                }
            } else if (event === 'SIGNED_OUT') {
                if (isMounted) navigate('/login', { replace: true });
            }
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, [navigate, initializeAuth]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
            <p className="text-slate-400 font-medium animate-pulse">Sincronizando de forma segura...</p>
        </div>
    );
}