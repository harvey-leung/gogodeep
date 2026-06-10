import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const Welcome = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) {
        setSession(next);
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    });

    const fallback = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) navigate("/dashboard", { replace: true });
        else navigate("/login", { replace: true });
      });
    }, 3000);

    return () => { sub.subscription.unsubscribe(); clearTimeout(fallback); };
  }, [navigate]);

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center pt-20">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Completing sign-in…
      </div>
    </div>
  );
};

export default Welcome;
