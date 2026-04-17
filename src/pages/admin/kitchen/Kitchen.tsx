import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Loader2, ChefHat, CheckCircle, Clock, RefreshCw, Printer, Eye, Hand, ListTodo, Flame, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Kitchen() {
    const { orgData, userRole } = useAuthStore();
    
    // --- CONTROL DE ROLES (Solución TypeScript) ---
    const roleString = userRole as string;
    const isOwnerOrAdmin = roleString === 'owner' || roleString === 'admin';
    const isChef = roleString === 'chef_dispatcher' || isOwnerOrAdmin;
    const isCook = roleString === 'line_cook';

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orderToPrint, setOrderToPrint] = useState<any>(null);
    const [now, setNow] = useState(new Date());
    
    const [activeMobileTab, setActiveMobileTab] = useState<'pending' | 'preparing' | 'ready'>('pending');

    const [isInteractiveMode, setIsInteractiveMode] = useState(() => {
        return localStorage.getItem('kitchen_interactive_mode') === 'true' || isChef || isCook;
    });

    const canInteract = (isOwnerOrAdmin || isChef || isCook) && isInteractiveMode;

    const toggleMode = () => {
        const newMode = !isInteractiveMode;
        setIsInteractiveMode(newMode);
        localStorage.setItem('kitchen_interactive_mode', newMode.toString());
        toast.success(newMode ? 'Modo Cocina Activado' : 'Modo Solo Lectura (Mozo)');
    };

    useEffect(() => {
        const int = setInterval(() => setNow(new Date()), 60000); 
        return () => clearInterval(int);
    }, []);

    useEffect(() => {
        if (orgData?.id) {
            fetchKitchenOrders();
            const interval = setInterval(fetchKitchenOrders, 30000); 
            return () => clearInterval(interval);
        }
    }, [orgData?.id]);

    const handlePrint = (order: any) => {
        setOrderToPrint(order);
        setTimeout(() => window.print(), 100);
    };

    async function fetchKitchenOrders() {
        if (!orgData?.id) return;
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
                    items: lines.map((l: any) => ({
                        quantity: l.quantity,
                        name: Array.isArray(l.catalog_items) ? l.catalog_items[0]?.name : l.catalog_items?.name || 'Ítem',
                        notes: l.notes
                    }))
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
        if (!canInteract) return toast.error("No tienes permisos.");
        if (isCook && newStatus === 'ready') return toast.error("Solo el encargado puede marcar tickets como listos para despacho.");
        if (!orgData?.id) return; // FIX TYPESCRIPT

        try {
            const updatedMetadata = { ...currentMetadata, kitchen_status: newStatus };
            const { error } = await supabase
                .from('operations')
                .update({ metadata: updatedMetadata })
                .eq('id', operationId)
                .eq('organization_id', orgData.id);

            if (error) throw error;
            setOrders(prev => prev.map(op => op.id === operationId ? { ...op, metadata: updatedMetadata } : op));
        } catch (error) {
            toast.error('No se pudo actualizar el estado.');
        }
    };

    const pendingOrders = orders.filter(o => !o.metadata?.kitchen_status || o.metadata.kitchen_status === 'pending');
    const preparingOrders = orders.filter(o => o.metadata?.kitchen_status === 'preparing');
    const readyOrders = orders.filter(o => o.metadata?.kitchen_status === 'ready');

    const TicketCard = ({ order, type }: { order: any, type: 'pending' | 'preparing' | 'ready' }) => {
        const elapsedMins = Math.floor((now.getTime() - new Date(order.created_at).getTime()) / 60000);
        const isLate = type !== 'ready' && elapsedMins >= 20;

        return (
            <div className={`bg-white rounded-2xl shadow-sm border p-5 flex flex-col animate-in slide-in-from-bottom-2 duration-300 ${
                isLate ? 'border-red-400 bg-red-50/10' : type === 'pending' ? 'border-amber-200' : type === 'preparing' ? 'border-blue-200' : 'border-emerald-200'
            }`}>
                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                    <div>
                        <h3 className="font-black text-xl text-slate-800">{order.metadata?.table_name || 'Sin Mesa'}</h3>
                        <p className={`text-xs font-bold flex items-center gap-1.5 mt-1 w-fit px-2 py-1 rounded-md ${isLate ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                            {isLate ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            {elapsedMins} min ({new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                        </p>
                    </div>
                    {isChef && (
                        <button onClick={() => handlePrint(order)} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors bg-slate-50 border border-slate-100" title="Imprimir Comanda">
                            <Printer className="w-5 h-5" />
                        </button>
                    )}
                </div>
                
                <div className="flex-1 space-y-3.5 mb-6">
                    {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex flex-col">
                            <div className="flex gap-3 text-base font-bold text-slate-700">
                                <span className="text-brand-600 bg-brand-50 px-2 rounded-md h-fit">{item.quantity}x</span>
                                <span className="leading-tight">{item.name}</span>
                            </div>
                            {item.notes && (
                                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-lg ml-9 mt-1.5 self-start border border-orange-200 uppercase tracking-wide">
                                    * {item.notes}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-auto">
                    {!canInteract ? (
                        <div className="w-full py-3 bg-slate-50 text-slate-400 rounded-xl font-bold text-sm text-center border border-slate-100 uppercase tracking-widest">Solo Lectura</div>
                    ) : (
                        <>
                            {type === 'pending' && (
                                <button onClick={() => updateKitchenStatus(order.id, order.metadata, 'preparing')} className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-blue-500/20 uppercase tracking-widest">
                                    <Flame className="w-4 h-4" /> Iniciar Preparación
                                </button>
                            )}
                            {type === 'preparing' && isChef && (
                                <button onClick={() => updateKitchenStatus(order.id, order.metadata, 'ready')} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-emerald-500/20 uppercase tracking-widest">
                                    <CheckCircle className="w-5 h-5" /> Marcar Listo (Despachar)
                                </button>
                            )}
                            {type === 'preparing' && isCook && (
                                <div className="w-full py-3 bg-blue-50 text-blue-500 rounded-xl font-bold text-xs text-center border border-blue-100 uppercase tracking-widest">Cocinando...</div>
                            )}
                            {type === 'ready' && (
                                <div className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm text-center border border-emerald-200 flex items-center justify-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" /> Esperando al mozo
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <div className="p-12 text-center text-slate-500 flex justify-center animate-in fade-in"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-slate-50 -m-4 sm:-m-8 p-4 sm:p-8 font-sans animate-in fade-in duration-500">
            <div className="print:hidden max-w-7xl mx-auto">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                            <div className="p-2 bg-brand-500 rounded-xl"><ChefHat className="w-6 h-6 text-white" /></div> 
                            Pantalla de Cocina
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {isOwnerOrAdmin && (
                            <button 
                                onClick={toggleMode}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all border ${
                                    isInteractiveMode 
                                    ? 'bg-orange-500 border-orange-600 text-white shadow-lg shadow-orange-500/20' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                {isInteractiveMode ? <Hand className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                {isInteractiveMode ? 'Modo Interactivo' : 'Modo Lectura'}
                            </button>
                        )}
                        <button onClick={fetchKitchenOrders} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-500 hover:text-brand-600 transition-colors" title="Actualizar">
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="md:hidden flex bg-white p-1.5 rounded-2xl mb-6 shadow-sm border border-slate-200 gap-1">
                    <button onClick={() => setActiveMobileTab('pending')} className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-sm font-bold transition-all ${activeMobileTab === 'pending' ? 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <span className="flex items-center gap-1.5"><ListTodo className="w-4 h-4 text-amber-500" /> Pendientes</span>
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md mt-1">{pendingOrders.length}</span>
                    </button>
                    <button onClick={() => setActiveMobileTab('preparing')} className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-sm font-bold transition-all ${activeMobileTab === 'preparing' ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-blue-500" /> Preparando</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md mt-1">{preparingOrders.length}</span>
                    </button>
                    <button onClick={() => setActiveMobileTab('ready')} className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl text-sm font-bold transition-all ${activeMobileTab === 'ready' ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Listos</span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md mt-1">{readyOrders.length}</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[calc(100vh-140px)]">
                    <div className={`bg-slate-200/40 rounded-3xl p-4 flex-col h-full overflow-hidden border border-slate-200/60 ${activeMobileTab !== 'pending' ? 'hidden md:flex' : 'flex'}`}>
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <ListTodo className="w-5 h-5 text-amber-500" /> Pendientes
                            </h2>
                            <span className="bg-white text-slate-800 shadow-sm text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full">{pendingOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar pb-20 md:pb-0">
                            {pendingOrders.map(order => <TicketCard key={order.id} order={order} type="pending" />)}
                            {pendingOrders.length === 0 && <p className="text-center text-slate-400 font-medium py-10">Sin comandas pendientes</p>}
                        </div>
                    </div>

                    <div className={`bg-slate-200/40 rounded-3xl p-4 flex-col h-full overflow-hidden border border-slate-200/60 ${activeMobileTab !== 'preparing' ? 'hidden md:flex' : 'flex'}`}>
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <Flame className="w-5 h-5 text-blue-500" /> En Preparación
                            </h2>
                            <span className="bg-white text-slate-800 shadow-sm text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full">{preparingOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar pb-20 md:pb-0">
                            {preparingOrders.map(order => <TicketCard key={order.id} order={order} type="preparing" />)}
                            {preparingOrders.length === 0 && <p className="text-center text-slate-400 font-medium py-10">Nada en el fuego</p>}
                        </div>
                    </div>

                    <div className={`bg-slate-200/40 rounded-3xl p-4 flex-col h-full overflow-hidden border border-slate-200/60 ${activeMobileTab !== 'ready' ? 'hidden md:flex' : 'flex'}`}>
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Listos
                            </h2>
                            <span className="bg-white text-slate-800 shadow-sm text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full">{readyOrders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar pb-20 md:pb-0">
                            {readyOrders.map(order => <TicketCard key={order.id} order={order} type="ready" />)}
                            {readyOrders.length === 0 && <p className="text-center text-slate-400 font-medium py-10">Despacho limpio</p>}
                        </div>
                    </div>
                </div>
            </div>

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
                                {item.notes && <span className="pl-4 mt-1 text-xs uppercase italic">* {item.notes}</span>}
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