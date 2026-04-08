import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, Utensils, MapPin, Phone, Search } from 'lucide-react';

interface MenuItem {
    id: string;
    name: string;
    price: number;
    properties: {
        category?: string;
        description?: string;
        image_url?: string;
    };
}

interface Organization {
    name: string;
    logo_url: string | null;
    settings: {
        phone?: string;
        address?: string;
        instagram?: string;
    };
}

export default function DigitalMenu() {
    const { slug } = useParams(); // Obtenemos el nombre del restaurante de la URL (ej: /m/bacanal)
    const [org, setOrg] = useState<Organization | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    
    // Estados nuevos para la búsqueda y filtros
    const [activeCategory, setActiveCategory] = useState<string>('Todas');
    const [search, setSearch] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (slug) {
            fetchMenuData();
        }
    }, [slug]);

    async function fetchMenuData() {
        try {
            setLoading(true);
            setError(false);

            // 1. Buscamos los datos públicos del restaurante por su slug
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('id, name, logo_url, settings')
                .eq('slug', slug)
                .single();

            if (orgError || !orgData) throw new Error('Restaurante no encontrado');
            setOrg(orgData);

            // 2. Buscamos el catálogo activo de ese restaurante
            const { data: itemsData, error: itemsError } = await supabase
                .from('catalog_items')
                .select('id, name, price, properties')
                .eq('organization_id', orgData.id)
                .eq('is_active', true)
                .order('name');

            if (itemsError) throw itemsError;

            const items = itemsData || [];
            setMenuItems(items);

            // 3. Extraemos las categorías para armar los botones
            const uniqueCategories = Array.from(
                new Set(items.map(item => item.properties?.category).filter(Boolean))
            ) as string[];

            // Agregamos "Todas" al principio
            setCategories(['Todas', ...uniqueCategories]);

        } catch (error) {
            console.error('Error fetching digital menu:', error);
            setError(true);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="text-slate-500 font-medium">Cargando el menú...</p>
            </div>
        );
    }

    if (error || !org) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <Utensils className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Menú no disponible</h1>
                <p className="text-slate-500">No pudimos encontrar la carta de este restaurante. Por favor, verificá el código QR.</p>
            </div>
        );
    }

    // Filtramos los platos combinando la Búsqueda + la Categoría
    const visibleItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = activeCategory === 'Todas' || item.properties?.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-slate-50 pb-12 font-sans">
            
            {/* CABECERA (Portada del Restaurante) */}
            <div className="bg-slate-900 text-white pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
                <div className="max-w-md mx-auto text-center relative z-10">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-24 h-24 rounded-full mx-auto border-4 border-white/10 object-cover mb-4 shadow-xl" />
                    ) : (
                        <div className="w-20 h-20 rounded-full mx-auto bg-brand-500 flex items-center justify-center mb-4 shadow-xl border-4 border-white/10">
                            <Utensils className="w-8 h-8 text-white" />
                        </div>
                    )}
                    <h1 className="text-3xl font-black tracking-tight mb-3">{org.name}</h1>
                    
                    {/* Info de contacto si existe en settings */}
                    <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-300 font-medium">
                        {org.settings?.address && (
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-brand-400" /> {org.settings.address}</span>
                        )}
                        {org.settings?.phone && (
                            <span className="flex items-center gap-1"><Phone className="w-4 h-4 text-brand-400" /> {org.settings.phone}</span>
                        )}
                    </div>
                </div>
                
                {/* Decoración de fondo (Tus luces neón) */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500 rounded-full mix-blend-screen filter blur-3xl"></div>
                    <div className="absolute bottom-0 -left-20 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-3xl"></div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 -mt-16 relative z-20">
                
                {/* BUSCADOR Y NAVEGACIÓN DE CATEGORÍAS */}
                <div className="bg-white p-3 rounded-3xl shadow-xl shadow-slate-200/50 mb-6 border border-slate-100">
                    
                    {/* Buscador */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Buscar plato o bebida..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 font-medium outline-none transition-all"
                        />
                    </div>

                    {/* Categorías (Sticky / Pegajosa) */}
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`snap-start px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex-1 text-center ${
                                    activeCategory === cat 
                                    ? 'bg-brand-500 text-white shadow-md' 
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                {cat.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* LISTA DE PLATOS */}
                <div className="space-y-4">
                    {visibleItems.map(item => (
                        <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 overflow-hidden relative group">
                            
                            {/* Información del Plato */}
                            <div className="flex-1 flex flex-col justify-center">
                                <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{item.name}</h3>
                                {item.properties?.description && (
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                                        {item.properties.description}
                                    </p>
                                )}
                                <span className="font-black text-brand-600 text-lg mt-auto">
                                    ${item.price.toLocaleString()}
                                </span>
                            </div>

                            {/* Foto del Plato (Si tiene) */}
                            {item.properties?.image_url && (
                                <div className="w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                                    <img 
                                        src={item.properties.image_url} 
                                        alt={item.name} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {visibleItems.length === 0 && (
                    <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-slate-100 mt-4">
                        <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-bold">No encontramos platos con esa búsqueda.</p>
                    </div>
                )}
            </div>

            {/* Footer B2B */}
            <div className="mt-12 text-center pb-8">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Menú Digital creado con <span className="text-brand-500">SpeedDigital</span>
                </p>
            </div>
            
        </div>
    );
}