import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Send, Trash2, Loader2, Info, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminAnnouncements() {
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Estado del Modal de Eliminación
    const [deleteModal, setDeleteModal] = useState<string | null>(null); // Guarda el ID a borrar

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('info');

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    async function fetchAnnouncements() {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
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
            const { error } = await supabase.from('announcements').insert([{ title: title.trim(), content: content.trim(), type }]);
            if (error) throw error;

            toast.success('¡Anuncio publicado globalmente!');
            setTitle(''); 
            setContent(''); 
            setType('info');
            fetchAnnouncements();
        } catch (error) {
            toast.error('Error al publicar el anuncio');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase.from('announcements').update({ is_active: !currentStatus }).eq('id', id);
            if (error) throw error;
            toast.success(currentStatus ? 'Anuncio ocultado' : 'Anuncio visible');
            setAnnouncements(announcements.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
        } catch (error) {
            toast.error('Error al cambiar el estado');
        }
    };

    const executeDelete = async () => {
        if (!deleteModal) return;
        try {
            const { error } = await supabase.from('announcements').delete().eq('id', deleteModal);
            if (error) throw error;
            toast.success('Anuncio eliminado permanentemente');
            setAnnouncements(announcements.filter(a => a.id !== deleteModal));
            setDeleteModal(null);
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const TypeIcon = ({ type, className = "w-5 h-5" }: { type: string, className?: string }) => {
        if (type === 'warning') return <AlertTriangle className={`${className} text-amber-500`} />;
        if (type === 'success') return <CheckCircle2 className={`${className} text-emerald-500`} />;
        return <Info className={`${className} text-blue-500`} />;
    };

    if (loading) return <div className="flex justify-center items-center h-[60vh] animate-in fade-in"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>;

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            
            {/* CABECERA */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Megaphone className="w-7 h-7 md:w-8 md:h-8 text-purple-500" /> 
                    Comunicaciones
                </h1>
                <p className="text-slate-400 mt-2 text-sm md:text-base">Publicá mensajes que todos tus clientes verán en sus paneles (mantenimiento, promos).</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                
                {/* --- FORMULARIO NUEVO ANUNCIO --- */}
                <div className="lg:col-span-1">
                    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl sticky top-24 shadow-xl">
                        <h2 className="text-xl font-bold text-white mb-6">Nuevo Mensaje</h2>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Título del Aviso</label>
                                <input 
                                    type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                                    placeholder="Ej: Mantenimiento este Sábado"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white font-medium focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Color / Nivel</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button type="button" onClick={() => setType('info')} className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${type === 'info' ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-sm shadow-blue-500/10 scale-105' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                        <Info className="w-5 h-5" /> <span className="text-[10px] font-bold uppercase tracking-wider">Info</span>
                                    </button>
                                    <button type="button" onClick={() => setType('warning')} className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${type === 'warning' ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm shadow-amber-500/10 scale-105' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                        <AlertTriangle className="w-5 h-5" /> <span className="text-[10px] font-bold uppercase tracking-wider">Alerta</span>
                                    </button>
                                    <button type="button" onClick={() => setType('success')} className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${type === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-500/10 scale-105' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                        <CheckCircle2 className="w-5 h-5" /> <span className="text-[10px] font-bold uppercase tracking-wider">Éxito</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Contenido</label>
                                <textarea 
                                    value={content} onChange={(e) => setContent(e.target.value)} required
                                    placeholder="Escribí el detalle acá. Se verá en el panel principal..." rows={4}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-300 font-medium focus:ring-2 focus:ring-purple-500/50 outline-none resize-none transition-all"
                                />
                            </div>

                            <div className="pt-2">
                                <button type="submit" disabled={submitting} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50">
                                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    Publicar Anuncio
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* --- HISTORIAL DE ANUNCIOS --- */}
                <div className="lg:col-span-2 space-y-4">
                    {announcements.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 text-center flex flex-col items-center animate-in zoom-in-95">
                            <Megaphone className="w-16 h-16 text-slate-800 mb-4" />
                            <h3 className="text-xl font-bold text-white">Tablero Limpio</h3>
                            <p className="text-slate-500 mt-2 text-sm max-w-sm">Tus usuarios no tienen mensajes activos. Usá el panel de la izquierda para crear tu primera comunicación.</p>
                        </div>
                    ) : (
                        announcements.map((a) => (
                            <div key={a.id} className={`bg-slate-900 border rounded-3xl p-5 md:p-6 transition-all animate-in slide-in-from-bottom-4 ${a.is_active ? 'border-slate-700 shadow-lg' : 'border-slate-800/50 opacity-60'}`}>
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3.5 rounded-2xl mt-1 shrink-0 ${
                                            a.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' : a.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-blue-500/10 border border-blue-500/20'
                                        }`}>
                                            <TypeIcon type={a.type} className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg md:text-xl font-bold text-white tracking-tight leading-tight">{a.title}</h3>
                                            <p className="text-slate-400 mt-2 text-sm leading-relaxed">{a.content}</p>
                                            <p className="text-[10px] text-slate-500 mt-4 font-black uppercase tracking-widest bg-slate-950 inline-block px-3 py-1.5 rounded-md border border-slate-800 shadow-inner">
                                                Publicado el {new Date(a.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0 shrink-0">
                                        <button 
                                            onClick={() => toggleStatus(a.id, a.is_active)}
                                            className="flex-1 sm:flex-none p-3 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors flex items-center justify-center active:scale-95"
                                            title={a.is_active ? "Ocultar Anuncio" : "Mostrar Anuncio"}
                                        >
                                            {a.is_active ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                        <button 
                                            onClick={() => setDeleteModal(a.id)}
                                            className="flex-1 sm:flex-none p-3 bg-slate-950 border border-slate-800 text-red-500/70 hover:text-red-500 hover:border-red-500/50 hover:bg-red-500/10 rounded-xl transition-colors flex items-center justify-center active:scale-95"
                                            title="Borrar Anuncio"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* =========================================================
                MODAL DE ELIMINACIÓN DE ANUNCIO
            ========================================================= */}
            <Transition appear show={!!deleteModal} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setDeleteModal(null)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[2rem] bg-slate-900 border border-slate-800 p-6 md:p-8 text-left align-middle shadow-2xl transition-all animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-6 mx-auto shadow-inner">
                                    <Trash2 className="w-8 h-8" />
                                </div>
                                <Dialog.Title as="h3" className="text-2xl font-black text-white text-center mb-2 tracking-tight">
                                    Borrar Mensaje
                                </Dialog.Title>
                                <p className="text-sm text-slate-400 text-center mb-8 font-medium">
                                    ¿Estás seguro de que querés borrar este anuncio definitivamente? Desaparecerá del panel de todos los clientes.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button onClick={() => setDeleteModal(null)} className="w-full py-4 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                                        Conservar
                                    </button>
                                    <button onClick={executeDelete} className="w-full py-4 rounded-xl font-black text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                                        Borrar Ahora
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}