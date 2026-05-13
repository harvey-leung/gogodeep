import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { whaleToast } from "@/lib/whaleToast";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "annual";

const FEATURES = [
  "Unlimited scans",
  "Unlimited practice questions",
  "Unlimited recap quizzes",
  "Unlimited Blue use",
];

const Pricing = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<Billing>("annual");
  const [loading, setLoading] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("profiles").select("plan").eq("id", user.id).single();
      setUserPlan(data?.plan ?? "free");
    });
  }, []);

  function handleClose() { navigate(-1); }

  async function handleUpgrade() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/signup"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { userId: user.id, email: user.email, planId: "deep", billing },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error(data?.error ?? "No checkout URL returned");
    } catch (err) {
      whaleToast.error(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  async function handleManageBilling() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setManagingBilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-portal", { body: { userId: user.id } });
      let errMsg = data?.error ?? (error as any)?.message ?? String(error);
      try { const ctx = (error as any)?.context; if (ctx) { const j = await ctx.json(); errMsg = j?.error ?? errMsg; } } catch {}
      if (!data?.url) throw new Error(errMsg);
      window.location.href = data.url;
    } catch (err) {
      whaleToast.error(err instanceof Error ? err.message : String(err));
      setManagingBilling(false);
    }
  }

  const isDeep = userPlan === "deep";

  return (
    <>
      <Helmet>
        <title>Go Deep</title>
        <link rel="canonical" href="https://gogodeep.com/pricing" />
      </Helmet>

      {/* Backdrop — click outside to close, fade in */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm bg-background/40 animate-in fade-in duration-200"
        onClick={handleClose}
      >
        {/* Card — stop propagation so clicking inside doesn't close */}
        <div
          className="relative w-full max-w-[480px] mx-4 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Hero — whale + title */}
            <div className="flex flex-col items-center pt-8 pb-5 px-8 text-center">
              <img
                src="/blue.png"
                alt=""
                draggable={false}
                className="whale-img h-24 w-24 object-contain mb-4"
                style={{ filter: "drop-shadow(0 8px 24px hsl(var(--primary)/0.35))" }}
              />
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Go Deep</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Everything you need to close every gap.</p>
            </div>

            {/* Features */}
            <ul className="px-8 pb-5 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Billing boxes */}
            <div className="px-8 pb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setBilling("annual")}
                className={cn(
                  "relative flex flex-col items-center rounded-xl border-2 px-4 py-4 text-center transition-all duration-150",
                  billing === "annual"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/40 text-foreground hover:border-primary/40"
                )}
              >
                <span className={cn(
                  "absolute -top-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                  billing === "annual" ? "bg-white text-primary" : "bg-primary text-primary-foreground"
                )}>
                  Save 25%
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Annual</span>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold">$6</span>
                  <span className="text-sm opacity-70">/ mo</span>
                </div>
                <span className="text-[11px] opacity-60">$0.20 / day</span>
              </button>

              <button
                onClick={() => setBilling("monthly")}
                className={cn(
                  "flex flex-col items-center rounded-xl border-2 px-4 py-4 text-center transition-all duration-150",
                  billing === "monthly"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/40 text-foreground hover:border-primary/40"
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Monthly</span>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold">$8</span>
                  <span className="text-sm opacity-70">/ mo</span>
                </div>
                <span className="text-[11px] opacity-60">$0.27 / day</span>
              </button>
            </div>

            {/* Value prop */}
            <p className="px-8 pb-3 text-center text-xs text-muted-foreground">
              Less than the average tutoring lesson.
            </p>

            {/* CTA */}
            <div className="px-8 pb-6 space-y-2">
              <Button
                onClick={handleUpgrade}
                disabled={loading || isDeep}
                className="w-full bg-primary hover:bg-primary/90 text-base font-semibold h-11"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDeep ? "You're already on Deep" : "Go Deep"}
              </Button>

              {isDeep && (
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={managingBilling}
                  className="w-full border-border text-muted-foreground"
                >
                  {managingBilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Manage subscription
                </Button>
              )}

              <p className="text-center text-xs text-muted-foreground/50 pt-1">
                For schools and teams,{" "}
                <a href="/contact" className="text-primary underline underline-offset-2 hover:text-primary/80">contact us</a>.
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default Pricing;
