// =============================================================================
// GymOnboardingModal.tsx
// Modal especializado para dar de alta alumnos en Gimnasios/Academias.
// Flujo: 1. Datos/Foto -> 2. Elegir Plan (Opcional) -> 3. Inserta Persona + Deuda
// =============================================================================

import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Camera, Save, RefreshCw, User, CheckCircle, Upload, ArrowRight } from 'lucide-react';
import Webcam from 'react-webcam';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export interface GymOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
}

export default function GymOnboardingModal({ isOpen, onClose, onSuccess }: GymOnboardingModalProps) {
    const { orgData } = useAuthStore();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Datos del Alumno
    const [formData, setFormData] = useState({
        full_name: '',
        identifier: '',
        phone: ''
    });

    // Multimedia
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Planes (Suscripciones)
    const [plans, setPlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

    // =========================================================================
    // INICIALIZACIÓN Y BÚSQUEDA DE PLANES
    // =========================================================================
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFormData({ full_name: '', identifier: '', phone: '' });
            setCapturedImage(null);
            setSelectedPlanId(null);
            fetchPlans();
        }
    }, [isOpen]);

    async function fetchPlans() {
        try {
            const { data, error } = await supabase
                .from('catalog_items')
                .select('id, name, price, properties')
                .or('type.eq.subscription,type.eq.service')
                .eq('is_active', true)
                .eq('organization_id', orgData?.id)
                .order('price');

            if (error) throw error;
            setPlans(data || []);
        } catch (error) {
            toast.error("Error al cargar los planes.");
        }
    }

    // =========================================================================
    // MANEJO DE FOTO (WEBCAM O ARCHIVO LOCAL)
    // =========================================================================
    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) setCapturedImage(imageSrc);
    }, [webcamRef]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setCapturedImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const triggerFileUpload = () => fileInputRef.current?.click();
    const retake = () => setCapturedImage(null);

    // =========================================================================
    // PROCESO DE GUARDADO
    // =========================================================================
    const handleFinalSubmit = async () => {
        if (!formData.full_name || !formData.identifier) {
            return toast.error("Completá nombre y DNI del alumno.");
        }
        if (!orgData?.id) return;

        // --- BLINDAJE DE DATOS (REGEX) ---
        const nameRegex = /^[a-zA-ZÀ-ÿ\s']+$/; // Permite tildes, espacios y apóstrofes
        const phoneRegex = /^[0-9+\-\s()]+$/;

        if (!nameRegex.test(formData.full_name.trim())) {
            return toast.error('El nombre solo puede contener letras y espacios.');
        }
        if (formData.phone && !phoneRegex.test(formData.phone.trim())) {
            return toast.error('El teléfono contiene caracteres inválidos.');
        }

        setLoading(true);

        try {
            const orgId = orgData.id;

            // PASO 1: Validar DNI único en la sucursal
            const { data: existingPerson } = await supabase
                .from('crm_people')
                .select('id')
                .eq('organization_id', orgId)
                .eq('identifier', formData.identifier.trim())
                .maybeSingle();

            if (existingPerson) {
                setLoading(false);
                return toast.error(`Ya existe un alumno con el DNI ${formData.identifier}.`);
            }

            // PASO 2: Subir foto a Cloudinary (Si hay)
            let photoUrl = null;
            if (capturedImage) {
                const res = await fetch(capturedImage);
                const blob = await res.blob();
                const file = new File([blob], `gym_photo_${formData.identifier}.jpg`, { type: "image/jpeg" });
                toast.loading('Subiendo foto del alumno...');
                photoUrl = await uploadToCloudinary(file);
                toast.dismiss();
            }

            // PASO 3: Preparar el objeto JSON del Plan Activo
            let activePlansArray = [];
            let selectedPlan = null;

            if (selectedPlanId) {
                selectedPlan = plans.find(p => p.id === selectedPlanId);
                if (selectedPlan) {
                    const planProps = selectedPlan.properties || {};
                    const isClasses = planProps.plan_mode === 'classes';

                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);

                    activePlansArray.push({
                        plan_id: selectedPlan.id,
                        name: selectedPlan.name,
                        mode: planProps.plan_mode || 'monthly',
                        schedule: planProps.schedule || 'free',
                        remaining_classes: isClasses ? (planProps.class_count || 12) : null,
                        expires_at: expiresAt.toISOString()
                    });
                }
            }

            // PASO 4: Guardar al Alumno en CRM
            const { data: newPerson, error: personError } = await supabase
                .from('crm_people')
                .insert([{
                    organization_id: orgId,
                    full_name: formData.full_name.trim(),
                    identifier: formData.identifier.trim(),
                    phone: formData.phone.trim(),
                    type: 'client',
                    portal_password: formData.identifier.trim(),
                    details: {
                        photo_url: photoUrl,
                        registered_at: new Date().toISOString(),
                        active_plans: activePlansArray
                    }
                }])
                .select('id')
                .single();

            if (personError) throw personError;

            // PASO 5: Generar la deuda SÓLO si eligió un plan
            if (selectedPlan) {
                try {
                    const { data: operation, error: opError } = await supabase
                        .from('operations')
                        .insert([{
                            organization_id: orgId,
                            person_id: newPerson.id,
                            status: 'pending',
                            total_amount: Number(selectedPlan.price),
                            balance: Number(selectedPlan.price),
                            metadata: { concept: `Inscripción: ${selectedPlan.name}` }
                        }])
                        .select('id')
                        .single();

                    if (opError) throw opError;

                    // Detalle de la factura (Operation Line)
                    const { error: lineError } = await supabase
                        .from('operation_lines')
                        .insert([{
                            organization_id: orgId,
                            operation_id: operation.id,
                            item_id: selectedPlan.id,
                            quantity: 1,
                            unit_price: Number(selectedPlan.price)
                        }]);

                    if (lineError) throw lineError;

                } catch (innerError) {
                    // Mecanismo de Seguridad: Si la generación de deuda falla, eliminamos al usuario para no dejar "fantasmas"
                    await supabase.from('crm_people').delete().eq('id', newPerson.id);
                    throw innerError;
                }
                toast.success('¡Alumno inscripto con éxito! Pasá por la caja para cobrarle.');
            } else {
                toast.success('Alumno registrado correctamente (Sin plan asignado).');
            }

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error al registrar al alumno.');
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // RENDER DEL MODAL (Multi-Paso)
    // =========================================================================
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all">

                                {/* HEADER COMPARTIDO */}
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <div className="p-2 bg-brand-100 rounded-xl"><User className="w-5 h-5 text-brand-600" /></div>
                                        Inscribir Nuevo Alumno
                                    </h2>
                                    <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto max-h-[75vh]">

                                    {/* --- PASO 1: FOTO Y DATOS --- */}
                                    {step === 1 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-300">

                                            <div className="space-y-5">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">DNI (Obligatorio para Check-in) *</label>
                                                    <input
                                                        autoFocus
                                                        required type="text"
                                                        placeholder="Ej: 35123456"
                                                        className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-slate-800"
                                                        value={formData.identifier}
                                                        onChange={(e) => {
                                                            const soloNumeros = e.target.value.replace(/\D/g, '');
                                                            setFormData({ ...formData, identifier: soloNumeros });
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre Completo *</label>
                                                    <input
                                                        required type="text"
                                                        placeholder="Ej: Martín Palermo"
                                                        className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-slate-800"
                                                        value={formData.full_name}
                                                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Teléfono o WhatsApp (Opcional)</label>
                                                    <input
                                                        type="tel"
                                                        placeholder="Ej: 3704123456"
                                                        className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-medium text-slate-800 text-sm"
                                                        value={formData.phone}
                                                        onChange={e => {
                                                            const soloNumeros = e.target.value.replace(/\D/g, '');
                                                            setFormData({ ...formData, phone: soloNumeros })}}
                                                    />
                                                </div>
                                            </div>

                                            {/* Manejo de Cámara */}
                                            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4 relative h-full min-h-[250px]">
                                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

                                                {!capturedImage ? (
                                                    <div className="w-full h-full max-w-[250px] overflow-hidden rounded-2xl shadow-inner bg-black relative group">
                                                        <Webcam
                                                            audio={false}
                                                            ref={webcamRef}
                                                            screenshotFormat="image/jpeg"
                                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            videoConstraints={{ facingMode: "user", aspectRatio: 1 }}
                                                        />
                                                        <button onClick={capture} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-600 hover:bg-brand-500 text-white p-3.5 rounded-full shadow-xl transition-transform hover:scale-110 active:scale-95 z-20" title="Tomar foto con webcam">
                                                            <Camera className="w-6 h-6" />
                                                        </button>
                                                        <button onClick={triggerFileUpload} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2.5 rounded-full backdrop-blur-sm transition-all z-20" title="Subir archivo manual">
                                                            <Upload className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full max-w-[250px] relative group rounded-2xl overflow-hidden shadow-md border border-slate-200">
                                                        <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                            <button onClick={retake} className="bg-white text-slate-900 px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-all shadow-xl hover:scale-105 active:scale-95">
                                                                <RefreshCw className="w-4 h-4" /> Reintentar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-widest">Foto del Perfil</p>
                                            </div>

                                            <div className="md:col-span-2 pt-4 border-t border-slate-100">
                                                <button
                                                    onClick={() => setStep(2)}
                                                    disabled={!formData.full_name || !formData.identifier}
                                                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/20 active:scale-95"
                                                >
                                                    Continuar a Selección de Plan <ArrowRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* --- PASO 2: ELEGIR PLAN (OPCIONAL) --- */}
                                    {step === 2 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                            {plans.length === 0 ? (
                                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                    <p className="text-slate-500 font-bold mb-2">No hay planes activos disponibles.</p>
                                                    <p className="text-sm text-slate-400 font-medium">Creá suscripciones desde la sección de Catálogo.</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm font-medium mb-4 shadow-sm border border-blue-100">
                                                        Seleccionar un plan generará una deuda automática para que el alumno pague en Caja. <b>Si no seleccionás ninguno, el alumno se guardará igual</b>.
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                                        {/* OPCIÓN: SIN PLAN */}
                                                        <label className={`relative flex flex-col p-6 cursor-pointer rounded-2xl border-2 transition-all ${selectedPlanId === null ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-slate-200 hover:border-brand-300 bg-white'}`}>
                                                            <input type="radio" className="sr-only" value="" checked={selectedPlanId === null} onChange={() => setSelectedPlanId(null)} />
                                                            <span className="font-bold text-slate-800 text-lg mb-1 pr-8">Registrar sin Plan</span>
                                                            <span className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Guardar al alumno en la base de datos sin generarle deudas. Ideal para inscripciones anticipadas o pruebas gratuitas.</span>
                                                            {selectedPlanId === null && (
                                                                <div className="absolute top-5 right-5 text-brand-600 animate-in zoom-in"><CheckCircle className="w-6 h-6" /></div>
                                                            )}
                                                        </label>

                                                        {/* PLANES ACTIVOS */}
                                                        {plans.map((plan) => (
                                                            <label key={plan.id} className={`relative flex flex-col p-6 cursor-pointer rounded-2xl border-2 transition-all ${selectedPlanId === plan.id ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-slate-200 hover:border-brand-300 bg-white'}`}>
                                                                <input type="radio" className="sr-only" value={plan.id} checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} />
                                                                <span className="font-bold text-slate-800 text-lg mb-1 pr-8">{plan.name}</span>
                                                                <span className="text-2xl font-black text-emerald-600">${plan.price.toLocaleString()}</span>

                                                                <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-500 flex flex-col gap-1.5 font-bold uppercase tracking-wider">
                                                                    {plan.properties?.plan_mode === 'classes' ? <span>• Paquete de {plan.properties.class_count} clases</span> : <span>• Acceso Libre Mensual</span>}
                                                                </div>

                                                                {selectedPlanId === plan.id && (
                                                                    <div className="absolute top-5 right-5 text-brand-600 animate-in zoom-in"><CheckCircle className="w-6 h-6" /></div>
                                                                )}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </>
                                            )}

                                            <div className="flex gap-3 pt-6 border-t border-slate-100">
                                                <button onClick={() => setStep(1)} disabled={loading} className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50">
                                                    Atrás
                                                </button>
                                                <button
                                                    onClick={handleFinalSubmit}
                                                    disabled={loading}
                                                    className="flex-1 bg-brand-600 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-brand-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20 active:scale-95"
                                                >
                                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                                    {selectedPlanId ? 'Guardar e Inscribir' : 'Guardar Alumno'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}