import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Loader2, Building, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        id: '',
        name: '',
        industry: 'generic',
        slug: ''
    });

    useEffect(() => {
        fetchOrg();
    }, []);

    async function fetchOrg() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (profile) {
                const { data: org } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', profile.organization_id)
                    .single();

                if (org) {
                    setFormData({
                        id: org.id,
                        name: org.name,
                        industry: org.industry,
                        slug: org.slug || ''
                    });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    name: formData.name,
                    industry: formData.industry,
                    // slug: formData.slug // Lo dejamos comentado por seguridad por ahora
                })
                .eq('id', formData.id);

            if (error) throw error;

            toast.success('Configuración guardada. Recargando...');

            // Recargamos para que el Menú Lateral actualice sus iconos/textos
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error: any) {
            toast.error('Error: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400">Cargando configuración...</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Configuración</h1>
                <p className="text-slate-500">Personaliza la identidad de tu negocio.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <Building className="w-5 h-5 text-slate-500" />
                    <h3 className="font-semibold text-slate-700">Datos de la Organización</h3>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">

                    {/* Nombre */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Negocio</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    {/* Industria / Rubro */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rubro / Industria</label>
                        <div className="relative">
                            <LayoutTemplate className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <select
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all appearance-none bg-white"
                                value={formData.industry}
                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                            >
                                <option value="generic">Genérico (Servicios/Ventas)</option>
                                <option value="gym">Gimnasio / Fitness</option>
                                <option value="gastronomy">Gastronomía / Restaurante</option>
                                <option value="accounting">Estudio Contable / Legal</option>
                                <option value="retail">Comercio Minorista (Retail)</option>
                                <option value="automotive">Taller Mecánico / Automotor</option>
                                <option value="beauty">Estética / Barbería</option>
                                <option value="education">Educación / Academia</option>
                            </select>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Esto adaptará el menú y la terminología del sistema automáticamente.
                        </p>
                    </div>

                    {/* ID (Solo lectura) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ID de Organización</label>
                        <code className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm">
                            {formData.id}
                        </code>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-slate-900/10"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}