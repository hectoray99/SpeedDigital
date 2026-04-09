import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, LayoutGrid, Armchair, Users, Receipt, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import CreateTableModal from '../../../components/CreateTableModal';
import TablePOSModal from '../../../components/TablePOSModal';

export default function Salon() {
    const { orgData, userRole } = useAuthStore();
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState<any | null>(null);

    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

    useEffect(() => {
        if (orgData?.id) {
            fetchSalonData();
        }
    }, [orgData?.id]);

    async function fetchSalonData() {
        try {
            setLoading(true);
            
            const { data: resourcesData, error: resourcesError } = await supabase
                .from('resources')
                .select('*')
                .eq('organization_id', orgData.id)
                .eq('is_active', true)
                .order('name');

            if (resourcesError) throw resourcesError;
            
            const { data: activeOrders, error: ordersError } = await supabase
                .from('operations')
                .select('id, total_amount, metadata')
                .eq('organization_id', orgData.id)
                .eq('status', 'pending');

            if (ordersError) throw ordersError;

            const onlyTables = (resourcesData || []).filter(item => item.availability_rules?.is_table === true);
            
            const tablesWithOrders = onlyTables.map(table => {
                const currentOrder = activeOrders?.find(order => order.metadata?.table_id === table.id);
                return {
                    ...table,
                    activeOrder: currentOrder || null 
                };
            });

            setTables(tablesWithOrders);
        } catch (error) {
            console.error('Error fetching salon data:', error);
            toast.error('Error al cargar el salón');
        } finally {
            setLoading(false);
        }
    }

    // --- NUEVA FUNCIÓN: Renombrar Mesa ---
    const handleRenameTable = async (e: React.MouseEvent, table: any) => {
        e.stopPropagation(); // Evita que se abra el modal del POS al hacer clic en el lápiz
        const newName = window.prompt('Ingresá el nuevo nombre para la mesa:', table.name);
        
        if (!newName || newName.trim() === '' || newName === table.name) return;

        try {
            const { error } = await supabase
                .from('resources')
                .update({ name: newName.trim() })
                .eq('id', table.id);

            if (error) throw error;
            toast.success('Mesa renombrada con éxito');
            fetchSalonData();
        } catch (error) {
            toast.error('No se pudo renombrar la mesa');
        }
    };

    return (
        <div className="pb-24 lg:pb-0 animate-in fade-in duration-500">
            <CreateTableModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchSalonData}
            />

            <TablePOSModal
                isOpen={!!selectedTable}
                onClose={() => {
                    setSelectedTable(null);
                    fetchSalonData(); 
                }}
                table={selectedTable}
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Mapa del Salón</h1>
                    <p className="text-sm sm:text-base text-slate-500 mt-1">Gestión de mesas y comandas activas.</p>
                </div>
                {isOwnerOrAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Nueva Mesa
                    </button>
                )}
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-400 font-medium">Cargando disposición del salón...</div>
            ) : tables.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center flex flex-col items-center shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <LayoutGrid className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">El salón está vacío</h3>
                    <p className="text-slate-500 mt-2 max-w-md">Creá tu primera mesa para empezar a tomar pedidos y organizar tu espacio.</p>
                </div>
            ) : (
                /* Grilla mejorada para móviles (1 col en celus muy chicos, 2 normales, etc) */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                    {tables.map((table) => {
                        const isOccupied = !!table.activeOrder;
                        
                        return (
                            <div 
                                key={table.id} 
                                onClick={() => setSelectedTable(table)}
                                className={`bg-white rounded-3xl p-6 cursor-pointer transition-all flex flex-col items-center justify-center gap-3 relative group overflow-hidden ${
                                    isOccupied 
                                    ? 'shadow-md shadow-red-500/10 border-2 border-red-100 hover:border-red-300'
                                    : 'shadow-sm border-2 border-slate-100 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/10'
                                }`}
                            >
                                {/* Barra de estado superior */}
                                <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors ${isOccupied ? 'bg-red-500' : 'bg-emerald-400'}`}></div>

                                {/* Botón de Edición (Solo Dueños) */}
                                {isOwnerOrAdmin && (
                                    <button 
                                        onClick={(e) => handleRenameTable(e, table)}
                                        className="absolute top-3 right-3 p-2 bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg opacity-0 md:group-hover:opacity-100 transition-all focus:opacity-100"
                                        title="Renombrar Mesa"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}

                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isOccupied ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-emerald-500'}`}>
                                    <Armchair className="w-8 h-8" />
                                </div>
                                
                                <h3 className="font-black text-slate-800 text-xl">{table.name}</h3>
                                
                                {isOccupied ? (
                                    <div className="flex items-center gap-1.5 text-sm font-bold text-red-600 bg-red-50 px-4 py-1.5 rounded-lg border border-red-100">
                                        <Receipt className="w-4 h-4" /> 
                                        ${table.activeOrder.total_amount.toLocaleString()}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                                        <Users className="w-4 h-4" /> {table.capacity} Libres
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}