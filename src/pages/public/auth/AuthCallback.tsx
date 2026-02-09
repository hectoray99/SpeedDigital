import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleAuthCallback = async () => {
            // Supabase detecta el código en la URL automáticamente y crea la sesión
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Error en AuthCallback:', error);
                navigate('/login'); // Si falla, volver al login
                return;
            }

            if (session) {
                // ¡Éxito! Redirigir al Dashboard
                // Usamos 'replace: true' para que no puedan volver atrás a esta pantalla de carga
                navigate('/admin/dashboard', { replace: true });
            }
        };

        handleAuthCallback();
    }, [navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
            <p className="text-lg font-medium animate-pulse">Finalizando acceso seguro...</p>
        </div>
    );
}