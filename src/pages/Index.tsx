import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";
import { Aperture, Microscope, Compass, ArrowRight, Zap, ScanLine, BookOpen, Loader2, Flame, ChevronRight, ChevronLeft, ChevronDown, Waves, Lock, Settings2, Lightbulb, RefreshCw, Mail, Send, X } from "lucide-react";
import { UnitCircle } from "@/components/interact/MathModels2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PageTransition from "@/components/PageTransition";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { RichText } from "@/components/RichText";
import gogodeepLogo from "@/assets/gogodeep-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { SCAN_LIMITS, SCAN_CACHE_KEY } from "@/lib/supabase";
import { FREE_FOR_ALL } from "@/lib/featureFlags";
import { whaleToast } from "@/lib/whaleToast";
import { cn } from "@/lib/utils";
import { calcScanXP, calcRelativeScanXP, QUIZ_XP, CHALLENGE_BONUS_XP, addBonusXP, getBonusXPEntries } from "@/lib/xp";
import type { User } from "@supabase/supabase-js";

const QUOTES = [
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "The only real mistake is the one from which we learn nothing.", author: "Henry Ford" },
  { text: "We do not learn from experience. We learn from reflecting on experience.", author: "John Dewey" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Mistakes are the portals of discovery.", author: "James Joyce" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Genius is 1% inspiration and 99% perspiration.", author: "Thomas Edison" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Education is not the learning of facts, but the training of the mind to think.", author: "Albert Einstein" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Nothing in the world can take the place of persistence.", author: "Calvin Coolidge" },
  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { text: "You don't lose marks for not knowing. You lose them for not finding out.", author: "Anonymous" },
  { text: "The student who reviews their mistakes outperforms the one who only studies new material.", author: "Anonymous" },
  { text: "The top students are not always the smartest. They just catch their errors faster.", author: "Anonymous" },
  { text: "One hour of deliberate review beats five hours of passive re-reading.", author: "Anonymous" },
  { text: "Every concept you master today is one less thing that can surprise you on exam day.", author: "Anonymous" },
  { text: "Comfort and high grades do not live at the same address.", author: "Anonymous" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "An unexamined answer is not worth submitting.", author: "Anonymous" },
  { text: "Frustration is just excitement without direction.", author: "Anonymous" },
  { text: "Repetition is the mother of skill.", author: "Tony Robbins" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "What we learn with pleasure, we never forget.", author: "Alfred Mercier" },
  { text: "A mistake is evidence that someone tried.", author: "Anonymous" },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.platform || navigator.userAgent);

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded border border-primary/40 bg-primary/10 w-9 h-9 text-base font-bold text-primary leading-none">
      {children}
    </span>
  );
}

function ScreenshotKeys() {
  if (isMac) return (
    <span className="flex items-center gap-1">
      <Key>⌘</Key><Key>⇧</Key><Key>4</Key>
    </span>
  );
  if (isWindows) return (
    <span className="flex items-center gap-1">
      <Key>⊞</Key><Key>⇧</Key><Key>S</Key>
    </span>
  );
  return <Key>PrtSc</Key>;
}

const steps = [
  { renderIcon: () => <ScreenshotKeys />, step: "01", title: "Screenshot", desc: "Drop a screenshot of a difficult problem." },
  { renderIcon: () => <span className="text-2xl font-black text-primary leading-none">!</span>, step: "02", title: "Learn", desc: "Gogodeep breaks the question down, and you'll understand it within minutes." },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

// ── XP & level system ─────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1,  name: "Bronze",   xpReq: 0,     color: "#9a5b1e", glow: "#9a5b1e40", inner: "#c97d38", text: "#fff" },
  { level: 2,  name: "Silver",   xpReq: 100,   color: "#5a6472", glow: "#5a647240", inner: "#8a97a4", text: "#fff" },
  { level: 3,  name: "Gold",     xpReq: 400,   color: "#c47d00", glow: "#c47d0040", inner: "#e8a800", text: "#fff" },
  { level: 4,  name: "Platinum", xpReq: 1000,  color: "#4060a0", glow: "#4060a040", inner: "#6888c8", text: "#fff" },
  { level: 5,  name: "Diamond",  xpReq: 2000,  color: "#0099bb", glow: "#0099bb40", inner: "#00c8e8", text: "#fff" },
  { level: 6,  name: "Emerald",  xpReq: 3500,  color: "#1a8c4e", glow: "#1a8c4e40", inner: "#28b864", text: "#fff" },
  { level: 7,  name: "Ruby",     xpReq: 5500,  color: "#c0241a", glow: "#c0241a40", inner: "#e84030", text: "#fff" },
  { level: 8,  name: "Sapphire", xpReq: 8000,  color: "#1464a8", glow: "#1464a840", inner: "#2888d4", text: "#fff" },
  { level: 9,  name: "Obsidian", xpReq: 11000, color: "#6b3090", glow: "#6b309040", inner: "#9040c0", text: "#fff" },
  { level: 10, name: "Master",   xpReq: 15000, color: "#c84800", glow: "#c8480040", inner: "#f06000", text: "#fff" },
] as const;
type Level = typeof LEVELS[number];


function hexPath(cx: number, cy: number, r: number): string {
  return "M " + Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 30) * Math.PI / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" L ") + " Z";
}

function LevelBadge({ lvl, size = 52 }: { lvl: Level; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.43, ri = r * 0.70;
  const id = `lvl-${lvl.level}-${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={lvl.inner} />
          <stop offset="100%" stopColor={lvl.color} />
        </radialGradient>
      </defs>
      <path d={hexPath(cx, cy, r + 3)} fill={lvl.glow} />
      <path d={hexPath(cx, cy, r)} fill={`url(#${id})`} />
      <path d={hexPath(cx, cy, ri)} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle"
        fill={lvl.text} fontSize={size * 0.32} fontWeight="900" fontFamily="system-ui,sans-serif">
        {lvl.level}
      </text>
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ErrorLog = {
  id: string;
  error_category: string | null;
  specific_error_tag: string | null;
  topic: string | null;
  created_at: string | null;
};

type DashboardData = {
  totalScans: number;
  creditsLeft: number | null;
  usedToday: number;
  dailyLimit: number | null;
  plan: string;
  conceptualCount: number;
  conceptsLearned: number;
  topTags: { tag: string; count: number }[];
  recentTopics: string[];
  recentScans: { id: string; label: string; created_at: string | null; error_category: string | null }[];
  loginStreak: number;
  bonusScans: number;
  weeklyScans: { day: string; count: number }[];
  totalXP: number;
  bestDayXP: number;
  todayXP: number;
};

function useUtcResetCountdown() {
  const getSecondsLeft = () => {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  };
  const [secs, setSecs] = useState(getSecondsLeft);
  useEffect(() => {
    const id = setInterval(() => setSecs(getSecondsLeft()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

type QuizQuestion = {
  topic: string;
  question: string;
  answer: string;
  mode: "typed" | "mc" | "tf";
  tfStatement?: string;
  tfCorrect?: boolean;
  mcOptions?: string[];
  mcCorrectIdx?: number;
};

type QuizState = {
  questions: QuizQuestion[];
  current: number;
  revealed: boolean;
  userInput: string;
  results: Array<"correct" | "incorrect">;
  currentResult: "correct" | "incorrect" | null;
  showStats: boolean;
  selectedMcIdx: number | null;
};

type QuizHistoryEntry = {
  id: string;
  date: string;
  score: number;
  total: number;
  elapsedSecs: number;
  topics: string[];
};

type QuizConfig = {
  numQuestions: number;
  typed: boolean;
  multipleChoice: boolean;
  trueOrFalse: boolean;
  selectedConcepts: string[];
};

function formatTime(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

const Dashboard = ({ user }: { user: User }) => {
  const username = user.user_metadata?.username ?? user.email?.split("@")[0] ?? "there";
  const [heroPhase, setHeroPhase] = useState<0 | 1 | 2>(0);

  // Daily XP claim (random 40–80 XP, resets each day)
  const DAILY_CLAIM_KEY = `gogodeep_claim_${user.id}`;
  const [dailyClaim, setDailyClaim] = useState<{ date: string; amount: number; claimed: boolean }>(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const stored = JSON.parse(localStorage.getItem(`gogodeep_claim_${user.id}`) ?? "null");
      if (stored?.date === today) return stored;
    } catch {}
    const today = new Date().toISOString().split("T")[0];
    const amount = 40 + Math.floor(Math.random() * 41);
    const claim = { date: today, amount, claimed: false };
    try { localStorage.setItem(`gogodeep_claim_${user.id}`, JSON.stringify(claim)); } catch {}
    return claim;
  });

  const GREETING_PHRASES = [
    "Today is your day",
    "Make yourself proud",
    "Your future self is watching",
    "Make today count",
    "No excuses today",
    "Outwork yesterday",
    "Earn your rest",
    "Own today",
    "Make it happen",
  ];
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizGenError, setQuizGenError] = useState<"limit" | "error" | null>(null);
  const [showQuizConfig, setShowQuizConfig] = useState(false);
  const [quizConfig, setQuizConfig] = useState<QuizConfig>({ numQuestions: 10, typed: true, multipleChoice: true, trueOrFalse: true, selectedConcepts: [] });
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [quizKey, setQuizKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeElapsedRef = useRef(0);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [showQuizHistory, setShowQuizHistory] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(`gogodeep_qh_${user.id}`) ?? "[]"); } catch { return []; }
  });
  const [nextQuizQuestions, setNextQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [generatingNext, setGeneratingNext] = useState(false);
  const QUIZ_SAVE_KEY = `gogodeep_qs_${user.id}`;
  const QUIZ_HIST_KEY = `gogodeep_qh_${user.id}`;
  const QUIZ_CACHE_Q_KEY = `gogodeep_rq_q_${user.id}`;
  const QUIZ_CACHE_D_KEY = `gogodeep_rq_d_${user.id}`;
  const QUIZ_DONE_KEY = `gogodeep_rq_done_${user.id}`;
  const [quizDoneToday, setQuizDoneToday] = useState(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      return localStorage.getItem(`gogodeep_rq_done_${user.id}`) === today;
    } catch { return false; }
  });
  const [scanAtBottom, setScanAtBottom] = useState(false);
  const scanScrollRef = useRef<HTMLDivElement>(null);
  const resetCountdown = useUtcResetCountdown();
  const location = useLocation();
  const GOAL_KEY = `gogodeep_daily_goal_${user.id}`;
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(`gogodeep_daily_goal_${user.id}`) ?? "5", 10) || 5; } catch { return 5; }
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

  // Hero entrance animation
  useEffect(() => {
    const t1 = setTimeout(() => setHeroPhase(1), 1500); // hold for reading
    const t2 = setTimeout(() => setHeroPhase(2), 2200); // done — overlay gone
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Show success toast when redirected back from Stripe
  useEffect(() => {
    if (new URLSearchParams(location.search).get("upgraded") === "1") {
      whaleToast.success("Plan activated. Enjoy your upgraded scans!");
      window.history.replaceState({}, "", "/");
    }
  }, [location.search]);

  useEffect(() => {
    const load = async () => {
      const [logsRes, profileRes] = await Promise.all([
        (supabase as any).from("error_logs").select("id, error_category, specific_error_tag, topic, created_at").eq("student_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("profiles").select("daily_scan_count, scan_reset_date, plan, login_streak, last_login_date, bonus_scans").eq("id", user.id).single(),
      ]);

      const logs: ErrorLog[] = logsRes.data ?? [];
      const plan: string = profileRes.data?.plan ?? "free";
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const isNewDay = (profileRes.data?.scan_reset_date ?? "") < today;
      if (isNewDay) {
        await (supabase as any).from("profiles").update({ daily_scan_count: 0, scan_reset_date: today }).eq("id", user.id);
      }
      const used = isNewDay ? 0 : (profileRes.data?.daily_scan_count ?? 0);
      let bonusScans: number = profileRes.data?.bonus_scans ?? 0;
      const limit = plan in SCAN_LIMITS ? SCAN_LIMITS[plan] : SCAN_LIMITS.free;

      // Streak logic
      const lastLogin: string = profileRes.data?.last_login_date ?? "";
      let loginStreak: number = profileRes.data?.login_streak ?? 0;
      if (lastLogin < today) {
        loginStreak = lastLogin === yesterday ? loginStreak + 1 : 1;
        const streakUpdates: Record<string, unknown> = { last_login_date: today, login_streak: loginStreak };
        if (plan !== "deep" && loginStreak % 7 === 0) {
          const bonus = plan === "intermediate" ? 20 : 10;
          bonusScans += bonus;
          streakUpdates.bonus_scans = bonusScans;
          whaleToast.success(`7-day streak! You've earned ${bonus} bonus credits.`);
        }
        await (supabase as any).from("profiles").update(streakUpdates).eq("id", user.id);
      }

      const creditsLeft = limit === null ? null : Math.max(0, (limit as number) - used) + bonusScans;

      const conceptualCount = logs.filter((l) => l.error_category?.toLowerCase() === "conceptual").length;
      const conceptsLearned = new Set(logs.map((l) => l.topic).filter(Boolean)).size;

      const tagCounts: Record<string, number> = {};
      for (const l of logs) {
        const tag = l.specific_error_tag ?? l.topic;
        if (tag) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

      const recentTopics = logs.map((l) => l.topic).filter(Boolean).slice(0, 3) as string[];

      const recentScans = logs.map((l) => ({
        id: l.id,
        label: l.specific_error_tag ?? l.topic ?? "Unnamed scan",
        created_at: l.created_at,
        error_category: l.error_category,
      }));

      const allLabels = logs.map(l => l.specific_error_tag ?? l.topic ?? null);
      const dayXP: Record<string, number> = {};
      for (let i = 0; i < logs.length; i++) {
        const l = logs[i];
        if (l.created_at) {
          const d = l.created_at.split("T")[0];
          dayXP[d] = (dayXP[d] ?? 0) + calcRelativeScanXP(l.specific_error_tag ?? l.topic, l.error_category, allLabels, l.id);
        }
      }
      // Add bonus XP (quiz, challenge, practice) from localStorage
      const bonusEntries = getBonusXPEntries(user.id);
      for (const e of bonusEntries) {
        dayXP[e.date] = (dayXP[e.date] ?? 0) + e.xp;
      }
      const todayStr = new Date().toISOString().split("T")[0];
      const todayXP = dayXP[todayStr] ?? 0;
      const totalXP = logs.reduce((sum, l) => sum + calcRelativeScanXP(l.specific_error_tag ?? l.topic, l.error_category, allLabels, l.id), 0)
        + bonusEntries.reduce((sum, e) => sum + e.xp, 0);
      const bestDayXP = Object.values(dayXP).length ? Math.max(...Object.values(dayXP)) : 0;

      const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyScans = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000);
        const dateStr = d.toISOString().split("T")[0];
        return { day: DAY_LABELS[d.getDay()], count: logs.filter((l) => l.created_at?.startsWith(dateStr)).length };
      });

      setData({ totalScans: logs.length, creditsLeft, usedToday: used, dailyLimit: limit as number | null, plan, conceptualCount, conceptsLearned, topTags, recentTopics, recentScans, loginStreak, bonusScans, weeklyScans, totalXP, bestDayXP, todayXP });
      setLoading(false);
    };
    load();
  }, [user.id]);

  const availableConcepts = (): string[] => {
    if (!data) return [];
    const concepts = new Set<string>();
    for (const scan of data.recentScans) {
      if (scan.label && scan.label !== "Unnamed scan") concepts.add(scan.label);
    }
    return Array.from(concepts);
  };

  const fetchRecapQuiz = useCallback((topics: string[]) => {
    const today = new Date().toISOString().split("T")[0];
    setQuizLoading(true);
    setQuizQuestions(null);
    setQuizGenError(null);
    supabase.functions.invoke("generate-quiz", { body: { topics } }).then(({ data: result, error }) => {
      setQuizLoading(false);
      if (error || !Array.isArray(result?.questions) || !result.questions.length) {
        console.error("[Quiz] generate-quiz failed:", error, result);
        setQuizGenError(result?.error === "daily_quiz_limit" ? "limit" : "error");
        return;
      }
      const questions: QuizQuestion[] = (result.questions as { topic: string; question: string; options: string[]; correct: number; explanation?: string }[]).map((q) => {
        const correctAnswer = q.options[q.correct];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        return {
          topic: q.topic,
          question: q.question,
          answer: q.explanation ? `${correctAnswer}\n\n${q.explanation}` : correctAnswer,
          mode: "mc" as const,
          mcOptions: shuffled,
          mcCorrectIdx: shuffled.indexOf(correctAnswer),
        };
      });
      setQuizQuestions(questions);
      try {
        localStorage.setItem(QUIZ_CACHE_D_KEY, today);
        localStorage.setItem(QUIZ_CACHE_Q_KEY, JSON.stringify(questions));
      } catch {}
    });
  }, []);

  // Generate recap quiz questions — only on new day, after completion, or when none exist
  useEffect(() => {
    if (!data || data.recentScans.length < 3) return;

    const today = new Date().toISOString().split("T")[0];
    const cachedDate = localStorage.getItem(QUIZ_CACHE_D_KEY);
    const cachedRaw = localStorage.getItem(QUIZ_CACHE_Q_KEY);

    // Use cached questions if they're from today
    if (cachedDate === today && cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (Array.isArray(cached) && cached.length) {
          setQuizQuestions(cached);
          return;
        }
      } catch {}
    }

    // New day: reset done flag
    if (cachedDate !== today) {
      try { localStorage.removeItem(QUIZ_DONE_KEY); } catch {}
      setQuizDoneToday(false);
    }

    const topics = data.recentScans.slice(0, 5).map((s) => s.label).filter(Boolean);
    if (!topics.length) return;
    fetchRecapQuiz(topics);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const quizActive = !!quiz && !quiz.showStats;
  useEffect(() => {
    if (!quizActive) { if (timerRef.current) clearInterval(timerRef.current); return; }
    const resumeFrom = resumeElapsedRef.current;
    resumeElapsedRef.current = 0;
    setElapsedSecs(resumeFrom);
    const startTs = Date.now() - resumeFrom * 1000;
    timerRef.current = setInterval(() => setElapsedSecs(Math.floor((Date.now() - startTs) / 1000)), 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizActive, quizKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save quiz progress whenever active quiz changes
  useEffect(() => {
    if (!quiz || quiz.showStats) return;
    try { localStorage.setItem(QUIZ_SAVE_KEY, JSON.stringify({ quiz, elapsed: elapsedSecs })); } catch {}
  }, [quiz, elapsedSecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // On quiz completion: save history, clear progress, handle deep/free
  useEffect(() => {
    if (!quiz?.showStats) return;
    try { localStorage.removeItem(QUIZ_SAVE_KEY); } catch {}
    const entry: QuizHistoryEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      score: quiz.results.filter((r) => r === "correct").length,
      total: quiz.questions.length,
      elapsedSecs,
      topics: [...new Set(quiz.questions.map((q) => q.topic))],
    };
    const newHistory = [entry, ...quizHistory].slice(0, 30);
    setQuizHistory(newHistory);
    try { localStorage.setItem(QUIZ_HIST_KEY, JSON.stringify(newHistory)); } catch {}

    if (data?.plan === "deep" && data.recentScans.length >= 3) {
      // Deep users: generate fresh questions for next round
      const topics = data.recentScans.slice(0, 5).map((s) => s.label).filter(Boolean);
      if (!topics.length) return;
      setGeneratingNext(true);
      setNextQuizQuestions(null);
      supabase.functions.invoke("generate-quiz", { body: { topics } }).then(({ data: result, error }) => {
        setGeneratingNext(false);
        if (error || !Array.isArray(result?.questions) || !result.questions.length) return;
        const questions: QuizQuestion[] = (result.questions as { topic: string; question: string; options: string[]; correct: number; explanation?: string }[]).map((q) => {
          const correctAnswer = q.options[q.correct];
          const shuffled = [...q.options].sort(() => Math.random() - 0.5);
          return { topic: q.topic, question: q.question, answer: q.explanation ? `${correctAnswer}\n\n${q.explanation}` : correctAnswer, mode: "mc" as const, mcOptions: shuffled, mcCorrectIdx: shuffled.indexOf(correctAnswer) };
        });
        setNextQuizQuestions(questions);
        setQuizQuestions(questions);
        const today = new Date().toISOString().split("T")[0];
        try {
          localStorage.setItem(QUIZ_CACHE_D_KEY, today);
          localStorage.setItem(QUIZ_CACHE_Q_KEY, JSON.stringify(questions));
        } catch {}
      });
    } else {
      // Free/intermediate: mark daily recap quiz as done, no more today
      const today = new Date().toISOString().split("T")[0];
      try { localStorage.setItem(QUIZ_DONE_KEY, today); } catch {}
      setQuizDoneToday(true);
      setQuizQuestions(null);
    }
    // Award quiz XP for everyone
    addBonusXP(user.id, QUIZ_XP, "quiz");
    setData(prev => prev ? { ...prev, totalXP: prev.totalXP + QUIZ_XP, todayXP: prev.todayXP + QUIZ_XP } : prev);
    window.dispatchEvent(new CustomEvent("whale-notify", {
      detail: { message: `+${QUIZ_XP} XP — quiz complete!`, type: "success" },
    }));
  }, [quiz?.showStats]); // eslint-disable-line react-hooks/exhaustive-deps

  const QUIZ_DAY_KEY = "gogodeep_quiz_day";
  const QUIZ_COUNT_KEY = "gogodeep_quiz_count";

  const getQuizzesToday = (): number => {
    try {
      const today = new Date().toISOString().split("T")[0];
      if (localStorage.getItem(QUIZ_DAY_KEY) !== today) return 0;
      return parseInt(localStorage.getItem(QUIZ_COUNT_KEY) ?? "0", 10);
    } catch { return 0; }
  };

  const recordQuizStarted = () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem(QUIZ_DAY_KEY, today);
      localStorage.setItem(QUIZ_COUNT_KEY, String(getQuizzesToday() + 1));
    } catch { /* ignore */ }
  };

  const startQuizWithConfig = (cfg: QuizConfig) => {
    if (!data) return;
    setShowQuizConfig(false);
    const byTopic: Record<string, { question: string; answer: string; options?: string[] }[]> = {};
    for (const scan of data.recentScans) {
      const raw = localStorage.getItem(SCAN_CACHE_KEY(scan.id));
      if (!raw) continue;
      try {
        const stored = JSON.parse(raw);
        const problems: { question: string; answer: string; options?: string[] }[] = stored.diagnosis?.practice_problems ?? [];
        for (const p of problems) { (byTopic[scan.label] ??= []).push(p); }
      } catch {}
    }
    const topics = Object.keys(byTopic);
    if (!topics.length) return;
    const perTopic = Math.ceil(cfg.numQuestions / topics.length);
    const pool: { topic: string; question: string; answer: string; options?: string[] }[] = [];
    for (const topic of topics) {
      const shuffled = [...(byTopic[topic] ?? [])].sort(() => Math.random() - 0.5);
      pool.push(...shuffled.slice(0, perTopic).map((p) => ({ topic, ...p })));
    }
    const base = pool.sort(() => Math.random() - 0.5).slice(0, cfg.numQuestions);
    if (!base.length) return;
    const final: QuizQuestion[] = base.flatMap((q) => {
      if (q.options && q.options.length >= 4) {
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        return [{ ...q, mode: "mc" as const, mcOptions: shuffled, mcCorrectIdx: shuffled.indexOf(q.options[0]) }];
      }
      return [];
    });
    if (!final.length) return;
    setQuizKey((k) => k + 1);
    setQuiz({ questions: final, current: 0, revealed: false, userInput: "", results: [], currentResult: null, showStats: false, selectedMcIdx: null });
  };

  const startQuiz = (questions?: QuizQuestion[]) => {
    const qs = questions ?? quizQuestions;
    if (!qs?.length) return;
    try { localStorage.removeItem(QUIZ_SAVE_KEY); } catch {}
    setNextQuizQuestions(null);
    setConfirmRestart(false);
    setQuizKey((k) => k + 1);
    setQuiz({ questions: qs, current: 0, revealed: false, userInput: "", results: [], currentResult: null, showStats: false, selectedMcIdx: null });
  };

  const navigate = useNavigate();

  async function handleScanClick(scanId: string) {
    const raw = localStorage.getItem(SCAN_CACHE_KEY(scanId));
    if (raw) {
      try {
        navigate("/report", { state: { ...JSON.parse(raw), scanId } });
        return;
      } catch {}
    }
    const { data, error } = await (supabase as any)
      .from("error_logs")
      .select("diagnosis")
      .eq("id", scanId)
      .single();
    if (error || !data?.diagnosis) {
      navigate("/dive");
      return;
    }
    navigate("/report", { state: { diagnosis: data.diagnosis, mode: (data.diagnosis as any)?.mode ?? "guide", scanId } });
  }

  // ── dashboard helpers ────────────────────────────────────────────────────────

  const DAILY_CHALLENGES = [
    "Find all solutions: |2x − 5| = 9",
    "Differentiate y = x³ · eˣ using the product rule",
    "Solve the quadratic: 6x² + x − 2 = 0",
    "Right triangle — hyp = 13, one leg = 5. Find the missing side.",
    "Balance this equation: Fe + O₂ → Fe₂O₃",
    "Evaluate ∫₀³ x² dx step by step",
    "Convert the recurring decimal 0.̄3 to an exact fraction",
  ];
  const DAY_NICKNAMES = ["Sun Grind", "Mot. Mon", "Tough Tue", "Wed Warrior", "Think Thu", "Final Push", "Sat Hustle"];
  const todayChallenge = DAILY_CHALLENGES[new Date().getUTCDay()];
  const PILL_COLORS = [
    "border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
    "border-violet-500/20 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20",
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
    "border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
  ];

  const bestDay = !loading && data ? (() => {
    const counts: Record<string, number> = {};
    for (const s of data.recentScans) {
      if (s.created_at) { const d = s.created_at.split("T")[0]; counts[d] = (counts[d] ?? 0) + 1; }
    }
    const vals = Object.values(counts);
    return vals.length ? Math.max(...vals) : 0;
  })() : 0;

  const [speechVariant] = useState(() => Math.floor(Math.random() * 4));
  const pick = (arr: string[]) => arr[speechVariant % arr.length];

  const blueSpeech = (() => {
    if (!data) return "Loading your stats...";
    const { loginStreak, totalScans, usedToday, dailyLimit, weeklyScans } = data;
    if (totalScans === 0) return pick([
      "First problem = first win. Drop a screenshot.",
      "Got something tricky? Let's break it down together.",
      "One scan away from your first insight.",
      "Show me what you're working on — I'll find the gap.",
    ]);
    const ydayCount = weeklyScans[weeklyScans.length - 2]?.count ?? 1;
    if (ydayCount === 0 && usedToday === 0) return pick([
      "Welcome back! Let's get to work.",
      "Good to see you — let's dive in.",
      "Ready to pick up where we left off?",
      "Let's keep that momentum going. What are we tackling today?",
    ]);
    if (usedToday === 0) return pick([
      "Ready when you are. What's today's problem?",
      "Let's find today's win — drop a problem in.",
      "Standing by. What are we solving first?",
      "Bring on today's challenge.",
    ]);
    if (dailyLimit && usedToday >= dailyLimit) return "Daily limit hit. Come back tomorrow — streak needs you.";
    if (loginStreak > 0 && loginStreak % 7 === 0) return `${loginStreak}-day streak. Badge earned!`;
    const left = dailyLimit ? dailyLimit - usedToday : null;
    if (left === 1) return "One more scan and you hit today's goal. Let's go.";
    if (usedToday >= 2) return pick([
      "On a roll today. Keep stacking.",
      "Look at you go. One more?",
      "Streak's heating up — nice work.",
      "Crushing it. Keep the wins coming.",
    ]);
    return pick([
      "You've got this. Crush the next one.",
      "Onward — let's tackle the next one.",
      "Nice. Ready for another?",
      "Let's keep the streak alive.",
    ]);
  })();

  const startDailyChallenge = () => {
    try {
      sessionStorage.setItem("gogodeep_challenge", todayChallenge);
      sessionStorage.setItem("gogodeep_challenge_bonus", "1");
      sessionStorage.setItem("gogodeep_challenge_xp", String(calcScanXP(todayChallenge, null) + CHALLENGE_BONUS_XP));
    } catch {}
    navigate("/dive");
  };

  function AchievementBadge({ xp }: { xp: number }) {
    const lvl = [...LEVELS].reverse().find(l => xp >= l.xpReq) ?? LEVELS[0];
    if (lvl.level <= 1) return null;
    return <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: lvl.color, color: lvl.text }}>{lvl.name}</span>;
  }

  return (
    <PageTransition>
      <Helmet>
        <title>Gogodeep</title>
        <meta name="description" content="Trace any difficult question down to its roots with AI. Gogodeep finds the exact error in your STEM working, explains the underlying concept, and builds targeted practice to fix the gap. Free for IB, AP, and A-Level students." />
        <link rel="canonical" href="https://gogodeep.com/dashboard" />
      </Helmet>
      {/* Animations */}
      <style>{`
        @keyframes blue-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        .blue-bob{animation:blue-bob 3.2s ease-in-out infinite}
        .blue-bubble::after{content:"";position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);border:9px solid transparent;border-top-color:hsl(var(--border));border-bottom:0}
        .blue-bubble::before{content:"";position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);border:8px solid transparent;border-top-color:hsl(var(--secondary));border-bottom:0;z-index:1}
        @keyframes hero-in{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}
        .hero-in{animation:hero-in 0.45s cubic-bezier(0.22,1,0.36,1) forwards}
      `}</style>

      {/* Hero overlay — portalled to body so it's above all layout layers */}
      {heroPhase < 2 && createPortal(
        <div
          onClick={() => setHeroPhase(2)}
          className="fixed inset-0 flex items-center justify-center bg-background px-6 cursor-pointer"
          style={{
            zIndex: 9999,
            opacity: heroPhase === 1 ? 0 : 1,
            transform: heroPhase === 1 ? "translateY(-40px)" : "translateY(0)",
            transition: heroPhase === 1 ? "opacity 0.65s ease-in, transform 0.65s ease-in" : undefined,
            pointerEvents: heroPhase === 1 ? "none" : "auto",
          }}
        >
          <h1 className="hero-in text-center text-6xl sm:text-8xl font-black tracking-tighter text-foreground leading-tight">
            {GREETING_PHRASES[new Date().getUTCDay() * 4 % 9]},
            <br /><span className="text-primary">{username}</span>
          </h1>
        </div>,
        document.body
      )}

      <div
        className="relative min-h-screen"
        style={{
          opacity: heroPhase >= 1 ? 1 : 0,
          transform: heroPhase >= 1 ? "translateY(0)" : "translateY(32px)",
          transition: heroPhase >= 1 ? "opacity 0.7s ease-out, transform 0.7s ease-out" : undefined,
        }}
      >
        <div className="container max-w-6xl py-8">

          {/* Greeting */}
          <div className="mb-6">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground leading-none">
              {GREETING_PHRASES[new Date().getUTCDay() * 4 % 9]},{" "}
              <span className="text-primary">{username}</span>
            </h1>
          </div>

          {/* ── Level bar + action cards — full width ──────────────── */}
          <div className="mb-8 flex gap-3 items-stretch">

            {/* Level card */}
            {!loading && data && (() => {
              const xp = data.totalXP;
              const currentLvl = [...LEVELS].reverse().find(l => xp >= l.xpReq) ?? LEVELS[0];
              const nextLvl = LEVELS.find(l => l.xpReq > xp);
              const progress = nextLvl
                ? Math.min(100, ((xp - currentLvl.xpReq) / (nextLvl.xpReq - currentLvl.xpReq)) * 100)
                : 100;
              const claimXP = () => {
                if (dailyClaim.claimed) return;
                addBonusXP(user.id, dailyClaim.amount, "challenge");
                const updated = { ...dailyClaim, claimed: true };
                setDailyClaim(updated);
                try { localStorage.setItem(DAILY_CLAIM_KEY, JSON.stringify(updated)); } catch {}
                setData(prev => prev ? { ...prev, totalXP: prev.totalXP + dailyClaim.amount, todayXP: prev.todayXP + dailyClaim.amount } : prev);
                window.dispatchEvent(new CustomEvent("whale-notify", {
                  detail: { message: `+${dailyClaim.amount} XP claimed!`, type: "success" },
                }));
              };
              return (
                <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <LevelBadge lvl={currentLvl} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-foreground">{currentLvl.name}</span>
                          {nextLvl && <span className="text-[10px] font-semibold text-muted-foreground">→ ???</span>}
                        </div>
                        <span className="text-sm font-black tabular-nums" style={{ color: currentLvl.color }}>
                          {xp.toLocaleString()} XP
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${currentLvl.color}cc, ${currentLvl.inner})` }} />
                      </div>
                      {nextLvl && <p className="mt-0.5 text-[9px] text-muted-foreground">{(nextLvl.xpReq - xp).toLocaleString()} XP to next</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate("/dive")}
                      className="flex-1 rounded-xl bg-amber-400 px-4 py-1.5 text-sm font-black text-black shadow-sm shadow-amber-400/30 transition-all hover:bg-amber-300 hover:scale-[1.02]">
                      Scan now →
                    </button>
                    <button
                      onClick={claimXP}
                      disabled={dailyClaim.claimed}
                      className="flex-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-black text-primary transition-all hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {dailyClaim.claimed ? (() => { const now = new Date(); const secsLeft = (24 - now.getHours() - 1) * 3600 + (59 - now.getMinutes()) * 60 + (59 - now.getSeconds()); const h = Math.floor(secsLeft / 3600); const m = Math.floor((secsLeft % 3600) / 60); return h > 0 ? `Next in ${h}h ${m}m` : `Next in ${m}m`; })() : `Claim +${dailyClaim.amount} XP`}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Daily Challenge mini-card */}
            <div className="w-[130px] shrink-0 rounded-2xl bg-amber-400 p-3.5 flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-black/60 whitespace-nowrap">Daily Challenge</span>
              <span className="text-sm font-black text-black leading-none">+{calcScanXP(todayChallenge, null) + CHALLENGE_BONUS_XP} XP</span>
              <span className="text-[10px] font-semibold text-black/50">5 min</span>
              <button onClick={startDailyChallenge}
                className="mt-auto w-full rounded-lg bg-black px-2 py-1.5 text-xs font-black text-amber-400 transition-all hover:bg-black/80 active:scale-95">
                Start →
              </button>
            </div>

            {/* Recap Quiz mini-card */}
            <div className="w-[130px] shrink-0 rounded-2xl border border-border bg-card p-3.5 flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Recap Quiz</span>
              <span className="text-sm font-black text-foreground leading-none">+{QUIZ_XP} XP</span>
              <span className="text-[10px] font-semibold text-muted-foreground/60">3–5 min</span>
              {quizDoneToday && data?.plan !== "deep" ? (
                <button onClick={() => navigate("/pricing")} className="mt-auto w-full rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs font-black text-primary transition-all hover:bg-primary/10">
                  Get Deep
                </button>
              ) : (data?.recentScans.length ?? 0) < 3 ? (
                <button
                  onClick={() => whaleToast.error(`Make ${3 - (data?.recentScans.length ?? 0)} more scan${3 - (data?.recentScans.length ?? 0) === 1 ? "" : "s"} for a recap quiz!`)}
                  className="mt-auto w-full rounded-lg bg-secondary px-2 py-1.5 text-[9px] font-bold text-muted-foreground text-left transition-colors hover:text-foreground"
                >
                  Need {3 - (data?.recentScans.length ?? 0)} more scans
                </button>
              ) : quizLoading ? (
                <div className="mt-auto flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></div>
              ) : (
                <button
                  onClick={() => {
                    if (!quizQuestions?.length) {
                      if (quizGenError === "limit") {
                        whaleToast.error("You've already done today's recap quiz — come back tomorrow!");
                      } else if (quizGenError === "error") {
                        whaleToast.error("Couldn't put together your recap quiz. Tap again to retry.");
                        const topics = data?.recentScans.slice(0, 5).map((s) => s.label).filter(Boolean) ?? [];
                        if (topics.length) fetchRecapQuiz(topics);
                      } else {
                        whaleToast.error("Still putting your recap quiz together — give me a moment and try again!");
                      }
                      return;
                    }
                    startQuiz();
                  }}
                  className={cn(
                    "mt-auto w-full rounded-lg px-2 py-1.5 text-xs font-black transition-all active:scale-95",
                    quizQuestions?.length
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  Start →
                </button>
              )}
            </div>

          </div>

          {/* Main layout — left content + Blue floats right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">

            {/* ── LEFT CONTENT ─────────────────────────────── */}
            <div className="min-w-0 space-y-5">

              {/* Stats 2×2 */}
              <div className="grid grid-cols-2 gap-4">

                {/* Problems Crushed — blue */}
                <div className="relative overflow-hidden rounded-2xl border-l-4 border-primary bg-primary/10 p-5">
                  <div className="pointer-events-none absolute -right-5 -bottom-5 opacity-[0.07]">
                    <svg viewBox="0 0 80 80" className="h-28 w-28 text-primary" fill="none" stroke="currentColor" strokeWidth="4">
                      <circle cx="40" cy="40" r="12"/><circle cx="40" cy="40" r="26" strokeDasharray="8 4"/>
                      <line x1="40" y1="4" x2="40" y2="22"/><line x1="40" y1="58" x2="40" y2="76"/>
                      <line x1="4" y1="40" x2="22" y2="40"/><line x1="58" y1="40" x2="76" y2="40"/>
                    </svg>
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-black uppercase tracking-[0.15em] text-primary/80">Problems Crushed</span>
                    <AchievementBadge xp={data?.totalXP ?? 0} />
                  </div>
                  <p className="mt-1 text-[3.5rem] font-black leading-none tracking-tighter text-primary">
                    {loading ? "—" : data?.totalScans ?? 0}
                  </p>
                  <p className="text-[11px] font-semibold text-primary/70">all-time</p>
                  {!loading && data?.plan !== "deep" && data?.dailyLimit !== null && (
                    <div className="group/bar relative mt-3">
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(data.dailyLimit as number, 10) }).map((_, i) => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < data.usedToday ? "bg-primary" : "bg-primary/15"}`} />
                        ))}
                      </div>
                      <p className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded-md border border-border bg-card px-2 py-0.5 text-[10px] text-foreground shadow-md opacity-0 transition-opacity group-hover/bar:opacity-100 z-10">
                        {data.usedToday} / {data.dailyLimit} used today
                      </p>
                    </div>
                  )}
                  {data?.plan !== "deep" && (
                    <div className="mt-3">
                      <button onClick={() => navigate("/pricing")} className="text-[9px] font-black uppercase tracking-wider text-primary/60 underline underline-offset-2 hover:text-primary">Unlock unlimited →</button>
                    </div>
                  )}
                </div>

                {/* Current Streak — amber */}
                <div className="relative overflow-hidden rounded-2xl border-l-4 border-amber-500 bg-amber-500/10 p-5">
                  <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.10]">
                    <svg viewBox="0 0 60 80" className="h-24 w-20 text-amber-500" fill="currentColor">
                      <path d="M38 2L14 42H28L26 78L52 34H38L38 2Z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.15em] text-amber-700 dark:text-amber-400/70">Current Streak</span>
                  <div className="mt-1 flex items-end gap-2">
                    <p className="text-[3.5rem] font-black leading-none tracking-tighter text-amber-600 dark:text-amber-400">
                      {loading ? "—" : data?.loginStreak ?? 0}
                    </p>
                    <p className="mb-1.5 text-sm font-black text-amber-600/60 dark:text-amber-400/50">{(data?.loginStreak ?? 0) !== 1 ? "days" : "day"}</p>
                  </div>
                  {!loading && (() => {
                    const s = data?.loginStreak ?? 0;
                    if (s === 0) return <p className="text-[11px] font-semibold text-amber-700/60 dark:text-amber-400/50">Start today</p>;
                    if (s >= 30) return <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{background:"#b8860b",color:"#fff"}}>Gold earned</span>;
                    if (s >= 14) return <p className="text-[11px] font-semibold text-amber-700/70 dark:text-amber-400/60">{30-s} more → gold</p>;
                    if (s >= 7) return <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{background:"#9a5b1e",color:"#fff"}}>Bronze · {14-s} → silver</span>;
                    return null;
                  })()}
                </div>

                {/* Today's Goal — emerald */}
                <div className="relative overflow-hidden rounded-2xl border-l-4 border-emerald-600 bg-emerald-600/10 p-5">
                  <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-[0.08]">
                    <svg viewBox="0 0 24 24" className="h-20 w-20 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                    </svg>
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400/60">Today's Goal</span>
                  <div className="mt-1 flex items-end gap-2">
                    <p className="text-[3.5rem] font-black leading-none tracking-tighter text-emerald-700 dark:text-emerald-400">
                      {loading ? "—" : data?.usedToday ?? 0}
                    </p>
                    {!editingGoal ? (
                      <div className="mb-1.5 flex items-center gap-1">
                        <p className="text-sm font-black text-emerald-700/50 dark:text-emerald-400/50">/ {dailyGoal}</p>
                        <button
                          onClick={() => { setGoalDraft(String(dailyGoal)); setEditingGoal(true); }}
                          className="rounded-md p-0.5 text-emerald-400/40 transition-colors hover:text-emerald-400"
                          title="Edit goal"
                        >
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="mb-1.5 flex items-center gap-1">
                        <span className="text-sm font-black text-emerald-700/50 dark:text-emerald-400/50">/</span>
                        <input
                          autoFocus
                          type="number"
                          min={1}
                          max={99}
                          value={goalDraft}
                          onChange={(e) => setGoalDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const v = Math.max(1, Math.min(99, parseInt(goalDraft) || 5));
                              setDailyGoal(v);
                              try { localStorage.setItem(GOAL_KEY, String(v)); } catch {}
                              setEditingGoal(false);
                            }
                            if (e.key === "Escape") setEditingGoal(false);
                          }}
                          onBlur={() => {
                            const v = Math.max(1, Math.min(99, parseInt(goalDraft) || 5));
                            setDailyGoal(v);
                            try { localStorage.setItem(GOAL_KEY, String(v)); } catch {}
                            setEditingGoal(false);
                          }}
                          className="w-10 rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-center text-xs font-black text-emerald-400 outline-none focus:bg-emerald-400/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-700/60 dark:text-emerald-400/60">
                    {!loading && data
                      ? (data.usedToday >= dailyGoal) ? "Goal smashed!"
                      : data.usedToday === 0 ? "Let's get started"
                      : `${dailyGoal - data.usedToday} more to go`
                      : ""}
                  </p>
                </div>

                {/* All-Time Best Day — violet, shown in XP */}
                <div className="relative overflow-hidden rounded-2xl border-l-4 border-violet-600 bg-violet-600/10 p-5">
                  <div className="pointer-events-none absolute -right-3 -bottom-2 opacity-[0.08]">
                    <svg viewBox="0 0 24 24" className="h-20 w-20 text-violet-600" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 3h10v7a5 5 0 0 1-10 0V3z"/>
                      <path d="M7 5H4a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3h2"/><path d="M17 5h3a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3h-2"/>
                      <line x1="12" y1="15" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>
                    </svg>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-[0.15em] text-violet-700 dark:text-violet-400/60">Best Day Ever</span>
                    {!loading && (data?.todayXP ?? 0) > 0 && (
                      <span className="text-sm font-black text-violet-700/80 dark:text-violet-400">Today {(data!.todayXP).toLocaleString()} XP</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-end gap-1">
                    <p className="text-[3.5rem] font-black leading-none tracking-tighter text-violet-700 dark:text-violet-400">
                      {loading ? "—" : (data?.bestDayXP ?? 0).toLocaleString()}
                    </p>
                    {!loading && (data?.bestDayXP ?? 0) > 0 && (
                      <p className="mb-1.5 text-sm font-black text-violet-700/50 dark:text-violet-400/60">XP</p>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-violet-700/60 dark:text-violet-400/60">in a single day</p>
                </div>

              </div>

            </div>

            {/* ── RIGHT: Blue — bottom-aligned with stats ───── */}
            <div className="flex flex-col items-center pt-2">

              {/* Speech bubble — top */}
              <div className="relative">
                <div className="rounded-[18px] border border-border bg-secondary px-5 py-3.5 text-center text-sm font-bold text-foreground shadow-[0_8px_32px_hsl(var(--primary)/0.10)] max-w-[210px]">
                  {loading ? "…" : blueSpeech}
                </div>
                <div
                  className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-0 w-0"
                  style={{
                    borderLeft: "8px solid transparent",
                    borderRight: "8px solid transparent",
                    borderTop: "8px solid hsl(var(--secondary))",
                  }}
                />
              </div>

              {/* Blue + Upgrade — pushed to bottom so Blue's base aligns with stats */}
              <div className="mt-auto flex flex-col items-center gap-3">
                <img
                  src="/blue.png"
                  alt="Blue"
                  draggable={false}
                  className="blue-bob w-full max-w-[240px] object-contain select-none"
                  style={{filter:"drop-shadow(0 16px 40px hsl(var(--primary)/0.20))"}}
                />
                {data?.plan !== "deep" && (
                  <button onClick={() => navigate("/pricing")} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                    Upgrade →
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* ── Full-width bottom: Dive back in + Stream ───── */}
          <div className="mt-6 grid grid-cols-2 gap-6">

            {/* Dive back in */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Dive back in</p>
              </div>
              {!loading && (data?.recentScans.length ?? 0) > 0 ? (
                <div className="max-h-[176px] overflow-y-auto space-y-1.5">
                  {data!.recentScans.slice(0, 6).map((scan) => (
                    <button
                      key={scan.id}
                      onClick={() => handleScanClick(scan.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                    >
                      <span className={`shrink-0 rounded-lg p-1.5 text-[10px] font-black uppercase leading-none ${
                        scan.error_category?.toLowerCase() === "conceptual"
                          ? "bg-primary/10 text-primary"
                          : scan.error_category?.toLowerCase() === "calculation"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {scan.error_category?.slice(0, 3).toUpperCase() ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {scan.label}
                      </span>
                      {scan.created_at && (
                        <span className="shrink-0 text-[10px] text-muted-foreground/60">
                          {new Date(scan.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">No scans yet — start your first one above.</p>
              )}
            </div>

            {/* Stream */}
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-3">Stream</p>
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Waves className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-foreground">Your personalised learning path</p>
                  <p className="mt-1 text-xs text-muted-foreground">Blue maps out exactly what you need to study next, based on your scans.</p>
                </div>
                <button
                  onClick={() => navigate("/stream")}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-black text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Start a stream →
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Quiz Dialog */}
      <Dialog open={!!quiz} onOpenChange={(open) => { if (!open) setQuiz(null); }}>
        <DialogContent className="border border-border bg-card sm:max-w-2xl p-0 overflow-hidden gap-0">
          {quiz?.showStats ? (
            <div className="flex flex-col items-center px-8 py-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quiz complete</p>
              <p className="mt-4 text-7xl font-extrabold text-foreground">
                {quiz.results.filter((r) => r === "correct").length}
                <span className="text-3xl font-medium text-muted-foreground"> / {quiz.questions.length}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{formatTime(elapsedSecs)}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-1.5">
                {quiz.results.map((r, i) => (
                  <div key={i} title={`Q${i + 1}: ${r}`}
                    className={`h-3 w-3 rounded-full ${r === "correct" ? "bg-green-400" : "bg-red-400"}`} />
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="outline" className="border-border" onClick={() => startQuizWithConfig(quizConfig)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                </Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={() => setQuiz(null)}>Done</Button>
              </div>
            </div>
          ) : quiz ? (() => {
            const currentQ = quiz.questions[quiz.current];
            const advance = () => setQuiz((q) => {
              if (!q) return q;
              if (q.current >= q.questions.length - 1) return { ...q, showStats: true };
              return { ...q, current: q.current + 1, revealed: false, currentResult: null, userInput: "", selectedMcIdx: null };
            });
            const gradeAndAdvance = (grade: "correct" | "incorrect") => setQuiz((q) => {
              if (!q) return q;
              const results = [...q.results, grade];
              if (q.current >= q.questions.length - 1) return { ...q, results, showStats: true };
              return { ...q, results, current: q.current + 1, revealed: false, currentResult: null, userInput: "", selectedMcIdx: null };
            });
            return (
              <div className="flex flex-col">
                {/* Header — Reset on left, counter+timer centred, X from Dialog is top-right */}
                <div className="flex items-center border-b border-border px-4 py-3 pr-12">
                  {confirmRestart ? (
                    <div className="flex items-center gap-1.5 mr-3 shrink-0">
                      <span className="text-xs text-muted-foreground">Restart?</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => { setConfirmRestart(false); startQuiz(); }}>Yes</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => setConfirmRestart(false)}>No</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground mr-3 shrink-0"
                      onClick={() => setConfirmRestart(true)}>
                      <RefreshCw className="mr-1.5 h-3 w-3" /> Reset
                    </Button>
                  )}
                  <div className="flex flex-1 items-center justify-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground">{quiz.current + 1} / {quiz.questions.length}</span>
                    <span className="font-mono text-sm font-semibold text-foreground">{formatTime(elapsedSecs)}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-secondary">
                  <div className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(quiz.current / quiz.questions.length) * 100}%` }} />
                </div>
                {/* Body */}
                <div className="space-y-4 px-6 py-6">
                  <p className="text-base font-medium text-foreground leading-relaxed"><RichText text={currentQ.question} /></p>

                  {/* TF mode */}
                  {currentQ.mode === "tf" && !quiz.revealed && (
                    <>
                      <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Is this statement true or false?</span>
                        <RichText text={currentQ.tfStatement} />
                      </div>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 border-border" onClick={() => {
                          const correct = currentQ.tfCorrect === true;
                          setQuiz((q) => q && ({ ...q, revealed: true, currentResult: correct ? "correct" : "incorrect", results: [...q.results, correct ? "correct" : "incorrect"] }));
                        }}>True</Button>
                        <Button variant="outline" className="flex-1 border-border" onClick={() => {
                          const correct = currentQ.tfCorrect === false;
                          setQuiz((q) => q && ({ ...q, revealed: true, currentResult: correct ? "correct" : "incorrect", results: [...q.results, correct ? "correct" : "incorrect"] }));
                        }}>False</Button>
                      </div>
                    </>
                  )}

                  {/* MC mode */}
                  {currentQ.mode === "mc" && !quiz.revealed && (
                    <div className="grid grid-cols-2 gap-2">
                      {currentQ.mcOptions?.map((opt, idx) => (
                        <button key={idx} onClick={() => {
                          const correct = idx === currentQ.mcCorrectIdx;
                          setQuiz((q) => q && ({ ...q, revealed: true, selectedMcIdx: idx, currentResult: correct ? "correct" : "incorrect", results: [...q.results, correct ? "correct" : "incorrect"] }));
                        }}
                          className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-secondary">
                          <span className="mr-2 font-bold text-primary">{String.fromCharCode(65 + idx)}.</span>
                          <RichText text={opt} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Revealed state */}
                  {quiz.revealed && (
                    <div className="space-y-3">
                      <div className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${quiz.currentResult === "correct" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                        {quiz.currentResult === "correct" ? "Correct ✓" : "Incorrect ✗"}
                      </div>
                      {currentQ.mode === "mc" && (
                        <div className="grid grid-cols-2 gap-2">
                          {currentQ.mcOptions?.map((opt, idx) => (
                            <div key={idx} className={`rounded-lg border px-4 py-3 text-sm ${idx === currentQ.mcCorrectIdx ? "border-green-500/40 bg-green-500/10 text-green-400 font-semibold" : idx === quiz.selectedMcIdx ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-border bg-secondary/30 text-muted-foreground"}`}>
                              <span className="mr-2 font-bold">{String.fromCharCode(65 + idx)}.</span>
                              <RichText text={opt} />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary block mb-1">Correct answer</span>
                        <RichText text={currentQ.answer} />
                      </div>
                      <Button className="w-full bg-primary hover:bg-primary/90" onClick={advance}>
                        {quiz.current < quiz.questions.length - 1 ? <>Next <ArrowRight className="ml-2 h-4 w-4" /></> : "Finish"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

// ─── Landing page ─────────────────────────────────────────────────────────────

const PERCENT_STEPS: { step: string; tip: string }[] = [
  {
    step: 'The equation is in the form $ax^2 + bx + c = 0$, so we can factor.$$2x^2 - 5x - 3 = 0$$Here $a = 2$, $b = -5$, $c = -3$.',
    tip: "Spotting a, b, and c first means you'll never lose track of which number goes where in the next steps.",
  },
  {
    step: 'Multiply $a \\times c = 2 \\times (-3) = -6$.\nFind two numbers that **multiply to −6** and **add to −5**.\nThose numbers are $-6$ and $+1$. ✓',
    tip: "Looking for a pair that multiplies to a×c and adds to b is the whole trick behind splitting the middle term.",
  },
  {
    step: 'Split the middle term using $-6x + x$:$$2x^2 - 6x + x - 3 = 0$$',
    tip: "Splitting −5x into −6x + x doesn't change the equation — it just sets things up so we can group in pairs.",
  },
  {
    step: 'Group and factor each pair:$$2x(x-3) + 1(x-3) = 0$$$$(2x+1)(x-3) = 0$$',
    tip: "Notice both groups share the factor (x − 3) — that's what lets you pull it out and combine everything into one product.",
  },
  {
    step: 'Set each factor to zero and solve:$$2x + 1 = 0 \\implies x = -\\tfrac{1}{2}$$$$x - 3 = 0 \\implies x = 3$$',
    tip: "Each bracket can equal zero on its own — solve them separately and you'll land on both roots.",
  },
];

const PERCENT_PRACTICE: { q: string; options: string[]; correct: number; explanation: string }[] = [
  {
    q: "Solve x² − x − 6 = 0",
    options: ["x = 2 or −3", "x = −2 or 3", "x = 1 or −6", "x = 3 or 6"],
    correct: 1,
    explanation: "Factor as (x − 3)(x + 2) = 0, giving x = 3 or x = −2.",
  },
  {
    q: "Solve 3x² + 5x − 2 = 0",
    options: ["x = 1/3 or −2", "x = −1/3 or 2", "x = 2 or −3", "x = 1 or −2"],
    correct: 0,
    explanation: "Factor as (3x − 1)(x + 2) = 0, giving x = 1/3 or x = −2.",
  },
  {
    q: "Solve x² − 9 = 0",
    options: ["x = 3", "x = ±9", "x = ±3", "x = 9 or 0"],
    correct: 2,
    explanation: "Difference of squares: (x − 3)(x + 3) = 0, so x = ±3.",
  },
];

type DemoTab = "steps" | "practice";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];

const ScreenshotCard = ({ dimmed = false }: { dimmed?: boolean }) => (
  <div className={`w-52 rounded-xl bg-blue-50 p-3.5 shadow-xl border border-blue-100 ${dimmed ? "opacity-40" : ""}`}>
    <p className="mb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Algebra — Question 4</p>
    <div className="space-y-2.5">
      <div className="h-1.5 w-4/5 rounded" style={{ background: "#d1d5db" }} />
      <div className="h-1.5 w-2/3 rounded" style={{ background: "#e5e7eb" }} />
      <div className="h-1.5 w-5/6 rounded" style={{ background: "#d1d5db" }} />
    </div>
  </div>
);

const LOADING_MSGS = [
  "Reading the question…",
  "Identifying the concept…",
  "Detailing the steps…",
];

const DemoPanel = () => {
  const [phase, setPhase] = useState(0);
  const [tab, setTab] = useState<DemoTab>("steps");
  const [stepIdx, setStepIdx] = useState(0);
  const [stepViewMode, setStepViewMode] = useState<"deck" | "reveal">("deck");
  const [revealedCount, setRevealedCount] = useState(1);
  const stepAnimDir = useRef<1 | -1>(1);
  const [blueOpenStep, setBlueOpenStep] = useState<number | null>(null);
  const [blueQuestion, setBlueQuestion] = useState("");
  const [blueReplied, setBlueReplied] = useState(false);
  const [blueTyping, setBlueTyping] = useState(true);
  const [bluePos, setBluePos] = useState({ x: 0, y: 0 });
  const blueDrag = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false, startX: 0, startY: 0, origX: 0, origY: 0,
  });
  const onBlueDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    blueDrag.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: bluePos.x, origY: bluePos.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onBlueDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!blueDrag.current.dragging) return;
    setBluePos({
      x: blueDrag.current.origX + (e.clientX - blueDrag.current.startX),
      y: blueDrag.current.origY + (e.clientY - blueDrag.current.startY),
    });
  };
  const onBlueDragEnd = () => { blueDrag.current.dragging = false; };
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, number>>({});
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const lastInteractionRef = useRef<number>(Date.now());
  const isHoveredRef = useRef(false);

  useEffect(() => {
    if (blueOpenStep === null) return;
    setBlueTyping(true);
    setBluePos({ x: 0, y: 0 });
    const t = setTimeout(() => setBlueTyping(false), 1100);
    return () => clearTimeout(t);
  }, [blueOpenStep]);

  useEffect(() => {
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), 1200);
      return () => clearTimeout(t);
    }
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), 1800);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      setLoadingMsgIdx(0);
      const cycle = setInterval(() => setLoadingMsgIdx((i) => Math.min(i + 1, LOADING_MSGS.length - 1)), 500);
      const t = setTimeout(() => { clearInterval(cycle); setPhase(3); }, 1900);
      return () => { clearTimeout(t); clearInterval(cycle); };
    }
    // Auto-reset after 13 s if user hasn't interacted, otherwise 33 s
    const check = setInterval(() => {
      const idle = Date.now() - lastInteractionRef.current;
      if (!isHoveredRef.current && idle > 33000) {
        setPhase(0); setTab("steps"); setStepIdx(0); setStepViewMode("deck"); setRevealedCount(1); setBlueOpenStep(null); setBlueQuestion(""); setBlueReplied(false); setBlueTyping(true); setBluePos({ x: 0, y: 0 }); setPracticeAnswers({});
      }
    }, 5000);
    const autoReset = setTimeout(() => {
      if (!isHoveredRef.current && Date.now() - lastInteractionRef.current > 5000) {
        setPhase(0); setTab("steps"); setStepIdx(0); setStepViewMode("deck"); setRevealedCount(1); setBlueOpenStep(null); setBlueQuestion(""); setBlueReplied(false); setBlueTyping(true); setBluePos({ x: 0, y: 0 }); setPracticeAnswers({});
      }
    }, 18000);
    return () => { clearInterval(check); clearTimeout(autoReset); };
  }, [phase]);

  return (
    <div
      className="relative h-[440px] scale-[0.93] origin-top"
      onMouseEnter={() => { isHoveredRef.current = true; lastInteractionRef.current = Date.now(); }}
      onMouseLeave={() => { isHoveredRef.current = false; lastInteractionRef.current = Date.now(); }}
      onMouseMove={() => { lastInteractionRef.current = Date.now(); }}
    >
      <div className="absolute inset-0 overflow-y-auto rounded-2xl border border-primary/30 bg-card shadow-[0_0_40px_hsl(225,75%,55%,0.18),0_0_80px_hsl(225,75%,55%,0.08)]">
      <div className="relative min-h-full">

        {/* Phase 0: empty state */}
        {phase === 0 && (
          <div className="flex h-[440px] items-center justify-center select-none">
            <div className="flex flex-col items-center gap-3">
              <p className="text-2xl font-extrabold tracking-tight text-foreground">Drop a screenshot</p>
              <p className="text-sm text-muted-foreground">of any problem</p>
              {/* Simple curved arrow pointing down */}
              <svg width="28" height="40" viewBox="0 0 28 40" fill="none" className="text-primary mt-1">
                <path d="M14 2 C14 2 14 28 14 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M6 24 L14 34 L22 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {/* Phase 1: screenshot drops into center */}
        {phase === 1 && (
          <div className="flex h-[440px] items-center justify-center">
            <div className="animate-slide-in-paper">
              <ScreenshotCard />
            </div>
          </div>
        )}

        {/* Phase 2: loading */}
        {phase === 2 && (
          <div className="flex h-[440px] flex-col items-center justify-center gap-5 p-8">
            <ScreenshotCard dimmed />
            <div className="w-48">
              <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary animate-loading-fill" />
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: results */}
        {phase === 3 && (
          <div className="animate-fade-up flex min-h-full flex-col p-4">
            {/* 2-tab bar */}
            {(() => {
              const demoTabs: { value: DemoTab; label: string }[] = [
                { value: "steps", label: "Step by Step" },
                { value: "practice", label: "Practice" },
              ];
              const demoTabIdx = demoTabs.findIndex((t) => t.value === tab);
              return (
                <div className="relative mb-3 flex gap-1 rounded-lg border border-border bg-secondary p-1">
                  <div
                    className="absolute bottom-1 top-1 rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
                    style={{ width: "calc((100% - 8px) / 2)", transform: `translateX(calc(${demoTabIdx} * 100%))` }}
                  />
                  {demoTabs.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { setTab(value); lastInteractionRef.current = Date.now(); }}
                      className={`relative z-10 flex flex-1 items-center justify-center rounded-md py-1.5 text-sm font-semibold transition-colors duration-200 ${
                        tab === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {tab === "steps" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-base font-black text-primary">Solve 2x² − 5x − 3 = 0</p>
                  <button
                    onClick={() => {
                      setStepViewMode((v) => {
                        const next = v === "deck" ? "reveal" : "deck";
                        if (next === "reveal") setRevealedCount(1);
                        return next;
                      });
                      lastInteractionRef.current = Date.now();
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {stepViewMode === "deck" ? (
                      <><ChevronRight className="h-3.5 w-3.5" /> Reveal steps</>
                    ) : (
                      <><ScanLine className="h-3.5 w-3.5" /> One by one</>
                    )}
                  </button>
                </div>

                {stepViewMode === "reveal" ? (
                  <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5 animate-in fade-in duration-200">
                    {PERCENT_STEPS.slice(0, revealedCount).map(({ step }, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                        <div className="text-sm leading-relaxed text-foreground"><RichText text={step} /></div>
                      </div>
                    ))}
                    {revealedCount < PERCENT_STEPS.length ? (
                      <button
                        onClick={() => { setRevealedCount((v) => v + 1); lastInteractionRef.current = Date.now(); }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        Show next step <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <p className="pt-1 text-center text-[10px] text-muted-foreground/50">All steps revealed.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col">
                    <div className="flex-1 overflow-hidden rounded-2xl border border-primary/25 bg-card p-4 shadow-[0_0_24px_hsl(var(--primary)/0.08)]">
                      <div
                        key={stepIdx}
                        className={cn(
                          "h-full overflow-y-auto animate-in fade-in duration-200 fill-mode-both",
                          stepAnimDir.current === 1 ? "slide-in-from-right-4" : "slide-in-from-left-4"
                        )}
                      >
                      <div className="mb-3 flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-black text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.4)]">
                          {stepIdx + 1}
                        </span>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                          Step {stepIdx + 1} of {PERCENT_STEPS.length}
                        </p>
                      </div>
                      <div className="text-sm leading-relaxed text-foreground">
                        <RichText text={PERCENT_STEPS[stepIdx].step} />
                      </div>
                      </div>
                    </div>

                    {/* Ask Blue — stays at fixed position below step card */}
                    <button
                      onClick={() => {
                        setBlueOpenStep((cur) => {
                          const next = cur === stepIdx ? null : stepIdx;
                          if (next !== null) { setBlueQuestion(""); setBlueReplied(false); }
                          return next;
                        });
                        lastInteractionRef.current = Date.now();
                      }}
                      className="mt-2 flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <img src="/blue.png" alt="" draggable={false} className="h-4 w-4 rounded-full object-cover shrink-0" />
                      Ask Blue about this step
                    </button>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        disabled={stepIdx === 0}
                        onClick={() => {
                          stepAnimDir.current = -1;
                          setStepIdx((i) => Math.max(0, i - 1));
                          lastInteractionRef.current = Date.now();
                        }}
                        className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <div className="flex items-center gap-1">
                        {PERCENT_STEPS.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              stepAnimDir.current = i > stepIdx ? 1 : -1;
                              setStepIdx(i);
                              lastInteractionRef.current = Date.now();
                            }}
                            aria-label={`Go to step ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all duration-200 ${i === stepIdx ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-primary/40"}`}
                          />
                        ))}
                      </div>
                      <button
                        disabled={stepIdx === PERCENT_STEPS.length - 1}
                        onClick={() => {
                          stepAnimDir.current = 1;
                          setStepIdx((i) => Math.min(PERCENT_STEPS.length - 1, i + 1));
                          lastInteractionRef.current = Date.now();
                        }}
                        className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {stepIdx === PERCENT_STEPS.length - 1 && (
                      <button
                        onClick={() => { setTab("practice"); lastInteractionRef.current = Date.now(); }}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 animate-in fade-in duration-300"
                      >
                        Practice this step <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "practice" && (
              <div className="flex-1 space-y-3 overflow-y-auto">
                {PERCENT_PRACTICE.map((item, i) => {
                  const chosen = practiceAnswers[i];
                  const answered = chosen !== undefined;
                  return (
                    <div key={i} className="rounded-xl border border-border bg-card p-3.5">
                      <p className="mb-3 text-base font-semibold text-foreground">{item.q}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {item.options.map((opt, j) => {
                          const isCorrect = j === item.correct;
                          const isChosen = chosen === j;
                          return (
                            <button
                              key={j}
                              disabled={answered}
                              onClick={() => { setPracticeAnswers((p) => ({ ...p, [i]: j })); lastInteractionRef.current = Date.now(); }}
                              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                                !answered
                                  ? "border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                                  : isCorrect
                                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                                  : isChosen
                                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                                  : "border-border text-muted-foreground opacity-50"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {answered && (
                        <p className="mt-2.5 text-xs text-muted-foreground">{item.explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>
      </div>
      {blueOpenStep !== null && (
        <div
          className="absolute z-10 bottom-4 right-4 w-64 select-none overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-2xl animate-in fade-in duration-150"
          style={{ transform: `translate(${bluePos.x}px, ${bluePos.y}px)`, transition: 'none' }}
        >
          <div
            onPointerDown={onBlueDragStart}
            onPointerMove={onBlueDragMove}
            onPointerUp={onBlueDragEnd}
            onPointerCancel={onBlueDragEnd}
            className="flex items-center gap-2.5 border-b border-border bg-secondary/40 px-3.5 py-2.5 cursor-grab touch-none active:cursor-grabbing"
          >
            <img src="/blue.png" alt="" draggable={false} className="h-7 w-7 rounded-full object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Blue</p>
              <p className="truncate text-[10px] text-muted-foreground">drag to move</p>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => { setBlueOpenStep(null); lastInteractionRef.current = Date.now(); }}
              className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5 p-3.5">
            {blueTyping ? (
              <div className="flex w-fit items-center gap-1.5 rounded-xl rounded-tl-sm border border-border bg-secondary/40 px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
              </div>
            ) : (
              <div className="rounded-xl rounded-tl-sm border border-border bg-secondary/40 px-3.5 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <p className="text-xs leading-relaxed text-foreground/85">I understand your step now. What question do you have?</p>
              </div>
            )}
            {blueReplied && (
              <div className="rounded-xl rounded-tl-sm border border-primary/30 bg-primary/5 px-3.5 py-2.5 animate-in fade-in duration-300">
                <p className="text-xs leading-relaxed text-foreground/80">
                  Great question — this is exactly the kind of back-and-forth you'd get with the real Blue. Sign up free and ask away on any step →
                </p>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!blueQuestion.trim() || blueReplied || blueTyping) return;
                setBlueReplied(true);
                lastInteractionRef.current = Date.now();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={blueQuestion}
                onChange={(e) => { setBlueQuestion(e.target.value); lastInteractionRef.current = Date.now(); }}
                placeholder="Ask Blue a question…"
                disabled={blueReplied || blueTyping}
                className="flex-1 min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!blueQuestion.trim() || blueReplied || blueTyping}
                className="shrink-0 flex items-center justify-center rounded-lg bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


const FAQ_ITEMS = [
  {
    q: "What is Gogodeep?",
    a: "Gogodeep is a free AI tool that breaks down any difficult question, step by step. Upload a screenshot of a hard problem and get a full explanation, the underlying concept, and practice questions to make it stick. For STEM topics, Gogodeep also pairs your question with an interactive model you can play with to build real intuition.",
  },
  {
    q: "Which exams and subjects does it support?",
    a: "Gogodeep mainly supports STEM subjects across IB (SL & HL), AP, SAT, and A-Level, including Maths, Physics, Chemistry, Biology, and Earth & Space Science. It works for other subjects too.",
  },
  {
    q: "Is it really free?",
    a: "Yes, Gogodeep is free to use. There is also a paid Deep plan that unlocks unlimited scans, unlimited Blue use, and unlimited practice questions.",
  },
  {
    q: "Will it just give me the answer?",
    a: "No. Gogodeep is built to make you understand, not just copy. It breaks down the exact concept you missed, explains the reasoning step by step, and generates targeted practice so the knowledge actually sticks. You walk away knowing how to solve the next one, not just this one.",
  },
  {
    q: "Can I upload handwritten working?",
    a: "Yes. Take a photo of handwritten notes, a worksheet, or a past paper question and Gogodeep will read and break it down.",
  },
  {
    q: "How is this different from asking ChatGPT?",
    a: "Gogodeep is built specifically for exam-style questions, presented in an easily digestible way so anyone can follow along. It doesn't just give you an answer. It identifies the exact concept you're missing, explains it clearly, and generates targeted practice so the understanding actually sticks.",
  },
];

function GoButton({ to = "/dive", label = "Try without signup" }: { to?: string; label?: ReactNode }) {
  return (
    <Link to={to} className="block w-full">
      <button className="group relative w-full rounded-2xl bg-primary py-4 text-base font-bold text-white select-none overflow-hidden transition-all duration-300 shadow-[0_0_24px_4px_rgba(91,127,239,0.3)] hover:scale-[1.02] hover:shadow-[0_0_44px_10px_rgba(91,127,239,0.45)] active:scale-[0.98]">
        <span className="pointer-events-none absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-[150%]" />
        <span className="relative z-10">{label}</span>
      </button>
    </Link>
  );
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i}>
          <button
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-foreground hover:bg-accent/40 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            {item.q}
            <ChevronDown className={`ml-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && (
            <div className="px-5 pt-1 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}


const Landing = () => {
  // Always show the landing page in dark mode regardless of the user's theme preference
  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "blue");
    return () => {
      if (prev) document.documentElement.setAttribute("data-theme", prev);
      else document.documentElement.removeAttribute("data-theme");
    };
  }, []);

  const logoRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [landingQuoteOffset, setLandingQuoteOffset] = useState(0);
  const [highlightedStep, setHighlightedStep] = useState<0 | 1 | 2>(0);
  const [chevronVisible, setChevronVisible] = useState(true);
  const [deeperY, setDeeperY] = useState(0);
  const highlightFired = useRef(false);

  const [landingUser, setLandingUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLandingUser(session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setLandingUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  const isSignedIn = !!landingUser;

  const runHighlight = useCallback(() => {
    if (highlightFired.current) return;
    highlightFired.current = true;
    setTimeout(() => setHighlightedStep(1), 200);
    setTimeout(() => setHighlightedStep(2), 900);
    setTimeout(() => setHighlightedStep(0), 2100);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setChevronVisible(window.scrollY < 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Trigger highlight when "How it works" section scrolls into view
  useEffect(() => {
    const el = howItWorksRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) runHighlight(); },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [runHighlight]);

  function scrollToHowItWorks() {
    setChevronVisible(false);
    const el = howItWorksRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    }
    highlightFired.current = false;
    setTimeout(runHighlight, 600);
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // "deeper" sinks as mouse moves down the viewport
      const ratio = e.clientY / window.innerHeight; // 0 = top, 1 = bottom
      setDeeperY(ratio * 10);

      if (!logoRef.current) return;
      const rect = logoRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxOffset = 6;
      const factor = Math.min(dist / 300, 1);
      setEyeOffset({
        x: (dx / (dist || 1)) * maxOffset * factor,
        y: (dy / (dist || 1)) * maxOffset * factor,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);


  return (
    <PageTransition>
      <Helmet>
        <title>Gogodeep</title>
        <meta name="description" content="Trace any difficult question down to its roots with AI. Gogodeep finds the exact error in your STEM working, explains the underlying concept, and builds targeted practice to fix the gap. Free for IB, AP, and A-Level students." />
        <link rel="canonical" href="https://gogodeep.com/" />
      </Helmet>
      <div className="relative z-10 min-h-screen pt-28">

        {/* ── Hero ── */}
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
                onClick={scrollToHowItWorks}
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

        {/* ── How it works ── */}
        <section ref={howItWorksRef} className="container pb-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">How it works</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {steps.map(({ renderIcon, step, title, desc }) => {
                const isHighlighted = (highlightedStep === 1 && step === "01") || (highlightedStep === 2 && step === "02");
                const sweepStyle = (opacity: number, delay = 0): React.CSSProperties => ({
                  background: `linear-gradient(to right, hsl(var(--primary) / ${opacity}) 50%, transparent 50%)`,
                  backgroundSize: "200% 100%",
                  backgroundPosition: isHighlighted ? "0% 0%" : "100% 0%",
                  transition: isHighlighted
                    ? `background-position 0.3s ease-out ${delay}s`
                    : "background-position 0.35s ease-in",
                  WebkitBoxDecorationBreak: "clone",
                  boxDecorationBreak: "clone" as React.CSSProperties["boxDecorationBreak"],
                  borderRadius: "2px",
                  padding: "1px 2px",
                });
                return (
                  <Card key={step} className="border-border bg-card p-8 transition-colors hover:bg-accent/50">
                    <div className="mb-6 inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-secondary text-primary px-2 py-2">
                      {renderIcon()}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{step}</p>
                    <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">
                      <span style={sweepStyle(0.38)}>{title}</span>
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      <span style={sweepStyle(0.22, 0.06)}>{desc}</span>
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="container pb-12">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">FAQ</h2>
            <FaqSection />
          </div>
        </section>

        {/* ── Quote ── */}
        <section className="container pb-12">
          <div className="mx-auto max-w-2xl">
            {(() => {
              const day = new Date().getUTCFullYear() * 1000 + Math.floor((Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86400000);
              const q = QUOTES[(day + landingQuoteOffset) % QUOTES.length];
              return (
                <div className="rounded-xl border border-border bg-card px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-center flex-1">
                      <p className="text-sm italic text-muted-foreground">"{q.text}"</p>
                      {q.author && q.author !== "Anonymous" && <p className="mt-2 text-xs font-semibold text-muted-foreground/60">— {q.author}</p>}
                    </div>
                    <button
                      onClick={() => setLandingQuoteOffset((v) => (v + 1) % QUOTES.length)}
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-muted-foreground"
                      title="New quote"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

      </div>
    </PageTransition>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export function DashboardRoute() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (user === undefined) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return <Dashboard user={user} />;
}

const Home = () => <Landing />;

export default Home;
