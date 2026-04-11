import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Store, Utensils, ArrowRight, Loader2, Sparkles, CheckCircle2, Ticket } from 'lucide-react';
import { toast } from 'sonner';

export default function Onboarding() {
    const { initializeAuth } = useAuthStore();
    
    // Estado del Wizard (Paso a paso)
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        industry: '',
        orgName: '',
    });

    // Estado del Cupón / Promoción (Por si entró desde un enlace de referidos)
    const [promoData, setPromoData] = useState<any | null>(null);
    const [validatingPromo, setValidatingPromo] = useState(false);

    // =========================================================================
    // INICIALIZACIÓN (Validar Cupón)
    // =========================================================================
    useEffect(() => {
        async function checkPromo() {
            const codeFromStorage = localStorage.getItem('speeddigital_promo');
            if (codeFromStorage) {
                setValidatingPromo(true);
                try {
                    // Validamos contra la BD que el cupón no esté vencido o agotado
                    const { data, error } = await supabase.rpc('validate_promotion', { check_code: codeFromStorage });
                    if (!error && data && data.valid) {
                        setPromoData(data);
                    } else {
                        // Si es trucho o está agotado, lo borramos silenciosamente
                        localStorage.removeItem('speeddigital_promo');
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setValidatingPromo(false);
                }
            }
        }
        checkPromo();
    }, []);

    // =========================================================================
    // FINALIZAR ONBOARDING (Crear la Organización)
    // =========================================================================
    const handleCreateOrganization = async () => {
        if (!formData.orgName.trim()) return toast.error('Necesitamos el nombre de tu negocio para continuar.');
        
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No hay usuario autenticado en la sesión.");

            // Lógica de Suscripciones (Días Gratis o Meses de Promo)
            const trialEnd = new Date();
            if (promoData && promoData.type === 'free_months') {
                // Le sumamos los meses gratis del cupón
                trialEnd.setMonth(trialEnd.getMonth() + promoData.value);
            } else {
                // Trial por defecto de 14 días para cuentas nuevas
                trialEnd.setDate(trialEnd.getDate() + 14);
            }

            // 1. Crear Organización Maestra (Tenant)
            const { error: orgError } = await supabase
                .from('organizations')
                .insert([{
                    name: formData.orgName.trim(),
                    industry: formData.industry,
                    slug: formData.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                    trial_ends_at: trialEnd.toISOString(),
                    owner_id: user.id,
                    active_promo_code: promoData ? promoData.code : null
                }]);

            if (orgError) throw orgError;

            // 2. Si usó promo, registrar su consumo en la BD (Restar 1 al cupo)
            if (promoData) {
                await supabase.rpc('claim_promotion', { promo_code: promoData.code });
                localStorage.removeItem('speeddigital_promo'); // Limpiar caché
            }

            // 3. Forzar refresco de Auth para que lea el nuevo organization_id del perfil
            await initializeAuth();
            
            toast.success("¡Tu negocio fue creado con éxito!");
            // Forzamos recarga dura para limpiar todo vestigio del Wizard y cargar el dashboard limpio
            window.location.href = '/admin/dashboard'; 

        } catch (error: any) {
            console.error("Error en onboarding:", error);
            toast.error(error.message || "Error al configurar tu cuenta inicial.");
            setLoading(false);
        } 
    };

    // =========================================================================
    // RENDER PRINCIPAL (El Wizard)
    // =========================================================================
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-brand-500/30">
            
            {/* Barra de Progreso Superior */}
            <div className="w-full max-w-2xl mb-8 flex items-center justify-between px-4 sm:px-10 animate-in fade-in duration-500">
                <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-brand-500 shadow-sm shadow-brand-500/20' : 'bg-slate-200'} transition-all duration-500`} />
                <div className="w-4" />
                <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-brand-500 shadow-sm shadow-brand-500/20' : 'bg-slate-200'} transition-all duration-500`} />
                <div className="w-4" />
                <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-brand-500 shadow-sm shadow-brand-500/20' : 'bg-slate-200'} transition-all duration-500`} />
            </div>

            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                
                {/* --- PASO 1: ELEGIR RUBRO --- */}
                {step === 1 && (
                    <div className="p-8 sm:p-10 animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="text-center mb-10">
                            <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-6 shadow-sm">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">¡Bienvenido a SpeedDigital!</h1>
                            <p className="text-slate-500 text-lg font-medium">Para empezar a adaptar el sistema a tus necesidades, contanos... ¿Qué tipo de negocio tenés?</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Card Gastronomía */}
                            <button onClick={() => setFormData({ ...formData, industry: 'gastronomy' })} className={`p-6 rounded-2xl border-2 text-left transition-all group ${formData.industry === 'gastronomy' ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-500/10 scale-105' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}>
                                <Utensils className={`w-8 h-8 mb-4 transition-colors ${formData.industry === 'gastronomy' ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-400'}`} />
                                <h3 className="font-bold text-slate-800 text-lg leading-tight">Gastronomía</h3>
                                <p className="text-sm text-slate-500 mt-2 font-medium">Restaurantes, Bares, Cafés.</p>
                            </button>
                            
                            {/* Card Gym */}
                            <button onClick={() => setFormData({ ...formData, industry: 'gym' })} className={`p-6 rounded-2xl border-2 text-left transition-all group ${formData.industry === 'gym' ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-500/10 scale-105' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}>
                                <Store className={`w-8 h-8 mb-4 transition-colors ${formData.industry === 'gym' ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-400'}`} />
                                <h3 className="font-bold text-slate-800 text-lg leading-tight">Gym & Fitness</h3>
                                <p className="text-sm text-slate-500 mt-2 font-medium">Gimnasios, Crossfit, Yoga.</p>
                            </button>
                            
                            {/* Card Servicios */}
                            <button onClick={() => setFormData({ ...formData, industry: 'services' })} className={`p-6 rounded-2xl border-2 text-left transition-all group ${formData.industry === 'services' ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-500/10 scale-105' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}>
                                <CheckCircle2 className={`w-8 h-8 mb-4 transition-colors ${formData.industry === 'services' ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-400'}`} />
                                <h3 className="font-bold text-slate-800 text-lg leading-tight">Servicios</h3>
                                <p className="text-sm text-slate-500 mt-2 font-medium">Barberías, Turnos, Consultorios.</p>
                            </button>
                        </div>
                        
                        <div className="mt-10 flex justify-end border-t border-slate-100 pt-6">
                            <button onClick={() => setStep(2)} disabled={!formData.industry} className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white px-10 py-4.5 rounded-xl font-black text-lg flex justify-center items-center gap-2 transition-all disabled:opacity-50 active:scale-95 shadow-xl shadow-slate-900/20">
                                Continuar <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* --- PASO 2: NOMBRE DEL NEGOCIO --- */}
                {step === 2 && (
                    <div className="p-8 sm:p-10 animate-in fade-in slide-in-from-right-8 duration-500">
                        <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-600 text-sm font-bold mb-6 flex items-center gap-1 transition-colors px-3 py-1.5 -ml-3 rounded-lg hover:bg-slate-100">
                            Volver atrás
                        </button>
                        
                        <div className="mb-8">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                <Store className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">¿Cómo se llama tu negocio?</h2>
                            <p className="text-slate-500 font-medium">Este será el nombre principal que verán tus clientes en el Menú Digital o Portal de Turnos.</p>
                        </div>

                        <div className="mb-10">
                            <input 
                                type="text" autoFocus 
                                value={formData.orgName} 
                                onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                                placeholder="Ej: Bacanal Burger"
                                className="w-full text-2xl md:text-3xl font-black text-slate-800 placeholder:text-slate-300 border-b-4 border-slate-200 focus:border-brand-500 bg-transparent py-4 outline-none transition-colors"
                                onKeyDown={(e) => e.key === 'Enter' && formData.orgName.length >= 3 && setStep(3)}
                            />
                        </div>

                        <div className="flex justify-end border-t border-slate-100 pt-6">
                            <button onClick={() => setStep(3)} disabled={formData.orgName.length < 3} className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white px-10 py-4.5 rounded-xl font-black text-lg flex justify-center items-center gap-2 transition-all disabled:opacity-50 active:scale-95 shadow-xl shadow-slate-900/20">
                                Siguiente paso <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* --- PASO 3: CONFIRMACIÓN Y PROMOS --- */}
                {step === 3 && (
                    <div className="p-8 sm:p-10 text-center animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border-4 border-white ring-1 ring-slate-100">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        
                        <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 tracking-tight">¡Todo listo para arrancar!</h2>

                        {validatingPromo ? (
                            <div className="flex flex-col justify-center items-center my-12 text-slate-400 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                                <span className="font-bold text-xs uppercase tracking-widest">Validando promoción...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                {/* CARTEL DE BENEFICIO ACTIVADO (PROMO) */}
                                {promoData && (
                                    <div className="w-full max-w-sm bg-brand-50 border border-brand-200 text-brand-700 p-5 rounded-2xl mb-6 flex items-start gap-4 text-left shadow-sm animate-in zoom-in-95">
                                        <Ticket className="w-6 h-6 mt-1 shrink-0" />
                                        <div>
                                            <p className="font-black text-[10px] uppercase tracking-widest mb-1 text-brand-500 bg-white px-2 py-0.5 rounded shadow-sm w-fit border border-brand-100">
                                                CUPÓN ACTIVADO: {promoData.code}
                                            </p>
                                            <p className="font-bold text-sm text-brand-900 mt-2 leading-snug">
                                                {promoData.type === 'free_months' 
                                                    ? `¡Felicidades! Tenés ${promoData.value} ${promoData.value === 1 ? 'mes' : 'meses'} de sistema completamente gratis para tu local.` 
                                                    : `Descuento guardado para tu suscripción.`}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* LISTA DE BENEFICIOS ESTÁNDAR */}
                                <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100 mb-10 w-full max-w-md shadow-inner text-left">
                                    <ul className="space-y-4 text-slate-700 font-bold text-sm md:text-base">
                                        <li className="flex items-center gap-3">
                                            <div className="p-1 bg-white rounded-md shadow-sm"><CheckCircle2 className="w-5 h-5 text-brand-500" /></div>
                                            {promoData?.type === 'free_months' ? `Prueba premium por ${promoData.value} meses.` : '14 días de prueba totalmente gratis.'}
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <div className="p-1 bg-white rounded-md shadow-sm"><CheckCircle2 className="w-5 h-5 text-brand-500" /></div>
                                            Acceso a todas las herramientas Pro.
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <div className="p-1 bg-white rounded-md shadow-sm"><CheckCircle2 className="w-5 h-5 text-brand-500" /></div>
                                            Sin necesidad de ingresar tarjeta.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-slate-100 pt-8 mt-auto">
                            <button 
                                onClick={handleCreateOrganization}
                                disabled={loading || validatingPromo}
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white px-8 py-5 md:py-6 rounded-2xl font-black text-xl shadow-xl shadow-brand-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-95 border-b-4 border-brand-800"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Crear mi cuenta y entrar"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}