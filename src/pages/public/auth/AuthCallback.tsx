import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AuthCallback() {
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                window.close(); // Se cierra sola la ventana
            }
        });
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
            <p>Autenticando...</p>
        </div>
    );
}