import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import { 
    Loader2, Search, Ticket, DollarSign, 
    Plus, Trash2, Power, ShieldAlert, Save, X, Globe, Lock, Layers, Edit3
} from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminPromotions() {
    const [activeTab, setActiveTab] = useState<'plans' | 'promos'>('plans');
    
    // --- ESTADOS DE DATOS ---
    const [promotions, setPromotions] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // --- ESTADOS DE MODALES ---
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [deleteModal, setDeleteModal] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingPlan, setEditingPlan] = useState<any | null>(null);
    const [newPlanPrice, setNewPlanPrice] = useState('');

    // --- ESTADO DEL FORMULARIO DE PROMOS ---
    const [formData, setFormData] = useState({
        code: '', 
        description: '', 
        type: 'percentage', 
        value: '', 
        max_uses: '', 
        expires_at: '', 
        is_public: false 
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            const [promosRes, plansRes] = await Promise.all([
                supabase.from('promotions').select('*').order('created_at', { ascending: false }),
                supabase.from('billing_plans').select('*').order('price', { ascending: true })
            ]);

            if (promosRes.error) throw promosRes.error;
            if (plansRes.error) throw plansRes.error;

            setPromotions(promosRes.data || []);
            setPlans(plansRes.data || []);
        } catch (error) {
            toast.error('Error al cargar la información del servidor');
        } finally {
            setLoading(false);
        }
    }

    // =========================================================================
    // ACCIONES: PLANES BASE (Precios del SaaS)
    // =========================================================================
    const openEditPlan = (plan: any) => {
        setEditingPlan(plan);
        setNewPlanPrice(plan.price.toString());
    };

    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan) return;
        
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('billing_plans')
                .update({ price: Number(newPlanPrice) })
                .eq('id', editingPlan.id);

            if (error) throw error;

            toast.success(`Precio de "${editingPlan.name}" actualizado`);
            setEditingPlan(null);
            fetchData(); 
        } catch (error) {
            toast.error('No se pudo actualizar el precio base');
        } finally {
            setIsSaving(false);
        }
    };

    // =========================================================================
    // ACCIONES: PROMOCIONES (Cupones y Campañas)
    // =========================================================================
    const handleCreatePromo = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const cleanCode = formData.code.toUpperCase().replace(/\s+/g, '');
            const val = Number(formData.value);
            const maxUses = formData.max_uses ? Number(formData.max_uses) : null;
            const expires = formData.expires_at ? new Date(formData.expires_at).toISOString() : null;

            if (!cleanCode) throw new Error('El código es obligatorio');
            if (val <= 0) throw new Error('El valor debe ser mayor a 0');

            const { error } = await supabase.from('promotions').insert([{
                code: cleanCode,
                description: formData.description.trim(),
                type: formData.type,
                value: val,
                max_uses: maxUses,
                expires_at: expires,
                is_public: formData.is_public
            }]);

            if (error) throw error;

            toast.success('¡Campaña activada correctamente!');
            setIsCreateModalOpen(false);
            setFormData({ code: '', description: '', type: 'percentage', value: '', max_uses: '', expires_at: '', is_public: false });
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al crear la promoción');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase.from('promotions').update({ is_active: !currentStatus }).eq('id', id);
            if (error) throw error;
            toast.success(`Campaña ${!currentStatus ? 'Activada' : 'Pausada'}`);
            setPromotions(promotions.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
        } catch (error) {
            toast.error('Error al cambiar el estado');
        }
    };

    const executeDelete = async () => {
        if (!deleteModal) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('promotions').delete().eq('id', deleteModal);
            if (error) throw error;
            toast.success('Promoción eliminada de la base de datos');
            setPromotions(promotions.filter(p => p.id !== deleteModal));
            setDeleteModal(null);
        } catch (error) {
            toast.error('Error al eliminar');
        } finally {
            setIsSaving(false);
        }
    };

    const formatValue = (type: string, value: number) => {
        if (type === 'percentage') return `${value}% OFF`;
        if (type === 'fixed') return `$${value.toLocaleString()} ARS`;
        if (type === 'free_months') return `${value} ${value === 1 ? 'Mes Gratis' : 'Meses Gratis'}`;
        return value;
    };

    const filteredPromos = promotions.filter(p => 
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="flex justify-center items-center h-[60vh] animate-in fade-in"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>;

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
            
            {/* CABECERA */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <DollarSign className="w-7 h-7 md:w-8 md:h-8 text-brand-500" /> 
                    Precios y Promociones
                </h1>
                <p className="text-slate-400 mt-2 text-sm md:text-base font-medium">Controlá los precios de tus planes y lanzá campañas públicas en la Landing Page.</p>
            </div>

            {/* TABS SELECTORAS */}
            <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl w-full sm:max-w-md shadow-sm">
                <button 
                    onClick={() => setActiveTab('plans')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'plans' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Layers className="w-4 h-4" /> Planes Base
                </button>
                <button 
                    onClick={() => setActiveTab('promos')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'promos' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Ticket className="w-4 h-4" /> Campañas
                </button>
            </div>

            {/* VISTA 1: PLANES BASE */}
            {activeTab === 'plans' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-left-4 duration-500">
                    {plans.map(plan => (
                        <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden shadow-xl hover:border-slate-700 transition-colors">
                            {plan.code === 'premium' && <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none" />}
                            <div>
                                <h3 className="text-2xl font-black text-white mb-2">{plan.name}</h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">SKU: {plan.code}</p>
                                <div className="flex items-end gap-1 mb-8">
                                    <span className="text-2xl font-bold text-slate-500 mb-1">$</span>
                                    <span className="text-5xl font-black text-white tracking-tighter">{plan.price.toLocaleString()}</span>
                                    <span className="text-sm font-bold text-slate-500 mb-2 ml-1">ARS</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => openEditPlan(plan)}
                                className={`w-full py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 active:scale-95 ${plan.code === 'premium' ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-xl shadow-brand-500/20' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                            >
                                <Edit3 className="w-5 h-5" /> Ajustar Precio
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* VISTA 2: LISTADO DE CAMPAÑAS */}
            {activeTab === 'promos' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-2xl shadow-lg">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input type="text" placeholder="Buscar campaña por código o descripción..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none text-white font-medium placeholder:font-normal" />
                        </div>
                        <button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-8 py-3.5 rounded-xl font-black shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0">
                            <Plus className="w-5 h-5" /> Nueva Campaña
                        </button>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto hide-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[850px]">
                                <thead>
                                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                        <th className="p-6">Campaña / Código</th>
                                        <th className="p-6">Beneficio Directo</th>
                                        <th className="p-6 text-center">Visibilidad</th>
                                        <th className="p-6 text-center">Cupos / Usos</th>
                                        <th className="p-6 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50 text-sm">
                                    {filteredPromos.map((promo) => {
                                        const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date();
                                        const isExhausted = promo.max_uses && promo.current_uses >= promo.max_uses;
                                        const isUsable = promo.is_active && !isExpired && !isExhausted;

                                        return (
                                            <tr key={promo.id} className={`hover:bg-slate-800/30 transition-colors ${!promo.is_active ? 'opacity-60 grayscale' : ''}`}>
                                                <td className="p-6">
                                                    <p className="text-white font-black text-xl tracking-widest leading-none mb-1">{promo.code}</p>
                                                    <p className="text-xs text-slate-500 font-bold truncate max-w-[250px]">{promo.description || 'Sin descripción'}</p>
                                                </td>
                                                <td className="p-6">
                                                    <span className="font-black text-emerald-400 text-base bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">{formatValue(promo.type, promo.value)}</span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    {promo.is_public ? (
                                                        <span className="inline-flex items-center gap-1.5 bg-brand-500/10 text-brand-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border border-brand-500/20 shadow-inner"><Globe className="w-3.5 h-3.5"/> Pública (Landing)</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-500 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border border-slate-700"><Lock className="w-3.5 h-3.5"/> Privada (Cupón)</span>
                                                    )}
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className={`text-sm font-black px-3 py-1.5 rounded-xl ${isUsable ? 'text-slate-300 bg-slate-950 border border-slate-800' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
                                                            {promo.current_uses} / {promo.max_uses || '∞'}
                                                        </span>
                                                        {promo.expires_at && <span className="text-[10px] font-black text-slate-600 mt-2 uppercase tracking-tighter">Hasta: {new Date(promo.expires_at).toLocaleDateString()}</span>}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => toggleStatus(promo.id, promo.is_active)} className="p-3 bg-slate-950 border border-slate-800 text-slate-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-95">
                                                            {promo.is_active ? <Power className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5 text-amber-500" />}
                                                        </button>
                                                        <button onClick={() => setDeleteModal(promo.id)} className="p-3 bg-slate-950 border border-slate-800 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all shadow-sm active:scale-95">
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: LANZAR CAMPAÑA */}
            <Transition appear show={isCreateModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isSaving && setIsCreateModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm transition-opacity" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 shadow-2xl transition-all animate-in zoom-in-95 duration-300">
                                <div className="p-6 md:p-8 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                                    <Dialog.Title as="h3" className="text-xl font-black text-white flex items-center gap-3">
                                        <div className="p-2 bg-brand-500/20 rounded-xl shadow-inner"><Ticket className="w-5 h-5 text-brand-400" /></div> Lanzar Campaña
                                    </Dialog.Title>
                                    <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-slate-800 rounded-xl"><X className="w-6 h-6"/></button>
                                </div>

                                <form onSubmit={handleCreatePromo} className="p-6 md:p-10 space-y-6">
                                    
                                    {/* VISIBILIDAD */}
                                    <div 
                                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group ${formData.is_public ? 'bg-brand-500/10 border-brand-500 shadow-lg shadow-brand-500/10' : 'bg-slate-950 border-slate-800'}`}
                                        onClick={() => setFormData({...formData, is_public: !formData.is_public})}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl transition-colors ${formData.is_public ? 'bg-brand-500 text-white' : 'bg-slate-900 text-slate-500'}`}>
                                                <Globe className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-white text-base">Campaña Pública</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Habilitar visibilidad en la Landing Page</p>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full relative transition-colors ${formData.is_public ? 'bg-brand-500' : 'bg-slate-700'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${formData.is_public ? 'left-7' : 'left-1'}`} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Código de la Promo *</label>
                                        <input type="text" required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s/g, '')})} placeholder="Ej: HOTSALE" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-5 text-white font-black text-2xl uppercase tracking-[0.2em] focus:ring-2 focus:ring-brand-500/50 outline-none transition-all placeholder:tracking-normal placeholder:font-bold" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Beneficio</label>
                                            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value, value: ''})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-white font-bold focus:ring-2 focus:ring-brand-500/50 outline-none transition-all cursor-pointer">
                                                <option value="percentage">Descuento (%)</option>
                                                <option value="fixed">Monto Fijo ($)</option>
                                                <option value="free_months">Meses Gratis</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Valor</label>
                                            <input type="number" required value={formData.value} onChange={(e) => setFormData({...formData, value: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-emerald-400 font-black text-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cupos Totales</label>
                                            <input type="number" value={formData.max_uses} onChange={(e) => setFormData({...formData, max_uses: e.target.value})} placeholder="∞" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none font-bold focus:border-slate-600 transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Vencimiento</label>
                                            <input type="date" value={formData.expires_at} onChange={(e) => setFormData({...formData, expires_at: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 outline-none font-bold [color-scheme:dark] focus:border-slate-600 transition-all" />
                                        </div>
                                    </div>

                                    <div className="pt-4 flex flex-col gap-3">
                                        <button type="submit" disabled={isSaving} className="w-full py-5 rounded-2xl font-black text-xl text-white bg-brand-600 hover:bg-brand-500 transition-all shadow-xl shadow-brand-500/20 flex justify-center items-center gap-3 active:scale-95 disabled:opacity-50">
                                            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Activar Campaña
                                        </button>
                                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="w-full py-4 text-slate-500 hover:text-white font-bold transition-colors">Cancelar y salir</button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* MODAL: EDITAR PRECIO DE PLAN */}
            <Transition appear show={!!editingPlan} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isSaving && setEditingPlan(null)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
                                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Ajustar Precio Base</h3>
                                <p className="text-slate-400 text-sm font-medium mb-8">Modificando el costo del plan <b>{editingPlan?.name}</b></p>
                                
                                <form onSubmit={handleUpdatePlan} className="space-y-8">
                                    <div className="relative shadow-inner">
                                        <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 w-8 h-8" />
                                        <input type="number" required autoFocus value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-3xl pl-16 pr-6 py-6 text-white font-black text-5xl focus:ring-4 focus:ring-brand-500/20 outline-none transition-all text-center tracking-tighter" />
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <button type="submit" disabled={isSaving} className="w-full py-5 rounded-2xl font-black text-lg text-white bg-brand-600 hover:bg-brand-500 flex justify-center items-center gap-2 shadow-xl shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50">
                                            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Confirmar Cambio
                                        </button>
                                        <button type="button" onClick={() => setEditingPlan(null)} className="py-2 text-slate-500 font-bold hover:text-white transition-colors">Cancelar</button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* MODAL: ELIMINAR PROMO */}
            <Transition appear show={!!deleteModal} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isSaving && setDeleteModal(null)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-6 mx-auto shadow-inner"><Trash2 className="w-10 h-10" /></div>
                                <Dialog.Title as="h3" className="text-2xl font-black text-white mb-3 tracking-tight">¿Eliminar Campaña?</Dialog.Title>
                                <p className="text-sm text-slate-400 mb-10 font-medium leading-relaxed px-4">Esta acción quitará el beneficio de la web y el cupón dejará de ser válido inmediatamente.</p>
                                <div className="flex flex-col gap-3">
                                    <button onClick={executeDelete} disabled={isSaving} className="w-full py-5 rounded-2xl font-black text-lg text-white bg-red-600 hover:bg-red-500 shadow-xl shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Eliminar Definitivamente
                                    </button>
                                    <button onClick={() => setDeleteModal(null)} className="py-2 text-slate-500 font-bold hover:text-white transition-colors">No, mantener</button>
                                </div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}