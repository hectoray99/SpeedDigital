import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';

export default function AuthCallback() {
    const navigate = useNavigate();
    const { initializeAuth } = useAuthStore(); // Traemos nuestro cerebro central

    useEffect(() => {
        // Esta es la forma oficial y segura de escuchar a Google OAuth
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                try {
                    // Forzamos al cerebro a cargar los datos (con los reintentos que le programamos)
                    await initializeAuth();
                    // Una vez cargado, lo mandamos al Dashboard
                    navigate('/admin/dashboard', { replace: true });
                } catch (error) {
                    console.error("Error cargando perfil post-Google:", error);
                    navigate('/login', { replace: true });
                }
            } else if (event === 'SIGNED_OUT') {
                navigate('/login', { replace: true });
            }
        });

        // Limpieza del listener cuando el componente muere
        return () => {
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