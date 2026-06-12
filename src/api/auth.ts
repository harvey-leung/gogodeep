import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Current auth user, kept in sync with Supabase auth state.
 *   undefined = still loading, null = signed out, User = signed in.
 *
 * Mirrors the getSession()+onAuthStateChange pattern that DashboardRoute and
 * Landing each had inline.
 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return user;
}
