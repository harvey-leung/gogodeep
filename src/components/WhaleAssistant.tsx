import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Send, ArrowRight, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";

const WHALE_IMG = "/blue.png";
const WHALE_CREDIT_LIMIT = 100;

function CreditCircle({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(used / limit, 1);
  const r = 8;
  const circ = 2 * Math.PI * r;
  const filled = pct * circ;
  const isOut = used >= limit;
  const stroke = isOut ? "#ef4444" : pct >= 0.75 ? "#f59e0b" : "hsl(var(--primary))";
  const displayPct = Math.round(pct * 100);
  return (
    <div className="group relative shrink-0 self-center cursor-default">
      <svg width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r={r} fill="none" strokeWidth="3" stroke="hsl(var(--border))" />
        {filled > 0 && (
          <circle
            cx="11" cy="11" r={r}
            fill="none"
            strokeWidth="3"
            stroke={stroke}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
            transform="rotate(-90 11 11)"
          />
        )}
      </svg>
      <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 z-[9999]">
        {isOut ? "Daily limit reached. Resets at midnight." : `${100 - displayPct}% left`}
      </div>
    </div>
  );
}

function WhaleAvatar({ className }: { className?: string }) {
  const [err, setErr] = useState(false);
  return err ? (
    <span className={cn("flex items-center justify-center rounded-full bg-primary/10 text-lg", className)}>🐋</span>
  ) : (
    <img src={WHALE_IMG} alt="Blue" draggable={false} onError={() => setErr(true)} className={cn("whale-img rounded-full object-cover", className)} />
  );
}

type Message = { role: "user" | "assistant"; content: string; showPracticeButton?: boolean };

const SYSTEM_PROMPT = `You are Blue, the study assistant inside Gogodeep. Your job: give crystal-clear, step-by-step explanations that make students go "oh, NOW I get it."

Rules:
- Be direct. Get to the point in the first sentence. No filler, no "Great question!"
- Show every step. Never skip algebra or logic. One transformation per line.
- Use plain language first, then introduce the formal name.
- Use $...$ for inline math and $$...$$ for display equations — always.
- If a student is stuck: diagnose exactly where they went wrong, then walk them forward.
- Keep a slightly quirky, encouraging tone — but never at the expense of clarity.
- If asked something off-topic, say so briefly and redirect to studying.

Gogodeep features (for navigation questions):
- Dive: upload a screenshot or type a question → step-by-step solution
- Report: Step by Step / Concept / Practice tabs
- Home: scan history, streak, recap quiz
- Stream: design a personal learning path with Blue's help`;

const GREETING = "Hey, I'm Blue 👋 Ask me anything. Concepts, questions, how Gogodeep works. I've got you.";

const DEFAULT_W = 340;
const DEFAULT_H = 460;
const EXPANDED_W = 560;
const EXPANDED_H = 640;

export default function WhaleAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const hidden = location.pathname === "/report" || location.pathname === "/dive";
  const [plan, setPlan] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [hasDoneScan, setHasDoneScan] = useState(() => !!localStorage.getItem("gogodeep_guest_scan_used"));
  const [open, setOpen] = useState(false);
  const [justClosed, setJustClosed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeLimitMode, setUpgradeLimitMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stepContext, setStepContext] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [whaleCreditsUsed, setWhaleCreditsUsed] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [bubble, setBubble] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [bubbleFading, setBubbleFading] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleQueue = useRef<Array<{ message: string; type: "success" | "error" }>>([]);
  const bubbleBusy = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; top: number; left: number } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setPlan("free"); setIsGuest(true); return; }
      setIsGuest(false);
      const { data } = await (supabase as any)
        .from("profiles")
        .select("plan, whale_chat_credits, whale_chat_date")
        .eq("id", user.id)
        .single();
      setPlan(data?.plan ?? "free");
      if (data?.plan !== "deep") {
        const today = new Date().toISOString().split("T")[0];
        const isNewDay = data?.whale_chat_date !== today;
        setWhaleCreditsUsed(isNewDay ? 0 : (data?.whale_chat_credits ?? 0));
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsGuest(!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const processQueue = useCallback(() => {
    if (bubbleBusy.current || bubbleQueue.current.length === 0) return;
    bubbleBusy.current = true;
    const next = bubbleQueue.current.shift()!;
    setBubbleFading(false);
    setBubble(next);
    // Show for 3700ms, then fade 300ms, then 500ms gap before next
    bubbleTimer.current = setTimeout(() => {
      setBubbleFading(true);
      bubbleFadeTimer.current = setTimeout(() => {
        setBubble(null);
        setBubbleFading(false);
        bubbleBusy.current = false;
        // 500ms gap before showing next message
        bubbleTimer.current = setTimeout(processQueue, 500);
      }, 300);
    }, 3700);
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent).detail;
      bubbleQueue.current.push({ message, type });
      processQueue();
    }
    function scanDoneHandler(e: Event) {
      setHasDoneScan(true);
      const detail = (e as CustomEvent).detail;
      if (detail?.context) setStepContext(detail.context);
    }
    window.addEventListener("whale-notify", handler);
    window.addEventListener("whale-scan-done", scanDoneHandler);
    return () => {
      window.removeEventListener("whale-notify", handler);
      window.removeEventListener("whale-scan-done", scanDoneHandler);
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      if (bubbleFadeTimer.current) clearTimeout(bubbleFadeTimer.current);
    };
  }, [processQueue]);

  // Welcome message on sign-in (once per session per user)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const key = `whale_greeted_${session.user.id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          const name = (session.user.user_metadata?.username as string | undefined)
            ?? session.user.email?.split("@")[0]
            ?? "there";
          const phrases = [
            "Today's your day.",
            "Let's pick up where we left off.",
            "Ready when you are.",
            "Let's keep that streak going.",
            "Glad you're here — let's dive in.",
          ];
          const phrase = phrases[Math.floor(Math.random() * phrases.length)];
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("whale-notify", {
              detail: { message: `Welcome back, ${name}. ${phrase}`, type: "success" },
            }));
          }, 800);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Listen for step context injected from the report page
  useEffect(() => {
    function handler(e: Event) {
      const { stepNum, stepText, questionSummary } = (e as CustomEvent).detail;
      const ctx = questionSummary
        ? `Question: ${questionSummary}\nStep ${stepNum}: ${stepText}`
        : `Step ${stepNum}: ${stepText}`;
      setStepContext(ctx);
      setOpen(true);
      setMessages((prev) => {
        const base = prev.length === 0 ? [{ role: "assistant" as const, content: GREETING }] : prev;
        const display = questionSummary
          ? `Step ${stepNum} (from: ${questionSummary})\n\n${stepText}\n\nWhat would you like to know about this step?`
          : `Step ${stepNum}\n\n${stepText}\n\nWhat would you like to know about this step?`;
        return [...base, { role: "assistant" as const, content: display }];
      });
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
    window.addEventListener("whale-context", handler);
    return () => window.removeEventListener("whale-context", handler);
  }, []);

  // Set initial position when panel becomes visible
  useEffect(() => {
    if (open && pos === null) {
      const w = expanded ? EXPANDED_W : DEFAULT_W;
      const h = expanded ? EXPANDED_H : DEFAULT_H;
      setPos({
        top: Math.max(8, window.innerHeight - 96 - h),
        left: Math.max(8, window.innerWidth - 24 - w),
      });
    }
  }, [open, pos, expanded]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragState.current || !panelRef.current) return;
    const top = dragState.current.top + (e.clientY - dragState.current.startY);
    const left = dragState.current.left + (e.clientX - dragState.current.startX);
    panelRef.current.style.top = `${top}px`;
    panelRef.current.style.left = `${left}px`;
  }, []);

  const onPointerUp = useCallback(() => {
    if (dragState.current && panelRef.current) {
      const top = parseFloat(panelRef.current.style.top);
      const left = parseFloat(panelRef.current.style.left);
      setPos({ top, left });
    }
    dragState.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  function onHeaderPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    if (!pos) return;
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, top: pos.top, left: pos.left };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    // Reposition after the resize animation completes so position glides in sync
    if (pos) {
      const newW = next ? EXPANDED_W : DEFAULT_W;
      const newH = next ? EXPANDED_H : DEFAULT_H;
      setTimeout(() => {
        setPos({
          top: Math.max(8, window.innerHeight - 96 - newH),
          left: Math.max(8, window.innerWidth - 24 - newW),
        });
      }, 0);
    }
  }

  function handleOpen() {
    if (open) {
      setOpen(false);
      setJustClosed(true);
      setTimeout(() => setJustClosed(false), 350);
      return;
    }
    setOpen(true);
    if (messages.length === 0) {
      setMessages([{ role: "assistant", content: GREETING }]);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // Chatting with Blue requires an account (server returns 401 for guests).
    if (isGuest) {
      setMessages((prev) => [...prev, { role: "user", content: text }, {
        role: "assistant",
        content: "Sign in to chat with me — it's free, and I'll remember your scans.",
      }]);
      setInput("");
      return;
    }

    if (plan !== null && plan !== "deep" && whaleCreditsUsed >= WHALE_CREDIT_LIMIT) {
      setUpgradeLimitMode(true);
      setShowUpgrade(true);
      return;
    }

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-assistant", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })), stepContext },
      });
      if ((data as any)?.error === "daily_limit_reached") {
        setWhaleCreditsUsed(WHALE_CREDIT_LIMIT);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "You've reached your daily Blue limit. Come back tomorrow, or upgrade to Deep for unlimited chats.",
        }]);
        return;
      }
      if ((data as any)?.error === "rate_limited") {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: (data as any)?.message || "You're sending messages too quickly. Please wait a moment.",
        }]);
        return;
      }
      if (error || (data as any)?.error) throw new Error((error as any)?.message ?? (data as any)?.error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: (data as any).reply,
        showPracticeButton: (data as any).showPracticeButton,
      }]);
      if ((data as any)?.creditsUsed !== undefined) setWhaleCreditsUsed((data as any).creditsUsed);
    } catch (err) {
      console.error("[Blue] Error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, { role: "assistant", content: errMsg?.includes("429") ? "Server is busy. Try again in a moment." : "Something went wrong. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  }

  const panelW = expanded ? EXPANDED_W : DEFAULT_W;
  const panelH = expanded ? EXPANDED_H : DEFAULT_H;

  if (hidden) return null;

  return (
    <>
      {/* Blue speech bubble notification */}
      {bubble && (
        <div className={cn(
          "fixed bottom-24 right-6 z-50 duration-300",
          bubbleFading ? "animate-out fade-out slide-out-to-bottom-2" : "animate-in fade-in slide-in-from-bottom-2"
        )}>
          <div className="relative max-w-[220px]">
            <div className={cn(
              "rounded-2xl px-4 py-2.5 text-sm shadow-lg",
              bubble.type === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            )}>
              {bubble.message}
            </div>
            {bubble.type !== "error" && (
              <div
                className="absolute -bottom-[7px] right-4 h-0 w-0"
                style={{
                  borderLeft: "7px solid transparent",
                  borderRight: "7px solid transparent",
                  borderTop: "7px solid hsl(var(--primary))",
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Guest persistent bubble removed */}

      {/* Floating button */}
      <button
        onClick={handleOpen}
        title={open ? "Close" : "Ask Blue"}
        className={cn(
          "group fixed bottom-6 right-6 z-50 flex h-14 items-center overflow-hidden rounded-full border border-border bg-card shadow-xl transition-all duration-300 ease-out",
          !open && !justClosed && "hover:pl-5"
        )}
      >
        <span className={cn(
          "max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-foreground transition-all duration-300 ease-out",
          !open && !justClosed && "group-hover:max-w-[100px] group-hover:pr-1"
        )}>
          Ask Blue
        </span>
        <div className="relative h-14 w-14 shrink-0">
          <WhaleAvatar className="h-14 w-14 p-1" />
          <div className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
            open ? "opacity-0 group-hover:opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40">
              <X className="h-4 w-4 text-white/70" />
            </div>
          </div>
        </div>
      </button>

      {/* Upgrade dialog */}
      <Dialog open={showUpgrade} onOpenChange={(v) => { setShowUpgrade(v); if (!v) setUpgradeLimitMode(false); }}>
        <DialogContent className="border border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-foreground">
              <WhaleAvatar className="h-9 w-9 shrink-0" />
              {upgradeLimitMode ? "Daily limit reached" : "Meet Blue"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {upgradeLimitMode
                ? "You've used all your daily Blue messages. Upgrade to Deep for unlimited chats — no daily cap, ever."
                : "Blue is your personal study assistant — ask him anything about a concept, a question you're stuck on, or how to navigate Gogodeep. Available on Intermediate and Deep plans."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end">
            <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/pricing")}>
              {upgradeLimitMode ? "Get Deep" : "View plans"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat panel */}
      {open && pos && (
        <div
          ref={panelRef}
          className="fixed z-50 flex flex-col rounded-2xl border border-border bg-card shadow-2xl"
          style={{
            top: pos.top,
            left: pos.left,
            width: panelW,
            height: panelH,
            minWidth: 280,
            minHeight: 360,
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "calc(100vh - 16px)",
            resize: "both",
            overflow: "hidden",
            transition: "width 0.32s cubic-bezier(0.22,1,0.36,1), height 0.32s cubic-bezier(0.22,1,0.36,1), top 0.32s cubic-bezier(0.22,1,0.36,1), left 0.32s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* Header — drag handle */}
          <div
            className="flex shrink-0 cursor-grab items-center justify-between border-b border-border bg-secondary/50 px-4 py-3 active:cursor-grabbing select-none"
            onPointerDown={onHeaderPointerDown}
          >
            <div className="flex items-center gap-2.5">
              <WhaleAvatar className="h-8 w-8 shrink-0" />
              <p className="text-sm font-semibold text-foreground">Blue</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleExpand}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <div className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && (
                    <WhaleAvatar className="mr-2 mt-1 h-6 w-6 shrink-0 self-start" />
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-secondary/60 text-foreground"
                    )}
                  >
                    <RichText text={m.content} />
                  </div>
                </div>
                {m.role === "assistant" && m.showPracticeButton && location.pathname === "/report" && (
                  <div className="flex justify-start pl-8">
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("scroll-to-practice-tab"))}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 py-1"
                    >
                      Ready to practice?
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2">
                <WhaleAvatar className="h-6 w-6 shrink-0" />
                <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-secondary/60 px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border p-3">
            <div className="flex items-end gap-2">
              {plan !== null && plan !== "deep" && (
                <CreditCircle used={whaleCreditsUsed} limit={WHALE_CREDIT_LIMIT} />
              )}
              <textarea
                ref={inputRef}
                rows={1}
                maxLength={2000}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask anything…"
                className="flex-1 resize-none rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                style={{ maxHeight: 120, overflowY: "auto" }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading || (plan !== null && plan !== "deep" && whaleCreditsUsed >= WHALE_CREDIT_LIMIT)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40 hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
