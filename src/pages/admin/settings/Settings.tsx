import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Building, Image as ImageIcon, Lock, AlertCircle, Link as LinkIcon, Loader2, MapPin, Phone, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { useAuthStore } from '../../../store/authStore';

export default function Settings() {
    const { orgData, initializeAuth } = useAuthStore(); 
    const [saving, setSaving] = useState(false);

    // Estados Generales
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [industry, setIndustry] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [newLogo, setNewLogo] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // NUEVO: Estados para los Datos de Contacto (Settings JSONB)
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [instagram, setInstagram] = useState('');

    useEffect(() => {
        if (orgData) {
            setName(orgData.name || '');
            setSlug(orgData.slug || '');
            setIndustry(orgData.industry || 'generic');
            setLogoUrl(orgData.logo_url || null);
            
            // Cargamos los datos extra si existen
            if (orgData.settings) {
                setPhone(orgData.settings.phone || '');
                setAddress(orgData.settings.address || '');
                setInstagram(orgData.settings.instagram || '');
            }
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

            // Empaquetamos los datos de contacto
            const updatedSettings = {
                ...orgData.settings,
                phone: phone.trim(),
                address: address.trim(),
                instagram: instagram.trim()
            };

            const { error } = await supabase
                .from('organizations')
                .update({
                    name: name.trim(),
                    slug: slug.trim() || null,
                    logo_url: finalLogoUrl,
                    settings: updatedSettings // Guardamos el JSON
                })
                .eq('id', orgData.id);

            if (error) {
                if (error.code === '23505') throw new Error('Este enlace público ya está en uso por otra cuenta. Elegí otro.');
                throw error;
            }

            toast.success('Configuración guardada');
            setNewLogo(null);
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
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Configuración de la Organización</h1>

            <form onSubmit={handleSave} className="space-y-6">
                
                {/* BLOQUE 1: Datos Generales */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                        <div className="p-2 bg-brand-100 rounded-lg"><Building className="w-5 h-5 text-brand-600" /></div>
                        <h2 className="font-bold text-slate-800 text-lg">Datos Generales</h2>
                    </div>

                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Negocio</label>
                                <input required type="text" className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-medium text-slate-800" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2  items-center gap-2">
                                    <LinkIcon className="w-4 h-4 text-brand-500" /> Enlace Público (Slug)
                                </label>
                                <div className="flex shadow-sm rounded-xl">
                                    <span className="px-4 py-3.5 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-slate-500 text-sm font-medium">/m/</span>
                                    <input required type="text" className="w-full p-3.5 border border-slate-300 rounded-r-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold text-slate-800" value={slug} onChange={handleSlugChange} placeholder="ej-bacanal" />
                                </div>
                                <p className="text-xs text-slate-500 mt-2 ml-1">Tus clientes entrarán a: <span className="font-bold text-brand-600">tuapp.com/m/{slug || '...'}</span></p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2  justify-between items-center max-w-md">
                                Rubro / Industria
                                <span className="text-xs font-bold text-amber-700 flex items-center gap-1 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200">
                                    <Lock className="w-3 h-3" /> Fijo
                                </span>
                            </label>
                            <div className="relative max-w-md mt-2">
                                <input type="text" className="w-full p-3.5 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed outline-none font-medium" value={industryLabels[industry] || industry} readOnly />
                                <AlertCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <label className="block text-sm font-bold text-slate-700 mb-4">Logo de la marca</label>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center bg-slate-50 overflow-hidden relative shrink-0">
                                    {(previewUrl || logoUrl) ? (
                                        <img src={previewUrl || logoUrl || ''} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    <input type="file" id="logoUpload" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    <label htmlFor="logoUpload" className="px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer hover:bg-slate-50 hover:shadow-sm transition-all inline-block">Subir nueva imagen</label>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">Recomendado: 500x500px (JPG/PNG, Máx 2MB)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BLOQUE 2: Datos de Contacto Públicos */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                        <div className="p-2 bg-indigo-100 rounded-lg"><MapPin className="w-5 h-5 text-indigo-600" /></div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-lg">Información Pública</h2>
                            <p className="text-xs text-slate-500">Estos datos aparecerán en tu Menú Digital o Portal de Clientes.</p>
                        </div>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> Teléfono / WhatsApp</label>
                            <input type="text" className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-medium text-slate-800" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: +54 9 11 1234-5678" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2  items-center gap-2"><Instagram className="w-4 h-4 text-slate-400" /> Instagram (@)</label>
                            <input type="text" className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-medium text-slate-800" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Ej: mi_restaurante" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-2  items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> Dirección Física</label>
                            <input type="text" className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-medium text-slate-800" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: Av. San Martín 1234, Ciudad" />
                        </div>
                    </div>
                </div>

                {/* BOTÓN DE GUARDAR */}
                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={saving} className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50 text-lg">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Guardar Cambios
                    </button>
                </div>

            </form>
        </div>
    );
}