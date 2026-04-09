import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import {
    Loader2, Plus, Search, Edit2, PackageOpen,
    Image as ImageIcon, CheckCircle2, XCircle,
    X, Trash2, Clock, Dumbbell, UploadCloud,Hash
} from 'lucide-react';

interface FormData {
    name: string;
    price: string;
    category: string;
    description: string;
    duration: string;
    plan_mode: string;
    class_count: string;
    imageUrls: string[];
    isActive: boolean;
}

export default function Products() {
    const { orgData } = useAuthStore();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isGym = orgData?.industry === 'gym';
    const isServiceBased = orgData?.industry === 'services' || orgData?.industry === 'sports';

    const ui = {
        title: isGym ? 'Planes de Suscripción' : (isServiceBased ? 'Catálogo de Servicios' : 'Catálogo y Menú'),
        subtitle: isGym ? 'Creá mensualidades y paquetes de clases.' : (isServiceBased ? 'Gestioná tus servicios y precios.' : 'Gestioná tus platos y precios.'),
        btnNew: isGym ? 'Nuevo Plan' : (isServiceBased ? 'Nuevo Servicio' : 'Nuevo Plato'),
        itemLabel: isGym ? 'Plan' : (isServiceBased ? 'Servicio' : 'Producto'),
        icon: isGym ? Dumbbell : PackageOpen
    };

    const [formData, setFormData] = useState<FormData>({
        name: '', price: '', category: '', description: '',
        duration: '60', plan_mode: 'monthly', class_count: '12',
        imageUrls: [], isActive: true,
    });

    useEffect(() => {
        if (orgData?.id) fetchProducts();
    }, [orgData?.id]);

    async function fetchProducts() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .eq('organization_id', orgData.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error al cargar productos:', error);
            toast.error('Error al cargar el catálogo');
        } finally {
            setLoading(false);
        }
    }

    const openModal = (product?: any) => {
        if (product) {
            setEditingId(product.id);
            let urls: string[] = [];
            if (Array.isArray(product.properties?.image_urls)) {
                urls = product.properties.image_urls;
            } else if (typeof product.properties?.image_url === 'string' && product.properties.image_url) {
                urls = [product.properties.image_url];
            }

            setFormData({
                name: product.name,
                price: product.price.toString(),
                category: product.properties?.category || '',
                description: product.properties?.description || '',
                duration: product.duration_minutes?.toString() || '60',
                plan_mode: product.properties?.plan_mode || 'monthly',
                class_count: product.properties?.class_count?.toString() || '12',
                imageUrls: urls,
                isActive: product.is_active,
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '', price: '', category: '', description: '',
                duration: '60', plan_mode: 'monthly', class_count: '12',
                imageUrls: [], isActive: true,
            });
        }
        setIsModalOpen(true);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        if (formData.imageUrls.length + files.length > 5) return toast.error('Máximo 5 imágenes');
        
        setIsUploadingImage(true);
        try {
            const uploadPromises = files.map(async (file) => {
                if (!file.type.startsWith('image/')) throw new Error('Solo imágenes');
                if (file.size > 5 * 1024 * 1024) throw new Error('Máximo 5MB por imagen');
                return await uploadToCloudinary(file);
            });
            const newSecureUrls = await Promise.all(uploadPromises);
            setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ...newSecureUrls] }));
            toast.success(files.length > 1 ? 'Imágenes subidas' : 'Imagen subida');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (i: number) => setFormData(p => ({ ...p, imageUrls: p.imageUrls.filter((_, idx) => idx !== i) }));

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.price || !orgData?.id) {
            return toast.error('Nombre y Precio son obligatorios');
        }

        setIsSaving(true);
        try {
            const dbType = isGym ? 'subscription' : (isServiceBased ? 'service' : 'product');

            const productPayload: any = {
                organization_id: orgData.id,
                name: formData.name.trim(),
                price: Number(formData.price),
                is_active: formData.isActive,
                type: dbType,
                properties: {
                    category: formData.category.trim() || 'General',
                    description: formData.description.trim(),
                    image_urls: formData.imageUrls,
                    image_url: formData.imageUrls.length > 0 ? formData.imageUrls[0] : null,
                }
            };

            if (isGym) {
                productPayload.properties.plan_mode = formData.plan_mode;
                if (formData.plan_mode === 'classes') {
                    productPayload.properties.class_count = Number(formData.class_count);
                }
            } else if (isServiceBased) {
                productPayload.duration_minutes = Number(formData.duration);
            }

            if (editingId) {
                const { error } = await supabase.from('catalog_items').update(productPayload).eq('id', editingId);
                if (error) throw error;
                toast.success('Actualizado correctamente');
            } else {
                const { error } = await supabase.from('catalog_items').insert([productPayload]);
                if (error) throw error;
                toast.success('Creado exitosamente');
            }

            setIsModalOpen(false);
            fetchProducts();
        } catch (error) {
            toast.error('Error al guardar en la base de datos');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await supabase.from('catalog_items').update({ is_active: !currentStatus }).eq('id', id);
            setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
            toast.success(currentStatus ? 'Pausado' : 'Activado');
        } catch { 
            toast.error("Error al cambiar estado"); 
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-4"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /><p className="font-bold">Cargando catálogo...</p></div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-brand-100 rounded-xl"><ui.icon className="w-6 h-6 text-brand-600" /></div>
                        {ui.title}
                    </h1>
                    <p className="text-slate-500 font-medium mt-2">{ui.subtitle}</p>
                </div>
                <button onClick={() => openModal()} className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm md:text-base">
                    <Plus className="w-5 h-5" /> {ui.btnNew}
                </button>
            </div>

            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder={`Buscar ${ui.itemLabel.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10 outline-none font-medium text-slate-800 transition-all" />
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto hide-scrollbar">
                    <table className="w-full text-left min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-widest font-bold">
                                <th className="px-6 py-4">{ui.itemLabel} y Detalle</th>
                                <th className="px-6 py-4">Categoría</th>
                                {isServiceBased && <th className="px-6 py-4">Duración</th>}
                                {isGym && <th className="px-6 py-4">Modalidad</th>}
                                <th className="px-6 py-4">Precio</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredProducts.length === 0 ? (
                                <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-bold bg-slate-50/50">No se encontraron resultados.</td></tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    const firstImg = Array.isArray(product.properties?.image_urls) ? product.properties.image_urls[0] : product.properties?.image_url;
                                    return (
                                        <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    {firstImg ? (
                                                        <div className="w-14 h-14 rounded-2xl shrink-0 relative border border-slate-100 bg-white shadow-sm p-1">
                                                            <img src={firstImg} className="w-full h-full object-cover rounded-xl" />
                                                            {product.properties?.image_urls?.length > 1 && (
                                                                <span className="absolute -top-1.5 -right-1.5 bg-slate-800 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                                                                    {product.properties.image_urls.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-300 shrink-0"><ImageIcon className="w-6 h-6" /></div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-base leading-tight mb-1">{product.name}</p>
                                                        {product.properties?.description && <p className="text-xs font-medium text-slate-500 line-clamp-1 max-w-[200px]">{product.properties.description}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-slate-100 text-slate-500 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider">
                                                    {product.properties?.category || 'General'}
                                                </span>
                                            </td>
                                            
                                            {isServiceBased && <td className="px-6 py-4 text-slate-600 font-bold text-sm"><div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> {product.duration_minutes || 30} min</div></td>}
                                            
                                            {isGym && (
                                                <td className="px-6 py-4 text-slate-600 text-sm font-bold">
                                                    {product.properties?.plan_mode === 'classes' ? <span className="flex items-center gap-1.5"><Hash className="w-4 h-4 text-slate-400" /> {product.properties.class_count} Clases</span> : 'Pase Libre'}
                                                </td>
                                            )}

                                            <td className="px-6 py-4 font-black text-lg text-emerald-600">${product.price.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => toggleStatus(product.id, product.is_active)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${product.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                                                    {product.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} {product.is_active ? 'Activo' : 'Pausado'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => openModal(product)} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all focus:opacity-100 border border-transparent hover:border-brand-100 bg-white hover:shadow-sm"><Edit2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL ABM */}
            <AnimatePresence>
                {isModalOpen && createPortal(
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    {editingId ? <Edit2 className="w-5 h-5 text-brand-500" /> : <Plus className="w-5 h-5 text-brand-500" />}
                                    {editingId ? `Editar ${ui.itemLabel}` : `Nuevo ${ui.itemLabel}`}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                            </div>

                            <div className="p-6 md:p-8 space-y-6 overflow-y-auto hide-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre *</label>
                                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder={`Ej: ${isGym ? 'Pase Libre Mensual' : 'Corte Clásico'}`} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/20 font-bold text-slate-800 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Precio *</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                            <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/20 font-black text-slate-800 transition-all" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Categoría *</label>
                                        <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Ej: General" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/20 font-bold uppercase tracking-wide text-slate-700 transition-all" />
                                    </div>
                                    
                                    {isGym ? (
                                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-100 mt-2">
                                            <div>
                                                <label className=" text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> Modalidad del Plan</label>
                                                <select value={formData.plan_mode} onChange={e => setFormData({...formData, plan_mode: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none cursor-pointer font-bold text-slate-700 shadow-sm">
                                                    <option value="monthly">Acceso Libre Mensual</option>
                                                    <option value="classes">Paquete de Clases</option>
                                                </select>
                                            </div>
                                            {formData.plan_mode === 'classes' && (
                                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                                    <label className=" text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Hash className="w-4 h-4 text-slate-400" /> Cant. de Clases</label>
                                                    <input type="number" value={formData.class_count} onChange={e => setFormData({...formData, class_count: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none font-black text-slate-800 shadow-sm" />
                                                </motion.div>
                                            )}
                                        </div>
                                    ) : isServiceBased ? (
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Duración (minutos) *</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                                <select value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none cursor-pointer font-bold appearance-none text-slate-700 transition-all focus:ring-2 focus:ring-brand-500/20">
                                                    <option value="15">15 minutos</option>
                                                    <option value="30">30 minutos</option>
                                                    <option value="45">45 minutos</option>
                                                    <option value="60">1 hora</option>
                                                    <option value="90">1 hora y media</option>
                                                    <option value="120">2 horas</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descripción (Opcional)</label>
                                    <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detalles o condiciones especiales..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/20 font-medium resize-none h-24 text-slate-700 transition-all" />
                                </div>

                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <label className=" text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-4 h-4 text-brand-500" /> Galería de Fotos</label>
                                        <span className="text-[10px] font-black bg-slate-200 text-slate-500 px-2 py-1 rounded-md tracking-widest">{formData.imageUrls.length} de 5 permitidas</span>
                                    </div>
                                    <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                                    
                                    <div className="flex flex-wrap gap-3">
                                        {formData.imageUrls.map((url, index) => (
                                            <div key={index} className="relative group rounded-2xl overflow-hidden border-2 border-slate-200 bg-white w-24 h-24 md:w-28 md:h-28 shrink-0 shadow-sm p-1">
                                                <img src={url} alt={`Foto ${index}`} className="w-full h-full object-cover rounded-xl" />
                                                {index === 0 && <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/80 backdrop-blur-sm text-white text-[9px] font-black text-center py-1 rounded-lg uppercase tracking-wider">Portada</div>}
                                                <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl m-1">
                                                    <button onClick={() => removeImage(index)} className="bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {formData.imageUrls.length < 5 && (
                                            <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage} className="w-24 h-24 md:w-28 md:h-28 shrink-0 border-2 border-dashed border-slate-300 hover:border-brand-400 bg-white hover:bg-brand-50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors text-slate-400 hover:text-brand-600 active:scale-95">
                                                {isUploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <><UploadCloud className="w-7 h-7" /><span className="text-[10px] font-bold uppercase tracking-widest">Subir Foto</span></>}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-2 pl-1">
                                    <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer transition-colors" />
                                    <label htmlFor="isActive" className="font-bold text-slate-700 cursor-pointer select-none">Activo (Visible en el catálogo público)</label>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
                                <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 shadow-xl shadow-slate-900/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 text-lg">
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Ítem'}
                                </button>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}
            </AnimatePresence>
        </div>
    );
}