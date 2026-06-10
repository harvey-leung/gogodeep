import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import gogodeepLogo from "@/assets/gogodeep-logo.png";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import PageTransition from "@/components/PageTransition";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

const Signup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { pendingReport?: { imageUrl: string; diagnosis: unknown }; pendingStream?: boolean } | null;
  const pendingReport = locationState?.pendingReport;
  const pendingStream = locationState?.pendingStream;

  const [showEmail, setShowEmail] = useState(() => (location.state as any)?.openEmail === true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const onSignup = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!firstName.trim()) { setFormError("Please enter your first name."); return; }
    if (!isValidEmail(email) || password.length < 8) return;
    setIsLoading(true);
    try {
      const username = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username } },
      });
      setIsLoading(false);
      if (error) {
        setFormError(
          error.message.toLowerCase().includes("already")
            ? "An account with that email already exists. Try logging in."
            : error.message
        );
        return;
      }
      if (data.user?.identities?.length === 0) {
        setFormError("An account with that email already exists. Try logging in.");
        return;
      }
      if (pendingReport) navigate("/report", { replace: true, state: pendingReport });
      else if (pendingStream) navigate("/stream", { replace: true });
      else navigate("/dashboard", { replace: true });
    } catch {
      setIsLoading(false);
      setFormError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <PageTransition>
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12 pt-24">
        <Card className="w-full max-w-lg border border-border bg-card p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src={gogodeepLogo} alt="Gogodeep" className="h-14 w-14 object-contain" draggable={false} />
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">Create your account</h1>
          </div>

          <div className="flex flex-col gap-4">
            <GoogleAuthButton label="Sign up with Google" />

            {!showEmail && (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="w-full rounded-lg border border-border py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Sign up with email
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

                  <form onSubmit={onSignup} className="space-y-4">
                    {/* First + Last name row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">First name</label>
                        <Input
                          type="text"
                          autoComplete="given-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="border-border bg-secondary h-12 text-base"
                          placeholder="Jamie"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Last name</label>
                        <Input
                          type="text"
                          autoComplete="family-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="border-border bg-secondary h-12 text-base"
                          placeholder="Smith"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="border-border bg-secondary pl-10 h-12 text-base"
                          placeholder="name@example.com"
                          required
                        />
                      </div>
                      {email.length > 0 && !isValidEmail(email) && (
                        <p className="text-sm text-destructive">Please enter a valid email.</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Password</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="border-border bg-secondary pl-10 h-12 text-base"
                          placeholder="Min 8 characters"
                          required
                        />
                      </div>
                      {password.length > 0 && password.length < 8 && (
                        <p className="text-sm text-destructive">Password must be at least 8 characters.</p>
                      )}
                    </div>

                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                    <Button type="submit" className="w-full h-12 text-base bg-primary hover:bg-primary/90" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-8 text-center text-base text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link>
          </p>
        </Card>
      </div>
    </PageTransition>
  );
};

export default Signup;
