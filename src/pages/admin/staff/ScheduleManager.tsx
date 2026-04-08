import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduleManagerProps {
    resourceId: string; 
    orgId: string;
}

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
    const [activeDay, setActiveDay] = useState<string>('1');

    const [schedule, setSchedule] = useState<Record<string, {start: string, end: string}[]>>({
        '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': []
    });

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
                .single();

            if (error) throw error;

            if (data?.availability_rules) {
                setSchedule(prev => ({ ...prev, ...(data.availability_rules as any) }));
            }
        } catch (error) {
            toast.error('Error al cargar los horarios');
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true);
            const cleanSchedule = { ...schedule };
            Object.keys(cleanSchedule).forEach(day => {
                cleanSchedule[day] = cleanSchedule[day].filter(r => r.start && r.end);
            });

            const { error } = await supabase
                .from('resources')
                .update({ availability_rules: cleanSchedule })
                .eq('id', resourceId)
                .eq('organization_id', orgId);

            if (error) throw error;
            toast.success('Horarios guardados con éxito');
        } catch (error) {
            toast.error('Error al guardar horarios');
        } finally {
            setSaving(false);
        }
    };

    const addRange = (dayId: string) => {
        setSchedule(prev => ({
            ...prev,
            [dayId]: [...prev[dayId], { start: '09:00', end: '18:00' }]
        }));
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

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>;

    const currentRanges = schedule[activeDay] || [];

    return (
        <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-6">
                {DAYS.map(day => {
                    const hasHours = schedule[day.id]?.length > 0;
                    const isActive = activeDay === day.id;
                    return (
                        <button
                            key={day.id}
                            onClick={() => setActiveDay(day.id)}
                            className={`w-10 h-10 rounded-full font-bold text-sm transition-all flex items-center justify-center border-2 ${
                                isActive 
                                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/30' 
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

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 min-h-[200px]">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-700">{DAYS.find(d => d.id === activeDay)?.name}</h4>
                    <button 
                        onClick={() => addRange(activeDay)}
                        className="text-xs font-bold text-brand-600 bg-brand-100 hover:bg-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Agregar turno
                    </button>
                </div>

                {currentRanges.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm"><p>No atiende este día.</p></div>
                ) : (
                    <div className="space-y-3">
                        {currentRanges.map((range, idx) => (
                            <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-sm font-bold text-slate-400 w-16 shrink-0">Turno {idx + 1}</span>
                                <input type="time" value={range.start} onChange={(e) => updateRange(activeDay, idx, 'start', e.target.value)} className="p-2 border border-slate-200 rounded-lg outline-none focus:border-brand-500 text-sm font-medium w-full sm:w-auto" />
                                <span className="text-slate-400 text-sm hidden sm:inline">a</span>
                                <input type="time" value={range.end} onChange={(e) => updateRange(activeDay, idx, 'end', e.target.value)} className="p-2 border border-slate-200 rounded-lg outline-none focus:border-brand-500 text-sm font-medium w-full sm:w-auto" />
                                <button onClick={() => removeRange(activeDay, idx)} className="ml-auto p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Horarios
                </button>
            </div>
        </div>
    );
}