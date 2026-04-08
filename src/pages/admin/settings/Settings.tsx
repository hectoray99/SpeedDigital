import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Building, Image as ImageIcon, Lock, AlertCircle, Link as LinkIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { useAuthStore } from '../../../store/authStore';

export default function Settings() {
    // 1. Traemos los datos directamente de nuestra memoria global
    const { orgData, initializeAuth } = useAuthStore(); 
    const [saving, setSaving] = useState(false);

    // 2. Estados locales para el formulario
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [industry, setIndustry] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    const [newLogo, setNewLogo] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // 3. Apenas carga el componente, llenamos los inputs con lo que ya sabe el cerebro
    useEffect(() => {
        if (orgData) {
            setName(orgData.name || '');
            setSlug(orgData.slug || '');
            setIndustry(orgData.industry || 'generic');
            setLogoUrl(orgData.logo_url || null);
        }
    }, [orgData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setNewLogo(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formattedSlug = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-');
        setSlug(formattedSlug);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        
        setSaving(true);
        try {
            let finalLogoUrl = logoUrl;

            if (newLogo) {
                finalLogoUrl = await uploadToCloudinary(newLogo);
            }

            const { error } = await supabase
                .from('organizations')
                .update({
                    name: name.trim(),
                    slug: slug.trim() || null,
                    logo_url: finalLogoUrl
                })
                .eq('id', orgData.id);

            if (error) {
                if (error.code === '23505') throw new Error('Este enlace público ya está en uso por otra cuenta. Elegí otro.');
                throw error;
            }

            toast.success('Configuración guardada');
            setNewLogo(null);

            // En vez de recargar la página bruscamente, forzamos al cerebro a actualizarse
            await initializeAuth();

        } catch (error: any) {
            toast.error('Error: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const industryLabels: Record<string, string> = {
        gym: 'Gimnasio / Club Deportivo',
        gastronomy: 'Gastronomía / Restaurante',
        services: 'Servicios / Barberías y Consultorios',
        academy: 'Academia / Cursos',
        generic: 'Servicios / Negocio General'
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Configuración de la Organización</h1>

            <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <Building className="w-5 h-5 text-brand-600" />
                    <h2 className="font-bold text-slate-700">Datos Generales</h2>
                </div>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Negocio</label>
                            <input required type="text" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 items-center gap-2">
                                <LinkIcon className="w-4 h-4 text-brand-500 inline mr-1" />
                                Enlace Público (Slug)
                            </label>
                            <div className="flex">
                                <span className="px-3 py-3 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-slate-500 text-sm font-medium flex items-center">/p/</span>
                                <input required type="text" className="w-full p-3 border border-slate-300 rounded-r-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all" value={slug} onChange={handleSlugChange} placeholder="ej-gymrat" />
                            </div>
                            <p className="text-xs text-slate-400 mt-2 ml-1">Esta será tu URL pública: speeddigitalapp.com/p/<span className="font-bold text-brand-500">{slug || '...'}</span></p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 justify-between items-center max-w-md">
                            Rubro / Industria
                            <span className="text-xs font-normal text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 mt-1 w-fit">
                                <Lock className="w-3 h-3" /> No se puede cambiar
                            </span>
                        </label>
                        <div className="relative max-w-md mt-2">
                            <input type="text" className="w-full p-3 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed outline-none font-medium" value={industryLabels[industry] || industry} readOnly />
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-sm font-bold text-slate-700 mb-4">Logo de la marca</label>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-50 overflow-hidden relative shrink-0">
                                {(previewUrl || logoUrl) ? (
                                    <img src={previewUrl || logoUrl || ''} alt="Logo" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-slate-300" />
                                )}
                            </div>
                            <div>
                                <input type="file" id="logoUpload" className="hidden" accept="image/*" onChange={handleFileChange} />
                                <label htmlFor="logoUpload" className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer hover:bg-slate-50 transition-colors inline-block shadow-sm">Subir nueva imagen</label>
                                <p className="text-xs text-slate-400 mt-2">Recomendado: 500x500px (PNG transparente, Máx 2MB)</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Guardar Configuración
                    </button>
                </div>
            </form>
        </div>
    );
}