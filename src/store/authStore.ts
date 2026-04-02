import { create } from "zustand";
import { supabase } from "../lib/supabase";

interface AuthState {
  user: any | null;
  orgData: any | null;
  userRole: string | null;
  isLoading: boolean;
  initializeAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  orgData: null,
  userRole: null,
  isLoading: true,

  initializeAuth: async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        set({ user: null, orgData: null, userRole: null, isLoading: false });
        return;
      }

      let fetchError = null;
      let membership = null;

      // EL GRAN CAMBIO: Buscamos directamente en la tabla de miembros, que es la fuente de la verdad
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
          .from("organization_members")
          .select(`
            role,
            organizations (id, name, industry, slug, logo_url, setup_completed)
          `)
          .eq("profile_id", session.user.id)
          .limit(1)
          .maybeSingle(); // maybeSingle no tira error si devuelve vacío

        if (data || !error) {
          membership = data;
          fetchError = null;
          break;
        } else {
          fetchError = error;
          await new Promise((res) => setTimeout(res, 500));
        }
      }

      if (fetchError) {
        console.error("Fallo crítico al buscar membresía:", fetchError);
        await supabase.auth.signOut();
        set({ user: null, orgData: null, userRole: null, isLoading: false });
        return;
      }

      // Si el usuario tiene una membresía asignada (Ej: el Mozo que acabás de crear)
      if (membership && membership.organizations) {
         // Supabase puede devolver un array o un objeto dependiendo de la relación, lo normalizamos:
         const org = Array.isArray(membership.organizations) 
            ? membership.organizations[0] 
            : membership.organizations;

         set({
            user: session.user,
            orgData: org,
            userRole: membership.role, // Acá sabe que es 'staff' o 'admin'
            isLoading: false,
         });
      } else {
         // Si NO tiene membresía, significa que es alguien que se registró solo en tu web pública
         // Lo dejamos pasar sin orgData para que le salte el Onboarding y cree su empresa
         set({
            user: session.user,
            orgData: null,
            userRole: 'owner', 
            isLoading: false,
         });
      }

    } catch (error) {
      console.error("Error inesperado en auth:", error);
      set({ user: null, orgData: null, userRole: null, isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, orgData: null, userRole: null, isLoading: false });
  },
}));