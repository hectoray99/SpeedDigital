import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, User, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import CreateStudentModal from '../../../components/CreateStudentModal';

// Interfaz adaptada a la nueva tabla crm_people
interface Person {
    id: string;
    full_name: string;
    identifier: string; // DNI
    email: string | null;
    phone: string | null;
    type: string;
    is_active: boolean;
}

export default function Students() {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPeople();
    }, []);

    async function fetchPeople() {
        try {
            setLoading(true);
            // Consultamos la tabla NUEVA: crm_people
            const { data, error } = await supabase
                .from('crm_people')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setPeople(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }

    // Filtro simple en cliente
    const filteredPeople = people.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.identifier && p.identifier.includes(searchTerm))
    );

    return (
        <div>
            <CreateStudentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchPeople}
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Personas</h1>
                    <p className="text-slate-500">Gestión de clientes, alumnos y contactos.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-brand-500/20 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por Nombre o Identificador..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando base de datos...</div>
                ) : filteredPeople.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <User className="w-12 h-12 text-slate-300 mb-2" />
                        <p>No se encontraron registros.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Nombre</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Identificador</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPeople.map((person) => (
                                    <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                                                    {person.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-900">{person.full_name}</div>
                                                    <div className="text-sm text-slate-500">{person.email || 'Sin email'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {person.identifier || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium gap-1 ${person.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {person.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {person.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link to={`/admin/students/${person.id}`} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium text-sm">
                                                Ver Perfil <ArrowRight className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}