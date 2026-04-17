import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Users, Clock, Search, Filter, User, LayoutList, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

// ==========================================
// INTERFACES ESTRICTAS (Regla de Oro #2)
// ==========================================
interface Appointment {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    catalog_items: {
        name: string;
        properties: {
            capacity: number;
            duration_minutes: number;
            resource_id: string | null;
        } | null;
    } | null;
    crm_people: {
        full_name: string;
    } | null;
}

interface Resource {
    id: string;
    name: string;
}

interface StudentRecord {
    id: string;
    name: string;
    status: string;
}

interface GroupedClass {
    id: string;
    start_time: Date;
    end_time: Date;
    name: string;
    capacity: number;
    resource_id: string | null;
    students: StudentRecord[];
}

type ViewMode = 'day' | 'week';

export default function MasterCalendar() {
    const { orgData } = useAuthStore();
    
    // Estados principales
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    
    // Datos
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    
    // Filtros
    const [selectedResource, setSelectedResource] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');

    // =========================================================================
    // LÓGICA DE FECHAS (El "Cerebro" del Calendario)
    // =========================================================================
    /**
     * Calcula los límites de tiempo para la consulta a la base de datos.
     * Si es 'day', devuelve 00:00 a 23:59 del día actual.
     * Si es 'week', devuelve del Lunes 00:00 al Domingo 23:59.
     */
    const getPeriodBounds = (date: Date, mode: ViewMode): { start: Date, end: Date } => {
        const start = new Date(date);
        const end = new Date(date);

        if (mode === 'week') {
            const day = start.getDay() || 7; 
            if (day !== 1) start.setHours(-24 * (day - 1)); 
            start.setHours(0, 0, 0, 0);

            end.setTime(start.getTime());
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    };

    // =========================================================================
    // CARGA DE DATOS DESDE SUPABASE
    // =========================================================================
    useEffect(() => {
        if (orgData?.id) {
            fetchCalendarData();
        }
    }, [orgData?.id, currentDate, viewMode]);

    async function fetchCalendarData() {
        try {
            setLoading(true);
            
            const { start, end } = getPeriodBounds(currentDate, viewMode);

            // 1. Traemos los recursos (Profes/Salas) para los filtros
            const { data: resourcesData, error: resError } = await supabase
                .from('resources')
                .select('id, name')
                .eq('organization_id', orgData!.id)
                .eq('is_active', true);
            
            if (resError) throw resError;
            setResources(resourcesData || []);

            // 2. Traemos los turnos en el rango calculado
            const { data: aptData, error: aptError } = await supabase
                .from('appointments')
                .select(`
                    id,
                    start_time,
                    end_time,
                    status,
                    catalog_items ( name, properties ),
                    crm_people ( full_name )
                `)
                .eq('organization_id', orgData!.id)
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())
                .neq('status', 'cancelled')
                .order('start_time', { ascending: true });

            if (aptError) throw aptError;
            setAppointments((aptData || []) as unknown as Appointment[]);

        } catch (error) {
            console.error(error);
            toast.error('Error al cargar la agenda.');
        } finally {
            setLoading(false);
        }
    }

    // =========================================================================
    // CONTROLES DE NAVEGACIÓN
    // =========================================================================
    const goToPrevious = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - (viewMode === 'week' ? 7 : 1));
        setCurrentDate(newDate);
    };

    const goToNext = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (viewMode === 'week' ? 7 : 1));
        setCurrentDate(newDate);
    };

    const goToToday = () => setCurrentDate(new Date());

    const isToday = new Date().toDateString() === currentDate.toDateString() && viewMode === 'day';

    const getPeriodLabel = (): string => {
        if (viewMode === 'day') {
            return currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        } else {
            const { start, end } = getPeriodBounds(currentDate, 'week');
            const startStr = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
            const endStr = end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
            return `${startStr} al ${endStr}`;
        }
    };

    // =========================================================================
    // AGRUPACIÓN Y TRANSFORMACIÓN DE DATOS (Modo Camaleón)
    // =========================================================================
    
    // 1. Agrupamos los turnos sueltos en "Clases"
    const groupedClasses = appointments.reduce<Record<string, GroupedClass>>((acc, curr) => {
        if (!curr.catalog_items) return acc;

        const classKey = `${curr.catalog_items.name}_${curr.start_time}`;
        
        if (!acc[classKey]) {
            acc[classKey] = {
                id: classKey,
                start_time: new Date(curr.start_time),
                end_time: new Date(curr.end_time),
                name: curr.catalog_items.name,
                capacity: curr.catalog_items.properties?.capacity || 1,
                resource_id: curr.catalog_items.properties?.resource_id || null,
                students: []
            };
        }
        
        acc[classKey].students.push({
            id: curr.id,
            name: curr.crm_people?.full_name || 'Desconocido',
            status: curr.status
        });
        
        return acc;
    }, {});

    // 2. Aplicamos filtros
    const filteredClassesArray: GroupedClass[] = Object.values(groupedClasses).filter((cls: GroupedClass) => {
        const matchesResource = selectedResource === 'all' || cls.resource_id === selectedResource;
        const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              cls.students.some((s: StudentRecord) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesResource && matchesSearch;
    });

    // 3. Agrupamos por DÍA para la vista semanal
    const classesByDay = filteredClassesArray.reduce<Record<string, GroupedClass[]>>((acc, cls) => {
        const dateStr = cls.start_time.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(cls);
        return acc;
    }, {});

    // 4. Ordenamos los días cronológicamente
    const sortedDays: string[] = Object.keys(classesByDay).sort((a: string, b: string) => {
        return classesByDay[a][0].start_time.getTime() - classesByDay[b][0].start_time.getTime();
    });

    // =========================================================================
    // RENDER PRINCIPAL
    // =========================================================================
    return (
        <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
            
            {/* CABECERA Y CONTROLES */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl"><CalendarIcon className="w-6 h-6 text-indigo-600" /></div>
                        Monitor Operativo
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Visión global de turnos, clases y ocupación.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                    
                    <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                        <button 
                            onClick={() => setViewMode('day')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutList className="w-4 h-4" /> Día
                        </button>
                        <button 
                            onClick={() => setViewMode('week')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <CalendarDays className="w-4 h-4" /> Semana
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 w-full sm:w-auto justify-between sm:justify-start">
                        <button onClick={goToPrevious} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
                        
                        <div className="flex flex-col items-center min-w-[160px]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                                {viewMode === 'week' ? 'SEMANA' : (isToday ? 'HOY' : 'FECHA')}
                            </span>
                            <span className="font-bold text-slate-800 capitalize leading-tight">{getPeriodLabel()}</span>
                        </div>

                        <button onClick={goToNext} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"><ChevronRight className="w-5 h-5" /></button>
                        
                        <button onClick={goToToday} className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors hidden sm:block">
                            Ir a Hoy
                        </button>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar clase o alumno..."
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-bold shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="relative w-full sm:w-64 shrink-0">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <select
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-bold shadow-sm appearance-none cursor-pointer"
                        value={selectedResource}
                        onChange={(e) => setSelectedResource(e.target.value)}
                    >
                        <option value="all">Todos los Profes / Salas</option>
                        {resources.map((res: Resource) => (
                            <option key={res.id} value={res.id}>{res.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* GRILLA DE HORARIOS (TIMELINE AGRUPADA POR DÍA) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] relative">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                        <p className="font-bold text-slate-500 text-sm uppercase tracking-widest">Sincronizando Agenda...</p>
                    </div>
                ) : sortedDays.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                        <CalendarIcon className="w-16 h-16 text-slate-200 mb-4" />
                        <h3 className="text-xl font-black text-slate-700">Agenda Libre</h3>
                        <p className="mt-2 text-slate-500 font-medium">No hay clases ni turnos programados para este período con los filtros actuales.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {sortedDays.map((dayLabel: string) => (
                            <div key={dayLabel} className="p-6">
                                {/* Encabezado del Día */}
                                <h2 className="text-lg font-black text-slate-800 capitalize mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    {dayLabel}
                                </h2>
                                
                                {/* Clases de ese día ordenadas por hora */}
                                <div className="space-y-4">
                                    {classesByDay[dayLabel]
                                        .sort((a: GroupedClass, b: GroupedClass) => a.start_time.getTime() - b.start_time.getTime())
                                        .map((cls: GroupedClass) => {
                                        
                                        const occupancyRate = (cls.students.length / cls.capacity) * 100;
                                        const isFull = cls.students.length >= cls.capacity;
                                        const profeName = resources.find(r => r.id === cls.resource_id)?.name || 'Sin asignar';

                                        return (
                                            <div key={cls.id} className="flex flex-col md:flex-row gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:shadow-md transition-shadow group relative overflow-hidden">
                                                
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`}></div>

                                                <div className="w-full md:w-32 shrink-0 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4 pl-2">
                                                    <p className="text-2xl font-black text-slate-800 tracking-tighter">
                                                        {cls.start_time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                                                        <Clock className="w-3 h-3" /> {cls.end_time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </p>
                                                </div>

                                                <div className="flex-1">
                                                    <h3 className="text-xl font-black text-slate-800 leading-tight mb-1">{cls.name}</h3>
                                                    <p className="text-sm font-bold text-indigo-600 flex items-center gap-1.5 bg-indigo-50 w-fit px-2 py-0.5 rounded-md border border-indigo-100">
                                                        <User className="w-3.5 h-3.5" /> {profeName}
                                                    </p>
                                                </div>

                                                <div className="w-full md:w-48 shrink-0 flex flex-col justify-center bg-white p-3 rounded-xl border border-slate-200">
                                                    <div className="flex justify-between items-end mb-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                                            <Users className="w-3 h-3" /> Ocupación
                                                        </span>
                                                        <span className={`font-black text-sm ${isFull ? 'text-red-500' : 'text-emerald-600'}`}>
                                                            {cls.students.length} / {cls.capacity}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : occupancyRate > 75 ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                                                            style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                                                        ></div>
                                                    </div>

                                                    {cls.students.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                                            <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-widest">Inscriptos:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {cls.students.slice(0, 3).map((s: StudentRecord) => (
                                                                    <span key={s.id} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={s.name}>
                                                                        {s.name.split(' ')[0]}
                                                                    </span>
                                                                ))}
                                                                {cls.students.length > 3 && (
                                                                    <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                                                        +{cls.students.length - 3}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}