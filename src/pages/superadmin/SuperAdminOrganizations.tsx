import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Search, Building2, Power, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminOrganizations() {
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchOrganizations();
    }, []);

    async function fetchOrganizations() {
        try {
            setLoading(true);
            
            // Llamamos a nuestro "Cable Directo" en la base de datos
            const { data, error } = await supabase.rpc('get_admin_orgs');

            if (error) throw error;

            // Guardamos la info directamente, ya viene masticada y perfecta
            setOrgs(data || []);

        } catch (error) {
            console.error("Error cargando orgs:", error);
            toast.error('Error al cargar las organizaciones');
        } finally {
            setLoading(false);
        }
    }

    const toggleOrgStatus = async (orgId: string, currentStatus: boolean, orgName: string) => {
        if (!window.confirm(`¿Estás seguro de que querés ${currentStatus ? 'SUSPENDER' : 'ACTIVAR'} el local "${orgName}"?`)) return;

        try {
            const { error } = await supabase
                .from('organizations')
                .update({ is_active: !currentStatus })
                .eq('id', orgId);

            if (error) throw error;
            
            toast.success(`Local ${!currentStatus ? 'Activado' : 'Suspendido'} exitosamente`);
            
            setOrgs(orgs.map(org => 
                org.id === orgId ? { ...org, is_active: !currentStatus } : org
            ));

        } catch (error) {
            toast.error('Error al cambiar el estado del local');
        }
    };

    const filteredOrgs = orgs.filter(org => 
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-purple-500" /> 
                    Gestión de Locales
                </h1>
                <p className="text-slate-400 mt-1">Administrá los negocios que usan SpeedDigital, suspendé cuentas por falta de pago o revisá sus datos.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre de local o email del dueño..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none text-white font-medium"
                    />
                </div>
                <div className="text-sm font-bold text-purple-400 bg-purple-500/10 px-6 py-3 rounded-xl border border-purple-500/20 whitespace-nowrap">
                    {filteredOrgs.length} Locales
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest">
                                <th className="p-5">Local</th>
                                <th className="p-5">Dueño</th>
                                <th className="p-5">Rubro</th>
                                <th className="p-5 text-center">Estado</th>
                                <th className="p-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredOrgs.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="p-5">
                                        <p className="text-white font-bold text-base">{org.name}</p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            Se unió el {new Date(org.created_at).toLocaleDateString()}
                                        </p>
                                    </td>
                                    <td className="p-5">
                                        <p className="text-slate-300 font-medium">{org.profiles?.full_name}</p>
                                        <p className="text-xs text-slate-500">{org.profiles?.email}</p>
                                    </td>
                                    <td className="p-5">
                                        <span className="bg-slate-800 text-slate-300 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest">
                                            {org.industry}
                                        </span>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                                            org.is_active 
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                            {org.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                            {org.is_active ? 'Activo' : 'Suspendido'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right">
                                        <button 
                                            onClick={() => toggleOrgStatus(org.id, org.is_active, org.name)}
                                            title={org.is_active ? "Suspender Local" : "Activar Local"}
                                            className={`p-2 rounded-xl transition-all ${
                                                org.is_active 
                                                ? 'bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white' 
                                                : 'bg-red-500/20 text-red-500 hover:bg-emerald-500 hover:text-white'
                                            }`}
                                        >
                                            {org.is_active ? <ShieldAlert className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredOrgs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500 font-medium">
                                        No se encontraron locales.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}