import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, User, CheckCircle, XCircle, ArrowRight, Loader2, Mail, Hash } from 'lucide-react';

import CreateStudentModal from '../../../components/CreateStudentModal';
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

const industryConfig: Record<string, { buttonLabel: string; modalAction: string }> = {
    gym: { buttonLabel: 'Nuevo Alumno', modalAction: 'openGymModal' },
    default: { buttonLabel: 'Nueva Persona', modalAction: 'openGenericModal' }
};

export default function Students() {
    const { orgData } = useAuthStore();
    const industry = orgData?.industry || 'default';
    const config = industryConfig[industry] || industryConfig.default;

    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
    const [isGymModalOpen, setIsGymModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (orgData?.id) fetchPeople();
    }, [orgData?.id]);

    async function fetchPeople() {
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
        if (config.modalAction === 'openGymModal') setIsGymModalOpen(true);
        else setIsGenericModalOpen(true);
    };

    const filteredPeople = people.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.identifier && p.identifier.includes(searchTerm))
    );

    return (
        <div className="animate-in fade-in duration-500">
            <CreateStudentModal isOpen={isGenericModalOpen} onClose={() => setIsGenericModalOpen(false)} onSuccess={fetchPeople} />
            <GymOnboardingModal isOpen={isGymModalOpen} onClose={() => setIsGymModalOpen(false)} onSuccess={fetchPeople} />

            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                        {industry === 'gym' ? 'Directorio de Alumnos' : 'Directorio de Personas'}
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm sm:text-base">Gestión y control de clientes activos.</p>
                </div>
                <button
                    onClick={handleCreateClick}
                    className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    {config.buttonLabel}
                </button>
            </div>

            {/* Buscador */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, apellido o DNI..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all text-slate-800 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Listado */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                        <p className="font-bold">Cargando base de datos...</p>
                    </div>
                ) : filteredPeople.length === 0 ? (
                    <div className="p-16 text-center text-slate-500 flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <User className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700">No hay registros</h3>
                        <p className="mt-2 max-w-sm text-sm">No se encontraron personas con esa búsqueda o la base de datos está vacía.</p>
                    </div>
                ) : (
                    <>
                        {/* VISTA MÓVIL (Tarjetas) */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredPeople.map((person) => (
                                <div key={person.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col gap-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg shrink-0 border border-brand-100">
                                                {person.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-lg leading-tight">{person.full_name}</div>
                                                <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-1">
                                                    <Hash className="w-3 h-3" /> {person.identifier || 'Sin DNI'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${person.is_active ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                                            {person.is_active ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                        </span>
                                    </div>
                                    <Link to={`/admin/students/${person.id}`} className="w-full py-3 bg-slate-50 text-brand-600 rounded-xl font-bold text-sm text-center border border-slate-100 hover:bg-brand-50 transition-colors">
                                        Ver Perfil Completo
                                    </Link>
                                </div>
                            ))}
                        </div>

                        {/* VISTA ESCRITORIO (Tabla) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre y Contacto</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Identificador</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Estado</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPeople.map((person) => (
                                        <tr key={person.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-sm shrink-0 border border-brand-100">
                                                        {person.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">{person.full_name}</div>
                                                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3 h-3" /> {person.email || 'Sin email'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-bold">
                                                {person.identifier || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider gap-1.5 border ${person.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    {person.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                    {person.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link 
                                                    to={`/admin/students/${person.id}`} 
                                                    className="inline-flex items-center gap-1 px-4 py-2 bg-slate-50 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg font-bold text-sm transition-all border border-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100"
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