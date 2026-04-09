import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import { X, Loader2, DollarSign, Wallet, Upload, FileText, Banknote, CreditCard, SmartphoneNfc } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
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

    if (!receivable) return null;

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

            if (file) {
                proofUrl = await uploadToCloudinary(file);
                if (!proofUrl) throw new Error('Error al subir la imagen a Cloudinary');
            }

            const { error: ledgerError } = await supabase.from('finance_ledger').insert({
                organization_id: profile.organization_id,
                operation_id: receivable.id,
                person_id: receivable.person_id,
                type: 'income',
                amount: receivable.balance,
                payment_method: paymentMethod,
                proof_url: proofUrl,
                processed_at: new Date()
            });

            if (ledgerError) throw ledgerError;

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

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[99999] p-0 md:p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        className="bg-white text-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-xl"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                                Registrar Cobro
                            </h2>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 md:p-8 space-y-8 overflow-y-auto">
                            <div className="bg-slate-900 text-white p-6 rounded-3xl text-center relative overflow-hidden shadow-inner border border-slate-800">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500 rounded-full mix-blend-screen filter blur-[40px] opacity-40"></div>
                                <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-widest relative z-10">Concepto a cobrar</p>
                                <h3 className="text-lg font-bold text-slate-200 mb-3 relative z-10">{conceptDisplay}</h3>
                                <p className="text-5xl font-black text-emerald-400 tracking-tight relative z-10">
                                    ${receivable.balance?.toLocaleString()}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Método de Pago</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button onClick={() => setPaymentMethod('cash')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200'}`}>
                                        <Banknote className="w-6 h-6" />
                                        <span className="font-bold text-[11px] uppercase tracking-wide">Efectivo</span>
                                    </button>
                                    <button onClick={() => setPaymentMethod('card')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-blue-200'}`}>
                                        <CreditCard className="w-6 h-6" />
                                        <span className="font-bold text-[11px] uppercase tracking-wide">Tarjeta</span>
                                    </button>
                                    <button onClick={() => setPaymentMethod('mercadopago')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'mercadopago' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-sky-200'}`}>
                                        <SmartphoneNfc className="w-6 h-6" />
                                        <span className="font-bold text-[11px] uppercase tracking-wide text-center">Transfer.</span>
                                    </button>
                                </div>
                            </div>

                            {paymentMethod !== 'cash' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Comprobante (Opcional)</label>
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
                                        className={`w-full p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${file ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 hover:border-brand-400 text-slate-400 bg-slate-50'}`}
                                    >
                                        {file ? (
                                            <>
                                                <FileText className="w-6 h-6 text-emerald-600 mb-1" />
                                                <span className="text-sm font-bold truncate max-w-[200px]">{file.name}</span>
                                                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs font-bold text-red-500 bg-red-100 px-3 py-1 rounded-lg mt-2 hover:bg-red-200 transition-colors">Quitar archivo</button>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-6 h-6 mb-1 text-slate-300" />
                                                <span className="text-sm font-bold text-slate-600">Subir foto o captura (PDF/JPG)</span>
                                                <span className="text-xs font-medium text-slate-400">Máx 2MB</span>
                                            </>
                                        )}
                                    </button>
                                </motion.div>
                            )}

                            <button
                                onClick={handlePayment}
                                disabled={loading}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 disabled:opacity-50 text-lg active:scale-95"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                                Confirmar y Saldar Deuda
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}