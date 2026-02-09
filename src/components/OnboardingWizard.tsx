import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import {
    Rocket, Upload, Loader2, ArrowRight, Check, ArrowLeft,
    Dumbbell, Utensils, Briefcase, GraduationCap, HeartPulse, Wrench, Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingWizardProps {
    isOpen: boolean;
    orgId: string;
    onComplete: () => void;
}

export default function OnboardingWizard({ isOpen, orgId, onComplete }: OnboardingWizardProps) {
    if (!isOpen) return null;

    const [step, setStep] = useState(1); // 1: Rubro, 2: Nombre, 3: Logo
    const [industry, setIndustry] = useState('');
    const [name, setName] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LISTA EXPANDIDA DE INDUSTRIAS (6 Opciones) ---
    const industries = [
        { id: 'gym', label: 'Gimnasio / Sport', icon: <Dumbbell className="w-8 h-8 mb-2" />, color: 'hover:border-emerald-500 hover:bg-emerald-50 text-emerald-600' },
        { id: 'education', label: 'Academia / Clases', icon: <GraduationCap className="w-8 h-8 mb-2" />, color: 'hover:border-indigo-500 hover:bg-indigo-50 text-indigo-600' },
        { id: 'gastronomy', label: 'Gastronomía', icon: <Utensils className="w-8 h-8 mb-2" />, color: 'hover:border-orange-500 hover:bg-orange-50 text-orange-600' },
        { id: 'health', label: 'Salud / Estética', icon: <HeartPulse className="w-8 h-8 mb-2" />, color: 'hover:border-pink-500 hover:bg-pink-50 text-pink-600' },
        { id: 'workshop', label: 'Taller / Service', icon: <Wrench className="w-8 h-8 mb-2" />, color: 'hover:border-slate-500 hover:bg-slate-50 text-slate-600' },
        { id: 'generic', label: 'Otro Negocio', icon: <Briefcase className="w-8 h-8 mb-2" />, color: 'hover:border-blue-500 hover:bg-blue-50 text-blue-600' },
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) return toast.error("Máximo 2MB");
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleFinalSubmit = async (skipLogo = false) => {
        if (!name.trim()) return toast.error('El nombre es obligatorio');
        setLoading(true);

        try {
            let logoUrl = null;
            if (!skipLogo && logoFile) {
                logoUrl = await uploadToCloudinary(logoFile);
            }

            const { error } = await supabase
                .from('organizations')
                .update({
                    name: name,
                    industry: industry,
                    logo_url: logoUrl,
                    setup_completed: true
                })
                .eq('id', orgId);

            if (error) throw error;

            toast.success('¡Academia configurada!');
            onComplete();

        } catch (error: any) {
            console.error(error);
            toast.error('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">

                {/* Header Dinámico */}
                <div className="bg-slate-50 p-8 border-b border-slate-100 relative text-center">

                    {/* BOTÓN VOLVER (Solo en paso 2 y 3) */}
                    {step > 1 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="absolute left-8 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-700 transition-all border border-transparent hover:border-slate-200"
                            title="Volver atrás"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    <div className="flex justify-center mb-4">
                        <div className="bg-brand-100 p-3 rounded-full shadow-inner">
                            {step === 1 ? <Zap className="w-8 h-8 text-brand-600" /> : <Rocket className="w-8 h-8 text-brand-600" />}
                        </div>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">
                        {step === 1 ? 'Elegí tu Rubro' : step === 2 ? 'Nombre del Negocio' : 'Tu Marca'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-2 font-medium">
                        Paso {step} de 3
                    </p>
                </div>

                <div className="p-8">
                    {step === 1 && (
                        // PASO 1: SELECCIÓN DE RUBRO (GRID DE 6)
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {industries.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setIndustry(item.id);
                                        setStep(2);
                                    }}
                                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center group h-40 ${industry === item.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'} ${item.color}`}
                                >
                                    <div className="transform group-hover:scale-110 transition-transform duration-300">
                                        {item.icon}
                                    </div>
                                    <span className={`font-bold text-sm mt-2 ${industry === item.id ? 'text-slate-900' : 'text-slate-600'}`}>
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 2 && (
                        // PASO 2: NOMBRE
                        <div className="space-y-4 max-w-md mx-auto">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">¿Cómo se llama tu negocio?</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none text-lg font-medium transition-all"
                                    placeholder="Ej: Gimnasio Hércules"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(3)}
                                />
                            </div>
                            <button
                                onClick={() => name.trim() && setStep(3)}
                                disabled={!name.trim()}
                                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-xl shadow-slate-900/10"
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        // PASO 3: LOGO
                        <div className="space-y-6 max-w-md mx-auto">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all group ${previewUrl ? 'border-brand-300 bg-brand-50/30' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="h-full w-full object-contain p-4" />
                                ) : (
                                    <>
                                        <div className="bg-slate-100 p-4 rounded-full mb-3 group-hover:bg-white group-hover:shadow-md transition-all">
                                            <Upload className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-600">Hacé clic para subir tu logo</p>
                                        <p className="text-xs text-slate-400 mt-1">PNG, JPG (Máx 2MB)</p>
                                    </>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => handleFinalSubmit(false)}
                                    disabled={loading}
                                    className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    Finalizar Configuración
                                </button>

                                <button
                                    onClick={() => handleFinalSubmit(true)}
                                    className="text-sm text-slate-400 hover:text-slate-600 font-medium py-2"
                                >
                                    Omitir este paso por ahora
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}