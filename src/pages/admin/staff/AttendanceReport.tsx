import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { 
    Loader2, Clock, CalendarDays, CheckCircle2, 
    AlertCircle, LogOut, Search, Fingerprint 
} from 'lucide-react';
import { toast } from 'sonner';

interface AttendanceRecord {
    id: string;
    person_id: string;
    work_date: string;
    check_in: string;
    check_out: string | null;
    status: string;
    crm_people: { full_name: string; identifier: string } | { full_name: string; identifier: string }[] | null;
}

export default function AttendanceReport() {
    const { orgData } = useAuthStore();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isClosingShift, setIsClosingShift] = useState<string | null>(null);

    // FIX: Selectores de fecha nativos (Por defecto arranca mostrando el día de hoy)
    const [startDate, setStartDate] = useState(() => new Date().toLocaleDateString('en-CA'));
    const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString('en-CA'));

    const fetchRecords = useCallback(async () => {
        if (!orgData?.id) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('staff_attendance')
                .select(`
                    id, person_id, work_date, check_in, check_out, status,
                    crm_people(full_name, identifier)
                `)
                .eq('organization_id', orgData.id)
                .gte('work_date', startDate) // Desde esta fecha
                .lte('work_date', endDate)   // Hasta esta fecha
                .order('check_in', { ascending: false });

            if (error) throw error;
            setRecords((data as unknown as AttendanceRecord[]) || []);

        } catch (error) {
            console.error('Error fetching attendance:', error);
            toast.error('Error al cargar el reporte.');
        } finally {
            setLoading(false);
        }
    }, [orgData?.id, startDate, endDate]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleManualCheckout = async (recordId: string, employeeName: string) => {
        if (!confirm(`¿Estás seguro de marcar la salida de ${employeeName} AHORA?`)) return;
        
        setIsClosingShift(recordId);
        try {
            const { error } = await supabase
                .from('staff_attendance')
                .update({ check_out: new Date().toISOString() })
                .eq('id', recordId);

            if (error) throw error;
            toast.success(`Turno cerrado correctamente.`);
            fetchRecords(); 
        } catch (error) {
            console.error(error);
            toast.error('Error al cerrar el turno manualmente.');
        } finally {
            setIsClosingShift(null);
        }
    };

    const calculateDuration = (checkIn: string, checkOut: string | null) => {
        if (!checkOut) return <span className="text-amber-500 font-bold animate-pulse">En curso...</span>;
        
        const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        
        return <span className="font-bold text-slate-700">{hours}h {minutes}m</span>;
    };

    const filteredRecords = records.filter(record => {
        const fullName = Array.isArray(record.crm_people) ? record.crm_people[0]?.full_name : record.crm_people?.full_name;
        return fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const openShifts = records.filter(r => !r.check_out).length;
    const totalRecords = records.length;

    return (
        <div className="pb-12 max-w-7xl mx-auto animate-in fade-in duration-500">
            
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl"><Clock className="w-6 h-6 text-emerald-600" /></div>
                        Reporte de Asistencias
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Controlá los horarios y cerrá turnos pendientes.</p>
                </div>

                {/* NUEVO: SELECTOR DE FECHAS NATIVO */}
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200 w-full xl:w-auto">
                    <div className="flex flex-col w-full sm:w-auto">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-1">Desde</span>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full"
                        />
                    </div>
                    <span className="text-slate-300 font-bold hidden sm:block mt-4">-</span>
                    <div className="flex flex-col w-full sm:w-auto">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-1">Hasta</span>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-800 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Turnos Abiertos</p>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-black text-slate-800 leading-none">{openShifts}</span>
                            <span className="text-sm font-semibold text-slate-500">/ {totalRecords} fichajes</span>
                        </div>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-amber-500" />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] relative">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                        <CalendarDays className="w-16 h-16 text-slate-200 mb-4" />
                        <h3 className="text-xl font-black text-slate-700">Sin Registros</h3>
                        <p className="mt-2 text-slate-500 font-medium">Cambiá las fechas para buscar fichajes antiguos.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest font-black border-b border-slate-200">
                                    <th className="p-5 pl-6">Empleado / DNI</th>
                                    <th className="p-5">Fecha</th>
                                    <th className="p-5">Entrada</th>
                                    <th className="p-5">Salida</th>
                                    <th className="p-5">Horas Trab.</th>
                                    <th className="p-5 text-right pr-6">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {filteredRecords.map((record) => {
                                    const fullName = Array.isArray(record.crm_people) ? record.crm_people[0]?.full_name : record.crm_people?.full_name;
                                    const dni = Array.isArray(record.crm_people) ? record.crm_people[0]?.identifier : record.crm_people?.identifier;
                                    const isOpen = !record.check_out;

                                    return (
                                        <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-5 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`} />
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-base">{fullName || 'Desconocido'}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                                                            <Fingerprint className="w-3 h-3" /> {dni || 'S/D'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className="font-semibold text-slate-600 capitalize">
                                                    {new Date(record.check_in).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2 text-emerald-700 font-black bg-emerald-50 w-fit px-3 py-1.5 rounded-lg border border-emerald-100">
                                                    {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                {record.check_out ? (
                                                    <div className="flex items-center gap-2 text-slate-600 font-black bg-slate-100 w-fit px-3 py-1.5 rounded-lg border border-slate-200">
                                                        {new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-amber-500 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 uppercase tracking-widest">
                                                        Turno Abierto
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-5">
                                                {calculateDuration(record.check_in, record.check_out)}
                                            </td>
                                            <td className="p-5 text-right pr-6">
                                                {isOpen ? (
                                                    <button onClick={() => handleManualCheckout(record.id, fullName || 'Empleado')} disabled={isClosingShift === record.id} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-md">
                                                        {isClosingShift === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                                        Forzar Salida
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">
                                                        <CheckCircle2 className="w-4 h-4" /> Completado
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}