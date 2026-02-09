import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
    User, Phone, Mail, ArrowLeft, Save, Loader2,
    CreditCard, History, AlertTriangle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import RegisterPaymentModal from '../../../components/RegisterPaymentModal'; // <--- Importamos el modal

// Interfaz para el perfil
interface PersonProfile {
    id: string;
    full_name: string;
    identifier: string;
    email: string | null;
    phone: string | null;
    is_active: boolean;
}

export default function StudentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Datos del cliente
    const [profile, setProfile] = useState<PersonProfile | null>(null);

    // Datos financieros
    const [balance, setBalance] = useState(0);
    const [pendingDebts, setPendingDebts] = useState<any[]>([]); // <--- Guardamos las deudas completas
    const [movements, setMovements] = useState<any[]>([]);

    // Modal de Cobro
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<any>(null);

    useEffect(() => {
        if (id) fetchStudentData();
    }, [id]);

    async function fetchStudentData() {
        try {
            setLoading(true);

            // 1. Obtener Datos Personales
            const { data: person, error: personError } = await supabase
                .from('crm_people')
                .select('*')
                .eq('id', id)
                .single();

            if (personError) throw personError;
            setProfile(person);

            // 2. Obtener DEUDAS (Con todos los datos necesarios para cobrar)
            const { data: debts } = await supabase
                .from('operations')
                .select('id, balance, metadata, person_id') // <--- Traemos ID y Metadata
                .eq('person_id', id)
                .gt('balance', 0)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: true }); // Las más viejas primero

            const debtList = debts || [];
            setPendingDebts(debtList);
            const totalDebt = debtList.reduce((sum, item) => sum + item.balance, 0);
            setBalance(totalDebt);

            // 3. Obtener Historial
            const { data: history } = await supabase
                .from('finance_ledger')
                .select('*')
                .eq('person_id', id)
                .order('processed_at', { ascending: false })
                .limit(10);

            setMovements(history || []);

        } catch (error: any) {
            console.error(error);
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
                    identifier: profile.identifier,
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

    // Lógica para abrir el modal de cobro
    const handleOpenPayment = () => {
        if (pendingDebts.length === 0) return;

        // Seleccionamos la deuda más antigua por defecto para cobrar
        // (Podrías hacer una lista para elegir, pero esto es más rápido)
        setSelectedDebt(pendingDebts[0]);
        setIsPaymentModalOpen(true);
    };

    if (loading) return <div className="p-10 text-center text-slate-400">Cargando legajo...</div>;
    if (!profile) return null;

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            {/* --- MODAL DE COBRO CONECTADO --- */}
            <RegisterPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSuccess={() => {
                    fetchStudentData(); // Recargamos datos tras el cobro
                    setIsPaymentModalOpen(false);
                }}
                receivable={selectedDebt}
            />

            {/* Header de Navegación */}
            <button
                onClick={() => navigate('/admin/students')}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
            >
                <ArrowLeft className="w-4 h-4" /> Volver a la lista
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUMNA IZQUIERDA: Datos Editables */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <User className="w-5 h-5 text-brand-600" />
                                Datos del Cliente
                            </h2>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${profile.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {profile.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>

                        <form onSubmit={handleUpdate} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 outline-none"
                                        value={profile.full_name}
                                        onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Identificador (DNI/CUIT)</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 outline-none bg-slate-50 text-slate-500 cursor-not-allowed"
                                        value={profile.identifier || ''}
                                        readOnly
                                        title="El identificador no se puede cambiar por seguridad"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 outline-none"
                                            value={profile.email || ''}
                                            onChange={e => setProfile({ ...profile, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="tel"
                                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 outline-none"
                                            value={profile.phone || ''}
                                            onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* COLUMNA DERECHA: Resumen Financiero */}
                <div className="space-y-6">
                    {/* Tarjeta de Saldo */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Estado de Cuenta</h3>

                        <div className={`flex items-center gap-4 p-4 rounded-xl mb-4 ${balance > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${balance > 0 ? 'bg-white text-red-500 shadow-sm' : 'bg-white text-emerald-500 shadow-sm'}`}>
                                {balance > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Deuda Total</p>
                                <p className={`text-2xl font-black ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    ${balance.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Botón de Cobro REAL */}
                        {balance > 0 && (
                            <button
                                onClick={handleOpenPayment}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-500/20 active:scale-95"
                            >
                                <CreditCard className="w-4 h-4" />
                                Registrar Cobro
                            </button>
                        )}
                        {balance > 0 && pendingDebts.length > 1 && (
                            <p className="text-xs text-center text-slate-400 mt-2">
                                Se cobrará la deuda más antigua primero.
                            </p>
                        )}
                    </div>

                    {/* Últimos Movimientos */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-500" />
                            <h3 className="font-bold text-slate-700 text-sm">Últimos Pagos</h3>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                            {movements.length === 0 ? (
                                <p className="p-6 text-center text-xs text-slate-400">Sin movimientos recientes.</p>
                            ) : (
                                movements.map((mov) => (
                                    <div key={mov.id} className="p-3 hover:bg-slate-50 flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-medium text-slate-800">Pago Recibido</p>
                                            <p className="text-xs text-slate-400">{new Date(mov.processed_at).toLocaleDateString()} • {mov.payment_method}</p>
                                        </div>
                                        <span className="font-bold text-emerald-600">+${mov.amount.toLocaleString()}</span>
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