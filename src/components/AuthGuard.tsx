import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
    children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            // 1. Preguntamos a Supabase si hay alguien logueado
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // 2. Si no hay nadie, patada al Login
                navigate('/', { replace: true });
            } else {
                // 3. Si hay sesión, dejamos pasar
                setLoading(false);
            }
        };

        checkAuth();

        // Listener: Si la sesión se corta (ej: logout en otra pestaña), lo sacamos
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                navigate('/', { replace: true });
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
        );
    }

    return <>{children}</>;
}