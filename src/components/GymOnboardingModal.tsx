// =============================================================================
// GymOnboardingModal.tsx
// Modal especializado para dar de alta alumnos en Gimnasios/Academias.
// Flujo: 1. Datos/Foto -> 2. Elegir Plan -> 3. Inserta Persona + Deuda (Operación)
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
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');

    // =========================================================================
    // INICIALIZACIÓN
    // =========================================================================
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFormData({ full_name: '', identifier: '', phone: '' });
            setCapturedImage(null);
            setSelectedPlanId('');
            fetchPlans();
        }
    }, [isOpen]);

    // Obtener los Planes (Catálogo)
    async function fetchPlans() {
        try {
            const { data, error } = await supabase
                .from('catalog_items')
                .select('id, name, price, properties')
                // Buscamos ítems marcados como suscripción o servicio
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
    // MANEJO DE FOTO (WEBCAM O ARCHIVO)
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
    // PROCESO DE GUARDADO (La Lógica Core)
    // =========================================================================
    const handleFinalSubmit = async () => {
        if (!formData.full_name || !formData.identifier || !selectedPlanId) {
            return toast.error("Completá todos los datos y seleccioná un plan.");
        }
        if (!orgData?.id) return; 

        setLoading(true);

        try {
            const orgId = orgData.id;

            // PASO 1: Validar que el DNI no exista en este negocio
            const { data: existingPerson } = await supabase
                .from('crm_people')
                .select('id')
                .eq('organization_id', orgId)
                .eq('identifier', formData.identifier)
                .maybeSingle();

            if (existingPerson) {
                setLoading(false);
                return toast.error(`Ya existe un alumno con el DNI ${formData.identifier}.`);
            }

            // PASO 2: Subir foto a Cloudinary
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
            const selectedPlan = plans.find(p => p.id === selectedPlanId);
            const planProps = selectedPlan.properties || {};
            const isClasses = planProps.plan_mode === 'classes';
            
            // Setear vencimiento a 30 días (Por defecto para mensualidades)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            const activePlanData = {
                plan_id: selectedPlan.id,
                name: selectedPlan.name,
                mode: planProps.plan_mode || 'monthly',
                schedule: planProps.schedule || 'free',
                remaining_classes: isClasses ? (planProps.class_count || 12) : null,
                expires_at: expiresAt.toISOString()
            };

            // PASO 4: Guardar al Alumno en CRM
            const { data: newPerson, error: personError } = await supabase
                .from('crm_people')
                .insert([{
                    organization_id: orgId,
                    full_name: formData.full_name,
                    identifier: formData.identifier,
                    phone: formData.phone,
                    type: 'client',
                    portal_password: formData.identifier, // Clave por defecto = DNI
                    details: {
                        photo_url: photoUrl,
                        registered_at: new Date().toISOString(),
                        active_plans: [activePlanData] // Guardamos el plan activo adentro del JSON
                    }
                }])
                .select('id')
                .single();

            if (personError) throw personError;

            // PASO 5: Generar la deuda (Operación) para que pase por Caja a pagar
            try {
                const { data: operation, error: opError } = await supabase
                    .from('operations')
                    .insert([{
                        organization_id: orgId,
                        person_id: newPerson.id,
                        status: 'pending', // Deuda pendiente de cobro
                        total_amount: Number(selectedPlan.price),
                        balance: Number(selectedPlan.price), // Debe todo
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
                        // IMPORTANTE: No mandamos 'subtotal' porque la DB lo calcula solo.
                    }]);

                if (lineError) throw lineError;

            } catch (innerError) {
                // Si falla generar la deuda, borramos al alumno para evitar datos corruptos (Rollback manual)
                await supabase.from('crm_people').delete().eq('id', newPerson.id);
                throw innerError;
            }

            toast.success('¡Alumno inscripto con éxito! Pasá por la caja para cobrarle.');
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
    // RENDER DEL MODAL
    // =========================================================================
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all">

                                {/* HEADER */}
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <User className="w-6 h-6 text-brand-600" />
                                        Inscribir Nuevo Alumno
                                    </h2>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto max-h-[75vh]">
                                    
                                    {/* --- PASO 1: FOTO Y DATOS --- */}
                                    {step === 1 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            
                                            {/* Formulario */}
                                            <div className="space-y-5">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-1">DNI (Obligatorio para el Check-in)</label>
                                                    <input
                                                        autoFocus
                                                        required type="number"
                                                        placeholder="Ej: 35123456"
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium"
                                                        value={formData.identifier}
                                                        onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo</label>
                                                    <input
                                                        required type="text"
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium"
                                                        value={formData.full_name}
                                                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono o WhatsApp (Opcional)</label>
                                                    <input
                                                        type="tel"
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-medium"
                                                        value={formData.phone}
                                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {/* Cámara */}
                                            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4 relative h-full min-h-[250px]">
                                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                                
                                                {!capturedImage ? (
                                                    <div className="w-full h-full max-w-[250px] overflow-hidden rounded-xl shadow-inner bg-black relative group">
                                                        <Webcam
                                                            audio={false}
                                                            ref={webcamRef}
                                                            screenshotFormat="image/jpeg"
                                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            videoConstraints={{ facingMode: "user", aspectRatio: 1 }}
                                                        />
                                                        <button
                                                            onClick={capture}
                                                            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-600 hover:bg-brand-700 text-white p-3 rounded-full shadow-xl transition-transform hover:scale-110 active:scale-95 z-20"
                                                            title="Tomar foto con webcam"
                                                        >
                                                            <Camera className="w-6 h-6" />
                                                        </button>
                                                        <button
                                                            onClick={triggerFileUpload}
                                                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all z-20"
                                                            title="Subir archivo"
                                                        >
                                                            <Upload className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full max-w-[250px] relative group rounded-xl overflow-hidden shadow-md border border-slate-200">
                                                        <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button onClick={retake} className="bg-white text-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors shadow-lg">
                                                                <RefreshCw className="w-4 h-4" /> Reintentar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-wider">Foto del Perfil</p>
                                            </div>

                                            <div className="md:col-span-2 pt-4">
                                                <button
                                                    onClick={() => setStep(2)}
                                                    disabled={!formData.full_name || !formData.identifier || !capturedImage}
                                                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20"
                                                >
                                                    Continuar a Selección de Plan <ArrowRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* --- PASO 2: ELEGIR PLAN --- */}
                                    {step === 2 && (
                                        <div className="space-y-6">
                                            {plans.length === 0 ? (
                                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                    <p className="text-slate-500 font-medium mb-2">No hay planes activos disponibles.</p>
                                                    <p className="text-sm text-slate-400">Creá suscripciones desde la sección de Catálogo.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {plans.map((plan) => (
                                                        <label
                                                            key={plan.id}
                                                            className={`relative flex flex-col p-6 cursor-pointer rounded-2xl border-2 transition-all ${
                                                                selectedPlanId === plan.id
                                                                    ? 'border-brand-500 bg-brand-50 shadow-md'
                                                                    : 'border-slate-200 hover:border-brand-300 bg-white'
                                                            }`}
                                                        >
                                                            <input type="radio" className="sr-only" value={plan.id} checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} />
                                                            <span className="font-bold text-slate-800 text-lg mb-1 pr-8">{plan.name}</span>
                                                            <span className="text-2xl font-black text-emerald-600">${plan.price.toLocaleString()}</span>

                                                            <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-500 flex flex-col gap-1.5 font-medium">
                                                                {plan.properties?.plan_mode === 'classes' ? (
                                                                    <span>• Paquete de {plan.properties.class_count} clases</span>
                                                                ) : (
                                                                    <span>• Acceso Libre Mensual</span>
                                                                )}
                                                                {plan.properties?.schedule && plan.properties.schedule !== 'free' && (
                                                                    <span className="capitalize">• Turno: {
                                                                        plan.properties.schedule === 'morning' ? 'Mañana' :
                                                                        plan.properties.schedule === 'afternoon' ? 'Tarde' : 'Noche'
                                                                    }</span>
                                                                )}
                                                            </div>

                                                            {selectedPlanId === plan.id && (
                                                                <div className="absolute top-5 right-5 text-brand-600">
                                                                    <CheckCircle className="w-6 h-6" />
                                                                </div>
                                                            )}
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex gap-3 pt-6 border-t border-slate-100">
                                                <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                                    Atrás
                                                </button>
                                                <button
                                                    onClick={handleFinalSubmit}
                                                    disabled={loading || !selectedPlanId}
                                                    className="flex-1 bg-brand-600 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
                                                >
                                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                                    Guardar e Inscribir
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