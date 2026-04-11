import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, Utensils, MapPin, Phone, Search, ChevronRight, Zap } from 'lucide-react';

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
    const { slug } = useParams();
    
    // --- ESTADOS DE LA PÁGINA ---
    const [org, setOrg] = useState<Organization | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    
    // --- ESTADOS DE FILTRADO ---
    const [activeCategory, setActiveCategory] = useState<string>('Todas');
    const [search, setSearch] = useState('');
    
    // --- ESTADOS DE CARGA Y ERROR ---
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // =========================================================================
    // INICIALIZACIÓN Y BÚSQUEDA
    // =========================================================================
    useEffect(() => {
        if (slug) fetchMenuData();
    }, [slug]);

    async function fetchMenuData() {
        try {
            setLoading(true);
            setError(false);

            // 1. Buscamos el local por su SLUG
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('id, name, logo_url, settings')
                .eq('slug', slug)
                .single();

            if (orgError || !orgData) throw new Error('Restaurante no encontrado');
            setOrg(orgData);

            // 2. Traemos su menú (solo platos activos)
            const { data: itemsData, error: itemsError } = await supabase
                .from('catalog_items')
                .select('id, name, price, properties')
                .eq('organization_id', orgData.id)
                .eq('is_active', true)
                .order('name');

            if (itemsError) throw itemsError;

            const items = itemsData || [];
            setMenuItems(items);

            // 3. Extraemos las categorías para crear las "pestañas" superiores
            const uniqueCategories = Array.from(
                new Set(items.map(item => item.properties?.category).filter(Boolean))
            ) as string[];

            setCategories(['Todas', ...uniqueCategories]);
        } catch (error) {
            console.error(error);
            setError(true);
        } finally {
            setLoading(false);
        }
    }

    // =========================================================================
    // RENDER: PANTALLAS DE ESTADO
    // =========================================================================
    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="text-slate-500 font-medium tracking-wide uppercase text-sm">Preparando la carta...</p>
            </div>
        );
    }

    if (error || !org) {
        return (
            <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Utensils className="w-10 h-10 text-slate-400" />
                </div>
                <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Menú no disponible</h1>
                <p className="text-slate-500 max-w-sm font-medium text-lg leading-relaxed">No pudimos encontrar la carta de este restaurante. Verificá que el código QR o el enlace sean correctos.</p>
            </div>
        );
    }

    // =========================================================================
    // RENDER PRINCIPAL (MENÚ DIGITAL)
    // =========================================================================
    const visibleItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = activeCategory === 'Todas' || item.properties?.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-[100dvh] bg-slate-50 font-sans selection:bg-brand-500/20">
            
            {/* CABECERA (Portada) */}
            <div className="bg-slate-900 text-white pt-10 pb-28 px-4 rounded-b-[3rem] shadow-xl relative overflow-hidden animate-in slide-in-from-top-8 duration-700">
                <div className="max-w-xl mx-auto text-center relative z-10">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-24 h-24 md:w-28 md:h-28 rounded-[2rem] mx-auto border border-white/20 object-cover mb-5 shadow-2xl" />
                    ) : (
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-[2rem] mx-auto bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center mb-5 shadow-2xl border-4 border-white/10">
                            <Utensils className="w-10 h-10 text-white" />
                        </div>
                    )}
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-5">{org.name}</h1>
                    
                    <div className="flex flex-col items-center justify-center gap-2.5 text-sm text-slate-300 font-medium">
                        {org.settings?.address && (
                            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-400" /> {org.settings.address}</span>
                        )}
                        {org.settings?.phone && (
                            <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-400" /> {org.settings.phone}</span>
                        )}
                    </div>
                </div>
                
                {/* Luces de fondo decorativas */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-40 pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-72 h-72 bg-brand-500 rounded-full mix-blend-screen filter blur-[100px] animate-pulse duration-[8s]"></div>
                    <div className="absolute bottom-0 -left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-screen filter blur-[100px] animate-pulse duration-[12s]"></div>
                </div>
            </div>

            {/* CONTENEDOR PRINCIPAL */}
            <div className="max-w-2xl mx-auto px-4 -mt-20 relative z-20 pb-12">
                
                {/* BUSCADOR Y NAVEGACIÓN (Sticky/Pegajoso) */}
                <div className="sticky top-4 z-30 bg-white/90 backdrop-blur-xl p-3 md:p-4 rounded-[2rem] shadow-xl shadow-slate-200/50 mb-8 border border-white">
                    <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="¿Qué tenés ganas de comer hoy?" 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)} 
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-100/60 rounded-2xl border border-slate-200 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10 font-bold outline-none transition-all text-slate-800 text-sm md:text-base placeholder:font-medium"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`snap-start px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex-1 text-center ${
                                    activeCategory === cat 
                                    ? 'bg-slate-900 text-white shadow-md transform scale-100' 
                                    : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* LISTA DE PLATOS */}
                <div className="space-y-4">
                    {visibleItems.map((item, index) => (
                        <div key={item.id} className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100/80 flex gap-4 overflow-hidden relative group hover:shadow-md hover:border-brand-200 transition-all animate-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                                <h3 className="font-black text-slate-800 text-lg leading-tight mb-1.5 pr-2 truncate">{item.name}</h3>
                                {item.properties?.description && (
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed pr-2 font-medium">
                                        {item.properties.description}
                                    </p>
                                )}
                                <div className="mt-auto flex items-center justify-between pr-2">
                                    <span className="font-black text-slate-900 text-xl tracking-tight">
                                        ${item.price.toLocaleString()}
                                    </span>
                                    {/* Botón estético (dummy) para incentivar la lectura */}
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-brand-500 group-hover:bg-brand-50 group-hover:scale-110 transition-all">
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>

                            {item.properties?.image_url && (
                                <div className="w-28 h-28 md:w-36 md:h-36 shrink-0 rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                                    <img 
                                        src={item.properties.image_url} 
                                        alt={item.name} 
                                        loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {visibleItems.length === 0 && (
                    <div className="text-center py-16 px-6 text-slate-400 bg-white rounded-3xl border border-slate-100 mt-4 shadow-sm animate-in zoom-in-95">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <h3 className="font-black text-slate-600 text-lg mb-1">Sin resultados</h3>
                        <p className="text-sm font-medium">No encontramos platos en esta categoría o con esa búsqueda.</p>
                    </div>
                )}

                {/* Footer Discreto (Marca Blanca) */}
                <div className="mt-16 text-center opacity-60 hover:opacity-100 transition-opacity">
                    <a href="https://speeddigital.com" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest px-4 py-2 rounded-full hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                        <Zap className="w-4 h-4 text-brand-500" />
                        Menu by <span className="text-slate-800">SpeedDigital</span>
                    </a>
                </div>
                
            </div>
        </div>
    );
}