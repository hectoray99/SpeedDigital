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
    const [org, setOrg] = useState<Organization | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    
    const [activeCategory, setActiveCategory] = useState<string>('Todas');
    const [search, setSearch] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (slug) fetchMenuData();
    }, [slug]);

    async function fetchMenuData() {
        try {
            setLoading(true);
            setError(false);

            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('id, name, logo_url, settings')
                .eq('slug', slug)
                .single();

            if (orgError || !orgData) throw new Error('Restaurante no encontrado');
            setOrg(orgData);

            const { data: itemsData, error: itemsError } = await supabase
                .from('catalog_items')
                .select('id, name, price, properties')
                .eq('organization_id', orgData.id)
                .eq('is_active', true)
                .order('name');

            if (itemsError) throw itemsError;

            const items = itemsData || [];
            setMenuItems(items);

            const uniqueCategories = Array.from(
                new Set(items.map(item => item.properties?.category).filter(Boolean))
            ) as string[];

            setCategories(['Todas', ...uniqueCategories]);
        } catch (error) {
            setError(true);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p className="text-slate-500 font-medium tracking-wide">Preparando la carta...</p>
            </div>
        );
    }

    if (error || !org) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                    <Utensils className="w-10 h-10 text-slate-400" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 mb-2">Menú no disponible</h1>
                <p className="text-slate-500 max-w-sm">No pudimos encontrar la carta de este restaurante. Por favor, solicitá un nuevo código QR en el local.</p>
            </div>
        );
    }

    const visibleItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = activeCategory === 'Todas' || item.properties?.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-brand-500/20">
            
            {/* CABECERA (Portada) */}
            <div className="bg-slate-900 text-white pt-10 pb-28 px-4 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="max-w-xl mx-auto text-center relative z-10">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-24 h-24 md:w-28 md:h-28 rounded-full mx-auto border-4 border-white/10 object-cover mb-4 shadow-2xl" />
                    ) : (
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full mx-auto bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center mb-4 shadow-2xl border-4 border-white/10">
                            <Utensils className="w-10 h-10 text-white" />
                        </div>
                    )}
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">{org.name}</h1>
                    
                    <div className="flex flex-col items-center justify-center gap-2 text-sm text-slate-300 font-medium">
                        {org.settings?.address && (
                            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-400" /> {org.settings.address}</span>
                        )}
                        {org.settings?.phone && (
                            <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand-400" /> {org.settings.phone}</span>
                        )}
                    </div>
                </div>
                
                {/* Luces de fondo decorativas */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30 pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500 rounded-full mix-blend-screen filter blur-3xl"></div>
                    <div className="absolute bottom-0 -left-20 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-3xl"></div>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-4 -mt-20 relative z-20 pb-12">
                
                {/* BUSCADOR Y NAVEGACIÓN (Sticky/Pegajoso) */}
                <div className="sticky top-4 z-30 bg-white/80 backdrop-blur-xl p-3 md:p-4 rounded-3xl shadow-xl shadow-slate-200/50 mb-8 border border-white">
                    <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="¿Qué tenés ganas de comer hoy?" 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)} 
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-100/50 rounded-2xl border border-slate-200 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10 font-medium outline-none transition-all text-slate-700"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`snap-start px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex-1 text-center ${
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
                    {visibleItems.map(item => (
                        <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100/80 flex gap-4 overflow-hidden relative group hover:shadow-md transition-shadow">
                            <div className="flex-1 flex flex-col justify-center">
                                <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1.5 pr-2">{item.name}</h3>
                                {item.properties?.description && (
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed pr-2">
                                        {item.properties.description}
                                    </p>
                                )}
                                <div className="mt-auto flex items-center justify-between pr-2">
                                    <span className="font-black text-slate-900 text-xl tracking-tight">
                                        ${item.price.toLocaleString()}
                                    </span>
                                    {/* Botón estético (dummy) para incentivar la compra */}
                                    <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-brand-600 group-hover:bg-brand-50 transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {item.properties?.image_url && (
                                <div className="w-28 h-28 md:w-32 md:h-32 shrink-0 rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                                    <img 
                                        src={item.properties.image_url} 
                                        alt={item.name} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {visibleItems.length === 0 && (
                    <div className="text-center py-16 px-6 text-slate-400 bg-white rounded-3xl border border-slate-100 mt-4 shadow-sm">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <h3 className="font-black text-slate-600 text-lg mb-1">Sin resultados</h3>
                        <p className="text-sm">No encontramos platos con esos filtros.</p>
                    </div>
                )}

                {/* Footer Discreto */}
                <div className="mt-16 text-center opacity-70">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-brand-500" />
                        Menu by <span className="text-slate-600">SpeedDigital</span>
                    </p>
                </div>
                
            </div>
        </div>
    );
}