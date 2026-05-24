import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, Link } from "react-router-dom";
import { Upload, Loader2, Waves, ArrowRight, Lock, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { whaleToast } from "@/lib/whaleToast";
import { Button } from "@/components/ui/button";
import EducatorLayout from "@/components/EducatorLayout";
import { checkScanCredits, SCAN_CACHE_KEY } from "@/lib/supabase";
import { calcDynamicScanXP, CHALLENGE_BONUS_XP, addBonusXP } from "@/lib/xp";
import { pendingFileStore, scanImageStore } from "@/lib/pendingFile";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SESSION_REPORT_KEY = "gogodeep_pending_report";

function useUtcResetCountdown() {
  const get = () => {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const s = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };
  const [label, setLabel] = useState(get);
  useEffect(() => { const id = setInterval(() => setLabel(get()), 30000); return () => clearInterval(id); }, []);
  return label;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

async function notifyScanXP(userId: string, topic: string | null, errorCategory: string | null) {
  let history: { topic: string | null; error_category: string | null }[] = [];
  try {
    const { data } = await (supabase as any)
      .from("error_logs")
      .select("topic, error_category")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) history = data;
  } catch {}

  const isChallenge = sessionStorage.getItem("gogodeep_challenge_bonus") === "1";
  const storedChallengeXP = parseInt(sessionStorage.getItem("gogodeep_challenge_xp") ?? "0", 10);
  sessionStorage.removeItem("gogodeep_challenge_bonus");
  sessionStorage.removeItem("gogodeep_challenge_xp");
  const total = isChallenge && storedChallengeXP > 0
    ? storedChallengeXP
    : calcDynamicScanXP(topic, errorCategory, history);
  if (isChallenge) addBonusXP(userId, CHALLENGE_BONUS_XP, "challenge");
  const msg = isChallenge ? `+${total} XP — challenge bonus!` : `+${total} XP`;
  window.dispatchEvent(new CustomEvent("whale-notify", { detail: { message: msg, type: "success" } }));
}

const SCAN_PHASES = [
  "Reading your problem…",
  "Identifying the concept…",
  "Building the breakdown…",
  "Almost done…",
];

function WhaleScanLoader({ complete }: { complete: boolean }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (complete) return;
    const t = setInterval(() => setPhase(p => Math.min(p + 1, SCAN_PHASES.length - 1)), 950);
    return () => clearInterval(t);
  }, [complete]);

  return (
    <div className="flex flex-col items-center gap-6 px-8 py-4 text-center z-10 w-full">
      {/* Rings + Blue */}
      <div className="relative flex items-center justify-center">
        {!complete && (
          <>
            <span className="absolute h-32 w-32 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "1.6s" }} />
            <span className="absolute h-20 w-20 rounded-full bg-primary/15 animate-ping" style={{ animationDuration: "1.6s", animationDelay: "0.3s" }} />
          </>
        )}
        <div className={cn(
          "relative flex h-24 w-24 items-center justify-center rounded-full transition-colors duration-500",
          complete ? "bg-green-500/20" : "bg-primary/10"
        )}>
          <img
            src="/blue.png"
            alt="Blue"
            draggable={false}
            className={cn("h-20 w-20 object-contain transition-all duration-300", !complete && "animate-bounce")}
            style={{ animationDuration: "1.4s", filter: "drop-shadow(0 4px 12px hsl(var(--primary)/0.3))" }}
          />
          {complete && (
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 shadow-lg animate-in zoom-in duration-300">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Phase text + bar */}
      <div className="w-full max-w-[220px] space-y-3">
        <p className={cn(
          "text-sm font-black transition-all duration-300",
          complete ? "text-green-500" : "text-foreground"
        )}>
          {complete ? "Done! Loading results…" : SCAN_PHASES[phase]}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-all duration-500", complete ? "bg-green-500" : "bg-primary")}
            style={{
              width: complete ? "100%" : undefined,
              animation: complete ? "none" : "loading-bar 1.6s ease-in-out infinite",
            }}
          />
        </div>
        {/* Phase dots */}
        <div className="flex justify-center gap-1.5">
          {SCAN_PHASES.map((_, i) => (
            <div key={i} className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i <= phase ? "w-4 bg-primary" : "w-1.5 bg-secondary"
            )} />
          ))}
        </div>
      </div>
    </div>
  );
}

const DiagnosticLab = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const resetCountdown = useUtcResetCountdown();
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const challenge = sessionStorage.getItem("gogodeep_challenge");
      if (challenge) {
        sessionStorage.removeItem("gogodeep_challenge");
        setTextInput(challenge);
        setShowTextInput(true);
        setIsChallengeMode(true);
        setTimeout(() => textareaRef.current?.focus(), 80);
      }
    } catch { /* ignore */ }
  }, []);
  const queryClient = useQueryClient();


  const SCAN_COOLDOWN_MS = 10_000;
  const checkCooldown = async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    const key = user?.id ? `gogodeep_last_scan_${user.id}` : "gogodeep_last_scan_guest";
    try {
      const last = parseInt(localStorage.getItem(key) ?? "0", 10);
      const remaining = SCAN_COOLDOWN_MS - (Date.now() - last);
      if (remaining > 0) {
        setCooldownActive(true);
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => setCooldownActive(false), remaining);
        return false;
      }
      localStorage.setItem(key, String(Date.now()));
    } catch { /* localStorage unavailable — skip cooldown */ }
    return true;
  };

  const analyzeImage = useCallback(
    async (file: File) => {
      const complexityLevel = 2;
      if (!await checkCooldown()) return;
      const {
        data: { user: preCheckUser },
      } = await supabase.auth.getUser();
      const isGuest = !preCheckUser?.id;
      if (isGuest && localStorage.getItem("gogodeep_guest_scan_used")) {
        navigate("/signup");
        return;
      }

      setIsAnalyzing(true);

      try {
        if (!isGuest) {
          const credits = await checkScanCredits();
          if (!credits.allowed) {
            setIsAnalyzing(false);
            setRemainingCredits(credits.credits);
            setShowUpgradeModal(true);
            return;
          }
        }

        let processedFile: File | Blob = file;
        let safeMime = file.type === "image/jpg" ? "image/jpeg" : file.type;

        if (file.type === "image/heic" || file.type === "image/heif") {
          try {
            const heic2any = (await import("heic2any")).default;
            const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
            processedFile = Array.isArray(converted) ? converted[0] : converted;
            safeMime = "image/jpeg";
          } catch {
            whaleToast.error("Could not convert HEIC image. Please export as JPG and try again.");
            setIsAnalyzing(false);
            return;
          }
        }

        const url = URL.createObjectURL(processedFile);
        const buffer = await processedFile.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        const { data, error } = await supabase.functions.invoke("diagnose-image", {
          body: { image: base64, mimeType: safeMime, mode: "guide_steps", complexity: complexityLevel },
        });

        if (error) {
          const msg = (error as any)?.message ?? String(error);
          whaleToast.error(`Scan failed: ${msg}`);
          setIsAnalyzing(false);
          return;
        }

        if ((data as any)?.error) {
          whaleToast.error(`Scan failed: ${(data as any).error}`);
          setIsAnalyzing(false);
          return;
        }

        const inputStatus = (data as any)?.input_status as string | undefined;
        if (inputStatus && inputStatus !== "ok") {
          whaleToast.error(
            inputStatus === "blurry"
              ? "Image is too blurry to read. Please retake a clearer photo."
              : "That doesn't look like a STEM image. Please upload a clear PNG or JPG."
          );
          setIsAnalyzing(false);
          return;
        }

        // Guest path — skip all DB writes, mark scan used, show result with signup prompt
        if (isGuest) {
          try { localStorage.setItem("gogodeep_guest_scan_used", "1"); } catch {}
          try { sessionStorage.setItem(SESSION_REPORT_KEY, JSON.stringify({ diagnosis: data, mode: "guide", guest: true })); } catch {}
          setScanComplete(true);
          await new Promise((r) => setTimeout(r, 580));
          navigate("/report", { state: { imageUrl: url, diagnosis: data, mode: "guide", guest: true } });
          return;
        }

        const user = preCheckUser!;
        const topic = (data as any)?.concept_label ?? (data as any)?.question_summary ?? null;
        const whaleScanContext = [
          "The user has a scan loaded. Answer questions based on this context and do not ask them to upload a screenshot.",
          topic && `Topic: ${topic}`,
          (data as any)?.question_summary && `Question: ${(data as any).question_summary}`,
          (data as any)?.what_happened && `Problem context: ${(data as any).what_happened}`,
          (data as any)?.core_concept && `Core concept: ${(data as any).core_concept}`,
          (data as any)?.underlying_concept && `Underlying concept: ${(data as any).underlying_concept}`,
        ].filter(Boolean).join("\n");


        const [{ data: insertedScan, error: insertError }] = await Promise.all([
          (supabase as any)
            .from("error_logs")
            .insert({ student_id: user.id, subject: "STEM", topic, specific_error_tag: null, error_category: null, diagnosis: data })
            .select("id")
            .single(),
          (supabase as any).rpc("increment_scan_count", { user_id: user.id }),
        ]);

        if (insertError) {
          console.error("error_logs insert failed:", insertError);
          whaleToast.error(`Scan save failed: ${insertError.message}. Check Supabase RLS policies.`);
        }

        const scanId = insertedScan?.id;
        if (scanId) {
          try {
            localStorage.setItem(SCAN_CACHE_KEY(scanId), JSON.stringify({ diagnosis: data, mode: "guide" }));
          } catch {
            // quota exceeded — Supabase is the fallback
          }
          // Store image in memory so tab-switch doesn't lose the blob URL
          const reader = new FileReader();
          reader.onload = () => { if (reader.result) scanImageStore.set(scanId, reader.result as string); };
          reader.readAsDataURL(processedFile);
        }

        queryClient.invalidateQueries({ queryKey: ["history", "error_logs"] });
        // Persist to sessionStorage — survives tab suspension/restore
        try {
          sessionStorage.setItem(SESSION_REPORT_KEY, JSON.stringify({ diagnosis: data, mode: "guide", scanId, imageBase64: base64, mimeType: safeMime }));
        } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent("whale-scan-done", { detail: { context: whaleScanContext } }));
        // XP notification
        notifyScanXP(user.id, topic, (data as any)?.error_category ?? null);
        setScanComplete(true);
        await new Promise((r) => setTimeout(r, 580));
        navigate("/report", { state: { imageUrl: url, diagnosis: data, mode: "guide", scanId } });
      } catch (err: unknown) {
        console.error("Analysis failed:", err);
        const msg = err instanceof Error ? err.message : String(err);
        whaleToast.error(`Scan failed: ${msg}`);
        setIsAnalyzing(false);
        setScanComplete(false);
      }
    },
    [navigate, queryClient]
  );

  const analyzeText = useCallback(async () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;

    // Reject obvious nonsense: too short or no real words
    const words = trimmed.split(/\s+/).filter(w => w.length > 1);
    if (trimmed.length < 8 || words.length < 2) {
      whaleToast.error("That doesn't look like a question — try typing it out more fully.");
      return;
    }

    if (!await checkCooldown()) return;

    const {
      data: { user: preCheckUser },
    } = await supabase.auth.getUser();
    const isGuest = !preCheckUser?.id;
    if (isGuest && localStorage.getItem("gogodeep_guest_scan_used")) {
      navigate("/signup");
      return;
    }

    setIsAnalyzing(true);

    try {
      if (!isGuest) {
        const credits = await checkScanCredits();
        if (!credits.allowed) {
          setIsAnalyzing(false);
          setRemainingCredits(credits.credits);
          setShowUpgradeModal(true);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("diagnose-image", {
        body: { text: trimmed, mode: "guide_steps", complexity: 2 },
      });

      if (error) {
        whaleToast.error(`Scan failed: ${(error as any)?.message ?? String(error)}`);
        setIsAnalyzing(false);
        return;
      }

      if ((data as any)?.error) {
        whaleToast.error(`Scan failed: ${(data as any).error}`);
        setIsAnalyzing(false);
        return;
      }

      // Guest path — skip all DB writes, mark scan used, show result with signup prompt
      if (isGuest) {
        try { localStorage.setItem("gogodeep_guest_scan_used", "1"); } catch {}
        try { sessionStorage.setItem(SESSION_REPORT_KEY, JSON.stringify({ diagnosis: data, mode: "guide", guest: true, inputText: trimmed })); } catch {}
        setScanComplete(true);
        await new Promise((r) => setTimeout(r, 580));
        navigate("/report", { state: { imageUrl: null, inputText: trimmed, diagnosis: data, mode: "guide", guest: true } });
        return;
      }

      const user = preCheckUser!;
      const topic = (data as any)?.concept_label ?? (data as any)?.question_summary ?? null;
      const whaleScanContext = [
        "The user has a scan loaded. Answer questions based on this context and do not ask them to upload a screenshot.",
        topic && `Topic: ${topic}`,
        (data as any)?.question_summary && `Question: ${(data as any).question_summary}`,
        (data as any)?.what_happened && `Problem context: ${(data as any).what_happened}`,
        (data as any)?.core_concept && `Core concept: ${(data as any).core_concept}`,
        (data as any)?.underlying_concept && `Underlying concept: ${(data as any).underlying_concept}`,
      ].filter(Boolean).join("\n");


      const [{ data: insertedScan, error: insertError }] = await Promise.all([
        (supabase as any)
          .from("error_logs")
          .insert({ student_id: user.id, subject: "STEM", topic, specific_error_tag: null, error_category: null, diagnosis: data })
          .select("id")
          .single(),
        (supabase as any).rpc("increment_scan_count", { user_id: user.id }),
      ]);

      if (insertError) {
        console.error("error_logs insert failed:", insertError);
      }

      const scanId = insertedScan?.id;
      if (scanId) {
        try {
          localStorage.setItem(SCAN_CACHE_KEY(scanId), JSON.stringify({ diagnosis: data, mode: "guide", inputText: trimmed }));
        } catch {
          // quota exceeded — Supabase is the fallback
        }
      }

      queryClient.invalidateQueries({ queryKey: ["history", "error_logs"] });
      // Persist to sessionStorage — survives tab suspension/restore
      try {
        sessionStorage.setItem(SESSION_REPORT_KEY, JSON.stringify({ diagnosis: data, mode: "guide", scanId, inputText: trimmed }));
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("whale-scan-done", { detail: { context: whaleScanContext } }));
      notifyScanXP(user.id, topic, (data as any)?.error_category ?? null);
      setScanComplete(true);
      await new Promise((r) => setTimeout(r, 580));
      navigate("/report", { state: { imageUrl: null, inputText: trimmed, diagnosis: data, mode: "guide", scanId } });
    } catch (err: unknown) {
      console.error("Text analysis failed:", err);
      whaleToast.error(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
      setIsAnalyzing(false);
      setScanComplete(false);
    }
  }, [textInput, navigate, queryClient]);

  useEffect(() => {
    const file = pendingFileStore.get();
    if (file) {
      pendingFileStore.clear();
      setSelectedFile(file);
      analyzeImage(file);
    }
  }, [analyzeImage]);

  // Accept drops anywhere on the page
  useEffect(() => {
    const TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isAnalyzing) return;
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      if (!TYPES.includes(file.type)) { whaleToast.error("Unsupported format. Please use JPG, PNG, WebP, or HEIC."); return; }
      setSelectedFile(file);
      analyzeImage(file);
    };
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [isAnalyzing, analyzeImage]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"].includes(file.type)) {
      whaleToast.error("Unsupported format. Please use JPG, PNG, WebP, or HEIC.");
      return;
    }
    setSelectedFile(file);
    analyzeImage(file);
  }, [analyzeImage]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"].includes(file.type)) {
      whaleToast.error("Unsupported format. Please use JPG, PNG, WebP, or HEIC.");
      return;
    }
    setSelectedFile(file);
    analyzeImage(file);
  }, [analyzeImage]);

  return (
    <EducatorLayout title="Workspace" subtitle="Drop it. Scan it. Understand it." noSidebar>
      <Helmet>
        <title>Workspace</title>
        <meta name="description" content="Upload a photo of your exam working or handwritten notes. Gogodeep analyses hard STEM questions, finds your error, and guides you step by step. Supports Physics HL, Math HL AA, AP Calculus BC, and AP Statistics." />
        <link rel="canonical" href="https://gogodeep.com/workspace" />
      </Helmet>

      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(600%); opacity: 0; }
        }
        .scan-line { animation: scan-line 2.4s ease-in-out infinite; }
        @keyframes border-spin {
          to { stroke-dashoffset: -400; }
        }
      `}</style>

      <div className="mx-auto max-w-2xl mt-6 sm:mt-10" data-feature="ai-scanner-for-hard-stem-questions">

        {/* ── Upload zone ── */}
        <label
          aria-label="Upload problem screenshot for AI analysis"
          onDragOver={(e) => { e.preventDefault(); if (!isAnalyzing) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { if (isAnalyzing) return; onDrop(e); }}
          className={cn(
            "group relative flex min-h-[22rem] w-full cursor-pointer flex-col items-center justify-center rounded-3xl overflow-hidden transition-all duration-300",
            isDragging
              ? "border-2 border-primary bg-primary/8 shadow-[0_0_80px_hsl(var(--primary)/0.25)]"
              : isAnalyzing
              ? "border-2 border-primary/40 bg-card cursor-not-allowed"
              : "border-2 border-dashed border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/50 hover:shadow-[0_0_48px_hsl(var(--primary)/0.12)]"
          )}
        >
          <input type="file" accept="image/*" className="hidden" onChange={onFileInput} disabled={isAnalyzing || cooldownActive} />

          {/* Faint Blue watermark */}
          {!isAnalyzing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.035]">
              <img src="/blue.png" alt="" draggable={false} className="h-80 w-80 object-contain" />
            </div>
          )}

          {/* Scanning line during drag */}
          {isDragging && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary/60 blur-sm scan-line" />
          )}

          {isAnalyzing ? (
            <WhaleScanLoader complete={scanComplete} />
          ) : cooldownActive ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center z-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-7 w-7 text-yellow-500" />
              </div>
              <p className="text-base font-black text-foreground">Hold on…</p>
              <p className="text-sm text-muted-foreground">Wait a few seconds before scanning again.</p>
            </div>
          ) : isDragging ? (
            <div className="flex flex-col items-center gap-4 z-10">
              <Waves className="h-12 w-12 text-primary animate-pulse" />
              <p className="text-2xl font-black text-primary">Drop it!</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 px-8 text-center z-10">
              {/* Animated upload icon */}
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/8 transition-all group-hover:border-primary/60 group-hover:bg-primary/15 group-hover:scale-110">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black tracking-tight text-foreground">
                  {selectedFile ? selectedFile.name : "Drop your hardest problem"}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Maths · Physics · Chemistry · Biology
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                <span>JPG</span><span>·</span><span>PNG</span><span>·</span><span>WebP</span><span>·</span><span>HEIC</span>
              </div>
            </div>
          )}
        </label>

        {/* ── Text input ── */}
        <div className="mt-4">
          {!showTextInput ? (
            <button
              className="w-full rounded-2xl border border-border bg-card/50 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              onClick={() => { setShowTextInput(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
            >
              or type your question ↓
            </button>
          ) : (
            <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
              isChallengeMode
                ? "border-amber-400/70 shadow-[0_0_32px_rgba(251,191,36,0.18)] focus-within:border-amber-400 focus-within:shadow-[0_0_48px_rgba(251,191,36,0.28)]"
                : "border-primary/20 bg-card shadow-[0_0_32px_hsl(var(--primary)/0.06)] focus-within:border-primary/40 focus-within:shadow-[0_0_40px_hsl(var(--primary)/0.10)]"
            }`}>
              {isChallengeMode && (
                <div className="flex items-center justify-between bg-amber-400/10 border-b border-amber-400/20 px-5 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Daily challenge</span>
                  <span className="text-sm font-black text-amber-500">+{storedChallengeXP} XP</span>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={(e) => {
                  if (isChallengeMode) {
                    setIsChallengeMode(false);
                    try { sessionStorage.removeItem("gogodeep_challenge_bonus"); sessionStorage.removeItem("gogodeep_challenge_xp"); } catch {}
                  }
                  setTextInput(e.target.value);
                }}
                disabled={isAnalyzing}
                placeholder="Type or paste your question here…"
                rows={4}
                className={`w-full resize-none bg-transparent px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50 ${isChallengeMode ? "bg-amber-400/[0.03]" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && textInput.trim()) {
                    e.preventDefault();
                    analyzeText();
                  }
                }}
              />
              <div className={`flex items-center justify-between border-t px-5 py-3 ${isChallengeMode ? "border-amber-400/20 bg-amber-400/[0.04]" : "border-primary/10 bg-primary/[0.02]"}`}>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  {isMac ? "⌘↵" : "Ctrl+↵"} to scan
                </span>
                <button
                  onClick={analyzeText}
                  disabled={isAnalyzing || !textInput.trim()}
                  className="rounded-xl bg-amber-400 px-5 py-2 text-sm font-black text-black shadow-lg shadow-amber-400/20 transition-all hover:bg-amber-300 hover:scale-[1.04] disabled:opacity-30 disabled:pointer-events-none"
                >
                  {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="border border-border bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">All 3 scans used for today</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Your free scans reset in <span className="font-medium text-foreground">{resetCountdown}</span>. Go Deep for unlimited scans — no daily cap.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center justify-between">
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowUpgradeModal(false)}>
              Wait for reset
            </button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => { setShowUpgradeModal(false); navigate("/pricing"); }}>
              Go Deep
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </EducatorLayout>
  );
};

export default DiagnosticLab;
