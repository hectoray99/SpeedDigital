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
    getAvailableSlots: async (
        orgId: string, 
        dateStr: string, 
        serviceId: string, 
        resourceId: string
    ) => {
        try {
            // 1. Obtener duración del servicio
            const { data: service } = await supabase
                .from('catalog_items')
                .select('duration_minutes')
                .eq('id', serviceId)
                .single();
                
            if (!service) throw new Error('Servicio no encontrado');
            const duration = service.duration_minutes || 30;

            // 2. Obtener reglas de disponibilidad del Profesional
            const { data: resource } = await supabase
                .from('resources')
                .select('availability_rules')
                .eq('id', resourceId)
                .single();

            if (!resource) throw new Error('Recurso no encontrado');

            // Determinar día de la semana (0-6)
            const dateObj = new Date(`${dateStr}T00:00:00`); 
            const dayOfWeek = dateObj.getDay().toString(); 
            
            const rules = resource.availability_rules as Record<string, {start: string, end: string}[]>;
            const dayRanges = rules?.[dayOfWeek];

            if (!dayRanges || !Array.isArray(dayRanges) || dayRanges.length === 0) {
                return []; 
            }

            // 3. Turnos ya ocupados (excluyendo cancelados)
            const startOfDay = `${dateStr}T00:00:00Z`;
            const endOfDay = `${dateStr}T23:59:59Z`;

            const { data: appointments } = await supabase
                .from('appointments')
                .select('start_time, end_time')
                .eq('organization_id', orgId)
                .eq('resource_id', resourceId)
                .neq('status', 'cancelled')
                .gte('start_time', startOfDay)
                .lt('start_time', endOfDay);

            const bookedBlocks = (appointments || []).map(app => {
                const start = new Date(app.start_time);
                const end = new Date(app.end_time);
                return {
                    startMin: start.getUTCHours() * 60 + start.getUTCMinutes(),
                    endMin: end.getUTCHours() * 60 + end.getUTCMinutes()
                };
            });

            // 4. Generar slots disponibles
            const availableSlots: string[] = [];
            const step = duration; // El intervalo entre turnos es la duración del servicio

            for (const range of dayRanges) {
                if (!range.start || !range.end) continue;

                const workStart = timeToMinutes(range.start);
                const workEnd = timeToMinutes(range.end);

                for (let currentMin = workStart; currentMin + duration <= workEnd; currentMin += step) {
                    const slotStart = currentMin;
                    const slotEnd = currentMin + duration;

                    const hasOverlap = bookedBlocks.some(block => {
                        return slotStart < block.endMin && slotEnd > block.startMin;
                    });

                    if (!hasOverlap) {
                        availableSlots.push(minutesToTime(slotStart));
                    }
                }
            }

            return [...new Set(availableSlots)].sort();

        } catch (error) {
            console.error('Error al calcular disponibilidad:', error);
            return [];
        }
    }
};