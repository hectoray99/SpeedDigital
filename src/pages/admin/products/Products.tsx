// =============================================================================
// Products.tsx
// Catálogo de productos/servicios con ABM completo.
// Soporta dos modos: "product" (restaurante/menú) y "service" (gimnasio/peluquería).
// Fix aplicado: validación de orgData.id antes del INSERT para evitar violación de RLS.
// =============================================================================

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { uploadToCloudinary } from '../../../services/cloudinary';
import {
    Loader2, Plus, Search, Edit2, PackageOpen,
    Image as ImageIcon, CheckCircle2, XCircle,
    X, Trash2, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

// =============================================================================
// TIPOS
// =============================================================================

interface FormData {
    name: string;
    price: string;
    category: string;
    description: string;
    duration: string;       // Solo para servicios (en minutos)
    imageUrls: string[];
    isActive: boolean;
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export default function Products() {

    // --------------------------------------------------------------------------
    // STORE Y ESTADO GLOBAL
    // --------------------------------------------------------------------------
    const { orgData } = useAuthStore();

    // --------------------------------------------------------------------------
    // ESTADO DE DATOS
    // --------------------------------------------------------------------------
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // --------------------------------------------------------------------------
    // ESTADO DEL MODAL
    // --------------------------------------------------------------------------
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Ref para el input de archivos oculto
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --------------------------------------------------------------------------
    // MODO: SERVICIO O PRODUCTO
    // Determina textos dinámicos y campos específicos (ej: duración)
    // --------------------------------------------------------------------------
    const isServiceBased =
        orgData?.industry === 'services' || orgData?.industry === 'gym';

    // --------------------------------------------------------------------------
    // ESTADO DEL FORMULARIO
    // --------------------------------------------------------------------------
    const [formData, setFormData] = useState<FormData>({
        name: '',
        price: '',
        category: '',
        description: '',
        duration: '30',     // Valor por defecto: 30 minutos
        imageUrls: [],
        isActive: true,
    });

    // =============================================================================
    // EFECTOS
    // =============================================================================

    // Cargar productos al montar o cuando cambia la org activa
    useEffect(() => {
        if (orgData?.id) {
            fetchProducts();
        }
    }, [orgData?.id]);

    // =============================================================================
    // FUNCIONES DE DATOS
    // =============================================================================

    /**
     * Obtiene todos los ítems del catálogo de la organización activa.
     */
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
            toast.error('Error al cargar los productos');
        } finally {
            setLoading(false);
        }
    }

    // =============================================================================
    // FUNCIONES DEL MODAL
    // =============================================================================

    /**
     * Abre el modal. Si recibe un producto, precarga el formulario para edición.
     * Si no recibe nada, abre en modo creación.
     */
    const openModal = (product?: any) => {
        if (product) {
            // --- MODO EDICIÓN ---
            setEditingId(product.id);

            // Compatibilidad con ambos formatos de imágenes (array nuevo / string viejo)
            let urls: string[] = [];
            if (Array.isArray(product.properties?.image_urls)) {
                urls = product.properties.image_urls;
            } else if (
                typeof product.properties?.image_url === 'string' &&
                product.properties.image_url
            ) {
                urls = [product.properties.image_url];
            }

            setFormData({
                name: product.name,
                price: product.price.toString(),
                category: product.properties?.category || '',
                description: product.properties?.description || '',
                duration: product.duration_minutes?.toString() || '30',
                imageUrls: urls,
                isActive: product.is_active,
            });
        } else {
            // --- MODO CREACIÓN ---
            setEditingId(null);
            setFormData({
                name: '',
                price: '',
                category: '',
                description: '',
                duration: '30',
                imageUrls: [],
                isActive: true,
            });
        }

        setIsModalOpen(true);
    };

    // =============================================================================
    // MANEJO DE IMÁGENES
    // =============================================================================

    /**
     * Sube una o varias imágenes a Cloudinary y las agrega al formData.
     * Límite: 5 imágenes por ítem, 5MB por imagen.
     */
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (formData.imageUrls.length + files.length > 5) {
            return toast.error('Máximo 5 imágenes permitidas por producto');
        }

        setIsUploadingImage(true);

        try {
            const uploadPromises = files.map(async (file) => {
                if (!file.type.startsWith('image/'))
                    throw new Error('Solo se permiten imágenes');
                if (file.size > 5 * 1024 * 1024)
                    throw new Error('Cada imagen no debe superar los 5MB');
                return await uploadToCloudinary(file);
            });

            const newSecureUrls = await Promise.all(uploadPromises);

            setFormData((prev) => ({
                ...prev,
                imageUrls: [...prev.imageUrls, ...newSecureUrls],
            }));

            toast.success(files.length > 1 ? 'Imágenes subidas ☁️' : 'Imagen subida ☁️');
        } catch (error: any) {
            console.error('Error al subir imagen:', error);
            toast.error(error.message || 'Error al subir imágenes');
        } finally {
            setIsUploadingImage(false);
            // Limpiar el input para permitir subir el mismo archivo de nuevo
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    /**
     * Elimina una imagen del array por su índice.
     */
    const removeImage = (indexToRemove: number) => {
        setFormData((prev) => ({
            ...prev,
            imageUrls: prev.imageUrls.filter((_, index) => index !== indexToRemove),
        }));
    };

    // =============================================================================
    // GUARDAR / ACTUALIZAR ÍTEM
    // =============================================================================

    /**
     * Valida el formulario y guarda (INSERT) o actualiza (UPDATE) en Supabase.
     *
     * FIX RLS: Antes de intentar el INSERT verificamos que orgData.id exista.
     * Si orgData.id es undefined o null el INSERT violaría la RLS policy de
     * catalog_items (que exige organization_id IN get_auth_orgs()), generando
     * el error 42501 "new row violates row-level security policy".
     */
    const handleSave = async () => {

        // --- VALIDACIONES DE FORMULARIO ---
        if (!formData.name.trim())
            return toast.error('El nombre es obligatorio');

        if (!formData.price || isNaN(Number(formData.price)))
            return toast.error('Precio inválido');

        if (!formData.category.trim())
            return toast.error('La categoría es obligatoria');

        // --- FIX: Validar que la organización esté cargada antes de insertar ---
        // Sin este chequeo, organization_id llega como undefined al INSERT
        // y Supabase rechaza la fila por violar la política RLS de catalog_items.
        if (!orgData?.id) {
            console.error('handleSave: orgData.id es undefined. orgData:', orgData);
            return toast.error('No hay organización activa. Intentá recargar la página.');
        }

        setIsSaving(true);

        try {
            // --- ARMAR EL PAYLOAD ---
            const productPayload: any = {
                organization_id: orgData.id,
                name: formData.name.trim(),
                price: Number(formData.price),
                is_active: formData.isActive,
                type: isServiceBased ? 'service' : 'product',
                properties: {
                    category: formData.category.trim(),
                    description: formData.description.trim(),
                    image_urls: formData.imageUrls,
                    // Mantenemos image_url para compatibilidad con código legacy
                    image_url: formData.imageUrls.length > 0 ? formData.imageUrls[0] : null,
                },
            };

            // Agregar duración solo para industrias basadas en servicios
            if (isServiceBased) {
                productPayload.duration_minutes = Number(formData.duration);
            }

            // --- INSERTAR O ACTUALIZAR ---
            if (editingId) {
                const { error } = await supabase
                    .from('catalog_items')
                    .update(productPayload)
                    .eq('id', editingId);

                if (error) throw error;
                toast.success('Ítem actualizado');
            } else {
                const { error } = await supabase
                    .from('catalog_items')
                    .insert([productPayload]);

                if (error) throw error;
                toast.success('Ítem creado exitosamente');
            }

            setIsModalOpen(false);
            fetchProducts();

        } catch (error: any) {
            // Log detallado para debugging futuro
            console.error('Error al guardar ítem:', error);
            toast.error('Error al guardar el ítem');
        } finally {
            setIsSaving(false);
        }
    };

    // =============================================================================
    // CAMBIAR ESTADO ACTIVO/PAUSADO
    // =============================================================================

    /**
     * Alterna el estado is_active de un ítem sin abrir el modal.
     */
    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('catalog_items')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            toast.success(currentStatus ? 'Pausado' : 'Activado');

            // Actualizar estado local para evitar un re-fetch innecesario
            setProducts((prev) =>
                prev.map((p) =>
                    p.id === id ? { ...p, is_active: !currentStatus } : p
                )
            );
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            toast.error('Error al cambiar estado');
        }
    };

    // =============================================================================
    // DERIVADOS Y TEXTOS DINÁMICOS
    // =============================================================================

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    // Textos que cambian según la industria
    const titleText      = isServiceBased ? 'Catálogo de Servicios' : 'Catálogo y Menú';
    const subtitleText   = isServiceBased
        ? 'Gestioná tus servicios, duración y precios.'
        : 'Gestioná tus platos, precios y fotos (hasta 5 por producto).';
    const buttonText        = isServiceBased ? 'Nuevo Servicio'  : 'Nuevo Plato';
    const searchPlaceholder = isServiceBased
        ? 'Buscar servicio por nombre...'
        : 'Buscar producto por nombre...';

    // =============================================================================
    // RENDER - LOADING
    // =============================================================================

    if (loading) {
        return (
            <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
        );
    }

    // =============================================================================
    // RENDER PRINCIPAL
    // =============================================================================

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">

            {/* ------------------------------------------------------------------ */}
            {/* CABECERA                                                            */}
            {/* ------------------------------------------------------------------ */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <PackageOpen className="w-8 h-8 text-brand-500" />
                        {titleText}
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">{subtitleText}</p>
                </div>

                <button
                    onClick={() => openModal()}
                    className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    {buttonText}
                </button>
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* BUSCADOR                                                            */}
            {/* ------------------------------------------------------------------ */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none font-medium"
                    />
                </div>
                <div className="text-sm font-bold text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    {filteredProducts.length} ítems
                </div>
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* TABLA DE PRODUCTOS / SERVICIOS                                      */}
            {/* ------------------------------------------------------------------ */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">

                        {/* Encabezados */}
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm font-bold">
                                <th className="p-4">{isServiceBased ? 'Servicio' : 'Producto'}</th>
                                <th className="p-4">Categoría</th>
                                {isServiceBased && <th className="p-4">Duración</th>}
                                <th className="p-4">Precio</th>
                                <th className="p-4">Estado</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>

                        {/* Filas */}
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={isServiceBased ? 6 : 5}
                                        className="p-12 text-center text-slate-400 font-medium"
                                    >
                                        No se encontraron resultados.
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    // Imagen de portada (primera del array o campo legacy)
                                    const firstImg = Array.isArray(product.properties?.image_urls)
                                        ? product.properties.image_urls[0]
                                        : product.properties?.image_url;

                                    return (
                                        <tr
                                            key={product.id}
                                            className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group"
                                        >
                                            {/* Nombre + imagen */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    {firstImg ? (
                                                        <div className="relative shrink-0">
                                                            <img
                                                                src={firstImg}
                                                                alt="img"
                                                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm"
                                                            />
                                                            {/* Badge de cantidad de fotos */}
                                                            {product.properties?.image_urls?.length > 1 && (
                                                                <span className="absolute -top-2 -right-2 bg-slate-800 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                                                    {product.properties.image_urls.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 shrink-0">
                                                            <ImageIcon className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-800">{product.name}</p>
                                                        {product.properties?.description && (
                                                            <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">
                                                                {product.properties.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Categoría */}
                                            <td className="p-4">
                                                <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-lg text-xs uppercase tracking-wider border border-slate-200">
                                                    {product.properties?.category || 'Sin categoría'}
                                                </span>
                                            </td>

                                            {/* Duración (solo servicios) */}
                                            {isServiceBased && (
                                                <td className="p-4 font-medium text-slate-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-4 h-4 text-slate-400" />
                                                        {product.duration_minutes || 30} min
                                                    </div>
                                                </td>
                                            )}

                                            {/* Precio */}
                                            <td className="p-4 font-black text-slate-800">
                                                ${product.price.toLocaleString()}
                                            </td>

                                            {/* Estado activo/pausado */}
                                            <td className="p-4">
                                                <button
                                                    onClick={() => toggleStatus(product.id, product.is_active)}
                                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                                                        product.is_active
                                                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {product.is_active
                                                        ? <CheckCircle2 className="w-4 h-4" />
                                                        : <XCircle className="w-4 h-4" />
                                                    }
                                                    {product.is_active ? 'Activo' : 'Pausado'}
                                                </button>
                                            </td>

                                            {/* Acciones (visible al hacer hover) */}
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => openModal(product)}
                                                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ================================================================== */}
            {/* MODAL ABM — Renderizado en document.body con Portal                */}
            {/* ================================================================== */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                        {/* Header del modal */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h2 className="text-xl font-black text-slate-800">
                                {editingId
                                    ? (isServiceBased ? 'Editar Servicio' : 'Editar Producto')
                                    : (isServiceBased ? 'Nuevo Servicio'  : 'Nuevo Producto')
                                }
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Cuerpo scrolleable del modal */}
                        <div className="p-6 space-y-5 overflow-y-auto">

                            {/* --- Nombre, Precio y Categoría --- */}
                            <div className="grid grid-cols-2 gap-4">

                                {/* Nombre */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder={isServiceBased ? 'Ej: Corte Clásico' : 'Ej: Hamburguesa Doble'}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-medium outline-none"
                                    />
                                </div>

                                {/* Precio */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Precio *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                                            $
                                        </span>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Categoría */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Categoría *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder={isServiceBased ? 'Ej: Peluquería' : 'Ej: Principales'}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-medium outline-none uppercase"
                                    />
                                </div>

                                {/* Duración — Solo para servicios/gym */}
                                {isServiceBased && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Duración (en minutos) *
                                        </label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            <select
                                                value={formData.duration}
                                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-bold outline-none cursor-pointer appearance-none"
                                            >
                                                <option value="15">15 minutos</option>
                                                <option value="30">30 minutos</option>
                                                <option value="45">45 minutos</option>
                                                <option value="60">1 hora</option>
                                                <option value="90">1 hora y media</option>
                                                <option value="120">2 horas</option>
                                                <option value="180">3 horas</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* --- Descripción --- */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    Descripción (Opcional)
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={isServiceBased ? 'Detalles del servicio...' : 'Ingredientes o detalles...'}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-medium outline-none resize-none h-20"
                                />
                            </div>

                            {/* --- Galería de imágenes múltiples --- */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-slate-700">Fotos</label>
                                    <span className="text-xs font-bold text-slate-400">
                                        {formData.imageUrls.length} de 5
                                    </span>
                                </div>

                                {/* Input de archivo oculto */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />

                                <div className="flex flex-wrap gap-3">

                                    {/* Miniaturas de imágenes cargadas */}
                                    {formData.imageUrls.map((url, index) => (
                                        <div
                                            key={index}
                                            className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 w-24 h-24 shrink-0 shadow-sm"
                                        >
                                            <img
                                                src={url}
                                                alt={`Foto ${index}`}
                                                className="w-full h-full object-cover"
                                            />

                                            {/* Badge "Portada" en la primera imagen */}
                                            {index === 0 && (
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-bold text-center py-0.5">
                                                    Portada
                                                </div>
                                            )}

                                            {/* Overlay con botón eliminar (hover) */}
                                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Botón para agregar más imágenes (máximo 5) */}
                                    {formData.imageUrls.length < 5 && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingImage}
                                            className="w-24 h-24 shrink-0 border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors text-slate-500 hover:text-brand-600"
                                        >
                                            {isUploadingImage ? (
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <>
                                                    <Plus className="w-8 h-8 opacity-70" />
                                                    <span className="text-[10px] font-bold opacity-60 text-center px-1">
                                                        Subir Foto
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* --- Checkbox visibilidad pública --- */}
                            <div className="flex items-center gap-3 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                                />
                                <label htmlFor="isActive" className="font-bold text-slate-700 cursor-pointer">
                                    Activo (Visible en el menú público)
                                </label>
                            </div>
                        </div>

                        {/* Footer del modal con acciones */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 py-3 rounded-xl font-black text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Guardando...' : 'Guardar Ítem'}
                            </button>
                        </div>

                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}
