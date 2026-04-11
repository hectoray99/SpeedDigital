import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Save, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: Props) {
    const [loading, setLoading] = useState(false);
    const [newPassword, setNewPassword] = useState('');

    // Si el modal está cerrado, no renderizamos nada
    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validación de longitud mínima
        if (newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        setLoading(true);

        try {
            // Actualizamos la contraseña del usuario AUTENTICADO en la sesión actual
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            toast.success('¡Contraseña actualizada con éxito!');
            setNewPassword('');
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200">
            <div className="bg-white text-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">

                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-brand-600" />
                        Cambiar Contraseña
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nueva Contraseña</label>
                        <div className="relative shadow-sm rounded-xl">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                required
                                autoFocus
                                type="password"
                                placeholder="Mínimo 6 caracteres..."
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white font-bold outline-none transition-all text-slate-800"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading} 
                        className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-slate-900/20 text-lg"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Guardar Nueva Clave
                    </button>
                </form>
            </div>
        </div>
    );
}