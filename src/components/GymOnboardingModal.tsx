import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Camera, Save, RefreshCw, User, CheckCircle, Upload } from 'lucide-react';
import Webcam from 'react-webcam';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import { useAuthStore } from '../store/authStore'; // <-- EL CEREBRO OPTIMIZADO
import { toast } from 'sonner';

// Definimos los props correctamente para que Students.tsx no tire error
export interface GymOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
}

interface Product {
    id: string;
    name: string;
    price: number;
    properties: any;
}

export default function GymOnboardingModal({ isOpen, onClose, onSuccess }: GymOnboardingModalProps) {
    const { orgData } = useAuthStore(); // Usamos la memoria global

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        full_name: '',
        identifier: '',
        phone: ''
    });

    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const [plans, setPlans] = useState<Product[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFormData({ full_name: '', identifier: '', phone: '' });
            setCapturedImage(null);
            setSelectedPlanId('');
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
                .order('price');

            if (error) throw error;
            setPlans(data || []);
        } catch (error) {
            console.error("Error fetching plans:", error);
            toast.error("Error al cargar los planes.");
        }
    }

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) setCapturedImage(imageSrc);
    }, [webcamRef]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const retake = () => {
        setCapturedImage(null);
    };

    const handleFinalSubmit = async () => {
        if (!formData.full_name || !formData.identifier || !selectedPlanId) {
            toast.error("Completá todos los datos y seleccioná un plan.");
            return;
        }

        if (!orgData?.id) return; // Validación de seguridad

        setLoading(true);

        try {
            const orgId = orgData.id;

            // 1. Verificar si ya existe
            const { data: existingPerson } = await supabase
                .from('crm_people')
                .select('id')
                .eq('organization_id', orgId)
                .eq('identifier', formData.identifier)
                .maybeSingle();

            if (existingPerson) {
                toast.error(`Ya existe un alumno con el DNI ${formData.identifier}.`);
                setLoading(false);
                return;
            }

            // 2. Subir Foto
            let photoUrl = null;
            if (capturedImage) {
                const res = await fetch(capturedImage);
                const blob = await res.blob();
                const file = new File([blob], `gym_photo_${formData.identifier}.jpg`, { type: "image/jpeg" });
                toast.loading('Subiendo foto...');
                photoUrl = await uploadToCloudinary(file);
                toast.dismiss();
            }

            // 3. Preparar el Plan
            const selectedPlan = plans.find(p => p.id === selectedPlanId);
            if (!selectedPlan) throw new Error("El plan seleccionado no es válido.");

            const planProps = selectedPlan.properties || {};
            const isClasses = planProps.plan_mode === 'classes';

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

            // 4. Crear Alumno
            const { data: newPerson, error: personError } = await supabase
                .from('crm_people')
                .insert([{
                    organization_id: orgId,
                    full_name: formData.full_name,
                    identifier: formData.identifier,
                    phone: formData.phone,
                    type: 'client',
                    portal_password: formData.identifier,
                    details: {
                        photo_url: photoUrl,
                        registered_at: new Date().toISOString(),
                        active_plans: [activePlanData]
                    }
                }])
                .select('id')
                .single();

            if (personError) throw personError;

            // 5. Crear Deuda Operativa
            try {
                const { data: operation, error: opError } = await supabase
                    .from('operations')
                    .insert([{
                        organization_id: orgId,
                        person_id: newPerson.id,
                        status: 'pending',
                        total_amount: selectedPlan.price,
                        balance: selectedPlan.price,
                        metadata: { concept: `Inscripción: ${selectedPlan.name}` }
                    }])
                    .select('id')
                    .single();

                if (opError) throw opError;

                const { error: lineError } = await supabase
                    .from('operation_lines')
                    .insert([{
                        organization_id: orgId,
                        operation_id: operation.id,
                        item_id: selectedPlan.id,
                        quantity: 1,
                        unit_price: selectedPlan.price
                    }]);

                if (lineError) throw lineError;

            } catch (innerError) {
                // Rollback manual si falla la operación
                await supabase.from('crm_people').delete().eq('id', newPerson.id);
                throw innerError;
            }

            toast.success('¡Alumno registrado con éxito!');
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error al registrar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-2xl transition-all">

                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <User className="w-6 h-6 text-brand-600" />
                                        Nuevo Alumno
                                    </h2>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6">
                                    {step === 1 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-1">DNI (Documento)</label>
                                                    <input
                                                        required type="text"
                                                        placeholder="Obligatorio para asistencia..."
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                                                        value={formData.identifier}
                                                        onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo</label>
                                                    <input
                                                        required type="text"
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                                                        value={formData.full_name}
                                                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono (Opcional)</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                                                        value={formData.phone}
                                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-4 relative">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileUpload}
                                                    accept="image/*"
                                                    className="hidden"
                                                />
                                                {!capturedImage ? (
                                                    <div className="w-full aspect-square max-w-[250px] overflow-hidden rounded-lg shadow-inner bg-black relative group">
                                                        <Webcam
                                                            audio={false}
                                                            ref={webcamRef}
                                                            screenshotFormat="image/jpeg"
                                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            videoConstraints={{ facingMode: "user", aspectRatio: 1 }}
                                                        />
                                                        <button
                                                            onClick={capture}
                                                            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-600 hover:bg-brand-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 z-20"
                                                            title="Tomar foto con webcam"
                                                        >
                                                            <Camera className="w-6 h-6" />
                                                        </button>
                                                        <button
                                                            onClick={triggerFileUpload}
                                                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all z-20"
                                                            title="Subir foto desde archivo"
                                                        >
                                                            <Upload className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full aspect-square max-w-[250px] relative group rounded-lg overflow-hidden shadow-md">
                                                        <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <button onClick={retake} className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-100">
                                                                <RefreshCw className="w-4 h-4" /> Reintentar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                <p className="text-xs font-medium text-slate-400 mt-4 text-center">
                                                    Usá la webcam o subí una foto.
                                                </p>
                                            </div>

                                            <div className="md:col-span-2 pt-4">
                                                <button
                                                    onClick={() => setStep(2)}
                                                    disabled={!formData.full_name || !formData.identifier || !capturedImage}
                                                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-50"
                                                >
                                                    Siguiente: Elegir Plan
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="space-y-6">
                                            {plans.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <p className="text-slate-500 mb-4">No hay planes activos disponibles.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-1">
                                                    {plans.map((plan) => (
                                                        <label
                                                            key={plan.id}
                                                            className={`relative flex flex-col p-5 cursor-pointer rounded-xl border-2 transition-all ${selectedPlanId === plan.id
                                                                ? 'border-brand-500 bg-brand-50 shadow-md'
                                                                : 'border-slate-200 hover:border-brand-300 bg-white'
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="plan"
                                                                className="sr-only"
                                                                value={plan.id}
                                                                checked={selectedPlanId === plan.id}
                                                                onChange={() => setSelectedPlanId(plan.id)}
                                                            />
                                                            <span className="font-bold text-slate-800 text-lg mb-1">{plan.name}</span>
                                                            <span className="text-2xl font-black text-brand-600">${plan.price.toLocaleString()}</span>

                                                            <div className="mt-2 text-xs text-slate-500 flex flex-col gap-1">
                                                                {plan.properties?.plan_mode === 'classes' ? (
                                                                    <span>• Paquete de {plan.properties.class_count} clases</span>
                                                                ) : (
                                                                    <span>• Mensualidad libre</span>
                                                                )}
                                                                {plan.properties?.schedule && plan.properties.schedule !== 'free' && (
                                                                    <span className="capitalize">• Turno: {
                                                                        plan.properties.schedule === 'morning' ? 'Mañana' :
                                                                            plan.properties.schedule === 'afternoon' ? 'Tarde' : 'Noche'
                                                                    }</span>
                                                                )}
                                                            </div>

                                                            {selectedPlanId === plan.id && (
                                                                <div className="absolute top-4 right-4 text-brand-600">
                                                                    <CheckCircle className="w-6 h-6" />
                                                                </div>
                                                            )}
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex gap-4 pt-4 border-t border-slate-100">
                                                <button
                                                    onClick={() => setStep(1)}
                                                    className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                                >
                                                    Atrás
                                                </button>
                                                <button
                                                    onClick={handleFinalSubmit}
                                                    disabled={loading}
                                                    className="flex-1 bg-brand-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-colors disabled:opacity-50"
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