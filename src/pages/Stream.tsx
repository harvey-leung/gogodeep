import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Waves, ArrowRight, Check, ChevronRight, Lock, Plus, Zap, Pencil, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | "landing"
  | "goal"
  | "intake"
  | "generating"
  | "program"
  | "diagnostic"
  | "practice";

interface IntakeQuestion {
  id: string;
  question: string;
  type: "mc" | "multi" | "text" | "date";
  options?: string[];
}

interface StreamProgram {
  title: string;
  tagline: string;
  estimatedWeeks: number;
  targetDate?: string; // ISO yyyy-mm-dd
  units: Array<{
    name: string;
    topics: string[];
    estimatedTime: string;
  }>;
}

interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  level: number;
  topic: string;
}

interface SavedStream {
  id: string;
  goal: string;
  program: StreamProgram;
  currentLevel: number | null;
  createdAt: string;
  intakeAnswers: Record<string, string>;
  cachedQuestions?: Question[];
}

// ── Fallbacks (used when stream-generate isn't deployed yet) ─────────────────

const FALLBACK_INTAKE: IntakeQuestion[] = [
  {
    id: "level",
    question: "How would you describe your current level?",
    type: "mc",
    options: ["Complete beginner", "Know the basics", "Fairly comfortable", "Advanced"],
  },
  {
    id: "goal_type",
    question: "What's your main aim?",
    type: "multi",
    options: ["Prepare for an exam", "Build a real skill", "Fill in gaps", "Deep understanding"],
  },
  {
    id: "timeline",
    question: "When do you want to achieve this?",
    type: "date",
  },
  {
    id: "time",
    question: "How much time can you dedicate each week?",
    type: "mc",
    options: ["1–2 hours", "3–5 hours", "6–10 hours", "10+ hours"],
  },
];

function makeFallbackTitle(goal: string): string {
  const stopWords = new Set(["a","an","the","for","of","to","and","in","on","my","i","with","how","learn"]);
  const words = goal.trim().split(/\s+/).filter((w) => !stopWords.has(w.toLowerCase())).slice(0, 4);
  const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return title.length < 10 ? `${title} Fundamentals` : title;
}

function buildFallbackProgram(goal: string, answers: Record<string, string>): StreamProgram {
  const dateAnswer = answers["When do you want to achieve this?"] ?? "";
  const timeAnswer = Object.values(answers).find((a) => a.includes("hour")) ?? "3–5 hours";

  // Default days from weekly hours if no date given
  let days = timeAnswer.includes("1–2") ? 56 : timeAnswer.includes("6–10") ? 28 : timeAnswer.includes("10+") ? 21 : 42;
  let targetDate: string | undefined;

  if (dateAnswer && /^\d{4}-\d{2}-\d{2}$/.test(dateAnswer)) {
    const target = new Date(dateAnswer + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff > 0) { days = diff; targetDate = dateAnswer; }
  }

  const tl = (d: number) => {
    if (d <= 1) return "1 day";
    if (d < 7) return `${d} days`;
    const w = Math.round(d / 7);
    return `${w} week${w !== 1 ? "s" : ""}`;
  };

  type Unit = StreamProgram["units"][number];
  let units: Unit[];

  if (days <= 7) {
    units = [
      { name: "Core Concepts", topics: ["Key ideas", "Fundamentals", "Basic technique"], estimatedTime: tl(Math.round(days * 0.5)) },
      { name: "Practice", topics: ["Worked examples", "Common mistakes", "Exam questions"], estimatedTime: tl(Math.round(days * 0.5)) },
    ];
  } else if (days <= 21) {
    units = [
      { name: "Foundations", topics: ["Core concepts", "Key terminology", "Basic problems"], estimatedTime: tl(Math.round(days * 0.35)) },
      { name: "Technique", topics: ["Methods", "Worked examples", "Problem types"], estimatedTime: tl(Math.round(days * 0.4)) },
      { name: "Exam Practice", topics: ["Past-style questions", "Timed practice", "Review"], estimatedTime: tl(Math.round(days * 0.25)) },
    ];
  } else if (days <= 49) {
    units = [
      { name: "Foundations", topics: ["Core concepts", "Key terminology"], estimatedTime: tl(Math.round(days * 0.3)) },
      { name: "Methods", topics: ["Problem-solving approaches", "Worked examples"], estimatedTime: tl(Math.round(days * 0.35)) },
      { name: "Application", topics: ["Harder problems", "Exam-style questions"], estimatedTime: tl(Math.round(days * 0.35)) },
    ];
  } else {
    units = [
      { name: "Foundations", topics: ["Core concepts", "Key terminology"], estimatedTime: tl(Math.round(days * 0.25)) },
      { name: "Methods", topics: ["Techniques", "Worked examples", "Common patterns"], estimatedTime: tl(Math.round(days * 0.3)) },
      { name: "Application", topics: ["Problem solving", "Practice questions"], estimatedTime: tl(Math.round(days * 0.25)) },
      { name: "Mastery", topics: ["Hard problems", "Exam-style questions", "Review"], estimatedTime: tl(Math.round(days * 0.2)) },
    ];
  }

  return {
    title: makeFallbackTitle(goal),
    tagline: `Your personal learning path through ${goal.toLowerCase()}`,
    targetDate,
    estimatedWeeks: Math.ceil(days / 7),
    units,
  };
}

// ── Storage ───────────────────────────────────────────────────────────────────

const LS_KEY = "gogodeep_streams_v1";
const PENDING_STREAM_KEY = "gogodeep_pending_stream";

function loadStreams(): SavedStream[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStreams(streams: SavedStream[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(streams)); } catch {}
}

// ── Animations ────────────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
};

const GENERATION_MESSAGES = [
  "Mapping the concepts...",
  "Planning your path...",
  "Charting the depths...",
  "Almost ready...",
];

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Calendar ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function StreamCalendar({ value, onChange }: { value: string | null; onChange: (iso: string) => void }) {
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startPad = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [...Array(startPad).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selected = value ? new Date(value + "T00:00:00") : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground text-base">
          ‹
        </button>
        <span className="text-sm font-semibold text-foreground">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground text-base">
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground/50 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(viewYear, viewMonth, day);
          date.setHours(0, 0, 0, 0);
          const isPast = date < todayDate;
          const isToday = date.getTime() === todayDate.getTime();
          const isSelected = selected ? date.getTime() === selected.getTime() : false;
          const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return (
            <button
              key={i}
              disabled={isPast}
              onClick={() => onChange(iso)}
              className={cn(
                "h-9 w-full rounded-lg text-sm font-medium transition-colors",
                isPast && "text-muted-foreground/20 cursor-not-allowed",
                !isPast && !isSelected && !isToday && "text-foreground hover:bg-accent",
                isToday && !isSelected && "text-primary ring-1 ring-primary/40 hover:bg-primary/10",
                isSelected && "bg-primary text-primary-foreground",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Whale Avatar ──────────────────────────────────────────────────────────────

function WhaleAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  const cls = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-8 w-8" : "h-12 w-12";
  return err ? (
    <span className={cn("flex items-center justify-center rounded-full bg-primary/10 text-2xl shrink-0", cls)}>🐋</span>
  ) : (
    <img
      src="/blue.png"
      alt="Blue"
      draggable={false}
      onError={() => setErr(true)}
      className={cn("rounded-full object-cover shrink-0", cls)}
    />
  );
}

// ── Depth Meter ───────────────────────────────────────────────────────────────

function DepthMeter({ level, max = 10 }: { level: number; max?: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Depth</span>
      <div className="relative h-40 w-3 rounded-full bg-border overflow-hidden">
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-full bg-primary"
          initial={{ height: "0%" }}
          animate={{ height: `${(level / max) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-bold text-primary">{level}</span>
    </div>
  );
}

// ── Level Badge ───────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: number }) {
  const label = level <= 2 ? "Surface" : level <= 4 ? "Shallow" : level <= 6 ? "Mid" : level <= 8 ? "Deep" : "Abyss";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
      level <= 3 ? "bg-green-500/15 text-green-400" :
      level <= 6 ? "bg-yellow-500/15 text-yellow-400" :
      "bg-primary/15 text-primary"
    )}>
      <Waves className="h-3 w-3" />
      {label} · L{level}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Stream() {
  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState<Phase>("landing");
  const [plan, setPlan] = useState<"free" | "deep">("free");
  const [streams, setStreams] = useState<SavedStream[]>(loadStreams);
  const [activeStream, setActiveStream] = useState<SavedStream | null>(null);
  const [isGuest, setIsGuest] = useState(true);

  // Goal phase
  const [goal, setGoal] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [validatingGoal, setValidatingGoal] = useState(false);

  // Intake phase
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestion[]>([]);
  const [intakeIndex, setIntakeIndex] = useState(0);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});
  const [intakeTextDraft, setIntakeTextDraft] = useState("");
  const [intakeMultiDraft, setIntakeMultiDraft] = useState<string[]>([]);
  const [intakeDateDraft, setIntakeDateDraft] = useState<string | null>(null);

  // Program phase
  const [program, setProgram] = useState<StreamProgram | null>(null);

  // Generation cycling message
  const [genMessageIndex, setGenMessageIndex] = useState(0);
  const [generationStage, setGenerationStage] = useState<"intake" | "program">("intake");

  // Diagnostic phase
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<Question[]>([]);
  const [diagnosticIndex, setDiagnosticIndex] = useState(0);
  const [currentDiagnosticLevel, setCurrentDiagnosticLevel] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [diagnosticDone, setDiagnosticDone] = useState(false);

  // Practice phase
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [expandedPractice, setExpandedPractice] = useState<number | null>(null);
  const [practiceSelected, setPracticeSelected] = useState<Record<number, number>>({});
  const [practiceRevealed, setPracticeRevealed] = useState<Record<number, boolean>>({});

  // Stream rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const goalRef = useRef<HTMLTextAreaElement>(null);

  // Load plan + detect sign-in to restore pending stream
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setIsGuest(true); return; }
      setIsGuest(false);
      const { data } = await (supabase as any)
        .from("profiles").select("plan").eq("id", user.id).single();
      if (data?.plan === "deep") setPlan("deep");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setIsGuest(true); return; }
      setIsGuest(false);
      // Restore pending stream created while guest
      try {
        const raw = sessionStorage.getItem(PENDING_STREAM_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as {
          goal: string; intakeAnswers: Record<string, string>;
          program: StreamProgram; currentLevel: number;
        };
        sessionStorage.removeItem(PENDING_STREAM_KEY);
        setGoal(saved.goal);
        setIntakeAnswers(saved.intakeAnswers);
        setProgram(saved.program);
        setCurrentLevel(saved.currentLevel);
        setDiagnosticDone(true);
        setPhase("diagnostic");
      } catch {}
    });
    return () => subscription.unsubscribe();
  }, []);

  // Cycle generation messages
  useEffect(() => {
    if (phase !== "generating") return;
    const id = setInterval(() => {
      setGenMessageIndex((i) => (i + 1) % GENERATION_MESSAGES.length);
    }, 1400);
    return () => clearInterval(id);
  }, [phase]);

  // Focus goal textarea when entering goal phase
  useEffect(() => {
    if (phase === "goal") {
      setTimeout(() => goalRef.current?.focus(), 400);
    }
  }, [phase]);

  // ── API helpers ────────────────────────────────────────────────────────────

  async function callStreamGenerate(body: object) {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("stream-generate", {
      body,
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });
    if (error) throw error;
    return data;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function startNew() {
    setGoal("");
    setIntakeAnswers({});
    setIntakeIndex(0);
    setIntakeTextDraft("");
    setIntakeMultiDraft([]);
    setIntakeDateDraft(null);
    setProgram(null);
    setDiagnosticQuestions([]);
    setDiagnosticIndex(0);
    setCurrentDiagnosticLevel(1);
    setSelectedAnswer(null);
    setAnswerRevealed(false);
    setDiagnosticDone(false);
    setPracticeQuestions([]);
    setCurrentLevel(null);
    setActiveStream(null);
    setPhase("goal");
  }

  async function submitGoal() {
    if (!goal.trim() || validatingGoal) return;
    setGoalError(null);
    setValidatingGoal(true);
    try {
      const data = await callStreamGenerate({ action: "validate_goal", goal: goal.trim() });
      if (data?.valid === false) {
        setGoalError(data.reason || "That goal's a bit too vague — try adding what subject, skill, or exam you're focusing on.");
        setValidatingGoal(false);
        return;
      }
    } catch { /* if validation itself fails, let the user proceed */ }
    setValidatingGoal(false);

    setGenerationStage("intake");
    setPhase("generating");
    let questions: IntakeQuestion[] = FALLBACK_INTAKE;
    try {
      const data = await callStreamGenerate({ action: "intake_questions", goal: goal.trim() });
      if (data?.questions?.length) {
        questions = (data.questions as IntakeQuestion[]).map((q) => ({
          ...q,
          type: q.options?.length ? "mc" : q.type,
        }));
      }
    } catch { /* use fallback */ }
    setIntakeQuestions(questions);
    setIntakeIndex(0);
    setPhase("intake");
  }

  function advanceIntake(answer: string) {
    const q = intakeQuestions[intakeIndex];
    const next = { ...intakeAnswers, [q.question]: answer };
    setIntakeAnswers(next);
    if (intakeIndex + 1 < intakeQuestions.length) {
      setIntakeIndex((i) => i + 1);
      setIntakeTextDraft("");
      setIntakeMultiDraft([]);
    } else {
      generateProgram(next);
    }
  }

  function answerMC(option: string) { advanceIntake(option); }

  function toggleMulti(opt: string) {
    setIntakeMultiDraft((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  }

  function submitMulti() {
    if (!intakeMultiDraft.length) return;
    advanceIntake(intakeMultiDraft.join(", "));
  }

  function answerText() {
    if (!intakeTextDraft.trim()) return;
    const q = intakeQuestions[intakeIndex];
    const next = { ...intakeAnswers, [q.question]: intakeTextDraft.trim() };
    setIntakeAnswers(next);
    if (intakeIndex + 1 < intakeQuestions.length) {
      setIntakeIndex((i) => i + 1);
      setIntakeTextDraft("");
    } else {
      generateProgram(next);
    }
  }

  async function generateProgram(answers: Record<string, string>) {
    setGenerationStage("program");
    setPhase("generating");
    const dateAnswer = answers["When do you want to achieve this?"];
    const targetDate = dateAnswer && /^\d{4}-\d{2}-\d{2}$/.test(dateAnswer) ? dateAnswer : undefined;
    let prog: StreamProgram = buildFallbackProgram(goal.trim(), answers);
    try {
      const data = await callStreamGenerate({ action: "program", goal: goal.trim(), intakeAnswers: answers });
      if (data?.title && data?.units?.length) prog = { ...data, targetDate: targetDate ?? data.targetDate };
    } catch { /* use fallback */ }
    setProgram(prog);
    setPhase("program");
  }

  async function startDiagnostic() {
    if (!program) return;
    setPhase("generating");
    setGenerationStage("intake");

    const allTopics = program.units.flatMap((u) => u.topics);
    let questions: Question[] = [];

    try {
      const data = await callStreamGenerate({ action: "diagnostic", goal: goal.trim(), topics: allTopics });
      if (data?.questions?.length) {
        questions = (data.questions as Question[]).sort((a, b) => a.level - b.level);
      }
    } catch { /* try generate-quiz fallback */ }

    if (!questions.length) {
      try {
        const { data } = await supabase.functions.invoke("generate-quiz", { body: { topics: allTopics.slice(0, 5) } });
        questions = (data?.questions ?? []).map((q: any, i: number) => ({
          ...q, level: Math.min(1 + Math.round(i * 1.3), 8), topic: q.topic ?? allTopics[i % allTopics.length] ?? "General",
        }));
      } catch { /* no questions available */ }
    }

    setDiagnosticQuestions(questions);
    setDiagnosticIndex(0);
    setCurrentDiagnosticLevel(questions[0]?.level ?? 1);
    setSelectedAnswer(null);
    setAnswerRevealed(false);
    setDiagnosticDone(false);
    setPhase("diagnostic");
  }

  function selectAnswer(idx: number) {
    if (answerRevealed) return;
    setSelectedAnswer(idx);
    setAnswerRevealed(true);
  }

  function nextDiagnostic(tooEasy = false) {
    const q = diagnosticQuestions[diagnosticIndex];
    if (!q) return;

    if (tooEasy) {
      // Jump forward 2 questions
      const nextIdx = Math.min(diagnosticIndex + 2, diagnosticQuestions.length - 1);
      if (nextIdx === diagnosticIndex) {
        finishDiagnostic(q.level + 1);
        return;
      }
      setDiagnosticIndex(nextIdx);
      setCurrentDiagnosticLevel(diagnosticQuestions[nextIdx].level);
    } else {
      const nextIdx = diagnosticIndex + 1;
      if (nextIdx >= diagnosticQuestions.length) {
        finishDiagnostic(q.level);
        return;
      }
      setDiagnosticIndex(nextIdx);
      setCurrentDiagnosticLevel(diagnosticQuestions[nextIdx].level);
    }
    setSelectedAnswer(null);
    setAnswerRevealed(false);
  }

  function finishDiagnostic(level: number) {
    setCurrentLevel(level);
    setDiagnosticDone(true);
  }

  async function startPractice() {
    if (!program || currentLevel === null) return;
    setPracticeLoading(true);
    setPhase("practice");

    const allTopics = program.units.flatMap((u) => u.topics);
    let qs: Question[] = [];

    try {
      const data = await callStreamGenerate({ action: "practice", goal: goal.trim(), topics: allTopics, level: currentLevel });
      if (data?.questions?.length) qs = data.questions;
    } catch { /* try generate-quiz fallback */ }

    if (!qs.length) {
      try {
        const { data } = await supabase.functions.invoke("generate-quiz", { body: { topics: allTopics.slice(0, 5) } });
        const lo = Math.max(1, currentLevel - 2);
        const hi = Math.min(10, currentLevel + 2);
        const raw = data?.questions ?? [];
        qs = raw.map((q: any, i: number) => ({
          ...q,
          level: raw.length > 1 ? Math.round(lo + (i * (hi - lo)) / (raw.length - 1)) : currentLevel,
          topic: q.topic ?? allTopics[0] ?? "General",
        }));
      } catch { /* no questions */ }
    }

    qs = [...qs].sort((a, b) => a.level - b.level);
    setPracticeQuestions(qs);

    // Only save on first creation — not when retrying or reopening
    if (!activeStream) {
      const newStream: SavedStream = {
        id: crypto.randomUUID(),
        goal: goal.trim(),
        program: program,
        currentLevel,
        createdAt: new Date().toISOString(),
        intakeAnswers,
        cachedQuestions: qs,
      };
      const updated = [newStream, ...streams];
      setStreams(updated);
      saveStreams(updated);
      setActiveStream(newStream);
    } else if (qs.length && activeStream) {
      // Update cached questions for existing stream
      const updated = streams.map((s) =>
        s.id === activeStream.id ? { ...s, cachedQuestions: qs } : s
      );
      setStreams(updated);
      saveStreams(updated);
    }

    setPracticeLoading(false);
  }

  function openStream(s: SavedStream) {
    setActiveStream(s);
    setGoal(s.goal);
    setProgram(s.program);
    setCurrentLevel(s.currentLevel);
    setIntakeAnswers(s.intakeAnswers ?? {});
    setExpandedPractice(null);
    setPracticeSelected({});
    setPracticeRevealed({});
    setPhase("practice");

    if (s.cachedQuestions?.length) {
      // Use cached questions — no API call needed
      setPracticeQuestions(s.cachedQuestions);
      setPracticeLoading(false);
    } else if (s.program && s.currentLevel !== null) {
      // Fallback: fetch fresh questions (first-open of old streams)
      const allTopics = s.program.units.flatMap((u) => u.topics);
      setPracticeLoading(true);
      const fetch = async () => {
        let qs: Question[] = [];
        try {
          const data = await callStreamGenerate({ action: "practice", goal: s.goal, topics: allTopics, level: s.currentLevel! });
          if (data?.questions?.length) qs = data.questions;
        } catch {}
        if (!qs.length) {
          try {
            const { data } = await supabase.functions.invoke("generate-quiz", { body: { topics: allTopics.slice(0, 5) } });
            const lvl = s.currentLevel ?? 5;
            const lo = Math.max(1, lvl - 2);
            const hi = Math.min(10, lvl + 2);
            const raw = data?.questions ?? [];
            qs = raw.map((q: any, i: number) => ({
              ...q,
              level: raw.length > 1 ? Math.round(lo + (i * (hi - lo)) / (raw.length - 1)) : lvl,
              topic: q.topic ?? allTopics[0] ?? "General",
            }));
          } catch {}
        }
        qs = [...qs].sort((a, b) => a.level - b.level);
        setPracticeQuestions(qs);
        if (qs.length) {
          const updated = streams.map((st) => st.id === s.id ? { ...st, cachedQuestions: qs } : st);
          setStreams(updated);
          saveStreams(updated);
        }
        setPracticeLoading(false);
      };
      fetch();
    }
  }

  function diveIntoQuestion(question: Question) {
    navigate("/dive", { state: { prefillText: question.question } });
  }

  function renameStream(id: string, title: string) {
    const updated = streams.map((s) =>
      s.id === id ? { ...s, program: { ...s.program, title } } : s
    );
    setStreams(updated);
    saveStreams(updated);
    setRenamingId(null);
  }

  function deleteStream(id: string) {
    const updated = streams.filter((s) => s.id !== id);
    setStreams(updated);
    saveStreams(updated);
    setDeleteConfirmId(null);
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function difficultyLabel(level: number): { label: string; cls: string } {
    if (level <= 3) return { label: "Easy", cls: "bg-green-500/10 text-green-400" };
    if (level <= 6) return { label: "Medium", cls: "bg-yellow-500/10 text-yellow-400" };
    return { label: "Hard", cls: "bg-primary/10 text-primary" };
  }

  const canCreateNew = plan === "deep" || streams.length === 0;

  // ── Phase: Landing ─────────────────────────────────────────────────────────

  if (phase === "landing") {
    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-start px-4 pt-16 pb-20">
        <Helmet><title>Stream — Gogodeep</title></Helmet>

        <motion.div {...fadeUp} className="w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-10">
            <Waves className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Stream</h1>
          </div>

          {streams.length === 0 ? (
            /* Empty state */
            <motion.div {...fadeUp} className="flex flex-col items-center text-center py-16 gap-8">
              <WhaleAvatar size="lg" />
              <div className="space-y-3">
                <h2 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight">
                  Design your first stream.
                </h2>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                  Tell Blue what you want to master. He'll ask a few quick questions and build your personal learning path.
                </p>
              </div>
              <button
                onClick={startNew}
                className="group flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
              >
                Start streaming
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          ) : (
            /* Existing streams */
            <div className="space-y-6">
              <div className="flex items-center justify-end">
                {canCreateNew ? (
                  <button
                    onClick={startNew}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" /> New stream
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/pricing", { state: { backgroundLocation: location } })}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent"
                  >
                    <Lock className="h-3.5 w-3.5" /> Go Deep for more
                  </button>
                )}
              </div>

              <div className="grid gap-3">
                {streams.map((s) => (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group w-full text-left rounded-2xl border border-border bg-card px-6 py-5 transition-all hover:border-primary/40 hover:bg-accent/50 hover:shadow-md"
                  >
                    {deleteConfirmId === s.id ? (
                      /* Inline delete confirmation */
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium text-foreground">Delete <span className="font-bold">{s.program.title}</span>?</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteStream(s.id); }}
                            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1" onClick={() => renamingId !== s.id && openStream(s)}>
                          {renamingId === s.id ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={() => renameStream(s.id, renameDraft.trim() || s.program.title)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renameStream(s.id, renameDraft.trim() || s.program.title);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-lg border border-primary bg-transparent px-2 py-0.5 text-base font-semibold text-foreground focus:outline-none"
                            />
                          ) : (
                            <p className="font-semibold text-foreground truncate">{s.program.title}</p>
                          )}
                          {s.program.targetDate && (
                            <p className="mt-0.5 text-sm text-muted-foreground truncate">Until {formatDate(s.program.targetDate)}</p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground/60 truncate">"{s.goal}"</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 self-start pt-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameDraft(s.program.title); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-muted-foreground hover:text-foreground"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(s.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" onClick={() => openStream(s)} />
                        </div>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>

              {!canCreateNew && (
                <p className="text-center text-xs text-muted-foreground/50">
                  Free plan includes 1 stream. <button onClick={() => navigate("/pricing", { state: { backgroundLocation: location } })} className="text-primary hover:underline">Go Deep</button> for unlimited.
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Phase: Goal ────────────────────────────────────────────────────────────

  if (phase === "goal") {
    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <Helmet><title>Stream — What do you want to master?</title></Helmet>

        <AnimatePresence mode="wait">
          <motion.div key="goal" {...fadeUp} className="w-full max-w-2xl flex flex-col gap-8">
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary uppercase tracking-widest">Step 1 of 3</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight">
                What do you want<br />to master?
              </h2>
              <p className="text-muted-foreground text-lg">
                Describe a subject, skill, or exam you're preparing for.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                ref={goalRef}
                value={goal}
                onChange={(e) => { setGoal(e.target.value); if (goalError) setGoalError(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && goal.trim()) submitGoal();
                }}
                placeholder="e.g. I want to learn how to factor quadratic equations"
                rows={4}
                className={cn(
                  "w-full resize-none rounded-2xl border bg-card/60 px-6 py-4 text-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 transition-all",
                  goalError
                    ? "border-destructive/60 focus:border-destructive/60 focus:ring-destructive/40"
                    : "border-border focus:border-primary/60 focus:ring-primary/40"
                )}
              />
              {goalError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {goalError}
                </motion.p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setPhase("landing")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <div className="flex flex-col items-end gap-1">
                <button
                  disabled={!goal.trim() || validatingGoal}
                  onClick={submitGoal}
                  className="group flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {validatingGoal ? "Checking..." : "Continue"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <p className="text-xs text-muted-foreground/40">⌘ Enter to continue</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── Phase: Generating ──────────────────────────────────────────────────────

  if (phase === "generating") {
    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <Helmet><title>Stream — Charting your path...</title></Helmet>

        <motion.div {...fadeUp} className="flex flex-col items-center gap-8 text-center">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "1.8s" }} />
            <span className="absolute inset-2 rounded-full bg-primary/15 animate-ping" style={{ animationDuration: "1.8s", animationDelay: "0.3s" }} />
            <WhaleAvatar size="lg" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-foreground">
              {generationStage === "intake" ? "Blue is preparing questions..." : "Charting your stream..."}
            </h3>
            <AnimatePresence mode="wait">
              <motion.p
                key={genMessageIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="text-muted-foreground"
              >
                {GENERATION_MESSAGES[genMessageIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Phase: Intake ──────────────────────────────────────────────────────────

  if (phase === "intake") {
    const q = intakeQuestions[intakeIndex];
    if (!q) return null;

    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <Helmet><title>Stream — Tell Blue more</title></Helmet>

        <div className="w-full max-w-xl flex flex-col gap-8">
          {/* Progress dots */}
          <div className="flex items-center gap-2 justify-center">
            {intakeQuestions.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i < intakeIndex ? "w-2 bg-primary" :
                  i === intakeIndex ? "w-6 bg-primary" :
                  "w-2 bg-border"
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-6"
            >
              {/* Blue + question */}
              <div className="flex gap-4 items-start">
                <WhaleAvatar size="md" />
                <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-5 py-4 flex-1">
                  <p className="text-lg font-semibold text-foreground leading-snug">{q.question}</p>
                </div>
              </div>

              {/* Answer area */}
              {q.type === "mc" && q.options ? (
                <div className="grid gap-2.5">
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => answerMC(opt)}
                      className="group w-full text-left rounded-xl border border-border bg-card px-5 py-3.5 text-base font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
                    >
                      <span className="mr-3 text-primary/60 font-mono text-sm">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : q.type === "multi" && q.options ? (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-2.5">
                    {q.options.map((opt, i) => {
                      const selected = intakeMultiDraft.includes(opt);
                      return (
                        <button
                          key={i}
                          onClick={() => toggleMulti(opt)}
                          className={cn(
                            "w-full text-left rounded-xl border px-5 py-3.5 text-base font-medium transition-all active:scale-[0.98]",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
                          )}
                        >
                          <span className={cn(
                            "mr-3 inline-flex h-4 w-4 items-center justify-center rounded border transition-colors align-middle",
                            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          )}>
                            {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    disabled={intakeMultiDraft.length === 0}
                    onClick={submitMulti}
                    className="self-end flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : q.type === "date" ? (
                <div className="flex flex-col gap-3">
                  <StreamCalendar
                    value={intakeDateDraft}
                    onChange={(iso) => setIntakeDateDraft(iso)}
                  />
                  <button
                    disabled={!intakeDateDraft}
                    onClick={() => { if (intakeDateDraft) { advanceIntake(intakeDateDraft); setIntakeDateDraft(null); } }}
                    className="self-end flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {intakeDateDraft ? `Confirm ${formatDate(intakeDateDraft)}` : "Pick a date first"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={intakeTextDraft}
                    onChange={(e) => setIntakeTextDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && intakeTextDraft.trim()) answerText(); }}
                    placeholder="Type your answer..."
                    className="w-full rounded-xl border border-border bg-card px-5 py-3.5 text-base text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none transition-all"
                  />
                  <button
                    disabled={!intakeTextDraft.trim()}
                    onClick={answerText}
                    className="self-end flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

        </div>
      </div>
    );
  }

  // ── Phase: Program ─────────────────────────────────────────────────────────

  if (phase === "program" && program) {
    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 pt-12 pb-24">
        <Helmet><title>Stream — {program.title}</title></Helmet>

        <motion.div {...fadeUp} className="w-full max-w-2xl flex flex-col gap-10">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary/70">
              <Waves className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-widest">Your Stream</span>
            </div>
            <h2 className="text-4xl font-bold text-foreground">{program.title}</h2>
            {program.targetDate && (
              <p className="text-base text-muted-foreground">Until {formatDate(program.targetDate)}</p>
            )}
          </div>

          {/* Units */}
          <div className="space-y-3">
            {program.units.map((unit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-border bg-card px-6 py-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                        {i + 1}
                      </span>
                      <p className="font-semibold text-foreground">{unit.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {unit.topics.map((t, j) => (
                        <span key={j} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground/60 shrink-0 pt-0.5">{unit.estimatedTime}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-4 pt-2"
          >
            <button
              onClick={startDiagnostic}
              className="group flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
            >
              Find my level
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            <p className="text-xs text-muted-foreground/50">Blue will ask a few questions to find where you are</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Phase: Diagnostic ──────────────────────────────────────────────────────

  if (phase === "diagnostic") {
    if (diagnosticDone) {
      return (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
          <AnimatePresence>
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-8 text-center max-w-md"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-bold text-foreground">Got it.</h3>
                <p className="text-xl text-muted-foreground">
                  You're diving at{" "}
                  <span className="font-bold text-foreground">level {currentLevel}</span>.
                </p>
                <p className="text-muted-foreground/70 text-sm">Blue will generate a program tailored to your depth.</p>
              </div>
              {isGuest ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <button
                    onClick={() => {
                      try {
                        sessionStorage.setItem(PENDING_STREAM_KEY, JSON.stringify({
                          goal, intakeAnswers, program, currentLevel,
                        }));
                      } catch {}
                      navigate("/signup", { state: { pendingStream: true } });
                    }}
                    className="group flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Sign up to unlock your stream
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </button>
                  <p className="text-xs text-muted-foreground/60">
                    Your progress is saved.{" "}
                    <button
                      onClick={() => {
                        try {
                          sessionStorage.setItem(PENDING_STREAM_KEY, JSON.stringify({
                            goal, intakeAnswers, program, currentLevel,
                          }));
                        } catch {}
                        navigate("/login", { state: { pendingStream: true } });
                      }}
                      className="text-primary hover:underline"
                    >
                      Already have an account?
                    </button>
                  </p>
                </div>
              ) : (
                <button
                  onClick={startPractice}
                  className="group flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start my stream
                  <Waves className="h-5 w-5" />
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      );
    }

    const dq = diagnosticQuestions[diagnosticIndex];
    if (!dq) {
      return (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 text-center">
          <motion.div {...fadeUp} className="flex flex-col items-center gap-6 max-w-md">
            <WhaleAvatar size="lg" />
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">Blue couldn't find your depth</h3>
              <p className="text-muted-foreground">Something went wrong generating your diagnostic questions. Let's try that again.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase("program")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={startDiagnostic}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="relative z-10 min-h-screen flex flex-col items-start justify-center px-4 py-12">
        <Helmet><title>Stream — Finding your level</title></Helmet>

        <div className="w-full max-w-2xl mx-auto flex gap-8">
          {/* Depth meter */}
          <div className="hidden sm:flex flex-col items-center justify-center shrink-0">
            <DepthMeter level={currentDiagnosticLevel} />
          </div>

          {/* Question */}
          <div className="flex-1 flex flex-col gap-6">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Finding your depth</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={diagnosticIndex}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <p className="text-2xl font-bold text-foreground leading-snug">{dq.question}</p>

                <div className="grid gap-2.5">
                  {dq.options.map((opt, i) => {
                    const isSelected = selectedAnswer === i;
                    const isCorrect = i === dq.correct;
                    const revealed = answerRevealed;
                    return (
                      <button
                        key={i}
                        onClick={() => selectAnswer(i)}
                        disabled={revealed}
                        className={cn(
                          "w-full text-left rounded-xl border px-5 py-3.5 text-base font-medium transition-all",
                          !revealed && "border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                          revealed && isCorrect && "border-green-500/60 bg-green-500/10 text-green-400",
                          revealed && isSelected && !isCorrect && "border-destructive/60 bg-destructive/10 text-destructive",
                          revealed && !isSelected && !isCorrect && "border-border bg-card opacity-50 text-muted-foreground",
                        )}
                      >
                        <span className="mr-3 font-mono text-sm opacity-50">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {answerRevealed && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3"
                  >
                    <div className="rounded-xl bg-card border border-border px-4 py-3">
                      <p className="text-sm text-muted-foreground">{dq.explanation}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => nextDiagnostic(false)}
                        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                      >
                        Next <ArrowRight className="h-4 w-4" />
                      </button>
                      {selectedAnswer === dq.correct && dq.level < 5 && (
                        <button
                          onClick={() => nextDiagnostic(true)}
                          className="text-xs text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <Zap className="h-3 w-3" /> That was too easy — step up
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Practice ────────────────────────────────────────────────────────

  if (phase === "practice") {
    return (
      <div className="relative z-10 min-h-screen flex flex-col px-4 pt-10 pb-24">
        <Helmet><title>Stream — Practice</title></Helmet>

        <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">
          {/* Header */}
          <motion.div {...fadeUp} className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Waves className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-widest">Practice Stream</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">{program?.title ?? "Your Stream"}</h2>
            </div>
            <button
              onClick={() => setPhase("landing")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              ← Streams
            </button>
          </motion.div>

          {/* Questions */}
          {practiceLoading ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "1.8s" }} />
                <WhaleAvatar size="md" />
              </div>
              <p className="text-muted-foreground">Blue is preparing your questions...</p>
            </div>
          ) : practiceQuestions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-muted-foreground">Couldn't load questions. Try again.</p>
              <button onClick={startPractice} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {practiceQuestions.map((q, i) => {
                const diff = difficultyLabel(q.level);
                const isExpanded = expandedPractice === i;
                const isDone = practiceRevealed[i];
                const chosen = practiceSelected[i];

                if (isDone) {
                  const wasCorrect = chosen === q.correct;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4"
                    >
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded-full shrink-0", wasCorrect ? "bg-green-500/15" : "bg-destructive/15")}>
                        {wasCorrect
                          ? <Check className="h-4 w-4 text-green-400" />
                          : <X className="h-4 w-4 text-destructive" />}
                      </div>
                      <p className="text-sm text-muted-foreground line-through truncate flex-1">{q.question}</p>
                      {!wasCorrect && (
                        <span className="text-xs text-muted-foreground/60 shrink-0">Correct: {q.options[q.correct]}</span>
                      )}
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "rounded-2xl border bg-card transition-all",
                      isExpanded ? "border-primary/40 shadow-md" : "border-border hover:border-primary/25 hover:shadow-sm cursor-pointer"
                    )}
                    onClick={() => !isExpanded && setExpandedPractice(i)}
                  >
                    {/* Collapsed header — always visible */}
                    <div className="flex items-start gap-4 px-6 py-5">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 mt-0.5", diff.cls)}>
                        {diff.label}
                      </span>
                      <p className={cn("text-base font-semibold text-foreground leading-snug flex-1", !isExpanded && "line-clamp-2")}>
                        {q.question}
                      </p>
                      {isExpanded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedPractice(null); }}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col gap-3 px-6 pb-6"
                      >
                        <div className="grid gap-2">
                          {q.options.map((opt, j) => (
                            <button
                              key={j}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (practiceSelected[i] !== undefined) return;
                                setPracticeSelected((prev) => ({ ...prev, [i]: j }));
                                setPracticeRevealed((prev) => ({ ...prev, [i]: true }));
                              }}
                              className={cn(
                                "w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                                practiceSelected[i] === undefined && "border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                                practiceSelected[i] !== undefined && j === q.correct && "border-green-500/50 bg-green-500/10 text-green-400",
                                practiceSelected[i] === j && j !== q.correct && "border-destructive/50 bg-destructive/10 text-destructive",
                                practiceSelected[i] !== undefined && practiceSelected[i] !== j && j !== q.correct && "border-border opacity-50 text-muted-foreground",
                              )}
                            >
                              <span className="mr-2.5 font-mono text-xs opacity-50">{String.fromCharCode(65 + j)}.</span>
                              {opt}
                            </button>
                          ))}
                        </div>

                        {practiceSelected[i] !== undefined && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground px-1">
                            {q.explanation}
                          </motion.p>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); diveIntoQuestion(q); }}
                          className="group/dive self-start flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          Dive
                          <ArrowRight className="h-4 w-4 transition-transform group-hover/dive:translate-x-0.5" />
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
