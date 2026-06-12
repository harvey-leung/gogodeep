import { Link } from "react-router-dom";
import { ChevronDown, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GoButton } from "./GoButton";
import { DemoPanel } from "./DemoPanel";

export function Hero({
  isSignedIn,
  deeperY,
  chevronVisible,
  onScrollToHowItWorks,
}: {
  isSignedIn: boolean;
  deeperY: number;
  chevronVisible: boolean;
  onScrollToHowItWorks: () => void;
}) {
  return (
    <section className="container py-14 md:py-20" data-topic="ai-exam-mistake-helper" data-subjects="physics-hl,math-hl-aa,ap-calculus-bc,ap-statistics">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-8 lg:grid-cols-2">

          {/* Left */}
          <div className="relative flex flex-col items-start -mt-6">
            {/* Light streaks from far off-screen top-left */}
            <div className="pointer-events-none absolute overflow-visible" style={{ top: -420, left: -380 }} aria-hidden>
              {([
                { angle: 28, length: 1100, width: 18,  opacity: 0.18, blur: 8  },
                { angle: 32, length: 1050, width: 10,  opacity: 0.22, blur: 5  },
                { angle: 35, length: 1000, width: 30,  opacity: 0.12, blur: 14 },
                { angle: 26, length:  950, width: 8,   opacity: 0.2,  blur: 4  },
                { angle: 38, length:  900, width: 45,  opacity: 0.08, blur: 20 },
                { angle: 24, length:  850, width: 6,   opacity: 0.15, blur: 3  },
                { angle: 41, length:  780, width: 60,  opacity: 0.06, blur: 28 },
              ] as { angle: number; length: number; width: number; opacity: number; blur: number }[]).map((s, i) => (
                <div key={i} style={{
                  position: "absolute", top: 0, left: 0,
                  width: s.length, height: s.width,
                  background: `linear-gradient(to right, transparent 0%, hsl(210 100% 85% / ${s.opacity}) 25%, hsl(215 85% 72% / ${s.opacity * 0.6}) 60%, transparent 100%)`,
                  transform: `rotate(${s.angle}deg)`,
                  transformOrigin: "0 50%",
                  filter: `blur(${s.blur}px)`,
                }} />
              ))}
            </div>
            <h1 className="relative text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.25rem]">
              Go{" "}<span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontOpticalSizing: "auto", paddingRight: "0.18em", backgroundImage: "linear-gradient(to bottom, hsl(225 90% 70%), hsl(225 75% 50%) 70%, hsl(225 60% 25%))", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", display: "inline-block", transform: `translateY(${deeperY}px)`, transition: "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)" } as React.CSSProperties}>deeper</span>
            </h1>
            <h1 className="relative text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.75rem]">
              than the answer.
            </h1>
            <p className="mt-6 max-w-md text-base sm:text-lg md:text-xl leading-relaxed text-muted-foreground">
              Master any STEM concept using simplified, screenshot-based deep learning designed for students who struggle with focus.
            </p>
            {isSignedIn ? (
              <div className="mt-8 flex justify-center sm:justify-start">
                <Link to="/dive" className="block">
                  <button className="group relative rounded-3xl bg-primary px-12 py-6 text-xl font-bold text-white select-none overflow-hidden transition-all duration-300 shadow-[0_0_24px_4px_rgba(91,127,239,0.3)] hover:scale-[1.02] hover:shadow-[0_0_44px_10px_rgba(91,127,239,0.45)] active:scale-[0.98]">
                    <span className="pointer-events-none absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-[150%]" />
                    <span className="relative z-10 inline-flex items-center gap-2">
                      Go
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/80 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/80 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/80" />
                      </span>
                    </span>
                  </button>
                </Link>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-3 w-full max-w-sm">
                <GoButton />
                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or sign up with</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex gap-3">
                  {/* Google sign-up */}
                  <button
                    onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard` } })}
                    className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-border bg-card/60 py-4 font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-accent hover:shadow-md active:scale-[0.98]"
                    title="Sign up with Google"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="text-[13px]">Google</span>
                  </button>

                  {/* Email sign-up */}
                  <Link
                    to="/signup"
                    state={{ openEmail: true }}
                    className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-border bg-card/60 py-4 font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-accent hover:shadow-md active:scale-[0.98]"
                    title="Sign up with email"
                  >
                    <Mail className="h-5 w-5 text-foreground/70 group-hover:text-foreground transition-colors" />
                    <span className="text-[13px]">Email</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right — live demo (hidden on mobile) */}
          <div className="hidden lg:flex flex-col gap-2">
            <p className="text-right text-xs font-semibold uppercase tracking-[0.15em] text-primary">Drop a screenshot now ↓</p>
            <DemoPanel />
          </div>
        </div>
        {/* Scroll invitation */}
        <div className="mt-10 flex justify-center">
          <button
            onClick={onScrollToHowItWorks}
            aria-label="See how it works"
            className={`animate-bounce rounded-full border border-border bg-card p-2 shadow-sm transition-all duration-500 hover:border-primary/50 hover:bg-primary/5 ${
              chevronVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronDown className="h-5 w-5 text-primary/70" />
          </button>
        </div>
      </div>
    </section>
  );
}
