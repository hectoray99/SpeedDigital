import { useEffect, useState, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { toast } from 'sonner';

import {
    Loader2, Plus, Search, Edit2,
    Image as ImageIcon, CheckCircle2, XCircle,
    X, Trash2, UploadCloud, Save, ShoppingBag, Coffee
} from 'lucide-react';

interface FormData {
    name: string;
    price: string;
    category: string;
    description: string;
    imageUrls: string[];
    isActive: boolean;
}

export default function Products() {
    const { orgData } = useAuthStore();
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>(['General']);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isNewCategory, setIsNewCategory] = useState(false); // Estado para el input de nueva categoría
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Diferenciación visual clara para este panel (Mostrador vs Servicios)
    const isRestaurant = orgData?.industry === 'restaurant' || orgData?.industry === 'gastronomy';
    const ui = {
        title: isRestaurant ? 'Menú y Platos' : 'Productos y Mostrador',
        subtitle: isRestaurant ? 'Gestioná los platos y bebidas de tu local.' : 'Gestioná stock físico, bebidas o accesorios de venta directa.',
        btnNew: isRestaurant ? 'Nuevo Plato' : 'Nuevo Producto',
        itemLabel: isRestaurant ? 'Plato' : 'Producto',
        icon: isRestaurant ? Coffee : ShoppingBag
    };

    const [formData, setFormData] = useState<FormData>({
        name: '', price: '', category: '', description: '',
        imageUrls: [], isActive: true
    });

    useEffect(() => {
        if (orgData?.id) fetchProducts();
    }, [orgData?.id]);

    async function fetchProducts() {
        if (!orgData?.id) return;
        
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .eq('organization_id', orgData.id)
                .eq('type', 'product') // SOLO trae productos físicos, ignora los servicios agendables
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Extraer las categorías únicas de los productos existentes
            const uniqueCategories = Array.from(
                new Set((data || []).map(item => item.properties?.category).filter(Boolean))
            ) as string[];
            
            setCategories(uniqueCategories.length > 0 ? uniqueCategories : ['General']);
            setProducts(data || []);
        } catch (error) {
            toast.error('Error al cargar los productos');
        } finally {
            setLoading(false);
        }
    }

    const openModal = (product?: any) => {
        setIsNewCategory(false); // Resetear siempre el modo de nueva categoría
        
        if (product && product.id) {
            setEditingId(product.id);
            let urls: string[] = [];
            
            if (Array.isArray(product.properties?.image_urls)) {
                urls = product.properties.image_urls;
            } else if (typeof product.properties?.image_url === 'string' && product.properties.image_url) {
                urls = [product.properties.image_url];
            }

            const prodCategory = product.properties?.category || categories[0] || 'General';

            setFormData({
                name: product.name,
                price: product.price.toString(),
                category: prodCategory,
                description: product.properties?.description || '',
                imageUrls: urls,
                isActive: product.is_active !== false,
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '', price: '', category: categories[0] || 'General', description: '',
                imageUrls: [], isActive: true
            });
        }
        setIsModalOpen(true);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        if (formData.imageUrls.length + files.length > 5) return toast.error('Máximo 5 imágenes por ítem');
        
        setIsUploadingImage(true);
        try {
            const uploadPromises = files.map(async (file) => {
                if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen');
                if (file.size > 5 * 1024 * 1024) throw new Error('El archivo no puede pesar más de 5MB');
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
        if (!formData.name.trim()) return toast.error('El nombre es obligatorio');
        if (formData.price === '' || Number(formData.price) < 0) return toast.error('Ingresá un precio válido (mayor a 0)');
        if (!formData.category.trim()) return toast.error('La categoría es obligatoria');
        if (!orgData?.id) return;

        setIsSaving(true);
        try {
            const finalCategory = formData.category.trim();
            const productPayload: any = {
                organization_id: orgData.id,
                name: formData.name.trim(),
                price: Number(formData.price),
                is_active: formData.isActive,
                type: 'product', // Obligamos a que se guarde como producto físico
                properties: {
                    category: finalCategory,
                    description: formData.description.trim(),
                    image_urls: formData.imageUrls,
                    image_url: formData.imageUrls.length > 0 ? formData.imageUrls[0] : null,
                }
            };

            if (editingId) {
                const { error } = await supabase.from('catalog_items').update(productPayload).eq('id', editingId);
                if (error) throw error;
                toast.success('Producto actualizado correctamente');
            } else {
                const { error } = await supabase.from('catalog_items').insert([productPayload]);
                if (error) throw error;
                toast.success('Producto creado exitosamente');
            }

            setIsModalOpen(false);
            fetchProducts();
        } catch (error) {
            toast.error('Error de base de datos al guardar.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await supabase.from('catalog_items').update({ is_active: !currentStatus }).eq('id', id);
            setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
            toast.success(currentStatus ? 'Producto pausado' : 'Producto activado');
        } catch { 
            toast.error("Error al cambiar el estado"); 
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!orgData?.id) return;
        if (!window.confirm(`¿Estás seguro de que querés eliminar el producto "${name}"?\nEsta acción no se puede deshacer.`)) return;

        try {
            const { error } = await supabase.from('catalog_items').delete().eq('id', id).eq('organization_id', orgData.id);
            if (error) throw error;
            
            setProducts(products.filter(p => p.id !== id));
            toast.success('Producto eliminado permanentemente');
        } catch (error) {
            toast.error('Error al eliminar. Podría estar asociado a ventas pasadas.');
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-4 animate-in fade-in duration-500"><Loader2 className="w-10 h-10 animate-spin text-brand-500" /><p className="font-bold uppercase tracking-widest text-sm">Cargando productos...</p></div>;

    const TopIcon = ui.icon;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
            
            {/* CABECERA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-emerald-100 rounded-xl"><TopIcon className="w-6 h-6 text-emerald-600" /></div>
                        {ui.title}
                    </h1>
                    <p className="text-slate-500 font-medium mt-2 text-base">{ui.subtitle}</p>
                </div>
                <button onClick={() => openModal()} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm md:text-base">
                    <Plus className="w-5 h-5" /> {ui.btnNew}
                </button>
            </div>

            {/* BUSCADOR */}
            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder={`Buscar ${ui.itemLabel.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none font-medium text-slate-800 transition-all" />
                </div>
            </div>

            {/* TABLA */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto hide-scrollbar">
                    <table className="w-full text-left min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-widest font-bold">
                                <th className="px-6 py-5">{ui.itemLabel} y Detalle</th>
                                <th className="px-6 py-5">Categoría</th>
                                <th className="px-6 py-5">Precio</th>
                                <th className="px-6 py-5 text-center">Estado</th>
                                <th className="px-6 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredProducts.length === 0 ? (
                                <tr><td colSpan={5} className="p-16 text-center text-slate-400 font-bold bg-slate-50/50 text-base">No se encontraron productos de mostrador.</td></tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    const firstImg = Array.isArray(product.properties?.image_urls) ? product.properties.image_urls[0] : product.properties?.image_url;
                                    return (
                                        <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    {firstImg ? (
                                                        <div className="w-14 h-14 rounded-2xl shrink-0 relative border border-slate-100 bg-white shadow-sm p-1">
                                                            <img src={firstImg} className="w-full h-full object-cover rounded-xl" alt="" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-300 shrink-0"><ImageIcon className="w-6 h-6" /></div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-base leading-tight mb-1">{product.name}</p>
                                                        {product.properties?.description && <p className="text-[11px] font-medium text-slate-500 line-clamp-1 max-w-[200px]">{product.properties.description}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-slate-100 text-slate-500 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider">
                                                    {product.properties?.category || 'General'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-black text-lg text-slate-800">${product.price.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => toggleStatus(product.id, product.is_active)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${product.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                                                    {product.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} {product.is_active ? 'Activo' : 'Pausado'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openModal(product)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all focus:opacity-100 border border-transparent hover:border-emerald-100 bg-white hover:shadow-sm" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(product.id, product.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all focus:opacity-100 border border-transparent hover:border-red-100 bg-white hover:shadow-sm" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            <Transition appear show={isModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[99999]" onClose={() => !isSaving && setIsModalOpen(false)}>
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                    
                    <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                        <div className="flex min-h-full items-end justify-center p-0 md:items-center md:p-4 text-center">
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col max-h-[90vh] md:max-h-[85vh]">
                                
                                {/* Header: Fijo arriba */}
                                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                    <Dialog.Title as="h3" className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <div className="p-2 bg-emerald-100 rounded-xl">
                                            {editingId ? <Edit2 className="w-5 h-5 text-emerald-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                                        </div>
                                        {editingId ? `Editar ${ui.itemLabel}` : `Nuevo ${ui.itemLabel}`}
                                    </Dialog.Title>
                                    <button onClick={() => setIsModalOpen(false)} disabled={isSaving} className="p-2 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>

                                {/* Body: Zona scrolleable */}
                                <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1 hide-scrollbar bg-white">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre *</label>
                                            <input type="text" autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder={`Ej: ${isRestaurant ? 'Hamburguesa Completa' : 'Cera Capilar 100g'}`} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white font-bold text-slate-800 transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Precio de Venta *</label>
                                            <div className="relative shadow-sm rounded-2xl">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                <input type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" className="w-full pl-9 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white font-black text-slate-800 transition-all" />
                                            </div>
                                        </div>

                                        {/* SELECCIÓN DE CATEGORÍA INTELIGENTE */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Categoría *</label>
                                            {!isNewCategory ? (
                                                <select 
                                                    value={formData.category} 
                                                    onChange={e => {
                                                        if (e.target.value === '___new___') {
                                                            setIsNewCategory(true);
                                                            setFormData({...formData, category: ''});
                                                        } else {
                                                            setFormData({...formData, category: e.target.value});
                                                        }
                                                    }} 
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold uppercase tracking-wide text-slate-700 transition-all shadow-sm cursor-pointer appearance-none"
                                                >
                                                    <option value="" disabled>Seleccioná una categoría</option>
                                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    <option value="___new___" className="font-black text-emerald-600">+ Agregar nueva categoría...</option>
                                                </select>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        autoFocus 
                                                        value={formData.category} 
                                                        onChange={e => setFormData({...formData, category: e.target.value})} 
                                                        placeholder="Escribí la categoría..." 
                                                        className="w-full p-4 bg-white border border-emerald-400 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold uppercase tracking-wide text-slate-800 transition-all shadow-sm" 
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setIsNewCategory(false);
                                                            setFormData({...formData, category: categories[0] || 'General'});
                                                        }} 
                                                        className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-bold transition-colors"
                                                    >
                                                        Volver
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descripción (Opcional)</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detalles, marcas o contenido..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white font-medium resize-none h-24 text-slate-700 transition-all shadow-sm" />
                                    </div>

                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className=" text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-4 h-4 text-emerald-500" /> Galería de Fotos</label>
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
                                                <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage} className="w-24 h-24 md:w-28 md:h-28 shrink-0 border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-white hover:bg-emerald-50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors text-slate-400 hover:text-emerald-600 active:scale-95">
                                                    {isUploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <><UploadCloud className="w-7 h-7" /><span className="text-[10px] font-bold uppercase tracking-widest">Subir Foto</span></>}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2 pl-1 pb-4">
                                        <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-colors" />
                                        <label htmlFor="isActive" className="font-bold text-slate-700 cursor-pointer select-none">Activo (Visible para vender en mostrador)</label>
                                    </div>
                                </div>

                                {/* Footer: Fijo abajo */}
                                <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                                    <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="flex-1 py-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">Cancelar</button>
                                    <button type="button" onClick={handleSave} disabled={isSaving} className="flex-[2] py-4 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-500 shadow-xl shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 text-lg">
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar Producto
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