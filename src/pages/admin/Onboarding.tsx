import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Store, Utensils, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Onboarding() {
    const navigate = useNavigate();
    const { initializeAuth } = useAuthStore();
    
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        industry: '',
        orgName: '',
    });

    const handleCreateOrganization = async () => {
        if (!formData.orgName.trim()) return toast.error('Necesitamos el nombre de tu negocio');
        
        setLoading(true);
        try {
            // 1. Obtenemos el usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No hay usuario autenticado");

            // 2. Calculamos los 14 días de prueba gratis
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 14);

            // 3. Creamos la organización (SIN guardar la variable 'org')
            const { error: orgError } = await supabase
                .from('organizations')
                .insert([{
                    name: formData.orgName.trim(),
                    industry: formData.industry,
                    slug: formData.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                    trial_ends_at: trialEnd.toISOString(),
                    owner_id: user.id // ¡Asegurate de que diga 'owner_id' acá!
                }]);

            if (orgError) throw orgError;

            // 4. Forzamos al cerebro (Zustand) a recargar para que detecte la nueva Org
            await initializeAuth();
            
            toast.success("¡Negocio creado con éxito!");
            navigate('/admin/dashboard', { replace: true });

        } catch (error: any) {
            console.error("Error en onboarding:", error);
            toast.error(error.message || "Error al configurar tu cuenta");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            
            {/* Barra de progreso superior */}
            <div className="w-full max-w-2xl mb-8 flex items-center justify-between px-10">
                <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-brand-500' : 'bg-slate-200'} transition-colors duration-500`} />
                <div className="w-4" />
                <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-brand-500' : 'bg-slate-200'} transition-colors duration-500`} />
                <div className="w-4" />
                <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-brand-500' : 'bg-slate-200'} transition-colors duration-500`} />
            </div>

            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                
                {/* PASO 1: Elegir Rubro */}
                {step === 1 && (
                    <div className="p-10 animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="text-center mb-10">
                            <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-800 mb-3">¡Bienvenido a SpeedDigital!</h1>
                            <p className="text-slate-500 text-lg">Para empezar a adaptar el sistema a tus necesidades, contanos... ¿Qué tipo de negocio tenés?</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* 1. GASTRONOMÍA */}
                            <button 
                                onClick={() => setFormData({ ...formData, industry: 'gastronomy' })}
                                className={`p-6 rounded-2xl border-2 text-left transition-all ${formData.industry === 'gastronomy' ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-500/10' : 'border-slate-200 hover:border-brand-200'}`}
                            >
                                <Utensils className={`w-8 h-8 mb-4 ${formData.industry === 'gastronomy' ? 'text-brand-600' : 'text-slate-400'}`} />
                                <h3 className="font-bold text-slate-800 text-lg">Gastronomía</h3>
                                <p className="text-sm text-slate-500 mt-1">Restaurantes, Bares, Cafés.</p>
                            </button>

                            {/* 2. GYM / FITNESS */}
                            <button 
                                onClick={() => setFormData({ ...formData, industry: 'gym' })}
                                className={`p-6 rounded-2xl border-2 text-left transition-all ${formData.industry === 'gym' ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-500/10' : 'border-slate-200 hover:border-brand-200'}`}
                            >
                                <Store className={`w-8 h-8 mb-4 ${formData.industry === 'gym' ? 'text-brand-600' : 'text-slate-400'}`} />
                                <h3 className="font-bold text-slate-800 text-lg">Gym & Fitness</h3>
                                <p className="text-sm text-slate-500 mt-1">Gimnasios, Crossfit, Yoga.</p>
                            </button>

                            {/* 3. SERVICIOS Y RESERVAS */}
                            <button 
                                onClick={() => setFormData({ ...formData, industry: 'services' })}
                                className={`p-6 rounded-2xl border-2 text-left transition-all ${formData.industry === 'services' ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-500/10' : 'border-slate-200 hover:border-brand-200'}`}
                            >
                                <CheckCircle2 className={`w-8 h-8 mb-4 ${formData.industry === 'services' ? 'text-brand-600' : 'text-slate-400'}`} />
                                <h3 className="font-bold text-slate-800 text-lg">Servicios</h3>
                                <p className="text-sm text-slate-500 mt-1">Barberías, Turnos, Consultorios.</p>
                            </button>
                        </div>
                        <div className="mt-10 flex justify-end">
                            <button 
                                onClick={() => setStep(2)}
                                disabled={!formData.industry}
                                className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                Continuar <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 2: Nombre del Negocio */}
                {step === 2 && (
                    <div className="p-10 animate-in fade-in slide-in-from-right-8 duration-500">
                        <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-600 text-sm font-bold mb-6 flex items-center gap-1">
                            Volver atrás
                        </button>
                        
                        <div className="mb-8">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                                <Store className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 mb-2">¿Cómo se llama tu negocio?</h2>
                            <p className="text-slate-500">Este será el nombre que verán tus clientes en el Menú Digital o Portal.</p>
                        </div>

                        <div>
                            <input 
                                type="text" 
                                autoFocus
                                value={formData.orgName}
                                onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                                placeholder="Ej: Bacanal Burger"
                                className="w-full text-2xl font-black text-slate-800 placeholder:text-slate-300 border-b-2 border-slate-200 focus:border-brand-500 bg-transparent py-4 outline-none transition-colors"
                            />
                        </div>

                        <div className="mt-12 flex justify-end">
                            <button 
                                onClick={() => setStep(3)}
                                disabled={formData.orgName.length < 3}
                                className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                Siguiente paso <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 3: Plan Gratis y Creación */}
                {step === 3 && (
                    <div className="p-10 text-center animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        
                        <h2 className="text-3xl font-black text-slate-800 mb-4">¡Todo listo para arrancar!</h2>
                        
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 inline-block text-left">
                            <ul className="space-y-3 text-slate-600 font-medium">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-brand-500" /> 14 días de prueba totalmente gratis.</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-brand-500" /> Acceso a todas las herramientas Pro.</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-brand-500" /> Sin necesidad de tarjeta de crédito.</li>
                            </ul>
                        </div>

                        <button 
                            onClick={handleCreateOrganization}
                            disabled={loading}
                            className="w-full bg-brand-500 hover:bg-brand-600 text-white px-8 py-5 rounded-2xl font-black text-lg shadow-xl shadow-brand-500/20 flex items-center justify-center gap-3 transition-all"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Crear mi cuenta y entrar"}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}