import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface AuthGuardProps {
    children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const navigate = useNavigate();
    const location = useLocation(); // Necesitamos saber en qué pantalla está
    
    // Nos traemos orgData para saber si ya creó su negocio
    const { user, orgData, isLoading, initializeAuth } = useAuthStore();

    useEffect(() => {
        // Arrancamos la verificación global
        initializeAuth();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        // Si sigue cargando, no tomamos ninguna decisión todavía
        if (isLoading) return;

        // REGLA 1: Si no hay usuario, patada al login
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }

        // REGLA 2: LA MAGIA. Tiene cuenta, pero NO tiene negocio -> Al onboarding
        if (!orgData && location.pathname !== '/onboarding') {
            navigate('/onboarding', { replace: true });
            return;
        }

        // REGLA 3: Ya tiene negocio, pero intentó entrar al onboarding de chusma -> Al dashboard
        if (orgData && location.pathname === '/onboarding') {
            navigate('/admin/dashboard', { replace: true });
            return;
        }

    }, [user, orgData, isLoading, navigate, location.pathname]);

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    <p className="text-sm font-medium animate-pulse text-slate-400">Verificando seguridad...</p>
                </div>
            </div>
        );
    }

    // Si hay usuario y pasó todas las reglas de arriba, lo dejamos ver la pantalla
    return user ? <>{children}</> : null;
}