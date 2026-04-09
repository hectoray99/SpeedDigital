import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, CheckCircle, Store, Hash, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    studentId: string | null;
    studentName: string;
    onSuccess?: () => void;
}

interface Product {
    id: string;
    name: string;
    price: number;
    type: string;
    properties: any;
}

export default function EnrollModal({ isOpen, onClose, studentId, studentName, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            setSelectedProductId('');
        }
    }, [isOpen]);

    async function fetchProducts() {
        const { data } = await supabase
            .from('catalog_items')
            .select('*')
            .eq('is_active', true)
            .in('type', ['subscription', 'service'])
            .order('name');

        if (data) setProducts(data);
    }

    const handleEnroll = async () => {
        if (!selectedProductId || !studentId) return;
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No auth');

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile) throw new Error('Error de permisos');

            const product = products.find(p => p.id === selectedProductId);
            if (!product) throw new Error('Producto no encontrado');

            // --- 1. PREPARAR EL NUEVO PLAN ---
            const planProps = product.properties || {};
            const isClasses = planProps.plan_mode === 'classes';

            // Vencimiento (30 días por defecto)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            const newActivePlan = {
                plan_id: product.id,
                name: product.name,
                mode: planProps.plan_mode || 'monthly',
                schedule: planProps.schedule || 'free',
                remaining_classes: isClasses ? (planProps.class_count || 12) : null,
                expires_at: expiresAt.toISOString()
            };

            // --- 2. TRAER DATOS ACTUALES DEL ALUMNO ---
            const { data: person } = await supabase
                .from('crm_people')
                .select('details')
                .eq('id', studentId)
                .single();

            if (!person) throw new Error('Alumno no encontrado');

            let currentPlans = person.details?.active_plans || [];

            // Retrocompatibilidad para alumnos viejos
            if (currentPlans.length === 0 && person.details?.active_plan) {
                currentPlans = [person.details.active_plan];
            }

            currentPlans.push(newActivePlan);

            const updatedDetails = {
                ...person.details,
                active_plans: currentPlans
            };

            // --- 3. ACTUALIZAR AL ALUMNO ---
            const { error: personUpdateError } = await supabase
                .from('crm_people')
                .update({ details: updatedDetails })
                .eq('id', studentId);

            if (personUpdateError) throw personUpdateError;

            // --- 4. GENERAR DEUDA/OPERACIÓN ---
            const { data: op, error: opError } = await supabase
                .from('operations')
                .insert({
                    organization_id: profile.organization_id,
                    person_id: studentId,
                    status: 'pending',
                    total_amount: product.price,
                    balance: product.price,
                    metadata: { concept: `Renovación/Asignación: ${product.name}` }
                })
                .select()
                .single();

            if (opError) throw opError;

            await supabase.from('operation_lines').insert({
                organization_id: profile.organization_id,
                operation_id: op.id,
                item_id: product.id,
                quantity: 1,
                unit_price: product.price
            });

            toast.success(`¡${studentName} inscripto correctamente! Se generó el cargo.`);
            if (onSuccess) onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error('Error al inscribir: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white text-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <div className="p-2 bg-brand-100 rounded-xl"><Store className="w-5 h-5 text-brand-600" /></div>
                                    Asignar Plan
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">Alumno: <span className="font-bold text-brand-600">{studentName}</span></p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 md:p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Seleccioná un Plan Activo</label>
                                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 hide-scrollbar">
                                    {products.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic text-center py-4">No hay planes activos en el catálogo.</p>
                                    ) : (
                                        products.map((product) => (
                                            <label
                                                key={product.id}
                                                className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden group ${selectedProductId === product.id
                                                    ? 'border-brand-500 bg-brand-50 shadow-md'
                                                    : 'border-slate-100 hover:border-brand-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {selectedProductId === product.id && (
                                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500"></div>
                                                )}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="radio"
                                                            name="product"
                                                            value={product.id}
                                                            checked={selectedProductId === product.id}
                                                            onChange={(e) => setSelectedProductId(e.target.value)}
                                                            className="w-4 h-4 mt-1 text-brand-600 border-slate-300 focus:ring-brand-500"
                                                        />
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-lg leading-tight">{product.name}</div>
                                                            <div className="font-black text-brand-600 mt-0.5">
                                                                ${product.price.toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pl-7 flex items-center gap-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {product.properties?.schedule === 'morning' ? 'Mañana' :
                                                            product.properties?.schedule === 'afternoon' ? 'Tarde' :
                                                                product.properties?.schedule === 'night' ? 'Noche' : 'Libre'}
                                                    </span>
                                                    {product.properties?.plan_mode === 'classes' && (
                                                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                                                            <Hash className="w-3.5 h-3.5" />
                                                            {product.properties.class_count} clases
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleEnroll}
                                disabled={loading || !selectedProductId}
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20 active:scale-95 text-lg"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                Asignar y Generar Deuda
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}