import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduleManagerProps {
    resourceId: string; 
    orgId: string;
}

// 0=Domingo ... 6=Sábado (Estándar JS)
const DAYS = [
    { id: '1', label: 'L', name: 'Lunes' },
    { id: '2', label: 'M', name: 'Martes' },
    { id: '3', label: 'X', name: 'Miércoles' },
    { id: '4', label: 'J', name: 'Jueves' },
    { id: '5', label: 'V', name: 'Viernes' },
    { id: '6', label: 'S', name: 'Sábado' },
    { id: '0', label: 'D', name: 'Domingo' }
];

export default function ScheduleManager({ resourceId, orgId }: ScheduleManagerProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeDay, setActiveDay] = useState<string>('1'); // Arranca en Lunes por defecto

    // El estado guarda un diccionario donde la clave es el ID del día y el valor un Array de rangos horarios
    const [schedule, setSchedule] = useState<Record<string, {start: string, end: string}[]>>({
        '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': []
    });

    // =========================================================================
    // INICIALIZACIÓN
    // =========================================================================
    useEffect(() => {
        if (resourceId) fetchSchedule();
    }, [resourceId]);

    async function fetchSchedule() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('resources')
                .select('availability_rules')
                .eq('id', resourceId)
                .eq('organization_id', orgId) // Blindaje
                .single();

            if (error) throw error;
            if (data?.availability_rules) {
                // Hacemos merge con el esqueleto vacío para asegurarnos de tener todos los días mapeados
                setSchedule(prev => ({ ...prev, ...(data.availability_rules as any) }));
            }
        } catch (error) {
            toast.error('Error al cargar los horarios del servidor.');
        } finally {
            setLoading(false);
        }
    }

    // =========================================================================
    // HANDLERS DEL DICCIONARIO
    // =========================================================================
    const addRange = (dayId: string) => {
        // Agrega un bloque por defecto de 09 a 18
        setSchedule(prev => ({ ...prev, [dayId]: [...prev[dayId], { start: '09:00', end: '18:00' }] }));
    };

    const removeRange = (dayId: string, index: number) => {
        setSchedule(prev => {
            const newRanges = [...prev[dayId]];
            newRanges.splice(index, 1);
            return { ...prev, [dayId]: newRanges };
        });
    };

    const updateRange = (dayId: string, index: number, field: 'start' | 'end', value: string) => {
        setSchedule(prev => {
            const newRanges = [...prev[dayId]];
            newRanges[index] = { ...newRanges[index], [field]: value };
            return { ...prev, [dayId]: newRanges };
        });
    };

    // =========================================================================
    // GUARDADO Y VALIDACIÓN ANTI-CRASHES
    // =========================================================================
    const handleSave = async () => {
        try {
            setSaving(true);
            const cleanSchedule = { ...schedule };
            let hasLogicError = false;

            // Recorremos cada día configurado para buscar errores humanos
            Object.keys(cleanSchedule).forEach(day => {
                // 1. Descartamos renglones vacíos
                let ranges = cleanSchedule[day].filter(r => r.start && r.end);

                // 2. Validar que la hora de inicio no sea mayor a la de fin
                ranges.forEach(r => {
                    if (r.start >= r.end) {
                        toast.error(`Error en ${DAYS.find(d=>d.id===day)?.name}: La hora de inicio debe ser anterior al fin.`);
                        hasLogicError = true;
                    }
                });

                // 3. Ordenar cronológicamente y buscar superposiciones entre turnos cortados (Ej: 10 a 14 y 13 a 16)
                ranges.sort((a, b) => a.start.localeCompare(b.start));
                for (let i = 0; i < ranges.length - 1; i++) {
                    if (ranges[i].end > ranges[i+1].start) {
                        toast.error(`Error en ${DAYS.find(d=>d.id===day)?.name}: Los horarios se superponen o cruzan.`);
                        hasLogicError = true;
                    }
                }
                
                cleanSchedule[day] = ranges;
            });

            // Si hay un error, cortamos y NO mandamos a la base de datos
            if (hasLogicError) {
                setSaving(false);
                return;
            }

            const { error } = await supabase
                .from('resources')
                .update({ availability_rules: cleanSchedule })
                .eq('id', resourceId)
                .eq('organization_id', orgId); // Blindaje

            if (error) throw error;
            toast.success('Horarios actualizados y guardados.');
            
        } catch (error) {
            toast.error('Ocurrió un error inesperado al guardar los horarios.');
        } finally {
            setSaving(false);
        }
    };

    // =========================================================================
    // RENDER
    // =========================================================================
    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

    const currentRanges = schedule[activeDay] || [];

    return (
        <div className="w-full animate-in fade-in duration-300">
            
            {/* 1. Selector de Días */}
            <div className="flex flex-wrap gap-2 md:gap-3 mb-8">
                {DAYS.map(day => {
                    const hasHours = schedule[day.id]?.length > 0;
                    const isActive = activeDay === day.id;
                    return (
                        <button
                            key={day.id}
                            onClick={() => setActiveDay(day.id)}
                            className={`w-11 h-11 md:w-12 md:h-12 rounded-full font-bold text-sm transition-all flex items-center justify-center border-2 focus:outline-none focus:ring-4 focus:ring-brand-500/20 active:scale-95 ${
                                isActive 
                                    ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/30 scale-110 z-10' 
                                    : hasHours 
                                        ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100' 
                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}
                            title={day.name}
                        >
                            {day.label}
                        </button>
                    );
                })}
            </div>

            {/* 2. Editor del Día Seleccionado */}
            <div className="bg-slate-50/80 rounded-2xl p-5 md:p-6 border border-slate-200 shadow-inner min-h-[250px]">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
                    <h4 className="font-black text-slate-800 text-lg">{DAYS.find(d => d.id === activeDay)?.name}</h4>
                    <button onClick={() => addRange(activeDay)} className="text-xs font-black text-brand-600 bg-brand-100 hover:bg-brand-200 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors uppercase tracking-wider active:scale-95">
                        <Plus className="w-4 h-4" /> Agregar Horario
                    </button>
                </div>

                {currentRanges.length === 0 ? (
                    <div className="text-center py-10 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-2"><Loader2 className="w-6 h-6 text-slate-400" /></div>
                        <p className="text-slate-500 font-bold">Día No Laborable.</p>
                        <p className="text-xs text-slate-400">Si agregás un horario, el profesional/cancha volverá a estar disponible.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {currentRanges.map((range, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-brand-300 group">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 shrink-0 bg-slate-50 px-2 py-1 rounded-md text-center">Turno {idx + 1}</span>
                                
                                <div className="flex items-center gap-2 flex-1">
                                    <input 
                                        type="time" 
                                        value={range.start} 
                                        onChange={(e) => updateRange(activeDay, idx, 'start', e.target.value)} 
                                        className="flex-1 p-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white text-sm font-black text-slate-800 transition-all" 
                                    />
                                    <span className="text-slate-400 text-sm font-bold uppercase">A</span>
                                    <input 
                                        type="time" 
                                        value={range.end} 
                                        onChange={(e) => updateRange(activeDay, idx, 'end', e.target.value)} 
                                        className="flex-1 p-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white text-sm font-black text-slate-800 transition-all" 
                                    />
                                </div>
                                
                                <button 
                                    onClick={() => removeRange(activeDay, idx)} 
                                    className="sm:ml-auto p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100 flex justify-center w-full sm:w-auto mt-2 sm:mt-0"
                                    title="Borrar bloque de horario"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. Footer Action */}
            <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="w-full sm:w-auto flex justify-center items-center gap-2 bg-slate-900 hover:bg-black text-white px-10 py-4 rounded-xl font-black transition-all active:scale-95 shadow-xl shadow-slate-900/20 disabled:opacity-50 text-lg"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
}