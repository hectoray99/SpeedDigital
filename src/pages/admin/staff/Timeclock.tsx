import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import {
    Loader2, ScanLine, UserCheck, UserX,
    Clock, Users, CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS LOCALES
// ─────────────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
    id: string;
    person_id: string;
    check_in: string;
    check_out: string | null;
    status: string;
    crm_people: { full_name: string } | { full_name: string }[] | null;
}

export default function Timeclock() {
    const { orgData } = useAuthStore();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [inputValue, setInputValue] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(true);

    const inputRef = useRef<HTMLInputElement>(null);

    // ── Reloj en tiempo real ─────────────────────────────────────────────
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Auto-focus modo kiosco ───────────────────────────────────────────
    useEffect(() => {
        const focusTimer = setInterval(() => {
            if (!isProcessing && inputRef.current && document.activeElement !== inputRef.current) {
                inputRef.current.focus();
            }
        }, 3000);
        return () => clearInterval(focusTimer);
    }, [isProcessing]);

    const normalizeDNI = (raw: string): string =>
        raw.replace(/[\s.,\-]/g, '').trim();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(normalizeDNI(e.target.value));
    };

    // ── Cargar registros del día ─────────────────────────────────────────
    const loadTodayRecords = useCallback(async () => {
        if (!orgData?.id) return;

        const today = new Date().toLocaleDateString('en-CA');

        const { data, error } = await supabase
            .from('staff_attendance')
            .select(`
                id, 
                person_id, 
                check_in, 
                check_out, 
                status, 
                crm_people(full_name)
            `)
            .eq('organization_id', orgData.id)
            .eq('work_date', today)
            .order('check_in', { ascending: false })
            .limit(30);

        if (error) {
            console.error('[Timeclock] Error cargando registros del día:', error);
        }

        setTodayRecords((data as unknown as AttendanceRecord[]) || []);
        setLoadingRecords(false);
    }, [orgData?.id]);

    useEffect(() => {
        loadTodayRecords();
    }, [loadTodayRecords]);

    // ── Registrar fichaje ────────────────────────────────────────────────
    const handlePunch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!orgData?.id) {
            toast.error('Error de sesión. Recargá la página.');
            return;
        }

        const documentNumber = normalizeDNI(inputValue);
        if (!documentNumber) return;

        setIsProcessing(true);

        try {
            const { data: person, error: personError } = await supabase
                .from('crm_people')
                .select('id, full_name, type')
                .eq('organization_id', orgData.id)
                .eq('identifier', documentNumber)
                .in('type', ['employee', 'staff'])
                .eq('is_active', true)
                .maybeSingle();

            if (personError) {
                console.error('[Timeclock] Error en la búsqueda de DNI:', personError);
                throw new Error('Error técnico al buscar el DNI.');
            }

            if (!person) {
                setInputValue('');
                throw new Error(`DNI "${documentNumber}" no encontrado.`);
            }

            const today = new Date().toLocaleDateString('en-CA');

            const { data: lastRecord, error: searchError } = await supabase
                .from('staff_attendance')
                .select('id, check_in, check_out')
                .eq('organization_id', orgData.id)
                .eq('person_id', person.id)
                .eq('work_date', today)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (searchError) throw searchError;

            const firstName = person.full_name.split(' ')[0];
            const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (!lastRecord || lastRecord.check_out) {
                // ENTRADA
                const { error: insertError } = await supabase
                    .from('staff_attendance')
                    .insert({
                        organization_id: orgData.id,
                        person_id: person.id,
                        work_date: today,
                        check_in: new Date().toISOString(),
                        status: 'present',
                    });

                if (insertError) throw insertError;

                toast.success(
                    <div className="flex flex-col text-left gap-0.5">
                        <span className="font-black text-lg">¡Hola, {firstName}!</span>
                        <span className="text-sm opacity-70">Entrada: {timeString} hs</span>
                    </div>,
                    { icon: <UserCheck className="w-6 h-6 text-emerald-500" />, duration: 4000 }
                );

            } else {
                // SALIDA
                const { error: updateError } = await supabase
                    .from('staff_attendance')
                    .update({ check_out: new Date().toISOString() })
                    .eq('id', lastRecord.id);

                if (updateError) throw updateError;

                // Cálculo de horas trabajadas
                const diffMs = Date.now() - new Date(lastRecord.check_in).getTime();
                const hours = Math.floor(diffMs / 3600000);
                const minutes = Math.floor((diffMs % 3600000) / 60000);

                toast.info(
                    <div className="flex flex-col text-left gap-0.5">
                        <span className="font-black text-lg">¡Hasta luego, {firstName}!</span>
                        <span className="text-sm opacity-70">
                            Salida: {timeString} hs · {hours}h {minutes}m trabajados
                        </span>
                    </div>,
                    { icon: <UserX className="w-6 h-6 text-indigo-500" />, duration: 5000 }
                );
            }

            await loadTodayRecords();
            setInputValue('');

        } catch (error: any) {
            toast.error(error.message || 'Error al procesar el fichaje.');
            setInputValue('');
        } finally {
            setIsProcessing(false);
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    };

    const presentCount = todayRecords.filter(r => !r.check_out).length;
    const totalToday = todayRecords.length;

    return (
        <div className="min-h-[calc(100vh-4rem)] flex flex-col p-4 md:p-6 animate-in fade-in duration-500">
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
                
                {/* COL IZQUIERDA - Terminal */}
                <div className="xl:col-span-3 flex flex-col items-center gap-6">
                    <div className="text-center w-full">
                        <p className="text-5xl sm:text-7xl md:text-8xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
                            {currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                        <p className="text-base sm:text-xl font-bold text-slate-400 capitalize mt-2">
                            {currentTime.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 w-full max-w-lg overflow-hidden">
                        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-brand-500 to-violet-500" />
                        <div className="p-6 sm:p-10 space-y-6 text-center">
                            <div className="flex flex-col items-center">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                                    <ScanLine className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Terminal de Asistencia</h2>
                                <p className="text-slate-400 font-semibold mt-1">Ingresá tu DNI para fichar</p>
                            </div>

                            <form onSubmit={handlePunch} className="space-y-4">
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        inputMode="numeric"
                                        autoFocus
                                        autoComplete="off"
                                        placeholder="DNI"
                                        onChange={handleInputChange}
                                        value={inputValue}
                                        disabled={isProcessing}
                                        className="w-full text-center p-5 sm:p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 focus:bg-white transition-all text-3xl sm:text-4xl font-black text-slate-900 tracking-widest placeholder:text-slate-200 disabled:opacity-50"
                                    />
                                    {isProcessing && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl backdrop-blur-sm">
                                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={isProcessing || !inputValue.trim()}
                                    className="w-full py-4 sm:py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xl sm:text-2xl transition-all active:scale-95 disabled:opacity-40 shadow-xl shadow-slate-900/10"
                                >
                                    {isProcessing ? (
                                        <span className="flex items-center justify-center gap-3">
                                            <Loader2 className="w-5 h-5 animate-spin" /> Procesando...
                                        </span>
                                    ) : 'REGISTRAR'}
                                </button>
                            </form>
                            <p className="text-slate-300 font-bold text-[10px] uppercase tracking-[0.3em]">
                                Speed Digital · {orgData?.name ?? ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* COL DERECHA - Actividad */}
                <div className="xl:col-span-2 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center text-center gap-2">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-emerald-500" />
                            </div>
                            <p className="text-3xl font-black text-slate-900 leading-none">{presentCount}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En el local</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center text-center gap-2">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-indigo-500" />
                            </div>
                            <p className="text-3xl font-black text-slate-900 leading-none">{totalToday}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fichajes hoy</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden flex-1">
                        <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <h3 className="font-black text-slate-600 text-[10px] uppercase tracking-wider">Actividad de hoy</h3>
                        </div>

                        <div className="overflow-y-auto divide-y divide-slate-50 max-h-[50vh] xl:max-h-[calc(100vh-22rem)]">
                            {loadingRecords ? (
                                <div className="flex items-center justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-slate-200" /></div>
                            ) : todayRecords.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-10 text-center gap-2">
                                    <p className="text-slate-400 font-bold text-sm">Sin actividad hoy</p>
                                </div>
                            ) : todayRecords.map((record) => {
                                const isPresent = !record.check_out;
                                
                                // Manejo seguro del nombre (puede venir como objeto o array)
                                const fullName = Array.isArray(record.crm_people) 
                                    ? record.crm_people[0]?.full_name 
                                    : record.crm_people?.full_name;

                                return (
                                    <div key={record.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPresent ? 'bg-emerald-400 animate-pulse' : 'bg-slate-200'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 text-sm truncate">{fullName ?? 'Empleado'}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                In: {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {record.check_out && ` · Out: ${new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                            </p>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0 ${isPresent ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {isPresent ? 'Presente' : 'Salió'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}