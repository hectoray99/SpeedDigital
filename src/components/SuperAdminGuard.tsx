import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminGuard() {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        checkGodMode();
    }, []);

    async function checkGodMode() {
        try {
            // 1. Verificamos si existe una sesión activa en el navegador
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setIsAuthorized(false);
                return;
            }

            // 2. Le preguntamos a la base de datos si el ID de este usuario tiene la bandera 'is_superadmin' en true
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('is_superadmin')
                .eq('id', session.user.id)
                .single();

            if (error || !profile) throw new Error('Perfil no encontrado');

            if (profile.is_superadmin) {
                setIsAuthorized(true);
            } else {
                toast.error('Acceso denegado: Área restringida');
                setIsAuthorized(false);
            }
        } catch (error) {
            console.error('Error verificando permisos SuperAdmin:', error);
            setIsAuthorized(false);
        } finally {
            // Bajamos la bandera de carga una vez que tenemos un veredicto (Sea true o false)
            setIsChecking(false);
        }
    }

    // Mientras averigua, mostramos una pantalla de carga sutil (Fondo oscuro porque es SuperAdmin)
    if (isChecking) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 animate-in fade-in duration-500">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                <p className="text-slate-400 font-bold tracking-widest text-sm uppercase animate-pulse flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Verificando Credenciales
                </p>
            </div>
        );
    }
    
    // Si tiene permiso, renderiza las pantallas hijas (El Layout del SuperAdmin). 
    // Si no, lo patea a la Home de la Landing Page.
    return isAuthorized ? <Outlet /> : <Navigate to="/" replace />;
}