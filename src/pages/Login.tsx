import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import gogodeepLogo from "@/assets/gogodeep-logo.png";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import PageTransition from "@/components/PageTransition";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { from?: string; pendingReport?: { imageUrl: string; diagnosis: unknown } } | null;
  const redirectTo = locationState?.from ?? "/dashboard";
  const pendingReport = locationState?.pendingReport;

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsLoading(true);
    try {
      try { localStorage.clear(); } catch {};
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (error) { setFormError(error.message); return; }
      if (pendingReport) {
        navigate("/report", { replace: true, state: pendingReport });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setIsLoading(false);
      if (err instanceof Error && err.message.includes("quota")) {
        setFormError("Storage is full. Please clear your browser data for this site and try again.");
      } else {
        setFormError("An unexpected error occurred. Please try again.");
      }
    }
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) { whaleToast.error(error.message); return; }
    setForgotSent(true);
  };

  return (
    <PageTransition>
      <div className="relative z-10 min-h-screen pt-20">
        <div className="container flex min-h-[calc(100vh-3.5rem)] items-center justify-center py-12">
          <Card className="w-full max-w-md border border-border bg-card p-8">

            {forgotOpen ? (
              <>
                <button
                  onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(""); }}
                  className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to log in
                </button>
                {forgotSent ? (
                  <div className="text-center">
                    <Mail className="mx-auto h-10 w-10 text-primary" />
                    <h2 className="mt-4 text-xl font-bold text-foreground">Check your email</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      We sent a reset link to <span className="font-medium text-foreground">{forgotEmail}</span>.
                    </p>
                  </div>
                ) : (
                  <>
                    <h2 className="mb-1 text-xl font-bold text-foreground">Reset your password</h2>
                    <p className="mb-5 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                    <form onSubmit={onForgot} className="space-y-4">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="email" autoComplete="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="border-border bg-secondary pl-9" placeholder="name@example.com" required />
                      </div>
                      <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={forgotLoading}>
                        {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send reset link
                      </Button>
                    </form>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <img src={gogodeepLogo} alt="Gogodeep — AI exam mistake helper for IB, AP, and A-Level STEM students" className="h-12 w-12 object-contain" />
                  <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Log in to Gogodeep</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Enter your credentials to continue.</p>
                </div>

                <GoogleAuthButton label="Log in with Google" />

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={onLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setFormError(""); }} className="border-border bg-secondary pl-9" placeholder="name@example.com" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">Password</label>
                      <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} className="text-xs text-primary hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setFormError(""); }} className="border-border bg-secondary pl-9" placeholder="••••••••" required />
                    </div>
                  </div>

                  {formError && <p className="text-xs text-destructive">{formError}</p>}
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log in
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/signup" className="font-medium text-primary hover:underline">Sign up</Link>
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </PageTransition>
  );
};

export default Login;
