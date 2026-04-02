import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, LayoutGrid, Armchair, Users, Receipt } from 'lucide-react';
import CreateTableModal from '../../../components/CreateTableModal';
import TablePOSModal from '../../../components/TablePOSModal';

export default function Salon() {
    const { orgData, userRole } = useAuthStore(); // <-- Traemos userRole
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState<any | null>(null);

    // Booleano de seguridad
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
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
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
                    <h1 className="text-3xl font-bold text-slate-800">Mapa del Salón</h1>
                    <p className="text-slate-500">Gestión de mesas y comandas activas.</p>
                </div>
                {/* BLINDAJE VISUAL: Solo dueños/admins ven el botón de Nueva Mesa */}
                {isOwnerOrAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-brand-500/20 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Nueva Mesa
                    </button>
                )}
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500">Cargando salón...</div>
            ) : tables.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center">
                    <LayoutGrid className="w-16 h-16 text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">El salón está vacío</h3>
                    <p className="text-slate-500 mt-2">Creá tus mesas para empezar a tomar pedidos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {tables.map((table) => {
                        const isOccupied = !!table.activeOrder;
                        
                        return (
                            <div 
                                key={table.id} 
                                onClick={() => setSelectedTable(table)}
                                className={`bg-white border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 shadow-sm relative group overflow-hidden ${
                                    isOccupied 
                                    ? 'border-red-400 hover:bg-red-50'
                                    : 'border-emerald-400 hover:bg-emerald-50'
                                }`}
                            >
                                <div className={`absolute top-0 left-0 w-full h-1 ${isOccupied ? 'bg-red-400' : 'bg-emerald-400'}`}></div>

                                <Armchair className={`w-8 h-8 ${isOccupied ? 'text-red-500' : 'text-emerald-600'}`} />
                                <h3 className="font-black text-slate-800 text-lg">{table.name}</h3>
                                
                                {isOccupied ? (
                                    <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-md mt-1">
                                        <Receipt className="w-3 h-3" /> 
                                        ${table.activeOrder.total_amount.toLocaleString()}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                        <Users className="w-3 h-3" /> {table.capacity} Libres
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