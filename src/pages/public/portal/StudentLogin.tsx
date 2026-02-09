import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { User, Lock, Loader2, ArrowLeft, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function StudentLogin() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim() || !password.trim()) {
            toast.error('Ingresá usuario y contraseña');
            return;
        }

        setLoading(true);
        try {
            // Buscamos en crm_people
            const { data, error } = await supabase
                .from('crm_people')
                .select('id, full_name, organization_id, organizations(name, industry)')
                .eq('identifier', identifier.trim())
                .eq('portal_password', password.trim())
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                toast.error('Credenciales incorrectas o usuario inactivo');
            } else {
                // CORRECCIÓN TS: Manejo seguro de la relación 'organizations'
                // Forzamos el tipo a 'any' para evitar errores si TS cree que es un array
                const rawOrg = data.organizations as any;
                const orgData = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;

                localStorage.setItem('portal_token', JSON.stringify({
                    id: data.id,
                    name: data.full_name,
                    org_name: orgData?.name || 'Academia',
                    industry: orgData?.industry || 'generic'
                }));

                toast.success(`¡Hola ${data.full_name}!`);
                navigate('/portal/dashboard');
            }

        } catch (error: any) {
            console.error(error);
            toast.error('Error de conexión: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">

            <motion.div
                initial={{ opacity: 0, y: -100 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute top-0 left-0 w-full h-64 bg-gradient-to-br from-brand-600 to-indigo-700 rounded-b-[3rem] shadow-2xl z-0"
            />

            <div className="absolute top-8 left-8 z-10">
                <Link to="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors font-medium backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-indigo-900/10 overflow-hidden relative z-10"
            >
                <div className="p-8 text-center pt-12">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 3 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
                        className="mx-auto bg-brand-50 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-brand-100"
                    >
                        <LayoutTemplate className="w-10 h-10 text-brand-600" />
                    </motion.div>
                    <h2 className="text-3xl font-bold text-slate-900">Portal de Clientes</h2>
                    <p className="text-slate-500 mt-2">Accedé a tus comprobantes y estado de cuenta.</p>
                </div>

                <div className="p-8 pt-0">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Usuario / DNI</label>
                            <div className="relative transition-all group-focus-within:scale-[1.02]">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Ingresá tu identificación"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Contraseña</label>
                            <div className="relative transition-all group-focus-within:scale-[1.02]">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-3 text-center">
                                ¿Primera vez? Tu contraseña es tu DNI.
                            </p>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 disabled:opacity-70 mt-4"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Ingresar al Portal'}
                        </motion.button>
                    </form>
                </div>
            </motion.div>

            <p className="mt-8 text-slate-400 text-sm font-medium">© SpeedDigital 2026</p>
        </div>
    );
}