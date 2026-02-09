import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import { Rocket, Upload, Loader2, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingWizardProps {
    isOpen: boolean;
    orgId: string;
    onComplete: () => void;
}

export default function OnboardingWizard({ isOpen, orgId, onComplete }: OnboardingWizardProps) {
    if (!isOpen) return null;

    const [step, setStep] = useState(1); // 1: Nombre, 2: Logo
    const [name, setName] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Manejo de archivo
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) return toast.error("Máximo 2MB");
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Guardado Final
    const handleFinalSubmit = async (skipLogo = false) => {
        if (!name.trim()) return toast.error('El nombre es obligatorio');
        setLoading(true);

        try {
            let logoUrl = null;

            // Si subió logo y no lo saltó
            if (!skipLogo && logoFile) {
                logoUrl = await uploadToCloudinary(logoFile);
            }

            // Actualizamos la organización Y marcamos setup_completed
            const { error } = await supabase
                .from('organizations')
                .update({
                    name: name,
                    logo_url: logoUrl, // Si es null, Supabase lo ignorará o pondrá null según config, mejor null
                    setup_completed: true // <--- ESTO EVITA QUE VUELVA A APARECER
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
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">

                {/* Header */}
                <div className="bg-slate-50 p-6 border-b border-slate-100 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-brand-100 p-3 rounded-full">
                            <Rocket className="w-8 h-8 text-brand-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">
                        {step === 1 ? '¡Bienvenido!' : 'Identidad Visual'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        {step === 1 ? 'Configuremos tu espacio de trabajo.' : 'Personaliza el portal de tus alumnos.'}
                    </p>
                </div>

                <div className="p-8">
                    {step === 1 ? (
                        // PASO 1: NOMBRE
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">¿Cómo se llama tu Academia?</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none text-lg"
                                    placeholder="Ej: Instituto English Point"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={() => name.trim() && setStep(2)}
                                disabled={!name.trim()}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        // PASO 2: LOGO
                        <div className="space-y-6">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl h-40 flex flex-col items-center justify-center cursor-pointer transition-all group ${previewUrl ? 'border-brand-300 bg-brand-50/30' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="h-full w-full object-contain p-2" />
                                ) : (
                                    <>
                                        <div className="bg-slate-100 p-3 rounded-full mb-2">
                                            <Upload className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-600">Subir Logo</p>
                                    </>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => handleFinalSubmit(false)}
                                    disabled={loading}
                                    className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    Terminar Configuración
                                </button>

                                <button
                                    onClick={() => handleFinalSubmit(true)} // Skip logo
                                    className="text-sm text-slate-400 hover:text-slate-600 font-medium"
                                >
                                    Omitir logo por ahora
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}