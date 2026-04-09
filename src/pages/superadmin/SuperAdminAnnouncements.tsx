import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Send, Trash2, Loader2, Info, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminAnnouncements() {
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Estado del formulario
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('info');

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    async function fetchAnnouncements() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAnnouncements(data || []);
        } catch (error) {
            toast.error('Error al cargar los anuncios');
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        try {
            setSubmitting(true);
            const { error } = await supabase
                .from('announcements')
                .insert([{ title, content, type }]);

            if (error) throw error;

            toast.success('¡Anuncio publicado globalmente!');
            setTitle('');
            setContent('');
            setType('info');
            fetchAnnouncements(); // Recargamos la lista

        } catch (error) {
            toast.error('Error al publicar el anuncio');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('announcements')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            toast.success(currentStatus ? 'Anuncio ocultado' : 'Anuncio visible');
            setAnnouncements(announcements.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
        } catch (error) {
            toast.error('Error al cambiar el estado');
        }
    };

    const deleteAnnouncement = async (id: string) => {
        if (!window.confirm('¿Borrar este anuncio definitivamente?')) return;
        try {
            const { error } = await supabase.from('announcements').delete().eq('id', id);
            if (error) throw error;
            toast.success('Anuncio eliminado');
            setAnnouncements(announcements.filter(a => a.id !== id));
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const TypeIcon = ({ type, className = "w-5 h-5" }: { type: string, className?: string }) => {
        if (type === 'warning') return <AlertTriangle className={`${className} text-amber-500`} />;
        if (type === 'success') return <CheckCircle2 className={`${className} text-emerald-500`} />;
        return <Info className={`${className} text-blue-500`} />;
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Megaphone className="w-8 h-8 text-purple-500" /> 
                    Comunicaciones Globales
                </h1>
                <p className="text-slate-400 mt-1">Publicá mensajes que todos tus clientes verán al entrar a sus paneles.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FORMULARIO DE REDACCIÓN */}
                <div className="lg:col-span-1">
                    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl sticky top-6">
                        <h2 className="text-xl font-bold text-white mb-6">Nuevo Mensaje</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Título</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Mantenimiento programado"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tipo de Aviso</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button type="button" onClick={() => setType('info')} className={`p-3 rounded-xl border flex justify-center transition-all ${type === 'info' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                                        <Info className="w-5 h-5" />
                                    </button>
                                    <button type="button" onClick={() => setType('warning')} className={`p-3 rounded-xl border flex justify-center transition-all ${type === 'warning' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                                        <AlertTriangle className="w-5 h-5" />
                                    </button>
                                    <button type="button" onClick={() => setType('success')} className={`p-3 rounded-xl border flex justify-center transition-all ${type === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                                        <CheckCircle2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Mensaje</label>
                                <textarea 
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Escribí el detalle acá..."
                                    rows={4}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none resize-none"
                                    required
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                Publicar Anuncio
                            </button>
                        </div>
                    </form>
                </div>

                {/* HISTORIAL DE ANUNCIOS */}
                <div className="lg:col-span-2 space-y-4">
                    {announcements.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center">
                            <Megaphone className="w-16 h-16 text-slate-700 mb-4" />
                            <h3 className="text-xl font-bold text-white">No hay anuncios</h3>
                            <p className="text-slate-500 mt-2">Usá el formulario para crear tu primera comunicación global.</p>
                        </div>
                    ) : (
                        announcements.map((announcement) => (
                            <div key={announcement.id} className={`bg-slate-900 border rounded-2xl p-6 transition-all ${announcement.is_active ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}>
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl mt-1 ${
                                            announcement.type === 'warning' ? 'bg-amber-500/10' : 
                                            announcement.type === 'success' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
                                        }`}>
                                            <TypeIcon type={announcement.type} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{announcement.title}</h3>
                                            <p className="text-slate-400 mt-2 text-sm leading-relaxed">{announcement.content}</p>
                                            <p className="text-xs text-slate-500 mt-4 font-medium uppercase tracking-wider">
                                                Publicado el {new Date(announcement.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => toggleStatus(announcement.id, announcement.is_active)}
                                            title={announcement.is_active ? "Ocultar anuncio" : "Mostrar anuncio"}
                                            className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                                        >
                                            {announcement.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button 
                                            onClick={() => deleteAnnouncement(announcement.id)}
                                            title="Eliminar"
                                            className="p-2 bg-slate-950 border border-slate-800 text-red-500/70 hover:text-red-500 hover:border-red-500/50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}