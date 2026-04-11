import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Save, Image as ImageIcon, Utensils } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface CreateProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    defaultType?: string;
    modalTitle?: string;
    industry?: string;
}

export default function CreateProductModal({ 
    isOpen, 
    onClose, 
    onSuccess, 
    defaultType = 'product', 
    modalTitle = 'Nuevo Ítem', 
    industry = 'generic' 
}: CreateProductModalProps) {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [staffList, setStaffList] = useState<{ id: string, full_name: string }[]>([]);

    // =========================================================================
    // ESTADOS DEL FORMULARIO (Agrupados por contexto)
    // =========================================================================
    
    // Compartidos
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        type: defaultType,
        sku: '',

        // Exclusivos Gym
        gymPlanMode: 'monthly',
        gymSchedule: 'free',
        gymClassCount: '12',
        gymTeacherId: '',
        gymDays: [] as string[],

        // Exclusivos Gastronomía
        gastroCategory: 'principales',
        gastroDescription: ''
    });

    // Imágenes
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const weekDays = [
        { id: 'mon', label: 'Lu' }, { id: 'tue', label: 'Ma' }, { id: 'wed', label: 'Mi' },
        { id: 'thu', label: 'Ju' }, { id: 'fri', label: 'Vi' }, { id: 'sat', label: 'Sá' }, { id: 'sun', label: 'Do' }
    ];

    // =========================================================================
    // INICIALIZACIÓN Y EFECTOS
    // =========================================================================
    useEffect(() => {
        if (isOpen) {
            // Resetear todos los campos al abrir
            setFormData({
                name: '', price: '', type: defaultType, sku: '',
                gymPlanMode: 'monthly', gymSchedule: 'free', gymClassCount: '12',
                gymTeacherId: '', gymDays: [],
                gastroCategory: 'principales', gastroDescription: ''
            });
            setImageFile(null);
            setPreviewUrl(null);

            // Si es un gimnasio, necesitamos la lista de profesores
            if (industry === 'gym') {
                fetchStaff();
            }
        }
    }, [isOpen, defaultType, industry]);

    async function fetchStaff() {
        try {
            const { data } = await supabase
                .from('crm_people')
                .select('id, full_name')
                .eq('type', 'staff')
                .eq('is_active', true)
                .eq('organization_id', orgData?.id);
            if (data) setStaffList(data);
        } catch (error) {
            console.error('Error cargando staff', error);
        }
    }

    // =========================================================================
    // HANDLERS (Interacciones del usuario)
    // =========================================================================
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) return toast.error("La imagen debe pesar menos de 2MB");
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const toggleDay = (dayId: string) => {
        setFormData(prev => {
            if (prev.gymDays.includes(dayId)) return { ...prev, gymDays: prev.gymDays.filter(d => d !== dayId) };
            return { ...prev, gymDays: [...prev.gymDays, dayId] };
        });
    };

    // =========================================================================
    // GUARDADO EN BASE DE DATOS
    // =========================================================================
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setLoading(true);

        try {
            // 1. Subida de Imagen (Si existe)
            let uploadedImageUrl = null;
            if (imageFile) {
                toast.loading('Subiendo imagen...', { id: 'upload' });
                uploadedImageUrl = await uploadToCloudinary(imageFile);
                toast.dismiss('upload');
            }

            // 2. Armado de JSON Properties (Dinámico según industria)
            let propertiesObj: any = {};

            if (industry === 'gym') {
                propertiesObj = {
                    plan_mode: formData.gymPlanMode,
                    schedule: formData.gymSchedule,
                    class_count: formData.gymPlanMode === 'classes' ? parseInt(formData.gymClassCount) : null,
                    teacher_id: formData.gymTeacherId || null,
                    days: formData.gymDays
                };
            } else if (industry === 'gastronomy') {
                propertiesObj = {
                    category: formData.gastroCategory,
                    description: formData.gastroDescription,
                    image_url: uploadedImageUrl
                };
            } else {
                // Caso genérico
                propertiesObj = {
                    image_url: uploadedImageUrl
                };
            }

            // 3. Inserción del Registro
            const { error } = await supabase.from('catalog_items').insert([{
                organization_id: orgData.id,
                name: formData.name.trim(),
                price: Number(formData.price),
                type: formData.type,
                sku: formData.sku.trim() || null,
                is_active: true,
                properties: propertiesObj
            }]);

            if (error) throw error;

            toast.success('Ítem guardado correctamente');
            onSuccess();
            onClose();

        } catch (error: any) {
            toast.error(error.message || 'Error al guardar');
        } finally {
            setLoading(false);
            toast.dismiss('upload');
        }
    };

    // =========================================================================
    // RENDER DEL MODAL
    // =========================================================================
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[99999]" onClose={() => !loading && onClose()}>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-[100dvh] md:min-h-full items-end md:items-center justify-center p-0 md:p-4 text-center">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-3xl md:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col h-[90dvh] md:h-auto md:max-h-[90vh]">

                            {/* HEADER */}
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0 shadow-sm z-10">
                                <Dialog.Title as="h3" className="text-lg font-black text-slate-900 tracking-tight">
                                    {modalTitle}
                                </Dialog.Title>
                                <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                            </div>

                            {/* FORMULARIO (Contiene el Body y el Footer) */}
                            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden bg-white">
                                
                                {/* BODY SCROLLEABLE */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    
                                    {/* Datos Generales (Para todas las industrias) */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre del ítem *</label>
                                            <input required autoFocus placeholder="Ej: Pase Libre o Hamburguesa" type="text" className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 font-bold text-slate-800 transition-all" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Precio ($) *</label>
                                                <input required type="number" min="0" step="0.01" className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 font-black text-slate-800 transition-all" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tipo de Ítem</label>
                                                <select className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 font-bold text-slate-700 cursor-pointer shadow-sm" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                                    <option value="product">Producto Físico</option>
                                                    {industry !== 'gastronomy' && <option value="subscription">Suscripción Mensual</option>}
                                                    <option value="service">Servicio</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BLOQUE EXCLUSIVO: GASTRONOMÍA */}
                                    {industry === 'gastronomy' && (
                                        <div className="pt-6 border-t border-slate-100 space-y-5 animate-in fade-in zoom-in-95">
                                            <div className="flex items-center gap-2 mb-2 text-brand-600 font-black tracking-tight">
                                                <Utensils className="w-5 h-5" /> Detalles del Plato
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Categoría *</label>
                                                <select className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-sm font-bold text-slate-700 cursor-pointer shadow-sm" value={formData.gastroCategory} onChange={e => setFormData({ ...formData, gastroCategory: e.target.value })}>
                                                    <option value="entradas">Entradas</option>
                                                    <option value="principales">Platos Principales</option>
                                                    <option value="bebidas">Bebidas</option>
                                                    <option value="postres">Postres</option>
                                                    <option value="adicionales">Adicionales / Extras</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descripción / Ingredientes</label>
                                                <textarea rows={3} placeholder="Ej: Doble carne, cheddar, bacon y salsa de la casa." className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 font-medium text-slate-700 resize-none transition-all" value={formData.gastroDescription} onChange={e => setFormData({ ...formData, gastroDescription: e.target.value })} />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Foto del Plato (Opcional)</label>
                                                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-brand-300 transition-all group min-h-[140px]">
                                                    {previewUrl ? (
                                                        <div className="relative w-full h-40 rounded-xl overflow-hidden shadow-sm">
                                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black uppercase tracking-wider backdrop-blur-sm">Cambiar foto</div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                                                <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-brand-500 transition-colors" />
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hacé clic para subir foto</span>
                                                        </>
                                                    )}
                                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* BLOQUE EXCLUSIVO: GIMNASIO */}
                                    {industry === 'gym' && (
                                        <div className="pt-6 border-t border-slate-100 mt-4 space-y-5 animate-in fade-in zoom-in-95">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Modalidad</label>
                                                    <select className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-sm font-bold text-slate-700 cursor-pointer shadow-sm" value={formData.gymPlanMode} onChange={e => setFormData({ ...formData, gymPlanMode: e.target.value })}>
                                                        <option value="monthly">Mes Libre</option>
                                                        <option value="classes">Por Clases</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Turno</label>
                                                    <select className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-sm font-bold text-slate-700 cursor-pointer shadow-sm" value={formData.gymSchedule} onChange={e => setFormData({ ...formData, gymSchedule: e.target.value })}>
                                                        <option value="free">Libre</option>
                                                        <option value="morning">Mañana</option>
                                                        <option value="afternoon">Tarde</option>
                                                        <option value="night">Noche</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {formData.gymPlanMode === 'classes' && (
                                                <div className="animate-in slide-in-from-top-2">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Cantidad de Clases</label>
                                                    <input required type="number" min="1" placeholder="Ej: 8" className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 font-black text-slate-800 transition-all" value={formData.gymClassCount} onChange={e => setFormData({ ...formData, gymClassCount: e.target.value })} />
                                                </div>
                                            )}
                                            
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Profesor Asignado (Opcional)</label>
                                                <select className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-sm font-bold text-slate-700 cursor-pointer shadow-sm" value={formData.gymTeacherId} onChange={e => setFormData({ ...formData, gymTeacherId: e.target.value })}>
                                                    <option value="">Sin profesor (Libre)</option>
                                                    {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.full_name}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Días Permitidos (Opcional)</label>
                                                <div className="flex justify-between gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200">
                                                    {weekDays.map(day => (
                                                        <button key={day.id} type="button" onClick={() => toggleDay(day.id)} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${formData.gymDays.includes(day.id) ? 'bg-brand-500 text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-slate-600 hover:bg-white'}`}>
                                                            {day.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* FOOTER FIJO (Botón de Guardar) */}
                                <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10">
                                    <div className="flex gap-3">
                                        <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors hidden md:block">Cancelar</button>
                                        <button type="submit" disabled={loading} className="flex-[2] py-4 bg-slate-900 hover:bg-black transition-all active:scale-95 text-white rounded-xl font-black text-lg flex justify-center items-center gap-2 shadow-xl shadow-slate-900/20 disabled:opacity-50">
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar Ítem
                                        </button>
                                    </div>
                                </div>

                            </form>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}