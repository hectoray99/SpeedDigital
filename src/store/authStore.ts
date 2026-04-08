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

      // EL GRAN CAMBIO: Buscamos directamente la organización donde este usuario es el DUEÑO (owner_id)
      const { data: org, error: fetchError } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", session.user.id)
        .maybeSingle(); // usamos maybeSingle para que no tire un error rojo si no encuentra nada

      if (fetchError) {
        console.error("Error al buscar la organización:", fetchError);
        // No cerramos la sesión acá por si es un error temporal, solo lo dejamos pasar sin org
      }

      if (org) {
        // ¡Tiene un negocio creado! Lo dejamos entrar al Dashboard
        set({
          user: session.user,
          orgData: org,
          userRole: 'owner', // Forzamos el rol owner porque lo encontramos por owner_id
          isLoading: false,
        });
      } else {
        // No tiene negocio (orgData: null). 
        // El AuthGuard va a ver esto y lo va a mandar directo a la pantalla de Onboarding.
        set({
          user: session.user,
          orgData: null,
          userRole: null, 
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