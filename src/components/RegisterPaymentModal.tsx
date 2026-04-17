import { useState, useRef, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import { useAuthStore } from '../store/authStore';
import { X, Loader2, DollarSign, Wallet, Upload, FileText, Banknote, CreditCard, SmartphoneNfc } from 'lucide-react';
import { toast } from 'sonner';

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
    const { orgData } = useAuthStore(); 
    
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const price = receivable?.balance || 0;
    const conceptDisplay = receivable?.metadata?.concept || 'Deuda Pendiente';

    // --- LÓGICA DE PAGO DIVIDIDO ---
    const [payments, setPayments] = useState<{ [key: string]: number }>({
        cash: 0,
        card: 0,
        transfer: 0
    });

    useEffect(() => {
        if (isOpen && receivable) {
            setPayments({ cash: price, card: 0, transfer: 0 });
            setFile(null);
        }
    }, [isOpen, price, receivable]);

    const handlePaymentChange = (method: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setPayments(prev => ({ ...prev, [method]: numValue }));
    };

    const totalPaid = Object.values(payments).reduce((acc, val) => acc + val, 0);
    const balanceRemaining = price - totalPaid;
    const isPaymentExact = totalPaid === price;

    const handlePayment = async () => {
        if (!orgData?.id) return toast.error('Error de sesión. Por favor recargá la página.');
        if (!isPaymentExact) return toast.error("El monto ingresado debe ser igual a la deuda.");

        setLoading(true);
        try {
            // 1. Subir comprobante a Cloudinary (Si existe)
            let proofUrl = null;
            if (file) {
                toast.loading('Subiendo comprobante...', { id: 'upload_proof' });
                proofUrl = await uploadToCloudinary(file);
                toast.dismiss('upload_proof');
                if (!proofUrl) throw new Error('Error al guardar la imagen en la nube.');
            }

            // 2. BLOQUEO ANTI-CONCURRENCIA 
            // Intentamos actualizar la operación SOLO si sigue 'pending'
            const { data: updatedOp, error: updateError } = await supabase
                .from('operations')
                .update({
                    status: 'paid'
                    // Ya no mandamos balance: 0, de eso se encarga el Trigger en v2.0
                })
                .eq('id', receivable!.id)
                .eq('organization_id', orgData.id)
                .eq('status', 'pending') 
                .select()
                .maybeSingle();

            if (updateError) throw updateError;

            if (!updatedOp) {
                toast.error('Transacción rechazada: Esta deuda ya fue modificada/saldada desde otra terminal.');
                onSuccess(); 
                onClose();
                return;
            }

            // 3. Registramos los ingresos (Pago Dividido)
            const activePayments = Object.entries(payments).filter(([_, amount]) => amount > 0);
            
            const financePromises = activePayments.map(([method, amount]) => {
                return supabase.from('finance_ledger').insert({
                    organization_id: orgData.id, 
                    operation_id: receivable!.id,
                    person_id: receivable!.person_id,
                    type: 'income',
                    amount: amount,
                    payment_method: method,
                    proof_url: proofUrl, // Attach proof if provided
                    processed_at: new Date(),
                    notes: `Pago de Deuda: ${conceptDisplay} (${method})`
                });
            });

            await Promise.all(financePromises);

            toast.success('¡Cobro registrado y deuda saldada!');
            onSuccess(); 
            onClose();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error al procesar el pago.');
        } finally {
            setLoading(false);
            toast.dismiss('upload_proof');
        }
    };

    if (!isOpen || !receivable) return null;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-[100dvh] md:min-h-full items-end md:items-center justify-center p-0 md:p-4">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-300">
                            
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-xl"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                                    Saldar Deuda
                                </Dialog.Title>
                                <button onClick={onClose} disabled={loading} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="p-6 md:p-8 space-y-6 overflow-y-auto hide-scrollbar">
                                
                                <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2rem] text-center relative overflow-hidden shadow-xl border border-slate-800 animate-in zoom-in-95 duration-500">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full mix-blend-screen filter blur-[50px] opacity-40 pointer-events-none"></div>
                                    <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest relative z-10">Concepto a cobrar</p>
                                    <h3 className="text-base font-bold text-slate-200 mb-4 relative z-10 px-4">{conceptDisplay}</h3>
                                    <p className="text-5xl font-black text-emerald-400 tracking-tighter relative z-10">
                                        ${price.toLocaleString()}
                                    </p>
                                </div>

                                {/* Desglose de Pagos */}
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">¿Cómo abona?</label>
                                        <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-md ${balanceRemaining === 0 ? 'bg-emerald-100 text-emerald-600' : balanceRemaining > 0 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                            {balanceRemaining === 0 ? 'COMPLETO' : balanceRemaining > 0 ? `FALTA $${balanceRemaining}` : `SOBRA $${Math.abs(balanceRemaining)}`}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {/* EFECTIVO */}
                                        <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${payments.cash > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white'}`}>
                                            <div className="flex items-center gap-3">
                                                <Banknote className={`w-6 h-6 ${payments.cash > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                                                <span className={`font-bold text-xs uppercase tracking-wider ${payments.cash > 0 ? 'text-emerald-800' : 'text-slate-500'}`}>Efectivo</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" min="0" step="0.01"
                                                    className="w-24 bg-transparent outline-none text-right font-black text-lg text-slate-800 placeholder-slate-300"
                                                    placeholder="0"
                                                    value={payments.cash || ''}
                                                    onChange={(e) => handlePaymentChange('cash', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* TARJETA */}
                                        <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${payments.card > 0 ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'}`}>
                                            <div className="flex items-center gap-3">
                                                <CreditCard className={`w-6 h-6 ${payments.card > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                                                <span className={`font-bold text-xs uppercase tracking-wider ${payments.card > 0 ? 'text-blue-800' : 'text-slate-500'}`}>Tarjeta</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" min="0" step="0.01"
                                                    className="w-24 bg-transparent outline-none text-right font-black text-lg text-slate-800 placeholder-slate-300"
                                                    placeholder="0"
                                                    value={payments.card || ''}
                                                    onChange={(e) => handlePaymentChange('card', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* TRANSFERENCIA VIRTUAL */}
                                        <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${payments.transfer > 0 ? 'border-sky-500 bg-sky-50' : 'border-slate-100 bg-white'}`}>
                                            <div className="flex items-center gap-3">
                                                <SmartphoneNfc className={`w-6 h-6 ${payments.transfer > 0 ? 'text-sky-600' : 'text-slate-400'}`} />
                                                <span className={`font-bold text-xs uppercase tracking-wider ${payments.transfer > 0 ? 'text-sky-800' : 'text-slate-500'}`}>Transf.</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" min="0" step="0.01"
                                                    className="w-24 bg-transparent outline-none text-right font-black text-lg text-slate-800 placeholder-slate-300"
                                                    placeholder="0"
                                                    value={payments.transfer || ''}
                                                    onChange={(e) => handlePaymentChange('transfer', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Subir Comprobante (Se muestra siempre que no sea SOLO efectivo) */}
                                {payments.cash !== price && (
                                    <div className="animate-in fade-in slide-in-from-top-4 duration-300 pt-2 border-t border-slate-100">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Comprobante (Opcional)</label>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*,.pdf"
                                            disabled={loading}
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setFile(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <button
                                            disabled={loading}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`w-full p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 ${file ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 hover:border-brand-400 text-slate-400 bg-slate-50'}`}
                                        >
                                            {file ? (
                                                <>
                                                    <FileText className="w-8 h-8 text-emerald-600 mb-2" />
                                                    <span className="text-sm font-bold truncate max-w-[200px] text-center">{file.name}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-100 px-3 py-1.5 rounded-lg mt-2 hover:bg-red-200 transition-colors active:scale-95">Quitar archivo</button>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-8 h-8 mb-2 text-slate-300" />
                                                    <span className="text-sm font-bold text-slate-600 text-center">Subir foto o PDF del comprobante</span>
                                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">Máximo 2MB</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                                <button
                                    onClick={handlePayment}
                                    disabled={loading || !isPaymentExact}
                                    className="w-full bg-slate-900 hover:bg-black text-white py-4 md:py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 disabled:opacity-50 disabled:shadow-none text-lg active:scale-95"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <DollarSign className="w-6 h-6" />}
                                    Confirmar y Saldar Deuda
                                </button>
                            </div>

                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}