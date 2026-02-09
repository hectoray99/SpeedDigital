import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary'; // <--- Importamos tu servicio
import { X, Loader2, DollarSign, Wallet, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    // Adaptado a la estructura de 'operations'
    receivable: {
        id: string;
        balance: number;
        person_id?: string;
        metadata?: any
    } | null;
}

export default function RegisterPaymentModal({ isOpen, onClose, onSuccess, receivable }: Props) {
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen || !receivable) return null;

    // Recuperamos el concepto del metadata o ponemos uno genérico
    const conceptDisplay = receivable.metadata?.concept || 'Deuda Pendiente';

    const handlePayment = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user?.id)
                .single();

            if (!profile) throw new Error('Error de sesión');

            let proofUrl = null;

            // 1. Subir a CLOUDINARY (Si hay archivo)
            if (file) {
                // Usamos tu servicio existente
                proofUrl = await uploadToCloudinary(file);

                if (!proofUrl) throw new Error('Error al subir la imagen a Cloudinary');
            }

            // 2. Registrar Ingreso en CAJA (finance_ledger)
            const { error: ledgerError } = await supabase.from('finance_ledger').insert({
                organization_id: profile.organization_id,
                operation_id: receivable.id,
                person_id: receivable.person_id,
                type: 'income',
                amount: receivable.balance, // Asumimos pago total
                payment_method: paymentMethod,
                proof_url: proofUrl, // <--- Guardamos la URL de Cloudinary
                processed_at: new Date()
            });

            if (ledgerError) throw ledgerError;

            // 3. Actualizar OPERACIÓN (Marcar como pagada)
            const { error: updateError } = await supabase
                .from('operations')
                .update({
                    status: 'paid',
                    balance: 0
                })
                .eq('id', receivable.id);

            if (updateError) throw updateError;

            toast.success('Pago registrado correctamente');
            onSuccess();
            onClose();
            setFile(null);

        } catch (error: any) {
            console.error(error);
            toast.error('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">

                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-emerald-600" />
                        Registrar Cobro
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="text-center">
                        <p className="text-slate-500 text-sm mb-1">Vas a cobrar:</p>
                        <h3 className="text-xl font-bold text-slate-800">{conceptDisplay}</h3>
                        <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                            ${receivable.balance?.toLocaleString()}
                        </p>
                    </div>

                    {/* Método de Pago */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-2">Método de Pago</label>
                        <select
                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            <option value="cash">💵 Efectivo</option>
                            <option value="transfer">🏦 Transferencia</option>
                            <option value="mercadopago">📱 MercadoPago</option>
                        </select>
                    </div>

                    {/* Subir Comprobante */}
                    {paymentMethod !== 'cash' && (
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-2">Comprobante (Opcional)</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,.pdf"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setFile(e.target.files[0]);
                                    }
                                }}
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all ${file ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 hover:border-emerald-400 text-slate-500'
                                    }`}
                            >
                                {file ? (
                                    <>
                                        <FileText className="w-5 h-5" />
                                        <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1 hover:bg-red-100 rounded-full text-red-500">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        <span className="text-sm font-medium">Subir foto o PDF</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                        Confirmar Cobro
                    </button>
                </div>
            </div>
        </div>
    );
}