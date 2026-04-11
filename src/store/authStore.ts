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
    
    // Listener de sesión global
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

                // 1. Verificar si es el Dueño
                let { data: org, error: fetchError } = await supabase
                    .from("organizations")
                    .select("*")
                    .eq("owner_id", session.user.id)
                    .maybeSingle();

                let assignedRole = 'owner';

                // 2. Verificar si es Miembro del Staff
                if (!org) {
                    const { data: membership } = await supabase
                        .from("organization_members")
                        .select("organization_id, role")
                        .eq("profile_id", session.user.id)
                        .maybeSingle();

                    if (membership) {
                        const { data: employeeOrg } = await supabase
                            .from("organizations")
                            .select("*")
                            .eq("id", membership.organization_id)
                            .maybeSingle();
                        
                        org = employeeOrg;
                        assignedRole = membership.role; 
                    }
                }

                if (fetchError && !org) console.error("Error fetching org:", fetchError);

                set({
                    user: session.user,
                    orgData: org || null,
                    userRole: org ? assignedRole : null,
                    isLoading: false,
                });

            } catch (error) {
                console.error("Auth initialization error:", error);
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