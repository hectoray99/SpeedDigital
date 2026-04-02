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

export default function CreateProductModal({ isOpen, onClose, onSuccess, defaultType = 'product', modalTitle = 'Nuevo Ítem', industry = 'generic' }: CreateProductModalProps) {
    const { orgData } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [staffList, setStaffList] = useState<{ id: string, full_name: string }[]>([]);

    // --- ESTADOS COMPARTIDOS ---
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        type: defaultType,
        sku: '',

        // --- ESTADOS EXCLUSIVOS GYM ---
        gymPlanMode: 'monthly',
        gymSchedule: 'free',
        gymClassCount: '12',
        gymTeacherId: '',
        gymDays: [] as string[],

        // --- ESTADOS EXCLUSIVOS GASTRONOMÍA ---
        gastroCategory: 'principales',
        gastroDescription: ''
    });

    // --- ESTADOS PARA LA FOTO (Menú Digital) ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const weekDays = [
        { id: 'mon', label: 'Lu' }, { id: 'tue', label: 'Ma' }, { id: 'wed', label: 'Mi' },
        { id: 'thu', label: 'Ju' }, { id: 'fri', label: 'Vi' }, { id: 'sat', label: 'Sá' }, { id: 'sun', label: 'Do' }
    ];

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: '', price: '', type: defaultType, sku: '',
                gymPlanMode: 'monthly', gymSchedule: 'free', gymClassCount: '12',
                gymTeacherId: '', gymDays: [],
                gastroCategory: 'principales', gastroDescription: ''
            });
            setImageFile(null);
            setPreviewUrl(null);

            if (industry === 'gym') {
                fetchStaff();
            }
        }
    }, [isOpen, defaultType, industry]);

    async function fetchStaff() {
        try {
            const { data } = await supabase.from('crm_people').select('id, full_name').eq('type', 'staff').eq('is_active', true);
            if (data) setStaffList(data);
        } catch (error) {
            console.error('Error cargando staff', error);
        }
    }

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setLoading(true);

        try {
            // 1. Si hay foto, la subimos a Cloudinary primero
            let uploadedImageUrl = null;
            if (imageFile) {
                toast.loading('Subiendo imagen...', { id: 'upload' });
                uploadedImageUrl = await uploadToCloudinary(imageFile);
                toast.dismiss('upload');
            }

            // 2. Armamos las propiedades dinámicas según la industria
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
            }

            // 3. Guardamos en la base de datos
            const { error } = await supabase.from('catalog_items').insert([{
                organization_id: orgData.id,
                name: formData.name,
                price: Number(formData.price),
                type: formData.type,
                sku: formData.sku || null,
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

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">

                            {/* Header estático */}
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                <Dialog.Title as="h3" className="text-lg font-bold text-slate-900">
                                    {modalTitle}
                                </Dialog.Title>
                                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                            </div>

                            {/* ¡CORRECCIÓN ACÁ! El <form> ahora envuelve TODO el contenido (body y footer) */}
                            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                                
                                {/* Contenido scrolleable */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {/* DATOS BÁSICOS COMPARTIDOS */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del ítem</label>
                                        <input required placeholder="Ej: Hamburguesa Completa" type="text" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Precio ($)</label>
                                            <input required type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Ítem</label>
                                            <select className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 bg-white" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                                <option value="product">Producto Físico</option>
                                                {industry !== 'gastronomy' && <option value="subscription">Suscripción Mensual</option>}
                                                <option value="service">Servicio</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* BLOQUE EXCLUSIVO GASTRONOMÍA */}
                                    {industry === 'gastronomy' && (
                                        <div className="pt-4 border-t border-slate-100 mt-4 space-y-4">
                                            <div className="flex items-center gap-2 mb-2 text-brand-600 font-bold text-sm">
                                                <Utensils className="w-4 h-4" /> Configuración del Menú
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                                                <select
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 text-sm bg-white"
                                                    value={formData.gastroCategory}
                                                    onChange={e => setFormData({ ...formData, gastroCategory: e.target.value })}
                                                >
                                                    <option value="entradas">Entradas</option>
                                                    <option value="principales">Platos Principales</option>
                                                    <option value="bebidas">Bebidas</option>
                                                    <option value="postres">Postres</option>
                                                    <option value="adicionales">Adicionales / Extras</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción / Ingredientes</label>
                                                <textarea
                                                    rows={2}
                                                    placeholder="Ej: Doble carne, cheddar, bacon y salsa de la casa."
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 text-sm resize-none"
                                                    value={formData.gastroDescription}
                                                    onChange={e => setFormData({ ...formData, gastroDescription: e.target.value })}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Foto del Plato (Opcional)</label>
                                                <div
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors group"
                                                >
                                                    {previewUrl ? (
                                                        <div className="relative w-full h-32 rounded-lg overflow-hidden">
                                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">Cambiar foto</div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <ImageIcon className="w-8 h-8 text-slate-300 mb-2 group-hover:text-brand-400 transition-colors" />
                                                            <span className="text-sm font-medium text-slate-500">Hacé clic para subir una foto</span>
                                                        </>
                                                    )}
                                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* BLOQUE EXCLUSIVO GYM */}
                                    {industry === 'gym' && (
                                        <div className="pt-4 border-t border-slate-100 mt-4 space-y-4 bg-slate-50 p-4 rounded-xl">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Modalidad</label>
                                                    <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" value={formData.gymPlanMode} onChange={e => setFormData({ ...formData, gymPlanMode: e.target.value })}>
                                                        <option value="monthly">Mes Libre</option>
                                                        <option value="classes">Por Clases</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Turno</label>
                                                    <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" value={formData.gymSchedule} onChange={e => setFormData({ ...formData, gymSchedule: e.target.value })}>
                                                        <option value="free">Libre</option><option value="morning">Mañana</option><option value="afternoon">Tarde</option><option value="night">Noche</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {formData.gymPlanMode === 'classes' && (
                                                <input required type="number" min="1" placeholder="Cantidad de clases" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" value={formData.gymClassCount} onChange={e => setFormData({ ...formData, gymClassCount: e.target.value })} />
                                            )}
                                            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" value={formData.gymTeacherId} onChange={e => setFormData({ ...formData, gymTeacherId: e.target.value })}>
                                                <option value="">Sin profesor</option>
                                                {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.full_name}</option>)}
                                            </select>
                                            <div className="flex justify-between gap-1">
                                                {weekDays.map(day => (
                                                    <button key={day.id} type="button" onClick={() => toggleDay(day.id)} className={`flex-1 py-1.5 rounded-md text-xs font-bold border ${formData.gymDays.includes(day.id) ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-500'}`}>{day.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer estático YA DENTRO DEL FORM */}
                                <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                                    <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 hover:bg-black transition-colors text-white rounded-xl font-bold flex justify-center items-center gap-2">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
                                    </button>
                                </div>

                            </form>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}