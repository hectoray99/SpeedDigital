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

export const useAuthStore = create<AuthState>((set, get) => {
  
  // Escuchador automático de sesión
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      set({ user: null, orgData: null, userRole: null, isLoading: false });
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      get().initializeAuth();
    }
  });

  return {
    user: null,
    orgData: null,
    userRole: null,
    isLoading: true,

    initializeAuth: async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          set({ user: null, orgData: null, userRole: null, isLoading: false });
          return;
        }

        // 1. Buscamos primero si es el DUEÑO DIRECTO
        let { data: org, error: fetchError } = await supabase
          .from("organizations")
          .select("*")
          .eq("owner_id", session.user.id)
          .maybeSingle();

        let assignedRole = 'owner';

        // 2. Si no es dueño, buscamos si es EMPLEADO (Staff/Admin delegado)
        if (!org) {
            const { data: membership } = await supabase
                .from("organization_members")
                .select("organization_id, role")
                .eq("profile_id", session.user.id)
                .maybeSingle();

            if (membership) {
                // Encontramos que trabaja en un local, traemos los datos de ese local
                const { data: employeeOrg } = await supabase
                    .from("organizations")
                    .select("*")
                    .eq("id", membership.organization_id)
                    .maybeSingle();
                
                org = employeeOrg;
                assignedRole = membership.role; // Puede ser 'staff' o 'admin'
            }
        }

        if (fetchError && !org) {
          console.error("Error al buscar la organización:", fetchError);
        }

        if (org) {
          // Entra con éxito (sea Dueño o Empleado)
          set({
            user: session.user,
            orgData: org,
            userRole: assignedRole,
            isLoading: false,
          });
        } else {
          // Si no es dueño ni empleado, lo mandamos al Onboarding
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
      set({ isLoading: true });
      await supabase.auth.signOut();
      set({ user: null, orgData: null, userRole: null, isLoading: false });
    },
  };
});