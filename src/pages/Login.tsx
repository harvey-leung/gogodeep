import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import gogodeepLogo from "@/assets/gogodeep-logo.png";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import PageTransition from "@/components/PageTransition";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { whaleToast } from "@/lib/whaleToast";

const Login = () => {
  const [showEmail, setShowEmail] = useState(false);
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
  const locationState = location.state as { from?: string; pendingReport?: { imageUrl: string; diagnosis: unknown }; pendingStream?: boolean } | null;
  const redirectTo = locationState?.from ?? "/dashboard";
  const pendingReport = locationState?.pendingReport;
  const pendingStream = locationState?.pendingStream;

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsLoading(true);
    try {
      try { localStorage.clear(); } catch {}
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (error) { setFormError(error.message); return; }
      if (pendingReport) navigate("/report", { replace: true, state: pendingReport });
      else if (pendingStream) navigate("/stream", { replace: true });
      else navigate(redirectTo, { replace: true });
    } catch (err) {
      setIsLoading(false);
      setFormError(
        err instanceof Error && err.message.includes("quota")
          ? "Storage is full. Please clear your browser data and try again."
          : "An unexpected error occurred. Please try again."
      );
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
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12 pt-24">
        <Card className="w-full max-w-lg border border-border bg-card p-10">

          {forgotOpen ? (
            <>
              <button
                onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(""); }}
                className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to log in
              </button>
              {forgotSent ? (
                <div className="text-center">
                  <Mail className="mx-auto h-12 w-12 text-primary" />
                  <h2 className="mt-4 text-2xl font-bold text-foreground">Check your email</h2>
                  <p className="mt-2 text-base text-muted-foreground">
                    We sent a reset link to <span className="font-semibold text-foreground">{forgotEmail}</span>.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="mb-2 text-2xl font-bold text-foreground">Reset your password</h2>
                  <p className="mb-6 text-base text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                  <form onSubmit={onForgot} className="space-y-4">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input type="email" autoComplete="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="border-border bg-secondary pl-10 h-12 text-base" placeholder="name@example.com" required />
                    </div>
                    <Button type="submit" className="w-full h-12 text-base bg-primary hover:bg-primary/90" disabled={forgotLoading}>
                      {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send reset link
                    </Button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              <div className="mb-8 flex flex-col items-center text-center">
                <img src={gogodeepLogo} alt="Gogodeep" className="h-14 w-14 object-contain" draggable={false} />
                <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">Log in to Gogodeep</h1>
              </div>

              <div className="flex flex-col gap-4">
                <GoogleAuthButton label="Log in with Google" />

                {!showEmail && (
                  <button
                    type="button"
                    onClick={() => setShowEmail(true)}
                    className="w-full rounded-lg border border-border py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Log in with email
                  </button>
                )}

                <AnimatePresence>
                  {showEmail && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-sm text-muted-foreground">or</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      <form onSubmit={onLogin} className="space-y-4">
                        <div className="space-y-1.5">
                          <label htmlFor="login-email" className="text-sm font-medium text-muted-foreground">Email</label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="login-email"
                              type="email"
                              autoComplete="email"
                              value={email}
                              onChange={(e) => { setEmail(e.target.value); setFormError(""); }}
                              className="border-border bg-secondary pl-10 h-12 text-base"
                              placeholder="name@example.com"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label htmlFor="login-password" className="text-sm font-medium text-muted-foreground">Password</label>
                            <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} className="text-sm text-primary hover:underline">
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="login-password"
                              type="password"
                              autoComplete="current-password"
                              value={password}
                              onChange={(e) => { setPassword(e.target.value); setFormError(""); }}
                              className="border-border bg-secondary pl-10 h-12 text-base"
                              placeholder="••••••••"
                              required
                            />
                          </div>
                        </div>

                        {formError && <p className="text-sm text-destructive">{formError}</p>}
                        <Button type="submit" className="w-full h-12 text-base bg-primary hover:bg-primary/90" disabled={isLoading}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Log in
                        </Button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <p className="mt-8 text-center text-base text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-semibold text-primary hover:underline">Sign up</Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </PageTransition>
  );
};

export default Login;
