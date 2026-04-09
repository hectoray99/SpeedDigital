import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, orgData, isLoading } = useAuthStore();
    const location = useLocation();
    
    const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
    const [forceUnlock, setForceUnlock] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setForceUnlock(true), 3000);
        return () => clearTimeout(timer);
    }, []);

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

    if (isLoading && !forceUnlock) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Iniciando Sistema...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (isSuperAdmin === null) return null;

    const isGoingToSuperAdmin = location.pathname.startsWith('/superadmin');
    const isGoingToOnboarding = location.pathname === '/onboarding';

    // =========================================================================
    // CASO 1: ES SUPERADMIN (Vos)
    // =========================================================================
    if (isSuperAdmin) {
        // EL DESVÍO: Si el login intenta mandarte al panel normal, te secuestramos y te mandamos al Olimpo.
        if (location.pathname === '/admin/dashboard' || location.pathname === '/') {
            return <Navigate to="/superadmin/dashboard" replace />;
        }
        return <>{children}</>;
    }

    // =========================================================================
    // CASO 2: ES USUARIO NORMAL (Clientes o Empleados)
    // =========================================================================
    if (!isSuperAdmin) {
        if (isGoingToSuperAdmin) {
            return <Navigate to="/admin/dashboard" replace />;
        }
        if (!orgData && !isGoingToOnboarding) {
            return <Navigate to="/onboarding" replace />;
        }
    }

    return <>{children}</>;
}