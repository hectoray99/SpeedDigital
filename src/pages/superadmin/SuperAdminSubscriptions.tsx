import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import { Loader2, CreditCard, DollarSign, Star, Search, CheckCircle2,Save  } from 'lucide-react';
import { toast } from 'sonner';

// Mapeo dinámico de precios (Para el cálculo de métricas)
const PLAN_PRICES: Record<string, number> = {
    'Gratis': 0,
    'Premium': 35000
};

export default function SuperAdminSubscriptions() {
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Estado para nuestro Modal de Confirmación personalizado
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, orgId: string, orgName: string, newPlan: string} | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    async function fetchSubscriptions() {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_admin_orgs');
            if (error) throw error;
            
            // Normalizamos datos por si quedaron orgs antiguas con plan 'Pro'
            const normalizedData = (data || []).map((org: any) => ({
                ...org,
                plan: org.plan === 'Pro' ? 'Premium' : (org.plan || 'Gratis')
            }));
            
            setOrgs(normalizedData);
        } catch (error) {
            toast.error('Error al cargar la facturación del servidor');
        } finally {
            setLoading(false);
        }
    }

    const requestPlanChange = (orgId: string, newPlan: string, orgName: string) => {
        setConfirmModal({ isOpen: true, orgId, orgName, newPlan });
    };

    const executePlanChange = async () => {
        if (!confirmModal) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ plan: confirmModal.newPlan })
                .eq('id', confirmModal.orgId);

            if (error) throw error;
            
            toast.success(`Plan de "${confirmModal.orgName}" actualizado a ${confirmModal.newPlan}`);
            
            // Optimistic UI Update
            setOrgs(orgs.map(org => 
                org.id === confirmModal.orgId ? { ...org, plan: confirmModal.newPlan } : org
            ));
            setConfirmModal(null);
        } catch (error) {
            toast.error('No se pudo actualizar la suscripción');
        } finally {
            setIsSaving(false);
        }
    };

    // Cálculos para las métricas globales
    const totalMRR = orgs.reduce((acc, org) => acc + (PLAN_PRICES[org.plan] || 0), 0);
    const freeUsers = orgs.filter(org => org.plan === 'Gratis').length;
    const premiumUsers = orgs.filter(org => org.plan === 'Premium').length;
    
    const filteredOrgs = orgs.filter(org => 
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="flex justify-center items-center h-[60vh] animate-in fade-in"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>;

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
            
            {/* CABECERA */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <CreditCard className="w-7 h-7 md:w-8 md:h-8 text-brand-500" /> 
                    Suscripciones y Facturación
                </h1>
                <p className="text-slate-400 mt-2 text-sm md:text-base font-medium">Controlá los planes de tus clientes y monitoreá tus ingresos recurrentes (MRR).</p>
            </div>

            {/* TARJETAS DE MÉTRICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-[#181132] border border-purple-500/20 p-6 md:p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden group col-span-1 sm:col-span-2 lg:col-span-1">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[40px] -mr-8 -mt-8 group-hover:bg-purple-500/30 transition-colors"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-xs font-black text-purple-300 uppercase tracking-widest mb-3">Ingreso Mensual (MRR)</p>
                            <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter">${totalMRR.toLocaleString('es-AR')}</h3>
                            <p className="text-purple-400/60 text-xs font-bold mt-2 uppercase tracking-widest">Pesos Argentinos</p>
                        </div>
                        <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-400 shadow-inner">
                            <DollarSign className="w-7 h-7" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Plan Inicial ($0)</p>
                            <h3 className="text-3xl md:text-4xl font-black text-white">{freeUsers} <span className="text-sm text-slate-600">Locales</span></h3>
                        </div>
                        <div className="p-3 bg-slate-800 rounded-2xl text-slate-400">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs font-black text-amber-500/60 uppercase tracking-widest mb-2">Premium ($35k)</p>
                            <h3 className="text-3xl md:text-4xl font-black text-white">{premiumUsers} <span className="text-sm text-slate-600">Locales</span></h3>
                        </div>
                        <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/10">
                            <Star className="w-6 h-6 fill-current" />
                        </div>
                    </div>
                </div>
            </div>

            {/* BUSCADOR */}
            <div className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-[2rem] flex items-center gap-4 shadow-xl">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre de local o email del dueño..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-brand-500/50 outline-none text-white font-medium transition-all"
                    />
                </div>
            </div>

            {/* TABLA DE SUSCRIPCIONES */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto hide-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="p-6">Local y Propietario</th>
                                <th className="p-6">Rubro</th>
                                <th className="p-6 text-center">Plan de Pagos</th>
                                <th className="p-6 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-sm">
                            {filteredOrgs.length === 0 ? (
                                <tr><td colSpan={4} className="p-16 text-center text-slate-500 font-bold bg-slate-950/20">No se encontraron suscripciones activas.</td></tr>
                            ) : (
                                filteredOrgs.map((org) => (
                                    <tr key={org.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="p-6">
                                            <p className="text-white font-black text-lg leading-tight mb-1">{org.name}</p>
                                            <p className="text-xs text-slate-500 font-medium group-hover:text-slate-400 transition-colors">{org.profiles?.email}</p>
                                        </td>
                                        <td className="p-6">
                                            <span className="bg-slate-800 text-slate-400 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border border-slate-700">
                                                {org.industry}
                                            </span>
                                        </td>
                                        <td className="p-6 text-center">
                                            <span className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-inner ${
                                                org.plan === 'Premium' ? 'bg-brand-500/10 text-brand-400 border-brand-500/30' :
                                                'bg-slate-800 text-slate-500 border-slate-700'
                                            }`}>
                                                {org.plan === 'Gratis' ? 'Plan Inicial' : org.plan}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <select
                                                value={org.plan}
                                                onChange={(e) => requestPlanChange(org.id, e.target.value, org.name)}
                                                className="bg-slate-950 border border-slate-800 hover:border-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-xl focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer py-3 px-5 transition-all shadow-sm appearance-none text-center"
                                            >
                                                <option value="Gratis">Bajar a Inicial</option>
                                                <option value="Premium">Subir a Premium</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE CONFIRMACIÓN */}
            <Transition appear show={!!confirmModal?.isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isSaving && setConfirmModal(null)}>
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 p-8 md:p-10 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-brand-500/10 border-2 border-brand-500/20 text-brand-500 mb-6 mx-auto shadow-inner">
                                    <CreditCard className="w-10 h-10" />
                                </div>
                                <Dialog.Title as="h3" className="text-2xl font-black text-white mb-3 tracking-tight">
                                    Confirmar Cambio
                                </Dialog.Title>
                                <p className="text-sm text-slate-400 mb-10 font-medium leading-relaxed">
                                    Vas a cambiar el plan de <b>"{confirmModal?.orgName}"</b> al nivel <span className="text-brand-400 font-black uppercase tracking-widest bg-brand-500/10 px-2 py-0.5 rounded">{confirmModal?.newPlan === 'Gratis' ? 'Inicial' : 'Premium'}</span>. <br/> ¿Deseas aplicar el cambio ahora?
                                </p>

                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={executePlanChange} 
                                        disabled={isSaving} 
                                        className="w-full py-5 rounded-2xl font-black text-lg text-white bg-brand-600 hover:bg-brand-500 shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Confirmar y Guardar
                                    </button>
                                    <button onClick={() => setConfirmModal(null)} disabled={isSaving} className="py-2 text-slate-500 font-bold hover:text-white transition-colors">No, cancelar</button>
                                </div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}