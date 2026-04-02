import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';


interface AuthGuardProps {
    children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const navigate = useNavigate();
    const { user, isLoading, initializeAuth } = useAuthStore();

    useEffect(() => {
        // Arrancamos la verificación global
        initializeAuth();
    }, []);

    useEffect(() => {
        // Si ya terminó de cargar y no hay usuario, patada al login
        if (!isLoading && !user) {
            navigate('/login', { replace: true });
        }
    }, [user, isLoading, navigate]);

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

    return user ? <>{children}</> : null;
}