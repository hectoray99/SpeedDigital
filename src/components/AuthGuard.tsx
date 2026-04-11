import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, orgData, isLoading } = useAuthStore();
    const location = useLocation();
    
    // Estado para saber si el usuario logueado es el SuperAdmin (dueño de la plataforma)
    const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
    
    // Fallback de seguridad: Evita que la pantalla de carga se cuelgue eternamente
    const [forceUnlock, setForceUnlock] = useState(false);

    useEffect(() => {
        // Reducido a 2.5s para mejorar la percepción de velocidad (UX)
        const timer = setTimeout(() => setForceUnlock(true), 2500);
        return () => clearTimeout(timer);
    }, []);

    // Verificación asíncrona de permisos a nivel base de datos
    useEffect(() => {
        let mounted = true;
        async function checkAccess() {
            if (!user) {
                if (mounted) setIsSuperAdmin(false);
                return;
            }
            try {
                const { data } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).maybeSingle();
                if (mounted) setIsSuperAdmin(!!data?.is_superadmin);
            } catch (err) {
                if (mounted) setIsSuperAdmin(false);
            }
        }
        checkAccess();
        return () => { mounted = false; };
    }, [user]);

    // =========================================================================
    // FASE 1: PANTALLAS DE CARGA Y REDIRECCIÓN DE INVITADOS
    // =========================================================================
    if (isLoading && !forceUnlock) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] animate-in fade-in duration-500">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Iniciando Sistema...</p>
            </div>
        );
    }

    if (!user) {
        // Si no está logueado, lo mandamos al login recordando de qué URL venía
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (isSuperAdmin === null) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505]">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Verificando Permisos...</p>
            </div>
        );
    }

    // Variables auxiliares para lectura de código más limpia
    const isGoingToSuperAdmin = location.pathname.startsWith('/superadmin');
    const isGoingToOnboarding = location.pathname === '/onboarding';

    // =========================================================================
    // FASE 2: ENRUTAMIENTO ESTRICTO PARA SUPERADMIN (Dueño de Plataforma)
    // =========================================================================
    if (isSuperAdmin) {
        // El SuperAdmin tiene su propio ecosistema, no debe ver paneles de inquilinos
        if (location.pathname === '/admin/dashboard' || location.pathname === '/' || location.pathname === '/login') {
            return <Navigate to="/superadmin/dashboard" replace />;
        }
        return <>{children}</>;
    }

    // =========================================================================
    // FASE 3: ENRUTAMIENTO ESTRICTO PARA INQUILINOS (Dueños de Locales/Staff)
    // =========================================================================
    if (!isSuperAdmin) {
        // 1. Un inquilino jamás puede pisar el panel de SuperAdmin
        if (isGoingToSuperAdmin) {
            return <Navigate to="/admin/dashboard" replace />;
        }
        
        // 2. Si intenta ir a Login pero ya está logueado, lo mandamos a su destino correcto
        if (location.pathname === '/login') {
            if (orgData) return <Navigate to="/admin/dashboard" replace />;
            return <Navigate to="/onboarding" replace />;
        }

        // 3. Flujo obligatorio de Onboarding (Si no tiene un local configurado)
        if (!orgData && !isGoingToOnboarding) {
            return <Navigate to="/onboarding" replace />;
        }

        // 4. Anti-Loop: Si ya tiene local, no tiene sentido que vaya al Onboarding
        if (orgData && isGoingToOnboarding) {
            return <Navigate to="/admin/dashboard" replace />;
        }
    }

    // Si sobrevivió a todos los guardias de seguridad, renderizamos la página hija
    return <>{children}</>;
}