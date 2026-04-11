import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { X, DollarSign, Wallet, CreditCard, Landmark, Loader2, Receipt } from 'lucide-react';
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
    const [paymentMethod, setPaymentMethod] = useState('cash'); 

    if (!isOpen || !appointment) return null;

    const price = appointment.catalog_items?.price || 0;
    const clientName = appointment.crm_people?.full_name || 'Cliente Ocasional';
    const serviceName = appointment.catalog_items?.name || 'Servicio General';

    const handleCheckout = async () => {
        if (!orgData?.id) return toast.error("Error de sesión. Recarga la página.");
        setLoading(true);

        try {
            // 1. Creamos la Cabecera del Ticket (Operación)
            const { data: opData, error: opError } = await supabase
                .from('operations')
                .insert([{
                    organization_id: orgData.id,
                    person_id: appointment.person_id,
                    total_amount: price,
                    status: 'paid'
                }])
                .select('id')
                .single();

            if (opError) throw opError;

            // 2. Creamos la Línea del Ticket (El detalle)
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

            // 3. Registramos la entrada de dinero en la Caja Diaria (Finanzas)
            const { error: financeError } = await supabase
                .from('finance_ledger')
                .insert([{
                    organization_id: orgData.id,
                    operation_id: opData.id,
                    person_id: appointment.person_id,
                    type: 'income',
                    amount: price,
                    payment_method: paymentMethod,
                    notes: `Cobro de turno: ${serviceName}`
                }]);

            if (financeError) throw financeError;

            // 4. Actualizamos el Turno: Se lo marca como Atendido y se le vincula el Ticket
            const { error: appError } = await supabase
                .from('appointments')
                .update({ 
                    status: 'attended',
                    operation_id: opData.id 
                })
                .eq('id', appointment.id)
                .eq('organization_id', orgData.id); // Blindaje

            if (appError) throw appError;

            toast.success('¡Cobro registrado con éxito en la caja!');
            onSuccess(); 

        } catch (error) {
            console.error("Error en el checkout:", error);
            toast.error('Hubo un problema al procesar el cobro.');
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // RENDER DEL MODAL (Headless UI)
    // =========================================================================
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-[100dvh] md:min-h-full items-end md:items-center justify-center p-0 md:p-4">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-300">
                            
                            {/* HEADER */}
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0 shadow-sm">
                                <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><Receipt className="w-5 h-5" /></div>
                                    Cobrar Turno
                                </Dialog.Title>
                                <button onClick={onClose} disabled={loading} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* BODY */}
                            <div className="p-6 md:p-8 space-y-6">
                                
                                {/* Resumen del Ticket */}
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
                                        <span className="text-3xl text-emerald-600 font-black tracking-tight">${price.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Métodos de Pago */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Método de Pago *</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button disabled={loading} onClick={() => setPaymentMethod('cash')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm scale-105' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                            <Wallet className="w-6 h-6" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Efectivo</span>
                                        </button>
                                        <button disabled={loading} onClick={() => setPaymentMethod('card')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm scale-105' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                            <CreditCard className="w-6 h-6" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Tarjeta</span>
                                        </button>
                                        <button disabled={loading} onClick={() => setPaymentMethod('transfer')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:opacity-50 ${paymentMethod === 'transfer' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm scale-105' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                                            <Landmark className="w-6 h-6" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-center">Transf.</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex gap-3">
                                <button onClick={onClose} disabled={loading} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 hidden sm:block">
                                    Cancelar
                                </button>
                                <button onClick={handleCheckout} disabled={loading} className="flex-[2] py-4 rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50 active:scale-95 text-lg">
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