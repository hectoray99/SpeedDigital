import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminGuard() {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        checkGodMode();
    }, []);

    async function checkGodMode() {
        try {
            // 1. Verificamos quién está logueado
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión');

            // 2. Le preguntamos a la base de datos si es SuperAdmin
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_superadmin')
                .eq('id', session.user.id)
                .single();

            if (profile?.is_superadmin) {
                setIsAuthorized(true);
            } else {
                toast.error('Acceso denegado: Área restringida');
            }
        } catch (error) {
            setIsAuthorized(false);
        } finally {
            setIsChecking(false);
        }
    }

    if (isChecking) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">Verificando Credenciales</p>
            </div>
        );
    }
    
    // Si tiene permiso, renderiza las pantallas hijas (Outlet). Si no, lo manda a la Home.
    return isAuthorized ? <Outlet /> : <Navigate to="/" replace />;
}