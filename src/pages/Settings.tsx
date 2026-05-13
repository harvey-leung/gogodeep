import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, Loader2 } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { applyColorMode, getStoredColorMode, type ColorMode } from "@/lib/theme";
import { whaleToast } from "@/lib/whaleToast";

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>(getStoredColorMode);
  const [plan, setPlan] = useState<string>("free");
  const [managingBilling, setManagingBilling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUser(data.user);
      setNewName(data.user.user_metadata?.username ?? data.user.email?.split("@")[0] ?? "");
      const { data: profile } = await (supabase as any)
        .from("profiles").select("plan").eq("id", data.user.id).single();
      if (profile?.plan) setPlan(profile.plan);
    });
  }, []);

  async function handleManageBilling() {
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

  async function saveName() {
    if (!user || !newName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.auth.updateUser({ data: { username: newName.trim() } });
    if (!error) {
      await (supabase as any).from("profiles").update({ username: newName.trim() }).eq("id", user.id);
      setUser(data.user);
      whaleToast.success("Name updated.");
    } else {
      whaleToast.error(error.message);
    }
    setSaving(false);
  }

  function applyTheme(mode: ColorMode) { applyColorMode(mode); setColorMode(mode); }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <PageTransition>
    <>
      <Helmet>
        <title>Settings · Gogodeep</title>
        <link rel="canonical" href="https://gogodeep.com/settings" />
      </Helmet>
      <div className="relative z-10 flex h-screen flex-col overflow-hidden pt-8">
        <div className="container max-w-xl flex-1 flex flex-col py-6 min-h-0">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground shrink-0">Settings</h1>

          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden shrink-0">

            {/* Profile */}
            <div className="p-6 space-y-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Profile</p>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                  className="border-border bg-secondary"
                  placeholder="Display name"
                  maxLength={40}
                />
                <Button className="bg-primary hover:bg-primary/90 shrink-0" onClick={saveName} disabled={saving || !newName.trim()}>
                  Save
                </Button>
              </div>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>{user?.email ?? "—"}</span>
                <span>Since {memberSince}</span>
              </div>
            </div>

            {/* Plan */}
            <div className="p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-5">Plan</p>
              {plan === "deep" ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Deep</span>
                    <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">Active</span>
                    <span className="text-xs text-muted-foreground">Full access to everything.</span>
                  </div>
                  <Button variant="outline" className="shrink-0 border-border text-muted-foreground" onClick={handleManageBilling} disabled={managingBilling}>
                    {managingBilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Manage
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src="/blue.png" alt="" draggable={false} className="whale-img h-10 w-10 object-contain shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Go Deep</p>
                      <p className="text-xs text-muted-foreground">from $6 / month</p>
                    </div>
                  </div>
                  <Button
                    className="shrink-0 bg-primary hover:bg-primary/90 font-semibold"
                    onClick={() => navigate("/pricing", { state: { backgroundLocation: location } })}
                  >
                    Go Deep
                  </Button>
                </div>
              )}
            </div>

            {/* Theme */}
            <div className="p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-5">Theme</p>
              <div className="grid grid-cols-3 gap-4">
                <ThemeCard label="Light" active={colorMode === "white"} onClick={() => applyTheme("white")}>
                  <div className="h-full w-full rounded-lg bg-[#efefef] p-2">
                    <div className="h-full rounded-md bg-white flex items-center justify-center shadow-sm">
                      <span className="text-xl font-bold text-black leading-none">Aa</span>
                    </div>
                  </div>
                </ThemeCard>
                <ThemeCard label="Dark" active={colorMode === "dark"} onClick={() => applyTheme("dark")}>
                  <div className="h-full w-full rounded-lg bg-[#111113] p-2">
                    <div className="h-full rounded-md bg-[#1c1c1f] flex items-center justify-center">
                      <span className="text-xl font-bold text-white leading-none">Aa</span>
                    </div>
                  </div>
                </ThemeCard>
                <ThemeCard label="System" active={colorMode === "auto"} onClick={() => applyTheme("auto")}>
                  <div className="h-full w-full overflow-hidden rounded-lg flex">
                    <div className="flex-1 bg-white flex items-center justify-center">
                      <span className="text-base font-bold text-black leading-none">Aa</span>
                    </div>
                    <div className="flex-1 bg-[#1c1c1f] flex items-center justify-center">
                      <span className="text-base font-bold text-white leading-none">Aa</span>
                    </div>
                  </div>
                </ThemeCard>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
    </PageTransition>
  );
}

function ThemeCard({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex flex-col gap-1.5 rounded-xl border-2 p-1.5 text-left transition-all ${active ? "border-primary" : "border-border hover:border-muted-foreground/50"}`}>
      <div className="h-20 w-full overflow-hidden rounded-lg">{children}</div>
      <div className="flex items-center justify-between px-1 pb-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {active && <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary"><Check className="h-2.5 w-2.5 text-primary-foreground" /></div>}
      </div>
    </button>
  );
}
