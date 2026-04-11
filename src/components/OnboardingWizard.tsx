import { useState, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import {
    Rocket, Upload, Loader2, ArrowRight, Check, ArrowLeft,
    Dumbbell, Utensils, Briefcase, GraduationCap, HeartPulse, Wrench, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingWizardProps {
    isOpen: boolean;
    orgId: string;
    onComplete: () => void;
}

export default function OnboardingWizard({ isOpen, orgId, onComplete }: OnboardingWizardProps) {
    const [step, setStep] = useState(1); // 1: Rubro, 2: Nombre, 3: Logo
    const [industry, setIndustry] = useState('');
    const [name, setName] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LISTA EXPANDIDA DE INDUSTRIAS ---
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
            if (file.size > 2 * 1024 * 1024) return toast.error("La imagen debe pesar menos de 2MB");
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleFinalSubmit = async (skipLogo = false) => {
        if (!name.trim()) return toast.error('El nombre es obligatorio');
        if (!industry) return toast.error('El rubro es obligatorio');
        setLoading(true);

        try {
            let logoUrl = null;
            if (!skipLogo && logoFile) {
                toast.loading('Subiendo logo...', { id: 'upload_logo' });
                logoUrl = await uploadToCloudinary(logoFile);
                toast.dismiss('upload_logo');
            }

            const { error } = await supabase
                .from('organizations')
                .update({
                    name: name.trim(),
                    industry: industry,
                    logo_url: logoUrl,
                    setup_completed: true
                })
                .eq('id', orgId);

            if (error) throw error;

            toast.success('¡Negocio configurado con éxito!');
            onComplete();

        } catch (error: any) {
            console.error(error);
            toast.error('Error al guardar la configuración: ' + error.message);
            toast.dismiss('upload_logo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            {/* Es un modal que NO se puede cerrar haciendo clic afuera (Onboarding obligatorio) */}
            <Dialog as="div" className="relative z-[99999]" onClose={() => {}}>
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col min-h-[500px] animate-in zoom-in-95 duration-300">
                            
                            {/* HEADER DINÁMICO */}
                            <div className="bg-slate-50 p-8 border-b border-slate-100 relative text-center shrink-0">
                                
                                {/* BOTÓN VOLVER (Solo en paso 2 y 3) */}
                                {step > 1 && !loading && (
                                    <button
                                        onClick={() => setStep(step - 1)}
                                        className="absolute left-6 top-1/2 -translate-y-1/2 p-2.5 rounded-full hover:bg-white text-slate-400 hover:text-slate-700 transition-all border border-transparent hover:border-slate-200 hover:shadow-sm"
                                        title="Volver al paso anterior"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                )}

                                <div className="flex justify-center mb-4">
                                    <div className="bg-brand-100 p-3.5 rounded-full shadow-inner animate-in fade-in zoom-in duration-500">
                                        {step === 1 ? <Zap className="w-8 h-8 text-brand-600" /> : <Rocket className="w-8 h-8 text-brand-600" />}
                                    </div>
                                </div>
                                
                                <Dialog.Title as="h2" className="text-2xl font-black text-slate-900 tracking-tight">
                                    {step === 1 ? 'Elegí tu Rubro' : step === 2 ? 'Nombre del Negocio' : 'Tu Identidad (Logo)'}
                                </Dialog.Title>
                                
                                {/* Barra de Progreso Discreta */}
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-brand-500' : 'bg-slate-200'}`} />
                                    <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-brand-500' : 'bg-slate-200'}`} />
                                    <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 3 ? 'bg-brand-500' : 'bg-slate-200'}`} />
                                </div>
                            </div>

                            {/* CONTENIDO VARIABLE */}
                            <div className="p-8 flex-1 flex flex-col justify-center">
                                <AnimatePresence mode="wait">
                                    {step === 1 && (
                                        <motion.div
                                            key="step1"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="grid grid-cols-2 md:grid-cols-3 gap-4"
                                        >
                                            {industries.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setIndustry(item.id)}
                                                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center group h-40 focus:outline-none focus:ring-4 focus:ring-brand-500/20 ${
                                                        industry === item.id 
                                                        ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 shadow-md' 
                                                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                                    } ${item.color}`}
                                                >
                                                    <div className={`transform transition-transform duration-300 ${industry === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                                                        {item.icon}
                                                    </div>
                                                    <span className={`font-bold text-sm mt-2 ${industry === item.id ? 'text-slate-900' : 'text-slate-600'}`}>
                                                        {item.label}
                                                    </span>
                                                </button>
                                            ))}

                                            <div className="col-span-2 md:col-span-3 mt-6 flex justify-end">
                                                <button
                                                    onClick={() => setStep(2)}
                                                    disabled={!industry}
                                                    className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10 active:scale-95"
                                                >
                                                    Continuar <ArrowRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {step === 2 && (
                                        <motion.div
                                            key="step2"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-6 max-w-md mx-auto w-full"
                                        >
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 text-center">¿Cómo se llama tu negocio?</label>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="w-full px-6 py-5 rounded-2xl border-2 border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none text-xl font-black text-center text-slate-800 transition-all placeholder:text-slate-300 placeholder:font-medium"
                                                    placeholder="Ej: Gimnasio Hércules"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(3)}
                                                />
                                            </div>
                                            <button
                                                onClick={() => name.trim() && setStep(3)}
                                                disabled={!name.trim()}
                                                className="w-full py-4.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10 text-lg active:scale-95"
                                            >
                                                Siguiente <ArrowRight className="w-5 h-5" />
                                            </button>
                                        </motion.div>
                                    )}

                                    {step === 3 && (
                                        <motion.div
                                            key="step3"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-6 max-w-md mx-auto w-full"
                                        >
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`w-full border-2 border-dashed rounded-3xl h-56 flex flex-col items-center justify-center transition-all group focus:outline-none focus:ring-4 focus:ring-brand-500/20 ${previewUrl ? 'border-brand-300 bg-brand-50/30' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}
                                            >
                                                {previewUrl ? (
                                                    <img src={previewUrl} alt="Preview Logo" className="h-full w-full object-contain p-4 rounded-3xl" />
                                                ) : (
                                                    <>
                                                        <div className="bg-white p-5 rounded-full mb-3 shadow-sm group-hover:shadow-md transition-all group-hover:scale-110">
                                                            <Upload className="w-8 h-8 text-brand-500" />
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-700">Hacé clic para subir tu logo</p>
                                                        <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest">PNG, JPG (Máx 2MB)</p>
                                                    </>
                                                )}
                                            </button>
                                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                                            <div className="flex flex-col gap-3 pt-4">
                                                <button
                                                    onClick={() => handleFinalSubmit(false)}
                                                    disabled={loading || !logoFile} // Forzamos que, si usa este botón, haya elegido un logo
                                                    className="w-full py-4.5 bg-brand-600 text-white rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-brand-500/20 active:scale-95"
                                                >
                                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                                    Finalizar Configuración
                                                </button>

                                                <button
                                                    onClick={() => handleFinalSubmit(true)}
                                                    disabled={loading}
                                                    className="text-sm text-slate-400 hover:text-slate-600 font-bold py-2 transition-colors disabled:opacity-50"
                                                >
                                                    Omitir logo por ahora
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}