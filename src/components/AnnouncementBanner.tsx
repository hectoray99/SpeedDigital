import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Megaphone, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export default function AnnouncementBanner() {
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [dismissed, setDismissed] = useState<string[]>([]); // Para que el cliente pueda "cerrar" el aviso

    useEffect(() => {
        fetchActiveAnnouncements();
    }, []);

    async function fetchActiveAnnouncements() {
        // Buscamos solo los anuncios que el SuperAdmin dejó como activos
        const { data } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (data) setAnnouncements(data);
    }

    // Filtramos los que el usuario ya cerró haciendo clic en la X
    const visibleAnnouncements = announcements.filter(a => !dismissed.includes(a.id));

    if (visibleAnnouncements.length === 0) return null;

    return (
        <div className="space-y-3 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {visibleAnnouncements.map(a => (
                <div key={a.id} className={`p-4 md:p-5 rounded-2xl border flex items-start gap-4 relative shadow-sm ${
                    a.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                    a.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                    'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                    {/* Icono según el tipo */}
                    {a.type === 'warning' ? <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5 text-amber-600" /> :
                     a.type === 'success' ? <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5 text-emerald-600" /> :
                     <Megaphone className="w-6 h-6 shrink-0 mt-0.5 text-blue-600" />}

                    <div className="pr-8">
                        <h4 className="font-bold text-base">{a.title}</h4>
                        <p className="text-sm opacity-90 mt-1 leading-relaxed">{a.content}</p>
                    </div>

                    {/* Botón para cerrar el aviso */}
                    <button
                        onClick={() => setDismissed([...dismissed, a.id])}
                        className="absolute top-4 right-4 p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                        title="Ocultar aviso"
                    >
                        <X className="w-5 h-5 opacity-50 hover:opacity-100" />
                    </button>
                </div>
            ))}
        </div>
    );
}