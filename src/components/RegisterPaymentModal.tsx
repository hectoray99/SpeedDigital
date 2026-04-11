import { useState, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
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
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Si no hay deuda seleccionada, no tiene sentido renderizar la lógica
    if (!receivable) return null;

    // Leemos el concepto del ticket para mostrarlo en pantalla
    const conceptDisplay = receivable.metadata?.concept || 'Deuda Pendiente';

    const handlePayment = async () => {
        setLoading(true);
        try {
            // 1. Obtener contexto del usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user?.id)
                .single();

            if (!profile) throw new Error('Error de sesión o permisos insuficientes.');

            // 2. Subir comprobante a Cloudinary (Si existe)
            let proofUrl = null;
            if (file) {
                toast.loading('Subiendo comprobante...', { id: 'upload_proof' });
                proofUrl = await uploadToCloudinary(file);
                toast.dismiss('upload_proof');
                if (!proofUrl) throw new Error('Error al guardar la imagen en la nube.');
            }

            // 3. Crear el Ingreso de Caja en la tabla 'finance_ledger'
            const { error: ledgerError } = await supabase.from('finance_ledger').insert({
                organization_id: profile.organization_id,
                operation_id: receivable.id,
                person_id: receivable.person_id,
                type: 'income',
                amount: receivable.balance,
                payment_method: paymentMethod,
                proof_url: proofUrl,
                processed_at: new Date(),
                notes: `Pago de Deuda: ${conceptDisplay}` // Agregamos nota clara para arqueo
            });

            if (ledgerError) throw ledgerError;

            // 4. Actualizar el estado de la Deuda Original ('pending' -> 'paid')
            const { error: updateError } = await supabase
                .from('operations')
                .update({
                    status: 'paid',
                    balance: 0
                })
                .eq('id', receivable.id);

            if (updateError) throw updateError;

            toast.success('¡Cobro registrado y deuda saldada!');
            onSuccess(); // Refresca las listas de deudores en el componente padre
            onClose();
            setFile(null); // Limpiamos el comprobante para la próxima

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error al procesar el pago.');
        } finally {
            setLoading(false);
            toast.dismiss('upload_proof');
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-[100dvh] md:min-h-full items-end md:items-center justify-center p-0 md:p-4">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-300">
                            
                            {/* HEADER */}
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-xl"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                                    Saldar Deuda
                                </Dialog.Title>
                                <button onClick={onClose} disabled={loading} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* BODY (Scrollable) */}
                            <div className="p-6 md:p-8 space-y-6 overflow-y-auto hide-scrollbar">
                                
                                {/* Info Block: Monto a Cobrar */}
                                <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2rem] text-center relative overflow-hidden shadow-xl border border-slate-800 animate-in zoom-in-95 duration-500">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full mix-blend-screen filter blur-[50px] opacity-40 pointer-events-none"></div>
                                    <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest relative z-10">Concepto a cobrar</p>
                                    <h3 className="text-base font-bold text-slate-200 mb-4 relative z-10 px-4">{conceptDisplay}</h3>
                                    <p className="text-5xl font-black text-emerald-400 tracking-tighter relative z-10">
                                        ${receivable.balance?.toLocaleString()}
                                    </p>
                                </div>

                                {/* Selección de Método de Pago */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Método de Pago *</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button disabled={loading} onClick={() => setPaymentMethod('cash')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm scale-105' : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200'}`}>
                                            <Banknote className="w-6 h-6" />
                                            <span className="font-bold text-[10px] uppercase tracking-wider">Efectivo</span>
                                        </button>
                                        <button disabled={loading} onClick={() => setPaymentMethod('card')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm scale-105' : 'border-slate-100 bg-white text-slate-500 hover:border-blue-200'}`}>
                                            <CreditCard className="w-6 h-6" />
                                            <span className="font-bold text-[10px] uppercase tracking-wider">Tarjeta</span>
                                        </button>
                                        <button disabled={loading} onClick={() => setPaymentMethod('mercadopago')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:opacity-50 ${paymentMethod === 'mercadopago' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm scale-105' : 'border-slate-100 bg-white text-slate-500 hover:border-sky-200'}`}>
                                            <SmartphoneNfc className="w-6 h-6" />
                                            <span className="font-bold text-[10px] uppercase tracking-wider text-center leading-none">Transf. <br/> Virtual</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Opcional: Subir Comprobante (Solo para Transferencias o Tarjetas) */}
                                {paymentMethod !== 'cash' && (
                                    <div className="animate-in fade-in slide-in-from-top-4 duration-300">
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

                            {/* FOOTER ACTION */}
                            <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                                <button
                                    onClick={handlePayment}
                                    disabled={loading}
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