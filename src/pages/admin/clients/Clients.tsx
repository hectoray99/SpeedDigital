import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, User, CheckCircle, XCircle, ArrowRight, Loader2, Mail, Hash } from 'lucide-react';

import CreateClientModal from '../../../components/CreateClientModal';
import GymOnboardingModal from '../../../components/GymOnboardingModal';

interface Person {
    id: string;
    full_name: string;
    identifier: string;
    email: string | null;
    phone: string | null;
    type: string;
    is_active: boolean;
}

export default function Clients() {
    const { orgData } = useAuthStore();
    const industry = orgData?.industry || 'default';

    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
    const [isGymModalOpen, setIsGymModalOpen] = useState(false);

    useEffect(() => {
        if (orgData?.id) fetchPeople();
    }, [orgData?.id]);

    async function fetchPeople() {
        if (!orgData?.id) return; // BLINDAJE DE TYPESCRIPT
        
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('crm_people')
                .select('*')
                .eq('organization_id', orgData.id)
                .eq('type', 'client') 
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPeople(data || []);
        } catch (error) {
            console.error('Error fetching people:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleCreateClick = () => {
        if (industry === 'gym') setIsGymModalOpen(true);
        else setIsGenericModalOpen(true);
    };

    const filteredPeople = people.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.identifier && p.identifier.includes(searchTerm))
    );

    return (
        <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
            
            <CreateClientModal isOpen={isGenericModalOpen} onClose={() => setIsGenericModalOpen(false)} onSuccess={fetchPeople} />
            <GymOnboardingModal isOpen={isGymModalOpen} onClose={() => setIsGymModalOpen(false)} onSuccess={fetchPeople} />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                        Directorio de Clientes
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm sm:text-base">Gestión y control de personas registradas.</p>
                </div>
                <button
                    onClick={handleCreateClick}
                    className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Cliente
                </button>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, apellido o DNI..."
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all text-slate-800 font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-4 h-full">
                        <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                        <p className="font-bold tracking-widest uppercase text-xs">Cargando base de datos...</p>
                    </div>
                ) : filteredPeople.length === 0 ? (
                    <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center h-full animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
                            <User className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-700">No hay registros</h3>
                        <p className="mt-2 max-w-sm font-medium">No se encontraron clientes con esa búsqueda o la base de datos está vacía.</p>
                    </div>
                ) : (
                    <>
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredPeople.map((person) => (
                                <div key={person.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg shrink-0 border border-brand-100 shadow-sm">
                                                {person.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-lg leading-tight truncate">{person.full_name}</div>
                                                <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-1">
                                                    <Hash className="w-3 h-3" /> {person.identifier || 'Sin DNI'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 shadow-sm border ${person.is_active ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                            {person.is_active ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                        </span>
                                    </div>
                                    <Link to={`/admin/clients/${person.id}`} className="w-full py-3.5 bg-slate-50 text-brand-600 rounded-xl font-bold text-sm text-center border border-slate-200 hover:bg-brand-50 transition-colors active:scale-95 shadow-sm">
                                        Ver Perfil Completo
                                    </Link>
                                </div>
                            ))}
                        </div>

                        <div className="hidden md:block overflow-x-auto hide-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre y Contacto</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificador</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                        <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPeople.map((person) => (
                                        <tr key={person.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-sm shrink-0 border border-brand-100 shadow-sm">
                                                        {person.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-base">{person.full_name}</div>
                                                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3.5 h-3.5" /> {person.email || 'Sin email'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-black">
                                                {person.identifier || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest gap-1.5 border shadow-sm ${person.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                                    {person.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                    {person.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link 
                                                    to={`/admin/clients/${person.id}`} 
                                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl font-bold text-sm transition-all border border-slate-200 hover:border-brand-200 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95 shadow-sm"
                                                >
                                                    Ver Perfil <ArrowRight className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}