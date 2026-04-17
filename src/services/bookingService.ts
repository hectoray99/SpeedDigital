import { supabase } from '../lib/supabase';

const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

export const bookingService = {
    getAvailableSlots: async (orgId: string, dateStr: string, serviceId: string, resourceId: string) => {
        try {
            const { data: service } = await supabase
                .from('catalog_items')
                .select('duration_minutes, properties')
                .eq('id', serviceId)
                .single();

            if (!service) throw new Error('Servicio no encontrado');

            const duration = (service.properties as any)?.duration_minutes || service.duration_minutes || 30;
            const capacity = (service.properties as any)?.capacity || 1;

            const { data: resource } = await supabase.from('resources').select('availability_rules').eq('id', resourceId).single();
            if (!resource) throw new Error('Recurso no encontrado');

            // Parseamos la fecha respetando el día local
            const dateParts = dateStr.split('-');
            const dateObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
            const dayOfWeek = dateObj.getDay().toString();
            const rules = resource.availability_rules as Record<string, { start: string, end: string }[]>;
            const dayRanges = rules?.[dayOfWeek];

            if (!dayRanges || !Array.isArray(dayRanges) || dayRanges.length === 0) return [];

            // 🔥 BLINDAJE DE ZONA HORARIA: Forzamos la búsqueda al día exacto en Argentina (-03:00)
            const startOfDay = `${dateStr}T00:00:00-03:00`;
            const endOfDay = `${dateStr}T23:59:59-03:00`;

            const { data: appointments } = await supabase
                .from('appointments')
                .select('start_time, end_time, status, created_at')
                .eq('organization_id', orgId)
                .eq('resource_id', resourceId)
                .in('status', ['pending', 'confirmed', 'attended'])
                .gte('start_time', startOfDay)
                .lte('start_time', endOfDay);

            // Cálculos precisos de la hora actual en Argentina
            const now = new Date();
            const nowArg = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
            const todayStr = `${nowArg.getFullYear()}-${String(nowArg.getMonth() + 1).padStart(2, '0')}-${String(nowArg.getDate()).padStart(2, '0')}`;

            const isToday = todayStr === dateStr;
            const nowMin = nowArg.getHours() * 60 + nowArg.getMinutes();

            const validAppointments = (appointments || []).filter(app => {
                // Si el turno está "En Espera" por más de 15 minutos, lo descartamos para liberar el lugar
                if (app.status === 'pending') {
                    const createdAt = new Date(app.created_at);
                    const diffMinutes = (now.getTime() - createdAt.getTime()) / 60000;
                    return diffMinutes <= 15;
                }
                return true;
            });

            const bookedBlocks = validAppointments.map(app => {
                const start = new Date(app.start_time);
                const end = new Date(app.end_time);
                return {
                    startMin: start.getHours() * 60 + start.getMinutes(),
                    endMin: end.getHours() * 60 + end.getMinutes()
                };
            });

            const availableSlots: string[] = [];
            const step = duration;

            for (const range of dayRanges) {
                if (!range.start || !range.end) continue;
                const workStart = timeToMinutes(range.start);
                const workEnd = timeToMinutes(range.end);

                for (let currentMin = workStart; currentMin + duration <= workEnd; currentMin += step) {
                    const slotStart = currentMin;
                    const slotEnd = currentMin + duration;

                    let overlappingCount = 0;
                    for (const block of bookedBlocks) {
                        // Verifica si el bloque de tiempo choca con algún turno ocupado
                        if (slotStart < block.endMin && slotEnd > block.startMin) {
                            overlappingCount++;
                        }
                    }

                    const isPast = isToday && slotStart <= nowMin;

                    // Si el horario no pasó y no supera el cupo, lo agregamos
                    if (!isPast && overlappingCount < capacity) {
                        availableSlots.push(minutesToTime(slotStart));
                    }
                }
            }

            return [...new Set(availableSlots)].sort();

        } catch (error) {
            console.error('Error calculando disponibilidad:', error);
            return [];
        }
    },

    getRecurringDates: (startDateStr: string, weeksToRepeat: number): string[] => {
        const dates: string[] = [];
        const baseDate = new Date(`${startDateStr}T12:00:00`);
        for (let i = 0; i <= weeksToRepeat; i++) {
            const nextDate = new Date(baseDate);
            nextDate.setDate(baseDate.getDate() + (i * 7));
            dates.push(nextDate.toISOString().split('T')[0]);
        }
        return dates;
    }
};