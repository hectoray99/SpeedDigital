import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';
// Aquí importaremos las pantallas específicas por rubro a medida que las creemos
import GymAttendancePublic from './GymAttendancePublic'; 

export default function PublicRouter() {
    const { slug } = useParams();
    const [loading, setLoading] = useState(true);
    const [orgData, setOrgData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (slug) {
            fetchOrganization(slug);
        }
    }, [slug]);

    async function fetchOrganization(orgSlug: string) {
        try {
            setLoading(true);
            setError(null);

            // Buscamos la organización por su slug exacto
            const { data, error: sbError } = await supabase
                .from('organizations')
                .select('id, name, industry, logo_url, brand_colors')
                .eq('slug', orgSlug)
                .single();

            if (sbError) throw sbError;
            if (!data) throw new Error('Organización no encontrada');

            setOrgData(data);
        } catch (err: any) {
            console.error('Error fetching org by slug:', err);
            setError('No pudimos encontrar esta página.');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                <p className="animate-pulse font-medium">Cargando portal...</p>
            </div>
        );
    }

    if (error || !orgData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white px-4 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Página no encontrada</h1>
                <p className="text-slate-400 mb-6">{error || 'El enlace puede estar roto o la página ya no existe.'}</p>
                <button 
                    onClick={() => window.location.href = '/'}
                    className="bg-brand-600 hover:bg-brand-700 px-6 py-2 rounded-lg font-bold transition-colors"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    // --- EL SWITCH MÁGICO MULTI-TENANT ---
    switch (orgData.industry) {
        case 'gym':
            return <GymAttendancePublic orgData={orgData} />;
            
        case 'gastronomy':
            return <div className="p-10 text-center">Menú digital en construcción para {orgData.name}</div>;
            
        default:
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4 text-center">
                    <h1 className="text-2xl font-bold mb-2">{orgData.name}</h1>
                    <p className="text-slate-400">Esta área no tiene un portal público configurado todavía.</p>
                </div>
            );
    }
}