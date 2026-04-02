import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PortalState {
    studentId: string | null;
    orgSlug: string | null;
    loginStudent: (id: string, slug: string) => void;
    logoutStudent: () => void;
}

export const usePortalStore = create<PortalState>()(
    persist(
        (set) => ({
            studentId: null,
            orgSlug: null,
            loginStudent: (id, slug) => set({ studentId: id, orgSlug: slug }),
            logoutStudent: () => set({ studentId: null, orgSlug: null }),
        }),
        {
            name: 'portal-session', // Nombre de la variable en memoria
            // CLAVE: Usamos sessionStorage para que la sesión muera al cerrar la pestaña
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);