import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

import {
    User, Phone, Mail, ArrowLeft, Save, Loader2,
    CreditCard, History, CheckCircle, Store, Calendar, Clock, Hash
} from 'lucide-react';

import RegisterPaymentModal from '../../../components/RegisterPaymentModal';
import EnrollModal from '../../../components/EnrollModal';

interface PersonProfile {
    id: string;
    full_name: string;
    identifier: string;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    details: any;
}

export default function StudentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [profile, setProfile] = useState<PersonProfile | null>(null);
    const [balance, setBalance] = useState(0);
    const [pendingDebts, setPendingDebts] = useState<any[]>([]);
    const [movements, setMovements] = useState<any[]>([]);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<any>(null);
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

    useEffect(() => {
        if (id) fetchStudentData();
    }, [id]);

    async function fetchStudentData() {
        try {
            setLoading(true);

            // A. Datos personales
            const { data: person, error: personError } = await supabase
                .from('crm_people')
                .select('*')
                .eq('id', id)
                .single();

            if (personError) throw personError;
            setProfile(person);

            // B. Deudas (balance > 0)
            const { data: debts } = await supabase
                .from('operations')
                .select('id, balance, metadata, person_id')
                .eq('person_id', id)
                .gt('balance', 0)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: true });

            const debtList = debts || [];
            setPendingDebts(debtList);
            const totalDebt = debtList.reduce((sum, item) => sum + item.balance, 0);
            setBalance(totalDebt);

            // C. Historial
            const { data: history } = await supabase
                .from('finance_ledger')
                .select('*')
                .eq('person_id', id)
                .order('processed_at', { ascending: false })
                .limit(10);

            setMovements(history || []);

        } catch (error: any) {
            toast.error('Error al cargar perfil');
            navigate('/admin/students');
        } finally {
            setLoading(false);
        }
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setSaving(true);

        try {
            const { error } = await supabase
                .from('crm_people')
                .update({
                    full_name: profile.full_name,
                    email: profile.email,
                    phone: profile.phone
                })
                .eq('id', profile.id);

            if (error) throw error;
            toast.success('Perfil actualizado correctamente');
        } catch (error: any) {
            toast.error('Error al actualizar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleOpenPayment = () => {
        if (pendingDebts.length === 0) return;
        setSelectedDebt(pendingDebts[0]);
        setIsPaymentModalOpen(true);
    };

    const getActivePlans = () => {
        if (!profile?.details) return [];
        let plans = profile.details.active_plans || [];
        if (plans.length === 0 && profile.details.active_plan) {
            plans = [profile.details.active_plan];
        }
        return plans;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="font-bold tracking-wide">Cargando legajo del cliente...</p>
            </div>
        );
    }
    
    if (!profile) return null;

    const activePlansList = getActivePlans();

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">

            <RegisterPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSuccess={() => {
                    fetchStudentData();
                    setIsPaymentModalOpen(false);
                }}
                receivable={selectedDebt}
            />

            <EnrollModal
                isOpen={isEnrollModalOpen}
                onClose={() => setIsEnrollModalOpen(false)}
                studentId={profile.id}
                studentName={profile.full_name}
                onSuccess={fetchStudentData}
            />

            {/* --- CABECERA Y BOTÓN VOLVER --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <button
                    onClick={() => navigate('/admin/students')}
                    className="flex items-center gap-2 text-slate-500 hover:text-brand-600 transition-colors font-bold text-sm bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver al Directorio
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

                {/* =====================================================================
                    COLUMNA IZQUIERDA (Datos y Planes)
                ===================================================================== */}
                <div className="lg:col-span-2 space-y-6 md:space-y-8">
                    
                    {/* --- TARJETA 1: DATOS PERSONALES --- */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-100 rounded-lg"><User className="w-5 h-5 text-brand-600" /></div>
                                <h2 className="text-lg font-black text-slate-800">Datos Personales</h2>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${profile.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {profile.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>

                        <form onSubmit={handleUpdate} className="p-6 sm:p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre Completo</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-bold text-slate-800 transition-all"
                                        value={profile.full_name}
                                        onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">DNI / Identificador</label>
                                    <div className="relative">
                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl outline-none bg-slate-100 text-slate-500 font-bold cursor-not-allowed"
                                            value={profile.identifier || ''}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Correo Electrónico</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium transition-all"
                                            value={profile.email || ''}
                                            onChange={e => setProfile({ ...profile, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="tel"
                                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium transition-all"
                                            value={profile.phone || ''}
                                            onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md active:scale-95"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* --- TARJETA 2: PLANES ACTIVOS --- */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg"><Store className="w-5 h-5 text-indigo-600" /></div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-800">Planes y Suscripciones</h2>
                                    <p className="text-xs text-slate-500 mt-0.5 font-bold uppercase tracking-widest">Servicios Inscriptos</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEnrollModalOpen(true)}
                                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                            >
                                Asignar Nuevo Plan
                            </button>
                        </div>

                        <div className="p-6 sm:p-8">
                            {activePlansList.length === 0 ? (
                                <div className="text-center py-10 px-4 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="font-bold">No hay planes activos registrados.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {activePlansList.map((plan: any, idx: number) => {
                                        const isExpired = new Date() > new Date(plan.expires_at);
                                        return (
                                            <div key={idx} className={`p-6 rounded-2xl border-2 transition-all ${isExpired ? 'bg-red-50/50 border-red-200 shadow-sm' : 'bg-white border-slate-200 shadow-md hover:border-brand-300'}`}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <h4 className="font-black text-slate-800 text-lg leading-tight pr-2">{plan.name}</h4>
                                                    {isExpired && <span className="px-2.5 py-1 bg-red-100 text-red-700 font-black text-[10px] rounded-lg uppercase tracking-widest shrink-0 border border-red-200">Vencido</span>}
                                                </div>
                                                
                                                <div className="space-y-3 text-sm font-medium">
                                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isExpired ? 'bg-red-100/50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
                                                        <Calendar className="w-4 h-4 shrink-0" />
                                                        <span>Vence: <b>{new Date(plan.expires_at).toLocaleDateString()}</b></span>
                                                    </div>
                                                    
                                                    {plan.mode === 'classes' && (
                                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 text-slate-600">
                                                            <Hash className="w-4 h-4 shrink-0" />
                                                            <span><b>{plan.remaining_classes}</b> clases restantes</span>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 text-slate-600 capitalize">
                                                        <Clock className="w-4 h-4 shrink-0" />
                                                        <span>{plan.schedule === 'free' ? 'Turno Libre' : `Turno ${plan.schedule === 'morning' ? 'Mañana' : plan.schedule === 'afternoon' ? 'Tarde' : 'Noche'}`}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* =====================================================================
                    COLUMNA DERECHA (Resumen Financiero)
                ===================================================================== */}
                <div className="space-y-6 md:space-y-8">
                    
                    {/* --- TARJETA 3: ESTADO DE CUENTA --- */}
                    <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-6 sm:p-8 text-white relative overflow-hidden">
                        {/* Glow de fondo */}
                        <div className={`absolute top-0 right-0 w-40 h-40 rounded-full mix-blend-screen filter blur-[60px] opacity-40 ${balance > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                        
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 relative z-10">Estado de Cuenta</h3>

                        <div className="mb-8 relative z-10">
                            <p className="text-slate-300 text-sm font-medium mb-1">Deuda Total Pendiente</p>
                            <p className={`text-5xl font-black tracking-tight ${balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                ${balance.toLocaleString()}
                            </p>
                        </div>

                        <div className="relative z-10">
                            {balance > 0 ? (
                                <button
                                    onClick={handleOpenPayment}
                                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-red-500/30"
                                >
                                    <CreditCard className="w-5 h-5" /> Cobrar Deuda
                                </button>
                            ) : (
                                <div className="w-full py-4 bg-emerald-500/10 text-emerald-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-emerald-500/20">
                                    <CheckCircle className="w-5 h-5" /> Cuenta al día
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- TARJETA 4: HISTORIAL DE PAGOS --- */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                            <div className="p-2 bg-slate-200 rounded-lg"><History className="w-4 h-4 text-slate-600" /></div>
                            <h3 className="font-bold text-slate-800">Últimos Pagos</h3>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto hide-scrollbar">
                            {movements.length === 0 ? (
                                <p className="p-10 text-center text-sm font-bold text-slate-400">Sin movimientos registrados.</p>
                            ) : (
                                movements.map((mov) => (
                                    <div key={mov.id} className="p-5 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">Pago Recibido</p>
                                            <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">
                                                {new Date(mov.processed_at).toLocaleDateString()} • <span className="bg-slate-100 px-1.5 py-0.5 rounded">{mov.payment_method}</span>
                                            </p>
                                        </div>
                                        <span className="font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm border border-emerald-100">
                                            +${Number(mov.amount).toLocaleString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}