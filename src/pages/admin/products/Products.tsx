import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Package, Tag, Layers, Trash2, Image as ImageIcon } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore'; // <-- Traemos el store global
import CreateProductModal from '../../../components/CreateProductModal';
import { toast } from 'sonner';

const industryConfig: Record<string, { title: string; subtitle: string; buttonLabel: string; searchPlaceholder: string; defaultItemType: string }> = {
    gym: { title: 'Planes y Servicios', subtitle: 'Gestioná las cuotas y pases.', buttonLabel: 'Nuevo Plan', searchPlaceholder: 'Buscar planes...', defaultItemType: 'subscription' },
    gastronomy: { title: 'Menú y Carta', subtitle: 'Platos, bebidas y adicionales.', buttonLabel: 'Nuevo Plato', searchPlaceholder: 'Buscar en el menú...', defaultItemType: 'product' },
    default: { title: 'Catálogo de Ítems', subtitle: 'Productos y servicios.', buttonLabel: 'Nuevo Ítem', searchPlaceholder: 'Buscar productos...', defaultItemType: 'product' }
};

interface Product {
    id: string;
    name: string;
    type: string;
    price: number;
    sku: string | null;
    is_active: boolean;
    properties: any;
}

export default function Products() {
    const { orgData } = useOutletContext<any>();
    const { userRole } = useAuthStore(); // <-- Extraemos el rol
    const industry = orgData?.industry || 'default';
    const config = industryConfig[industry] || industryConfig.default;

    // Booleano de seguridad
    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchProducts();
    }, []);

    async function fetchProducts() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .eq('organization_id', orgData.id)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            if (data) setProducts(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que querés eliminar este ítem?')) return;
        try {
            const { error } = await supabase.from('catalog_items').update({ is_active: false }).eq('id', id);
            if (error) throw error;
            toast.success('Ítem eliminado');
            fetchProducts();
        } catch (error: any) {
            toast.error(error.message);
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <CreateProductModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchProducts}
                defaultType={config.defaultItemType}
                modalTitle={config.buttonLabel}
                industry={industry}
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">{config.title}</h1>
                    <p className="text-slate-500">{config.subtitle}</p>
                </div>
                {/* BLINDAJE VISUAL: Solo dueños/admins ven el botón de Nuevo Producto */}
                {isOwnerOrAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-brand-500/20 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        {config.buttonLabel}
                    </button>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder={config.searchPlaceholder}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all text-slate-900"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full p-12 text-center text-slate-500">Cargando datos...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-slate-500 flex flex-col items-center">
                        <Package className="w-12 h-12 text-slate-300 mb-2" />
                        <p>No hay registros activos en el menú.</p>
                    </div>
                ) : (
                    filteredProducts.map((product) => (
                        <div key={product.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col h-full">

                            {/* BLINDAJE VISUAL: Solo dueños/admins ven el tachito de basura */}
                            {isOwnerOrAdmin && (
                                <button
                                    onClick={() => handleDelete(product.id)}
                                    className="absolute top-3 right-3 z-10 bg-white/80 backdrop-blur-sm p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                    title="Eliminar ítem"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}

                            {/* FOTO DEL PLATO */}
                            {industry === 'gastronomy' && (
                                <div className="h-40 w-full bg-slate-100 shrink-0 relative border-b border-slate-100">
                                    {product.properties?.image_url ? (
                                        <img src={product.properties.image_url} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                            <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                                            <span className="text-xs font-medium">Sin foto</span>
                                        </div>
                                    )}
                                    {product.properties?.category && (
                                        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                                            {product.properties.category}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-slate-800 text-lg leading-tight pr-4">{product.name}</h3>
                                    <span className="font-black text-brand-600 text-lg shrink-0">
                                        ${product.price.toLocaleString()}
                                    </span>
                                </div>

                                {industry === 'gastronomy' && product.properties?.description && (
                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                                        {product.properties.description}
                                    </p>
                                )}

                                <div className="flex-1"></div>

                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                                    <div className={`p-1.5 rounded-md ${product.type === 'service' ? 'bg-purple-100 text-purple-600' : (product.type === 'subscription' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600')}`}>
                                        {product.type === 'service' || product.type === 'subscription' ? <Layers className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                                    </div>
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                                        {product.type === 'subscription' ? 'Suscripción' : (product.type === 'service' ? 'Servicio' : 'Producto')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}