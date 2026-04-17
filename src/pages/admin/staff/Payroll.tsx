import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import {
    Loader2, Calculator, Wallet,
    Briefcase, Percent, Search, X, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, Transition } from '@headlessui/react';

interface PayrollStaff {
    id: string;
    full_name: string;
    identifier: string;
    type: string;
    compensation_type: 'fixed' | 'commission';
    commission_pct: number;
    total_hours: number;
    total_minutes: number;
    attendance_count: number;
}

export default function Payroll() {
    const { orgData } = useAuthStore();
    const [staffData, setStaffData] = useState<PayrollStaff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // --- EL TRONCO DE PROPINAS ---
    const [totalTipsPool, setTotalTipsPool] = useState(0);

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [selectedStaff, setSelectedStaff] = useState<PayrollStaff | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isPaying, setIsPaying] = useState(false);

    const fetchPayrollData = async () => {
        if (!orgData?.id) return;
        setLoading(true);

        try {
            const [year, month] = selectedMonth.split('-');
            const startOfMonth = new Date(Number(year), Number(month) - 1, 1);
            const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);

            const startStr = startOfMonth.toLocaleDateString('en-CA');
            const endStr = endOfMonth.toLocaleDateString('en-CA');

            const { data: people, error: peopleError } = await supabase
                .from('crm_people')
                .select('id, full_name, identifier, type, details')
                .eq('organization_id', orgData.id)
                .in('type', ['employee', 'staff'])
                .eq('is_active', true)
                .order('full_name');

            if (peopleError) throw peopleError;

            const { data: attendance, error: attendanceError } = await supabase
                .from('staff_attendance')
                .select('person_id, check_in, check_out')
                .eq('organization_id', orgData.id)
                .gte('work_date', startStr)
                .lte('work_date', endStr);

            if (attendanceError) throw attendanceError;

            // --- CÁLCULO DEL TRONCO (Propinas del mes) ---
            const { data: tipsData } = await supabase
                .from('finance_ledger')
                .select('amount')
                .eq('organization_id', orgData.id)
                .eq('type', 'income')
                .ilike('notes', '%PROPINA_TRONCO%')
                .gte('processed_at', startStr)
                .lte('processed_at', endStr);
                
            const pool = tipsData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
            setTotalTipsPool(pool);

            const payrollProcessed = (people || []).map(person => {
                const personAttendance = (attendance || []).filter(a => a.person_id === person.id);

                let totalMs = 0;
                let validShifts = 0;

                personAttendance.forEach(record => {
                    if (record.check_in && record.check_out) {
                        totalMs += new Date(record.check_out).getTime() - new Date(record.check_in).getTime();
                        validShifts++;
                    }
                });

                const totalHours = Math.floor(totalMs / 3600000);
                const totalMinutes = Math.floor((totalMs % 3600000) / 60000);
                const details = person.details as any || {};

                return {
                    id: person.id,
                    full_name: person.full_name,
                    identifier: person.identifier || 'S/D',
                    type: person.type,
                    compensation_type: details.compensation_type || 'fixed',
                    commission_pct: details.commission_pct || 0,
                    total_hours: totalHours,
                    total_minutes: totalMinutes,
                    attendance_count: validShifts
                };
            });

            setStaffData(payrollProcessed);

        } catch (error) {
            console.error(error);
            toast.error('Error al calcular la liquidación.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayrollData();
    }, [orgData?.id, selectedMonth]);

    const [year, month] = selectedMonth.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 1);
    const monthLabel = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const filteredStaff = staffData.filter(s => s.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const openPaymentModal = (staff: PayrollStaff) => {
        setSelectedStaff(staff);
        setPaymentAmount('');
        setPaymentNotes(`Liquidación ${monthLabel.replace(/^\w/, c => c.toUpperCase())}`);
    };

    const handleProcessPayment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
            return toast.error('Ingresá un monto válido mayor a 0.');
        }

        setIsPaying(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success(
                <div className="flex flex-col text-left">
                    <span className="font-bold">Pago Registrado</span>
                    <span className="text-sm">Se liquidaron ${paymentAmount} a {selectedStaff?.full_name}.</span>
                </div>
            );
            setSelectedStaff(null);
        } catch (error) {
            toast.error('Error al procesar el pago.');
        } finally {
            setIsPaying(false);
        }
    };

    return (
        <div className="pb-12 max-w-7xl mx-auto animate-in fade-in duration-500">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl"><Calculator className="w-6 h-6 text-indigo-600" /></div>
                        Liquidación y Pagos
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Resumen de horas y modalidad de contrato por período.</p>
                </div>

                <div className="flex flex-col w-full sm:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-1">Período a Liquidar</span>
                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-700 font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full"
                    />
                </div>
            </div>

            {/* --- PANEL DEL TRONCO DE PROPINAS --- */}
            {orgData?.industry === 'gastronomy' && (
                <div className="mb-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                            <Wallet className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black">Fondo de Propinas (Tronco)</h2>
                            <p className="text-emerald-100 font-medium">Pozo acumulado en este período para repartir al equipo.</p>
                        </div>
                    </div>
                    <div className="text-4xl md:text-5xl font-black tracking-tighter">
                        ${totalTipsPool.toLocaleString()}
                    </div>
                </div>
            )}

            <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-slate-800 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="p-20 text-center flex flex-col items-center bg-white rounded-3xl shadow-sm border border-slate-200">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                    <p className="font-bold tracking-widest text-xs uppercase text-slate-400">Calculando...</p>
                </div>
            ) : filteredStaff.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center bg-white rounded-3xl shadow-sm border border-slate-200">
                    <Wallet className="w-16 h-16 text-slate-200 mb-4" />
                    <h3 className="text-xl font-black text-slate-700">Sin Datos</h3>
                    <p className="mt-2 text-slate-500 font-medium">No se encontró personal para este período.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStaff.map((staff) => (
                        <div key={staff.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 leading-tight">{staff.full_name}</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">DNI: {staff.identifier}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-600 border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    {staff.full_name.charAt(0)}
                                </div>
                            </div>

                            <div className="flex-1 space-y-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Modalidad</p>
                                    {staff.compensation_type === 'fixed' ? (
                                        <div className="flex items-center gap-2 text-slate-700 font-bold"><Briefcase className="w-5 h-5 text-slate-400" /> Sueldo Fijo</div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-emerald-700 font-bold"><Percent className="w-5 h-5 text-emerald-500" /> A Comisión ({staff.commission_pct}%)</div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Horas Trab.</p>
                                        <p className="text-xl font-black text-slate-800">{staff.total_hours}h {staff.total_minutes}m</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Turnos</p>
                                        <p className="text-xl font-black text-slate-800">{staff.attendance_count}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <button onClick={() => openPaymentModal(staff)} className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md">
                                    <Wallet className="w-4 h-4" /> Generar Pago
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL DE PAGO */}
            <Transition appear show={!!selectedStaff} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isPaying && setSelectedStaff(null)}>
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[2rem] bg-white text-left align-middle shadow-2xl transition-all animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                    <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-100 rounded-xl"><Wallet className="w-6 h-6 text-indigo-600" /></div> Liquidar Pago
                                    </Dialog.Title>
                                    <button onClick={() => setSelectedStaff(null)} disabled={isPaying} className="p-2 bg-white hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                        <X className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>

                                {selectedStaff && (
                                    <form onSubmit={handleProcessPayment} className="p-6 md:p-8 space-y-6">
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                                            <p className="font-black text-indigo-900 text-lg mb-1">{selectedStaff.full_name}</p>
                                            <div className="flex items-center gap-4 text-xs font-bold text-indigo-600/70 uppercase tracking-widest">
                                                <span>{selectedStaff.attendance_count} turnos</span><span>•</span><span>{selectedStaff.total_hours}h {selectedStaff.total_minutes}m</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Monto a Liquidar ($) *</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">$</span>
                                                    <input required type="number" min="1" autoFocus className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-black text-slate-800 text-xl transition-all" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Concepto / Notas</label>
                                                <input type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white font-medium text-slate-800 transition-all" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100">
                                            <button type="submit" disabled={isPaying || !paymentAmount} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-xl shadow-indigo-500/30 active:scale-95 text-lg">
                                                {isPaying ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle className="w-6 h-6" />} {isPaying ? 'Procesando...' : 'Confirmar Pago'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}