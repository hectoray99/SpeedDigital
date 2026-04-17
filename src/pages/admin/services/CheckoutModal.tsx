import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { X, DollarSign, Wallet, CreditCard, Landmark, Loader2, Receipt, MailCheck } from 'lucide-react';
import { toast } from 'sonner';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    appointment: any;
}

export default function CheckoutModal({ isOpen, onClose, onSuccess, appointment }: CheckoutModalProps) {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(false);
    
    const price = appointment?.catalog_items?.price || 0;
    const clientName = appointment?.crm_people?.full_name || 'Cliente Ocasional';
    const clientEmail = appointment?.crm_people?.email || null;
    const serviceName = appointment?.catalog_items?.name || 'Servicio General';
    const autoEmailActive = orgData?.settings?.auto_email_receipts === true;

    // --- LÓGICA DE PAGO DIVIDIDO ---
    const [payments, setPayments] = useState<{ [key: string]: number }>({
        cash: 0,
        card: 0,
        transfer: 0
    });

    useEffect(() => {
        if (isOpen) {
            setPayments({ cash: price, card: 0, transfer: 0 });
        }
    }, [isOpen, price]);

    const handlePaymentChange = (method: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setPayments(prev => ({ ...prev, [method]: numValue }));
    };

    const totalPaid = Object.values(payments).reduce((acc, val) => acc + val, 0);
    const balanceRemaining = price - totalPaid;
    const isPaymentExact = totalPaid === price;

    const handleCheckout = async () => {
        if (!orgData?.id) return toast.error("Error de sesión. Recarga la página.");
        if (!isPaymentExact) return toast.error("El monto ingresado debe ser igual al total.");
        
        setLoading(true);

        try {
            const { data: opData, error: opError } = await supabase
                .from('operations')
                .insert([{
                    organization_id: orgData.id,
                    person_id: appointment.person_id,
                    status: 'paid'
                }])
                .select('id')
                .single();

            if (opError) throw opError;

            const { error: lineError } = await supabase
                .from('operation_lines')
                .insert([{
                    organization_id: orgData.id,
                    operation_id: opData.id,
                    item_id: appointment.catalog_items?.id,
                    quantity: 1,
                    unit_price: price,
                }]);

            if (lineError) throw lineError;

            const activePayments = Object.entries(payments).filter(([_, amount]) => amount > 0);
            
            const financePromises = activePayments.map(([method, amount]) => {
                return supabase.from('finance_ledger').insert([{
                    organization_id: orgData.id,
                    operation_id: opData.id,
                    person_id: appointment.person_id,
                    type: 'income',
                    amount: amount,
                    payment_method: method,
                    notes: `Cobro de turno: ${serviceName} (${method})`
                }]);
            });

            await Promise.all(financePromises);

            const { error: appError } = await supabase
                .from('appointments')
                .update({ 
                    status: 'attended',
                    operation_id: opData.id 
                })
                .eq('id', appointment.id)
                .eq('organization_id', orgData.id);

            if (appError) throw appError;

            toast.success('¡Cobro registrado con éxito en la caja!');

            // ======================================================
            // DISPARADOR DE CORREOS (Edge Function)
            // ======================================================
            if (autoEmailActive && clientEmail) {
                try {
                    // Aquí llamamos a la Edge Function alojada en Supabase que usa Resend
                    await supabase.functions.invoke('send-receipt', {
                        body: { operationId: opData.id, emailTo: clientEmail }
                    });
                    toast.success(`Recibo enviado automáticamente a ${clientEmail}`);
                } catch (emailErr) {
                    console.error("Error enviando correo:", emailErr);
                    toast.error("Cobro registrado, pero falló el envío automático del correo.");
                }
            }

            onSuccess(); 

        } catch (error) {
            console.error("Error en el checkout:", error);
            toast.error('Hubo un problema al procesar el cobro.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !appointment) return null;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-[100dvh] md:min-h-full items-end md:items-center justify-center p-0 md:p-4">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-300">
                            
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0 shadow-sm">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><Receipt className="w-5 h-5" /></div>
                                    Cobrar Turno
                                </Dialog.Title>
                                <button onClick={onClose} disabled={loading} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="p-6 md:p-8 space-y-6">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-bold">Cliente:</span>
                                        <span className="text-slate-800 font-black">{clientName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-bold">Servicio:</span>
                                        <span className="text-slate-800 font-black">{serviceName}</span>
                                    </div>
                                    <div className="pt-4 mt-2 border-t border-slate-200 flex justify-between items-end">
                                        <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Total a cobrar:</span>
                                        <span className="text-3xl text-slate-800 font-black tracking-tight">${price.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Indicador de Envío Automático */}
                                {autoEmailActive && clientEmail && (
                                    <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 rounded-xl flex items-start gap-3 shadow-sm">
                                        <MailCheck className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                                        <p className="text-xs font-bold leading-tight mt-0.5">
                                            Al confirmar el cobro, se enviará el recibo en formato PDF a <span className="underline">{clientEmail}</span>
                                        </p>
                                    </div>
                                )}
                                {autoEmailActive && !clientEmail && (
                                    <div className="bg-slate-50 border border-slate-200 text-slate-500 px-4 py-3 rounded-xl flex items-start gap-3 shadow-sm">
                                        <MailCheck className="w-5 h-5 shrink-0 mt-0.5 opacity-50" />
                                        <p className="text-xs font-bold leading-tight mt-0.5">
                                            El cliente no tiene un email registrado, no se enviará comprobante automático.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">¿Cómo abona?</label>
                                        <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-md ${balanceRemaining === 0 ? 'bg-emerald-100 text-emerald-600' : balanceRemaining > 0 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                            {balanceRemaining === 0 ? 'COMPLETO' : balanceRemaining > 0 ? `FALTA $${balanceRemaining}` : `SOBRA $${Math.abs(balanceRemaining)}`}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${payments.cash > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white'}`}>
                                            <div className="flex items-center gap-3">
                                                <Wallet className={`w-6 h-6 ${payments.cash > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
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

                                        <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${payments.transfer > 0 ? 'border-sky-500 bg-sky-50' : 'border-slate-100 bg-white'}`}>
                                            <div className="flex items-center gap-3">
                                                <Landmark className={`w-6 h-6 ${payments.transfer > 0 ? 'text-sky-600' : 'text-slate-400'}`} />
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
                            </div>

                            <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex gap-3">
                                <button onClick={onClose} disabled={loading} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 hidden sm:block">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCheckout} 
                                    disabled={loading || !isPaymentExact} 
                                    className="flex-[2] py-4 rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:shadow-none active:scale-95 text-lg"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                                    Registrar Pago
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}