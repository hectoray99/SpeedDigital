import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Loader2, ChefHat, CheckCircle, Clock, RefreshCw, Printer, Eye, Hand } from 'lucide-react';
import { toast } from 'sonner';

export default function Kitchen() {
    const { orgData, userRole } = useAuthStore();
    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orderToPrint, setOrderToPrint] = useState<any>(null);

    const [isInteractiveMode, setIsInteractiveMode] = useState(() => {
        return localStorage.getItem('kitchen_interactive_mode') === 'true';
    });

    // 🔒 EL CANDADO DOBLE: Solo podés interactuar si está el modo activo Y ADEMÁS sos jefe.
    const canInteract = isOwnerOrAdmin && isInteractiveMode;

    const toggleMode = () => {
        const newMode = !isInteractiveMode;
        setIsInteractiveMode(newMode);
        localStorage.setItem('kitchen_interactive_mode', newMode.toString());
        toast.success(newMode ? 'Modo Cocina Activado' : 'Modo Solo Lectura (Mozo)');
    };

    useEffect(() => {
        if (orgData?.id) {
            fetchKitchenOrders();
            const interval = setInterval(fetchKitchenOrders, 30000);
            return () => clearInterval(interval);
        }
    }, [orgData?.id]);

    const handlePrint = (order: any) => {
        setOrderToPrint(order);
        setTimeout(() => {
            window.print();
        }, 100);
    };

    async function fetchKitchenOrders() {
        try {
            setRefreshing(true);
            const { data: opsData, error: opsError } = await supabase
                .from('operations')
                .select('id, metadata, created_at, number')
                .eq('organization_id', orgData.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (opsError) throw opsError;

            if (!opsData || opsData.length === 0) {
                setOrders([]);
                return;
            }

            const opIds = opsData.map(op => op.id);

            const { data: linesData, error: linesError } = await supabase
                .from('operation_lines')
                .select('operation_id, quantity, notes, catalog_items(name)')
                .in('operation_id', opIds);

            if (linesError) throw linesError;

            const fullOrders = opsData.map(op => {
                const lines = linesData?.filter(line => line.operation_id === op.id) || [];
                return {
                    ...op,
                    items: lines.map((l: any) => {
                        const itemName = Array.isArray(l.catalog_items) 
                            ? l.catalog_items[0]?.name 
                            : l.catalog_items?.name;

                        return {
                            quantity: l.quantity,
                            name: itemName || 'Ítem desconocido',
                            notes: l.notes
                        };
                    })
                };
            });

            setOrders(fullOrders.filter(o => o.items.length > 0));

        } catch (error) {
            console.error('Error fetching kitchen orders:', error);
            toast.error('Error al actualizar comandas');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const updateKitchenStatus = async (operationId: string, currentMetadata: any, newStatus: string) => {
        // Bloqueo duro en la función también
        if (!canInteract) return toast.error("No tienes permisos para cambiar estados.");
        
        try {
            const updatedMetadata = { ...currentMetadata, kitchen_status: newStatus };
            const { error } = await supabase
                .from('operations')
                .update({ metadata: updatedMetadata })
                .eq('id', operationId);

            if (error) throw error;
            setOrders(prev => prev.map(op => op.id === operationId ? { ...op, metadata: updatedMetadata } : op));
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('No se pudo actualizar el estado');
        }
    };

    const pendingOrders = orders.filter(o => !o.metadata?.kitchen_status || o.metadata.kitchen_status === 'pending');
    const preparingOrders = orders.filter(o => o.metadata?.kitchen_status === 'preparing');
    const readyOrders = orders.filter(o => o.metadata?.kitchen_status === 'ready');

    const TicketCard = ({ order, type }: { order: any, type: 'pending' | 'preparing' | 'ready' }) => (
        <div className={`bg-white rounded-xl shadow-sm border-t-4 p-4 flex flex-col ${
            type === 'pending' ? 'border-t-amber-400' : type === 'preparing' ? 'border-t-blue-400' : 'border-t-emerald-400'
        }`}>
            <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-2">
                <div>
                    <h3 className="font-black text-lg text-slate-800">{order.metadata?.table_name || 'Sin Mesa'}</h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                </div>
                {/* 🔒 BLOQUEO: Solo los Jefes en Modo Interactivo ven la impresora */}
                {canInteract && (
                    <button onClick={() => handlePrint(order)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Imprimir Comanda">
                        <Printer className="w-4 h-4" />
                    </button>
                )}
            </div>
            
            <div className="flex-1 space-y-3 mb-4">
                {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col">
                        <div className="flex gap-2 text-sm font-bold text-slate-700">
                            <span className="text-slate-400">{item.quantity}x</span>
                            <span className="leading-tight">{item.name}</span>
                        </div>
                        {item.notes && (
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded ml-6 mt-1 self-start">
                                {item.notes}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-auto flex gap-2">
                {/* 🔒 BLOQUEO: Si no es jefe activo, solo dice Solo Lectura */}
                {!canInteract ? (
                    <div className="w-full py-2 bg-slate-50 text-slate-400 rounded-lg font-bold text-xs text-center border border-slate-100">
                        Solo Lectura
                    </div>
                ) : (
                    <>
                        {type === 'pending' && (
                            <button onClick={() => updateKitchenStatus(order.id, order.metadata, 'preparing')} className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-sm transition-colors">
                                Preparar
                            </button>
                        )}
                        {type === 'preparing' && (
                            <button onClick={() => updateKitchenStatus(order.id, order.metadata, 'ready')} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-1">
                                <CheckCircle className="w-4 h-4" /> Listo
                            </button>
                        )}
                        {type === 'ready' && (
                            <div className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm text-center border border-emerald-200">
                                Esperando al mozo
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    if (loading) return <div className="p-12 text-center text-slate-500 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-slate-100 -m-4 p-4 sm:p-8 font-sans">
            
            <div className="print:hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <ChefHat className="w-6 h-6 text-brand-500" /> Pantalla de Cocina
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        
                        {/* BOTÓN SOLO VISIBLE PARA DUEÑOS/ADMINS */}
                        {isOwnerOrAdmin && (
                            <button 
                                onClick={toggleMode}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors border ${
                                    isInteractiveMode 
                                    ? 'bg-orange-50 border-orange-200 text-orange-700' 
                                    : 'bg-white border-slate-200 text-slate-500'
                                }`}
                            >
                                {isInteractiveMode ? <Hand className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                {isInteractiveMode ? 'Modo Interactivo' : 'Modo Lectura'}
                            </button>
                        )}

                        <button onClick={fetchKitchenOrders} className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-500 hover:text-brand-600 transition-colors">
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
                    <div className="bg-slate-200/50 rounded-2xl p-4 flex flex-col h-full overflow-hidden border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span> Pendientes
                            </h2>
                            <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{pendingOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar pr-1">
                            {pendingOrders.map(order => <TicketCard key={order.id} order={order} type="pending" />)}
                        </div>
                    </div>

                    <div className="bg-slate-200/50 rounded-2xl p-4 flex flex-col h-full overflow-hidden border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-400"></span> En Preparación
                            </h2>
                            <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{preparingOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar pr-1">
                            {preparingOrders.map(order => <TicketCard key={order.id} order={order} type="preparing" />)}
                        </div>
                    </div>

                    <div className="bg-slate-200/50 rounded-2xl p-4 flex flex-col h-full overflow-hidden border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Listos
                            </h2>
                            <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{readyOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar pr-1">
                            {readyOrders.map(order => <TicketCard key={order.id} order={order} type="ready" />)}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ZONA DE IMPRESIÓN DEL TICKET --- */}
            {orderToPrint && (
                <div className="hidden print:block w-[80mm] text-black bg-white font-mono text-sm leading-tight">
                    <div className="text-center font-bold text-xl mb-2 border-b-2 border-dashed border-black pb-2">
                        {orgData?.name?.toUpperCase()}
                    </div>
                    
                    <div className="mb-4">
                        <p className="font-bold text-lg mb-1">{orderToPrint.metadata?.table_name}</p>
                        <p>Fecha: {new Date(orderToPrint.created_at).toLocaleDateString()}</p>
                        <p>Hora: {new Date(orderToPrint.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        <p>Ticket #: {orderToPrint.number}</p>
                    </div>

                    <div className="border-t border-b border-black py-2 mb-4 space-y-2">
                        {orderToPrint.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex flex-col">
                                <div className="flex justify-between font-bold">
                                    <span>{item.quantity}x {item.name}</span>
                                </div>
                                {item.notes && (
                                    <span className="pl-4 mt-1 text-xs uppercase italic">
                                        * {item.notes}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="text-center text-xs mt-8 pb-4">
                        <p>--- COMANDA DE COCINA ---</p>
                    </div>
                </div>
            )}
        </div>
    );
}