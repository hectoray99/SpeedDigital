import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export type UserRole = 'owner' | 'admin' | 'staff' | 'viewer' | 'chef_dispatcher' | 'line_cook';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    industry: string;
    owner_id: string;
    [key: string]: any;
}

interface AuthState {
    user: User | null;
    orgData: Organization | null;
    userRole: UserRole | null;
    isSuperAdmin: boolean;
    isLoading: boolean;
    initializeAuth: () => Promise<void>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
    
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            set({ user: null, orgData: null, userRole: null, isSuperAdmin: false, isLoading: false });
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            get().initializeAuth();
        }
    });

    return {
        user: null,
        orgData: null,
        userRole: null,
        isSuperAdmin: false,
        isLoading: true,

        initializeAuth: async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    set({ user: null, orgData: null, userRole: null, isSuperAdmin: false, isLoading: false });
                    return;
                }

                const [profileRes, orgOwnerRes, membershipRes] = await Promise.all([
                    supabase.from("profiles").select("is_superadmin").eq("id", session.user.id).maybeSingle(),
                    supabase.from("organizations").select("*").eq("owner_id", session.user.id).maybeSingle(),
                    supabase.from("organization_members").select("organization_id, role").eq("profile_id", session.user.id).maybeSingle()
                ]);

                const isSuperAdmin = !!profileRes.data?.is_superadmin;
                let org = orgOwnerRes.data as Organization | null;
                let assignedRole: UserRole | null = org ? 'owner' : null;

                if (!org && membershipRes.data?.organization_id) {
                    const { data: employeeOrg } = await supabase
                        .from("organizations")
                        .select("*")
                        .eq("id", membershipRes.data.organization_id)
                        .maybeSingle();

                    org = employeeOrg as Organization;
                    assignedRole = membershipRes.data.role as UserRole;
                }

                set({
                    user: session.user,
                    orgData: org || null,
                    userRole: org ? assignedRole : null,
                    isSuperAdmin,
                    isLoading: false,
                });

            } catch (error) {
                console.error("Auth initialization error:", error);
                set({ user: null, orgData: null, userRole: null, isSuperAdmin: false, isLoading: false });
            }
        },

        signOut: async () => {
            set({ isLoading: true });
            await supabase.auth.signOut();
            set({ user: null, orgData: null, userRole: null, isSuperAdmin: false, isLoading: false });
        },
    };
});