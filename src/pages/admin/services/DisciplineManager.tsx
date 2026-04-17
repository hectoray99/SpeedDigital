import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Loader2, Edit2, X, Save, Users, Clock, Dumbbell, User as UserIcon, CreditCard, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// INTERFACES
// ==========================================
interface Resource {
    id: string;
    name: string;
}

interface Discipline {
    id: string;
    name: string;
    price: number;
    is_active: boolean;
    properties: {
        description?: string;
        capacity: number;
        duration_minutes: number;
        resource_id: string | null;
        requires_deposit?: boolean;
        deposit_percentage?: number;
    };
}

export default function DisciplineManager() {
    const { orgData } = useAuthStore();
    const [disciplines, setDisciplines] = useState<Discipline[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Estados del Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        capacity: '1',
        duration_minutes: '60',
        resource_id: '',
        is_active: true,
        requires_deposit: false,
        deposit_percentage: '50'
    });

    const isGym = orgData?.industry === 'gym';

    useEffect(() => {
        if (orgData?.id) {
            fetchData();
        }
    }, [orgData?.id]);

    async function fetchData() {
        if (!orgData?.id) return;
        setLoading(true);
        try {
            // Buscamos los servicios y los recursos (profesionales/espacios)
            const [discRes, resRes] = await Promise.all([
                supabase.from('catalog_items')
                    .select('*')
                    .eq('organization_id', orgData.id)
                    .in('type', ['service', 'subscription'])
                    .order('created_at', { ascending: false }),
                supabase.from('resources')
                    .select('id, name')
                    .eq('organization_id', orgData.id)
                    .eq('is_active', true)
            ]);

            if (discRes.error) throw discRes.error;
            if (resRes.error) throw resRes.error;

            setDisciplines(discRes.data || []);
            setResources(resRes.data || []);
        } catch (error) {
            toast.error('Error al cargar los servicios agendables');
        } finally {
            setLoading(false);
        }
    }

    const openModal = (item?: Discipline) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                name: item.name,
                price: item.price.toString(),
                description: item.properties?.description || '',
                capacity: item.properties?.capacity?.toString() || '1',
                duration_minutes: item.properties?.duration_minutes?.toString() || '60',
                resource_id: item.properties?.resource_id || '',
                is_active: item.is_active !== false,
                requires_deposit: item.properties?.requires_deposit || false,
                deposit_percentage: item.properties?.deposit_percentage?.toString() || '50'
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '', price: '', description: '', capacity: '1', duration_minutes: '60', 
                resource_id: '', is_active: true, requires_deposit: false, deposit_percentage: '50'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        if (!formData.name.trim()) return toast.error('El nombre es obligatorio');
        if (Number(formData.price) < 0) return toast.error('El precio no puede ser negativo');

        // 🔥 BLINDAJE: Validación estricta del 1 al 100 para la seña
        if (formData.requires_deposit) {
            const pct = Number(formData.deposit_percentage);
            if (isNaN(pct) || pct < 1 || pct > 100) {
                return toast.error('El porcentaje de la seña debe estar estrictamente entre 1 y 100');
            }
        }

        setIsSaving(true);
        try {
            const payload = {
                organization_id: orgData.id,
                name: formData.name.trim(),
                price: Number(formData.price),
                is_active: formData.is_active,
                type: isGym ? 'subscription' : 'service',
                properties: {
                    description: formData.description.trim(),
                    capacity: Number(formData.capacity) || 1,
                    duration_minutes: Number(formData.duration_minutes) || 60,
                    resource_id: formData.resource_id || null,
                    requires_deposit: formData.requires_deposit,
                    deposit_percentage: Number(formData.deposit_percentage) || 50
                }
            };

            if (editingId) {
                const { error } = await supabase.from('catalog_items').update(payload).eq('id', editingId);
                if (error) throw error;
                toast.success('Servicio actualizado con éxito');
            } else {
                const { error } = await supabase.from('catalog_items').insert([payload]);
                if (error) throw error;
                toast.success('Servicio creado exitosamente');
            }

            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Error al guardar en la base de datos');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        if (!orgData?.id) return;
        try {
            await supabase.from('catalog_items').update({ is_active: !currentStatus }).eq('id', id);
            setDisciplines(disciplines.map(d => d.id === id ? { ...d, is_active: !currentStatus } : d));
            toast.success(currentStatus ? 'Servicio pausado' : 'Servicio activado');
        } catch {
            toast.error("Error al cambiar estado");
        }
    };

    const filteredDisciplines = disciplines.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
            
            {/* CABECERA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <Clock className="w-6 h-6 text-indigo-600" />
                        </div>
                        Servicios Agendables
                    </h1>
                    <p className="text-slate-500 font-medium mt-2 text-base">Gestioná qué pueden reservar tus clientes en el portal.</p>
                </div>
                <button onClick={() => openModal()} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm md:text-base">
                    <Plus className="w-5 h-5" /> Nuevo Servicio
                </button>
            </div>

            {/* BUSCADOR */}
            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium text-slate-800 transition-all" />
                </div>
            </div>

            {/* LISTA */}
            {loading ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                    <p className="font-bold uppercase tracking-widest text-sm">Cargando servicios...</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-left min-w-[800px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-widest font-bold">
                                    <th className="px-6 py-5">Nombre del Servicio</th>
                                    <th className="px-6 py-5">Configuración</th>
                                    <th className="px-6 py-5">Precio y Seña</th>
                                    <th className="px-6 py-5 text-center">Estado</th>
                                    <th className="px-6 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredDisciplines.length === 0 ? (
                                    <tr><td colSpan={5} className="p-16 text-center text-slate-400 font-bold bg-slate-50/50 text-base">No se encontraron servicios agendables.</td></tr>
                                ) : (
                                    filteredDisciplines.map((item) => {
                                        const reqDeposit = item.properties?.requires_deposit;
                                        const linkedResource = resources.find(r => r.id === item.properties?.resource_id);

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                                                            {isGym ? <Dumbbell className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-base leading-tight">{item.name}</p>
                                                            {item.properties?.description && <p className="text-[11px] font-medium text-slate-500 line-clamp-1 max-w-[200px] mt-1">{item.properties.description}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                                                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {item.properties?.duration_minutes || 60} min
                                                        </span>
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                                                            <Users className="w-3.5 h-3.5 text-slate-400" /> Cupo: {item.properties?.capacity || 1}
                                                        </span>
                                                        {linkedResource && (
                                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md w-fit">
                                                                <UserIcon className="w-3 h-3" /> {linkedResource.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-black text-lg text-emerald-600">${item.price.toLocaleString()}</p>
                                                    {reqDeposit ? (
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 mt-1">
                                                            Pide Seña: {item.properties?.deposit_percentage}%
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                                                            Sin Seña
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => toggleStatus(item.id, item.is_active)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${item.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                                                        {item.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} {item.is_active ? 'Activo' : 'Pausado'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => openModal(item)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all focus:opacity-100 border border-transparent hover:border-indigo-100 bg-white hover:shadow-sm" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL DE CREACIÓN / EDICIÓN */}
            <Transition appear show={isModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isSaving && setIsModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                                
                                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                    <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <div className="p-2 bg-indigo-100 rounded-xl">
                                            {editingId ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                                        </div>
                                        {editingId ? 'Editar Servicio Agendable' : 'Crear Servicio Agendable'}
                                    </Dialog.Title>
                                    <button onClick={() => setIsModalOpen(false)} disabled={isSaving} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                                        <X className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>

                                <form onSubmit={handleSave} className="flex-1 overflow-y-auto hide-scrollbar">
                                    <div className="p-6 md:p-8 space-y-6">
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre del Servicio *</label>
                                                <input required type="text" autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Turno Kinesiología" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white font-bold text-slate-800 transition-all" />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Precio Total *</label>
                                                <div className="relative shadow-sm rounded-2xl">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                    <input required type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0" className="w-full pl-9 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white font-black text-slate-800 transition-all" />
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <label className=" text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Users className="w-4 h-4" /> Cupo Máximo *</label>
                                                <input required type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} placeholder="1" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white font-black text-slate-800 transition-all" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            <div>
                                                <label className=" text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Duración *</label>
                                                <select value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none cursor-pointer font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20">
                                                    <option value="15">15 minutos</option>
                                                    <option value="30">30 minutos</option>
                                                    <option value="45">45 minutos</option>
                                                    <option value="60">1 hora</option>
                                                    <option value="90">1 hora y media</option>
                                                    <option value="120">2 horas</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className=" text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><UserIcon className="w-4 h-4" /> Profesional Asignado</label>
                                                <select value={formData.resource_id} onChange={e => setFormData({...formData, resource_id: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none cursor-pointer font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20">
                                                    <option value="">Ninguno (Libre)</option>
                                                    {resources.map(res => <option key={res.id} value={res.id}>{res.name}</option>)}
                                                </select>
                                                <p className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">Vincular para comisiones a fin de mes.</p>
                                            </div>
                                        </div>

                                        {/* 🔥 SEÑA DINÁMICA CON LIMITACIÓN */}
                                        <div className="bg-brand-50/50 p-5 rounded-2xl border border-brand-100">
                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-xs font-bold text-brand-800 uppercase tracking-widest flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-brand-500" /> Requerir Seña (MercadoPago)
                                                </label>
                                                <input type="checkbox" checked={formData.requires_deposit} onChange={e => setFormData({...formData, requires_deposit: e.target.checked})} className="w-5 h-5 rounded-md border-brand-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                            </div>
                                            
                                            <AnimatePresence>
                                                {formData.requires_deposit && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2 border-t border-brand-100 overflow-hidden">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 mt-2">Porcentaje de la seña (%) *</label>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            max="100" 
                                                            value={formData.deposit_percentage} 
                                                            onChange={e => {
                                                                let val = e.target.value;
                                                                if (Number(val) > 100) val = '100'; // Limita al 100% mientras tipea
                                                                setFormData({...formData, deposit_percentage: val})
                                                            }} 
                                                            className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none font-black text-slate-800 shadow-sm focus:ring-2 focus:ring-brand-500/20" 
                                                        />
                                                        <p className="text-[10px] text-brand-600 mt-2 font-bold uppercase tracking-widest">
                                                            El cliente pagará online ${ ((Number(formData.price) || 0) * (Number(formData.deposit_percentage) || 50)) / 100 } para asegurar el turno.
                                                        </p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descripción Corta</label>
                                            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detalles visibles para el cliente..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white font-medium resize-none h-24 text-slate-700 transition-all shadow-sm" />
                                        </div>

                                        <div className="flex items-center gap-3 pt-2 pl-1">
                                            <input type="checkbox" id="isActive" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-colors" />
                                            <label htmlFor="isActive" className="font-bold text-slate-700 cursor-pointer select-none">Servicio Activo (Recibe turnos)</label>
                                        </div>
                                    </div>

                                    <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] sticky bottom-0">
                                        <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="flex-1 py-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">Cancelar</button>
                                        <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 text-lg">
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar Servicio
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}