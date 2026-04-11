import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import { Loader2, Search, Building2, Power, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminOrganizations() {
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Estado del Modal de Confirmación
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, orgId: string, orgName: string, isCurrentlyActive: boolean} | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    async function fetchOrganizations() {
        try {
            setLoading(true);
            // rpc (Remote Procedure Call) configurada en Supabase para saltar RLS y ver todos los usuarios
            const { data, error } = await supabase.rpc('get_admin_orgs');
            if (error) throw error;
            setOrgs(data || []);
        } catch (error) {
            toast.error('Error al cargar las organizaciones');
        } finally {
            setLoading(false);
        }
    }

    const requestToggleStatus = (orgId: string, isCurrentlyActive: boolean, orgName: string) => {
        setConfirmModal({ isOpen: true, orgId, orgName, isCurrentlyActive });
    };

    const executeToggleStatus = async () => {
        if (!confirmModal) return;
        setIsSaving(true);
        try {
            // Actualizamos la base de datos maestra
            const { error } = await supabase
                .from('organizations')
                .update({ is_active: !confirmModal.isCurrentlyActive })
                .eq('id', confirmModal.orgId);

            if (error) throw error;
            
            toast.success(`Local ${!confirmModal.isCurrentlyActive ? 'Activado' : 'Suspendido'} exitosamente`);
            
            // Actualizamos la UI
            setOrgs(orgs.map(org => 
                org.id === confirmModal.orgId ? { ...org, is_active: !confirmModal.isCurrentlyActive } : org
            ));
            
            setConfirmModal(null);
        } catch (error) {
            toast.error('Error al cambiar el estado del local');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredOrgs = orgs.filter(org => 
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    );

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    if (loading) return <div className="flex justify-center items-center h-[60vh] animate-in fade-in"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>;

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            
            {/* CABECERA */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Building2 className="w-7 h-7 md:w-8 md:h-8 text-purple-500" /> 
                    Gestión de Locales
                </h1>
                <p className="text-slate-400 mt-2 text-sm md:text-base">Administrá negocios, suspendé cuentas por falta de pago o revisá sus datos de contacto.</p>
            </div>

            {/* BUSCADOR */}
            <div className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-[2rem] flex flex-col sm:flex-row items-center gap-4 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre del local o email del dueño..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none text-white font-medium transition-all"
                    />
                </div>
                <div className="text-sm font-black text-purple-400 bg-purple-500/10 px-8 py-4 rounded-xl border border-purple-500/20 w-full sm:w-auto text-center shrink-0 uppercase tracking-widest">
                    {filteredOrgs.length} Locales
                </div>
            </div>

            {/* TABLA */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto hide-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[750px]">
                        <thead>
                            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest">
                                <th className="p-6">Local y Rubro</th>
                                <th className="p-6">Datos del Dueño</th>
                                <th className="p-6 text-center">Estado de Cuenta</th>
                                <th className="p-6 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-sm">
                            {filteredOrgs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-16 text-center text-slate-500 font-bold bg-slate-950/20">
                                        No se encontraron locales que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrgs.map((org) => (
                                    <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-6">
                                            <p className="text-white font-black text-lg leading-tight mb-1">{org.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="uppercase text-[9px] tracking-widest font-black bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                                                    {org.industry}
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">Desde: {new Date(org.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="text-slate-300 font-bold text-sm leading-tight">{org.profiles?.full_name}</p>
                                            <p className="text-xs font-medium text-slate-500 mt-1">{org.profiles?.email}</p>
                                        </td>
                                        <td className="p-6 text-center">
                                            <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-inner ${
                                                org.is_active 
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>
                                                {org.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {org.is_active ? 'Activo' : 'Suspendido'}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button 
                                                onClick={() => requestToggleStatus(org.id, org.is_active, org.name)}
                                                title={org.is_active ? "Suspender Local" : "Activar Local"}
                                                className={`p-3 rounded-xl transition-all shadow-sm active:scale-95 inline-flex items-center justify-center ${
                                                    org.is_active 
                                                    ? 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30' 
                                                    : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30'
                                                }`}
                                            >
                                                {org.is_active ? <Power className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* =========================================================
                MODAL DE CONFIRMACIÓN DE SUSPENSIÓN (Headless UI)
            ========================================================= */}
            <Transition appear show={!!confirmModal?.isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => !isSaving && setConfirmModal(null)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 p-6 md:p-10 text-left align-middle shadow-2xl transition-all animate-in zoom-in-95 duration-200">
                                <div className={`flex items-center justify-center w-20 h-20 rounded-full mb-6 mx-auto shadow-inner ${confirmModal?.isCurrentlyActive ? 'bg-red-500/10 border-4 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-4 border-emerald-500/20 text-emerald-500'}`}>
                                    {confirmModal?.isCurrentlyActive ? <ShieldAlert className="w-10 h-10" /> : <Power className="w-10 h-10" />}
                                </div>
                                
                                <Dialog.Title as="h3" className="text-3xl font-black text-white text-center mb-4 tracking-tight">
                                    {confirmModal?.isCurrentlyActive ? 'Suspender Sistema' : 'Reactivar Sistema'}
                                </Dialog.Title>
                                
                                <p className="text-slate-400 text-center mb-10 font-medium leading-relaxed">
                                    {confirmModal?.isCurrentlyActive 
                                        ? `Estás a punto de bloquearle el acceso al local "${confirmModal?.orgName}". No podrán vender ni ingresar al sistema hasta que los habilites de nuevo.`
                                        : `Vas a reactivar el acceso completo al sistema para el local "${confirmModal?.orgName}".`
                                    }
                                </p>

                                <div className="flex flex-col gap-3 border-t border-slate-800 pt-6">
                                    <button 
                                        onClick={executeToggleStatus} 
                                        disabled={isSaving} 
                                        className={`w-full py-4.5 rounded-xl font-black text-lg text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                                            confirmModal?.isCurrentlyActive 
                                            ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20' 
                                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                                        }`}
                                    >
                                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                        {confirmModal?.isCurrentlyActive ? 'Suspender ahora' : 'Reactivar acceso'}
                                    </button>
                                    <button onClick={() => setConfirmModal(null)} disabled={isSaving} className="w-full py-4 rounded-xl font-bold text-slate-400 bg-transparent hover:text-white transition-colors disabled:opacity-50">
                                        Cancelar
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}