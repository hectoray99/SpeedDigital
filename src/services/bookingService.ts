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
            // 1. Duración del servicio
            const { data: service } = await supabase
                .from('catalog_items')
                .select('duration_minutes')
                .eq('id', serviceId)
                .single();
                
            if (!service) throw new Error('Servicio no encontrado');
            
            // Si no hay duración definida, asumimos 30 minutos por defecto
            const duration = service.duration_minutes || 30;

            // 2. Reglas del Profesional (Recurso)
            const { data: resource } = await supabase
                .from('resources')
                .select('availability_rules')
                .eq('id', resourceId)
                .single();

            if (!resource) throw new Error('Profesional no encontrado');

            const dateObj = new Date(`${dateStr}T00:00:00Z`); 
            const dayOfWeek = dateObj.getUTCDay().toString(); 
            
            const rules = resource.availability_rules as Record<string, {start: string, end: string}[]>;
            const dayRanges = rules?.[dayOfWeek];

            if (!dayRanges || !Array.isArray(dayRanges) || dayRanges.length === 0) {
                return []; 
            }

            // 3. Turnos ya ocupados en ese día
            const startOfDay = new Date(`${dateStr}T00:00:00-03:00`); 
            const endOfDay = new Date(`${dateStr}T23:59:59-03:00`);

            const { data: appointments } = await supabase
                .from('appointments')
                .select('start_time, end_time')
                .eq('organization_id', orgId)
                .eq('resource_id', resourceId)
                .neq('status', 'cancelled')
                .gte('start_time', startOfDay.toISOString())
                .lt('start_time', endOfDay.toISOString());

            const bookedBlocks = (appointments || []).map(app => {
                const start = new Date(app.start_time);
                const end = new Date(app.end_time);
                return {
                    startMin: start.getHours() * 60 + start.getMinutes(),
                    endMin: end.getHours() * 60 + end.getMinutes()
                };
            });

            // 4. Generar huecos.
            // EL CAMBIO ESTÁ AQUÍ: El 'step' ahora es igual a la 'duration' del servicio.
            const availableSlots: string[] = [];
            const step = duration; 

            for (const range of dayRanges) {
                if (!range.start || !range.end) continue;

                const workStart = timeToMinutes(range.start);
                const workEnd = timeToMinutes(range.end);

                for (let currentMin = workStart; currentMin + duration <= workEnd; currentMin += step) {
                    const slotStart = currentMin;
                    const slotEnd = currentMin + duration;

                    // ¿Choca con algún turno ocupado?
                    const hasOverlap = bookedBlocks.some(block => {
                        return slotStart < block.endMin && slotEnd > block.startMin;
                    });

                    if (!hasOverlap) {
                        availableSlots.push(minutesToTime(slotStart));
                    }
                }
            }

            // Eliminar duplicados y ordenar
            return [...new Set(availableSlots)].sort();

        } catch (error) {
            console.error('Error calculando turnos:', error);
            return [];
        }
    }
};