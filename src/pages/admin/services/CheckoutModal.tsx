import { useState } from 'react';
import { createPortal } from 'react-dom'; // <-- IMPORTAMOS PORTAL
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
    const clientName = appointment.crm_people?.full_name || 'Cliente sin registrar';
    const serviceName = appointment.catalog_items?.name || 'Servicio';

    const handleCheckout = async () => {
        setLoading(true);
        try {
            // 1. Creamos la Operación
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

            // 2. Creamos la Línea de Operación
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

            // 3. Registramos la plata en Finanzas
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

            // 4. Actualizamos el Turno
            const { error: appError } = await supabase
                .from('appointments')
                .update({ 
                    status: 'attended',
                    operation_id: opData.id 
                })
                .eq('id', appointment.id);

            if (appError) throw appError;

            toast.success('¡Cobro registrado con éxito!');
            onSuccess(); 

        } catch (error) {
            console.error("Error en el checkout:", error);
            toast.error('Hubo un problema al procesar el cobro');
        } finally {
            setLoading(false);
        }
    };

    // EL PORTAL MÁGICO PARA QUE TAPE TODO
    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Receipt className="w-6 h-6 text-brand-500" />
                        Cobrar Turno
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-bold">Cliente:</span>
                            <span className="text-slate-800 font-black">{clientName}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-bold">Servicio:</span>
                            <span className="text-slate-800 font-black">{serviceName}</span>
                        </div>
                        <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Total a cobrar:</span>
                            <span className="text-2xl text-emerald-600 font-black">${price.toLocaleString()}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">Método de Pago</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={() => setPaymentMethod('cash')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                    paymentMethod === 'cash' 
                                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' 
                                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <Wallet className="w-6 h-6" />
                                <span className="text-xs font-bold text-slate-700">Efectivo</span>
                            </button>
                            <button 
                                onClick={() => setPaymentMethod('transfer')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                    paymentMethod === 'transfer' 
                                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' 
                                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <Landmark className="w-6 h-6" />
                                <span className="text-xs font-bold text-slate-700">Transf.</span>
                            </button>
                            <button 
                                onClick={() => setPaymentMethod('card')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                    paymentMethod === 'card' 
                                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' 
                                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <CreditCard className="w-6 h-6" />
                                <span className="text-xs font-bold text-slate-700">Tarjeta</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleCheckout} 
                        disabled={loading} 
                        className="flex-1 py-3 rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                        Cobrar ${price.toLocaleString()}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}