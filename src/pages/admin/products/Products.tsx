import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Package, Tag, Layers } from 'lucide-react';
import CreateProductModal from '../../../components/CreateProductModal'; // Crearemos este modal en el siguiente paso

interface Product {
    id: string;
    name: string;
    type: string;
    price: number;
    sku: string | null;
    is_active: boolean;
}

export default function Products() {
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
                .from('catalog_items') // <-- Nueva tabla
                .select('*')
                .order('name');

            if (error) throw error;
            if (data) setProducts(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
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
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Catálogo</h1>
                    <p className="text-slate-500">Productos, servicios y planes de suscripción.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-brand-500/20 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Ítem
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full p-12 text-center text-slate-500">Cargando catálogo...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-slate-500 flex flex-col items-center">
                        <Package className="w-12 h-12 text-slate-300 mb-2" />
                        <p>No hay productos registrados.</p>
                    </div>
                ) : (
                    filteredProducts.map((product) => (
                        <div key={product.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-2 rounded-lg ${product.type === 'service' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {product.type === 'service' || product.type === 'subscription' ? <Layers className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                                </div>
                                <span className="font-bold text-lg text-slate-800">
                                    ${product.price.toLocaleString()}
                                </span>
                            </div>

                            <h3 className="font-bold text-slate-800 mb-1">{product.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-semibold tracking-wider">
                                <span>{product.type === 'subscription' ? 'Suscripción' : (product.type === 'service' ? 'Servicio' : 'Producto')}</span>
                                {product.sku && <span>• SKU: {product.sku}</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}