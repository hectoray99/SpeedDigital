import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, CheckCircle, Store } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    studentId: string | null;
    studentName: string;
}

interface Product {
    id: string;
    name: string;
    price: number; // Ahora es 'price'
    type: string;
}

export default function EnrollModal({ isOpen, onClose, studentId, studentName }: Props) {
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
        // Buscamos items que sean de tipo 'subscription' o 'service' en el catálogo nuevo
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
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user?.id)
                .single();

            if (!profile) throw new Error('Error de permisos');

            // Buscamos el precio del producto seleccionado
            const product = products.find(p => p.id === selectedProductId);
            if (!product) throw new Error('Producto no encontrado');

            // 1. Creamos la Operación (Venta)
            const { data: op, error: opError } = await supabase
                .from('operations')
                .insert({
                    organization_id: profile.organization_id,
                    person_id: studentId,
                    status: 'pending', // Queda como deuda a pagar
                    total_amount: product.price,
                    balance: product.price,
                    metadata: { concept: `Inscripción: ${product.name}` }
                })
                .select()
                .single();

            if (opError) throw opError;

            // 2. Creamos la Línea de Detalle
            await supabase.from('operation_lines').insert({
                organization_id: profile.organization_id,
                operation_id: op.id,
                item_id: product.id,
                quantity: 1,
                unit_price: product.price
            });

            toast.success(`¡${studentName} inscripto correctamente! Se generó el cargo.`);
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error('Error al inscribir: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Store className="w-5 h-5 text-brand-600" />
                            Nueva Inscripción
                        </h2>
                        <p className="text-xs text-slate-500">Alumno: <span className="font-semibold text-brand-600">{studentName}</span></p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Seleccioná un Plan</label>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {products.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No hay planes activos en el catálogo.</p>
                            ) : (
                                products.map((product) => (
                                    <label
                                        key={product.id}
                                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedProductId === product.id
                                            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                                            : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="product"
                                                value={product.id}
                                                checked={selectedProductId === product.id}
                                                onChange={(e) => setSelectedProductId(e.target.value)}
                                                className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                                            />
                                            <div>
                                                <div className="font-medium text-slate-900">{product.name}</div>
                                                <div className="text-xs text-slate-500 capitalize">{product.type === 'subscription' ? 'Suscripción' : 'Servicio'}</div>
                                            </div>
                                        </div>
                                        <div className="font-bold text-slate-700">
                                            ${product.price.toLocaleString()}
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleEnroll}
                        disabled={loading || !selectedProductId}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Confirmar Inscripción
                    </button>
                </div>
            </div>
        </div>
    );
}