import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";
import { Aperture, Microscope, Compass, ArrowRight, Zap, ScanLine, BookOpen, Loader2, Flame, ChevronRight, ChevronDown, BrainCircuit, Lock, Settings2, Lightbulb, RefreshCw } from "lucide-react";
import { UnitCircle } from "@/components/interact/MathModels2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PageTransition from "@/components/PageTransition";
import { RichText } from "@/components/RichText";
import gogodeepLogo from "@/assets/gogodeep-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { SCAN_LIMITS, SCAN_CACHE_KEY } from "@/lib/supabase";
import { FREE_FOR_ALL } from "@/lib/featureFlags";
import { whaleToast } from "@/lib/whaleToast";
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
  { renderIcon: () => <span className="text-2xl font-black text-primary leading-none">!</span>, step: "02", title: "Repair", desc: "Gogodeep breaks the question down, and you'll understand it within minutes." },
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
  const [quoteOffset, setQuoteOffset] = useState(0);
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
          dayXP[d] = (dayXP[d] ?? 0) + calcRelativeScanXP(l.specific_error_tag ?? l.topic, l.error_category, allLabels);
        }
      }
      // Add bonus XP (quiz, challenge, practice) from localStorage
      const bonusEntries = getBonusXPEntries(user.id);
      for (const e of bonusEntries) {
        dayXP[e.date] = (dayXP[e.date] ?? 0) + e.xp;
      }
      const todayStr = new Date().toISOString().split("T")[0];
      const todayXP = dayXP[todayStr] ?? 0;
      const totalXP = logs.reduce((sum, l, i) => sum + calcRelativeScanXP(l.specific_error_tag ?? l.topic, l.error_category, allLabels), 0)
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
    setQuizLoading(true);
    setQuizQuestions(null);
    supabase.functions.invoke("generate-quiz", { body: { topics } }).then(({ data: result, error }) => {
      setQuizLoading(false);
      if (error || !Array.isArray(result?.questions) || !result.questions.length) {
        console.error("[Quiz] generate-quiz failed:", error, result);
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
      navigate("/workspace");
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

  const blueSpeech = (() => {
    if (!data) return "Loading your stats...";
    const { loginStreak, totalScans, usedToday, dailyLimit, weeklyScans } = data;
    if (totalScans === 0) return "First problem = first win. Drop a screenshot.";
    const ydayCount = weeklyScans[weeklyScans.length - 2]?.count ?? 1;
    if (ydayCount === 0 && usedToday === 0) return "Haven't seen you in a day... miss you!";
    if (usedToday === 0) return "Ready when you are. What's today's problem?";
    if (dailyLimit && usedToday >= dailyLimit) return "Daily limit hit. Come back tomorrow — streak needs you.";
    if (loginStreak > 0 && loginStreak % 7 === 0) return `${loginStreak}-day streak. Badge earned!`;
    const left = dailyLimit ? dailyLimit - usedToday : null;
    if (left === 1) return "One more scan and you hit today's goal. Let's go.";
    if (usedToday >= 2) return "On a roll today. Keep stacking.";
    return "You've got this. Crush the next one.";
  })();

  const startDailyChallenge = () => {
    try {
      sessionStorage.setItem("gogodeep_challenge", todayChallenge);
      sessionStorage.setItem("gogodeep_challenge_bonus", "1");
      sessionStorage.setItem("gogodeep_challenge_xp", String(calcScanXP(todayChallenge, null) + CHALLENGE_BONUS_XP));
    } catch {}
    navigate("/workspace");
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
        className="relative min-h-screen pb-28"
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
                    <button onClick={() => navigate("/workspace")}
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
                <span className="mt-auto text-[9px] text-muted-foreground">Need {3 - (data?.recentScans.length ?? 0)} more scans</span>
              ) : quizLoading ? (
                <div className="mt-auto flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></div>
              ) : (
                <button onClick={() => startQuiz()} disabled={!quizQuestions?.length}
                  className="mt-auto w-full rounded-lg bg-primary px-2 py-1.5 text-xs font-black text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40">
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

            {/* ── RIGHT: Blue — free-floating, no panel ───── */}
            <div className="flex flex-col items-center justify-start gap-5 pt-2">

              {/* Speech bubble */}
              <div className="relative">
                <div className="rounded-[18px] border-2 border-border bg-card px-5 py-3.5 text-center text-sm font-bold text-foreground shadow-[0_8px_32px_hsl(var(--primary)/0.10)] max-w-[210px]">
                  {loading ? "…" : blueSpeech}
                </div>
                <div className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 h-0 w-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent" style={{borderTopColor:"hsl(var(--border))"}} />
                <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 h-0 w-0 border-l-[9px] border-r-[9px] border-t-[12px] border-l-transparent border-r-transparent" style={{borderTopColor:"hsl(var(--card))"}} />
              </div>

              {/* Blue — big, free */}
              <img
                src="/blue.png"
                alt="Blue"
                draggable={false}
                className="blue-bob w-full max-w-[240px] object-contain select-none -mt-2"
                style={{filter:"drop-shadow(0 16px 40px hsl(var(--primary)/0.20))"}}
              />

              {data?.plan !== "deep" && (
                <button onClick={() => navigate("/pricing")} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                  Upgrade →
                </button>
              )}

            </div>
          </div>

          {/* ── Full-width: weekly chart + quote ───────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-6 mb-4">
              <div className="shrink-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">This Week's Power</p>
                <p className="mt-1 text-4xl font-black tracking-tighter text-foreground">
                  {loading ? "—" : (data?.weeklyScans ?? []).reduce((s, d) => s + d.count, 0)}
                  <span className="ml-2 text-sm font-semibold text-muted-foreground">scans</span>
                </p>
              </div>
              {(() => {
                const day = new Date().getUTCFullYear() * 1000 + Math.floor((Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86400000);
                const q = QUOTES[(day + quoteOffset) % QUOTES.length];
                return (
                  <div className="flex-1 text-right">
                    <div className="flex items-start justify-end gap-2">
                      <button onClick={() => setQuoteOffset(v => (v + 1) % QUOTES.length)}
                        className="shrink-0 rounded-full p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors mt-1">
                        <RefreshCw className="h-3 w-3" />
                      </button>
                      <p className="text-2xl font-black italic leading-snug text-foreground">"{q.text}"</p>
                    </div>
                    {q.author && q.author !== "Anonymous" && <p className="mt-1.5 text-xs font-semibold text-muted-foreground/60">— {q.author}</p>}
                  </div>
                );
              })()}
            </div>
            <div className="h-28">
              {!loading && data && (() => {
                const MOCK = [1, 3, 2, 0, 4, 2, 1];
                const isAllZero = data.weeklyScans.every(d => d.count === 0);
                const chartData = data.weeklyScans.map((d, i) => ({
                  ...d,
                  count: isAllZero ? MOCK[i] ?? 0 : d.count,
                }));
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={16} margin={{ top: 0, right: 0, left: -32, bottom: 0 }}>
                      <Tooltip
                        cursor={{ fill: "rgba(99,102,241,0.07)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const val = Number(payload[0]?.value ?? 0);
                          return (
                            <div style={{ background: "rgba(15,23,42,0.92)", color: "#f8fafc", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, pointerEvents: "none", whiteSpace: "nowrap" }}>
                              {isAllZero ? "no data yet" : `${val} scan${val !== 1 ? "s" : ""}`}
                            </div>
                          );
                        }}
                      />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.count > 0 ? (isAllZero ? "hsl(var(--primary)/0.3)" : "hsl(var(--primary))") : "hsl(var(--secondary))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
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

const PHYSICS_STEPS = [
  "Label the triangle: hypotenuse $= 10\\text{ cm}$, angle $\\theta = 35°$, and we want the side opposite $\\theta$.",
  "The ratio linking the opposite side to the hypotenuse is sine: $\\sin\\theta = \\dfrac{\\text{opposite}}{\\text{hypotenuse}}$.",
  "Substitute the known values: $\\sin(35°) = \\dfrac{x}{10}$.",
  "Rearrange: $x = 10 \\times \\sin(35°)$.",
  "Calculate: $x = 10 \\times 0.574 \\approx 5.74\\text{ cm}$.",
];

const PHYSICS_ELI5 = "Imagine you're on a ramp going up a hill. You know ==how steep the angle is== and ==how long the ramp is==. You want to find out how high you'd climb.\n\nA right triangle has three sides. The **longest one** is the ramp — we call it the **hypotenuse**. The side going straight up is what we want.\n\nThere's a simple recipe: ==sin(angle) = height ÷ ramp length==. So to find the height, multiply the ramp length by sin of the angle.\n\nHere: ramp = **10 cm**, angle = **35°**, so height = 10 × sin(35°) ≈ **5.74 cm**.";
const PHYSICS_CORE_CONCEPT = "==SOH–CAH–TOA== is the shortcut for right-triangle trig:\n$$\\sin\\theta = \\frac{\\text{opp}}{\\text{hyp}}, \\quad \\cos\\theta = \\frac{\\text{adj}}{\\text{hyp}}, \\quad \\tan\\theta = \\frac{\\text{opp}}{\\text{adj}}$$\nPick the ratio that ==connects the side you know to the side you want==.\n\nThe **unit circle** extends these definitions beyond $90°$ by placing the angle on a circle of radius $1$.";
const PHYSICS_RECOGNITION_CUE = "When a problem gives a right triangle with **one angle** and **one side**, reach for ==SOH–CAH–TOA==.\n\nIdentify which two sides are involved:\n**opp + hyp** → use ==sine==\n**adj + hyp** → use ==cosine==\n**opp + adj** → use ==tangent==\n\nRearrange to isolate the unknown, then evaluate with a calculator.";

const PHYSICS_PRACTICE = [
  {
    q: "A right triangle has hypotenuse $8\\text{ cm}$ and angle $\\theta = 40°$. Find the adjacent side.",
    steps: [
      "Adjacent and hypotenuse → use cosine: $\\cos\\theta = \\text{adj}/\\text{hyp}$.",
      "$\\text{adj} = 8 \\times \\cos(40°) = 8 \\times 0.766 \\approx 6.13\\text{ cm}$.",
    ],
  },
  {
    q: "A ladder leans against a wall at $60°$ to the ground. The ladder is $5\\text{ m}$ long. How high up the wall does it reach?",
    steps: [
      "The height is the side opposite $60°$; the ladder is the hypotenuse.",
      "$\\text{height} = 5 \\times \\sin(60°) = 5 \\times \\tfrac{\\sqrt{3}}{2} \\approx 4.33\\text{ m}$.",
    ],
  },
  {
    q: "An angle of elevation is $25°$ and the opposite side is $6\\text{ m}$. Find the hypotenuse.",
    steps: [
      "Opposite and hypotenuse → $\\sin(25°) = 6/\\text{hyp}$.",
      "$\\text{hyp} = 6 / \\sin(25°) = 6 / 0.423 \\approx 14.19\\text{ m}$.",
    ],
  },
];

const DEMO_STEPS = [
  "Spot two different function types multiplied together: $x$ (algebraic) and $e^x$ (exponential). This calls for integration by parts.",
  "By LIATE, choose $u = x$ and $dv = e^x\\,dx$, so $du = dx$ and $v = e^x$.",
  "Apply the IBP formula: $\\displaystyle\\int x\\,e^x\\,dx = x e^x - \\int e^x\\,dx$.",
  "Evaluate the remaining integral: $\\displaystyle\\int e^x\\,dx = e^x$.",
  "Write the final answer: $\\displaystyle\\int x\\,e^x\\,dx = e^x(x-1) + C$.",
];

const DEMO_WHAT_HAPPENED = "The problem asks to evaluate $\\int x\\,e^x\\,dx$ — a polynomial multiplied by an exponential. This product of two different function types calls for integration by parts. Setting $u = x$ and $dv = e^x\\,dx$, the rule $\\int u\\,dv = uv - \\int v\\,du$ reduces the integral to one that can be solved directly.";
const DEMO_CORE_CONCEPT = "Integration by parts is the reverse of the product rule. The formula $\\int u\\,dv = uv - \\int v\\,du$ trades one integral for a simpler one. Use LIATE to choose $u$: Logarithmic → Inverse trig → Algebraic → Trig → Exponential. The most common mistake is choosing $u$ as the exponential, which makes the new integral harder, not simpler.";
const DEMO_RECOGNITION_CUE = "When you see two different function types multiplied under an integral — like $x e^x$ or $x\\sin(x)$ — use integration by parts. Apply LIATE: pick the algebraic term as $u$ when paired with an exponential or trig function. If $\\int v\\,du$ looks more complex than the original, swap $u$ and $dv$.";

const DEMO_PRACTICE = [
  {
    q: "Find $\\int x\\cos(x)\\,dx$ using integration by parts.",
    steps: [
      "By LIATE, $x$ is Algebraic and $\\cos(x)$ is Trig — set $u = x$.",
      "Then $dv = \\cos(x)\\,dx$, giving $du = dx$ and $v = \\sin(x)$.",
      "Apply IBP: $\\int x\\cos(x)\\,dx = x\\sin(x) - \\int\\sin(x)\\,dx$.",
      "Evaluate: $-\\int\\sin(x)\\,dx = \\cos(x)$.",
      "Final answer: $x\\sin(x) + \\cos(x) + C$.",
    ],
  },
  {
    q: "Evaluate $\\int x^2 e^x\\,dx$. You may need IBP twice.",
    steps: [
      "First pass: $u = x^2$, $dv = e^x\\,dx$ $\\Rightarrow$ $du = 2x\\,dx$, $v = e^x$.",
      "After first IBP: $x^2 e^x - 2\\int x\\,e^x\\,dx$.",
      "Second pass on $\\int x\\,e^x\\,dx$: result is $x e^x - e^x$.",
      "Substitute back: $x^2 e^x - 2(x e^x - e^x)$.",
      "Final answer: $e^x(x^2 - 2x + 2) + C$.",
    ],
  },
  {
    q: "Calculate $\\int \\ln(x)\\,dx$. Let $u = \\ln(x)$ and $dv = dx$.",
    steps: [
      "Set $u = \\ln(x)$, $dv = dx$, so $du = \\tfrac{1}{x}\\,dx$ and $v = x$.",
      "Apply IBP: $\\int\\ln(x)\\,dx = x\\ln(x) - \\int x \\cdot \\tfrac{1}{x}\\,dx$.",
      "Simplify: $\\int 1\\,dx = x$.",
      "Final answer: $x\\ln(x) - x + C$.",
    ],
  },
];

type DemoTab = "steps" | "concept" | "practice";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];

const ScreenshotCard = ({ dimmed = false }: { dimmed?: boolean }) => (
  <div className={`w-52 rounded-xl bg-blue-50 p-3.5 shadow-xl border border-blue-100 ${dimmed ? "opacity-40" : ""}`}>
    <p className="mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Question 7</p>
    <div className="mb-2 h-2 w-3/5 rounded bg-gray-400" />
    <div className="space-y-1.5">
      <div className="h-1.5 w-full rounded bg-gray-300" />
      <div className="mt-2 flex items-center justify-center rounded bg-gray-100 py-2">
        <svg viewBox="0 0 170 115" className="w-32 h-20">
          <polygon points="25,98 125,98 125,28" fill="none" stroke="#374151" strokeWidth="1.5" />
          <rect x="114" y="87" width="11" height="11" fill="none" stroke="#374151" strokeWidth="1.2" />
          <path d="M 43,98 A 18,18 0 0,0 39.7,87.7" fill="none" stroke="#2563eb" strokeWidth="1.3" />
          <text x="50" y="91" fontSize="9" fill="#2563eb" fontWeight="600">35°</text>
          <text x="75" y="52" fontSize="9" fill="#6b7280" textAnchor="middle" transform="rotate(-35,75,52)">hyp = 10 cm</text>
          <text x="133" y="66" fontSize="9" fill="#16a34a" fontWeight="600">x = ?</text>
        </svg>
      </div>
      <div className="h-1.5 w-3/4 rounded bg-gray-300" />
    </div>
  </div>
);

const LOADING_MSGS = [
  "Reading the question…",
  "Identifying the concept…",
  "Detailing the steps…",
  "Building practice questions…",
];

const DemoPanel = () => {
  const [phase, setPhase] = useState(0);
  const [tab, setTab] = useState<DemoTab>("steps");
  const [revealedSteps, setRevealedSteps] = useState(1);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const lastInteractionRef = useRef<number>(Date.now());

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
    const t = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > 30000) {
        setPhase(0);
        setTab("steps");
        setRevealedSteps(1);
        setRevealedAnswers(new Set());
      }
    }, 5000);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <div className="relative h-[440px] overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-[0_0_40px_hsl(225,75%,55%,0.18),0_0_80px_hsl(225,75%,55%,0.08)] scale-[0.93] origin-top">
      <div className="relative h-full">

        {/* Phase 0: empty state */}
        {phase === 0 && (
          <div className="flex h-full items-center justify-center select-none">
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
          <div className="flex h-full items-center justify-center">
            <div className="animate-slide-in-paper">
              <ScreenshotCard />
            </div>
          </div>
        )}

        {/* Phase 2: loading */}
        {phase === 2 && (
          <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
            <ScreenshotCard dimmed />
            <div className="w-56">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary animate-loading-fill" />
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: results */}
        {phase === 3 && (
          <div className="animate-fade-up flex h-full flex-col p-4">
            {(() => {
              const demoTabs: { value: DemoTab; label: string }[] = [
                { value: "steps", label: "Step by Step" },
                { value: "concept", label: "Concept" },
                { value: "practice", label: "Practice" },
              ];
              const demoTabIdx = demoTabs.findIndex((t) => t.value === tab);
              return (
                <div className="relative mb-3 flex gap-1 rounded-lg border border-border bg-secondary p-1">
                  <div
                    className="absolute bottom-1 top-1 rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
                    style={{ width: "calc((100% - 8px) / 3)", transform: `translateX(calc(${demoTabIdx} * 100%))` }}
                  />
                  {demoTabs.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { setTab(value); lastInteractionRef.current = Date.now(); }}
                      className={`relative z-10 flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition-colors duration-200 ${
                        tab === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {tab === "steps" && (
              <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
                <div className="flex justify-center rounded-lg border border-border bg-secondary/30 py-2">
                  <svg viewBox="0 0 170 115" className="w-44 h-28">
                    <polygon points="25,98 125,98 125,28" fill="none" stroke="hsl(var(--foreground) / 0.5)" strokeWidth="1.5" />
                    <rect x="114" y="87" width="11" height="11" fill="none" stroke="hsl(var(--foreground) / 0.4)" strokeWidth="1.2" />
                    <path d="M 43,98 A 18,18 0 0,0 39.7,87.7" fill="none" stroke="#5b7fef" strokeWidth="1.3" />
                    <text x="50" y="91" fontSize="10" fill="#5b7fef" fontWeight="600">35°</text>
                    <text x="75" y="52" fontSize="10" fill="hsl(var(--foreground) / 0.55)" textAnchor="middle" transform="rotate(-35,75,52)">hyp = 10 cm</text>
                    <text x="133" y="66" fontSize="10" fill="#4ade80" fontWeight="600">x = ?</text>
                    <text x="75" y="111" fontSize="10" fill="hsl(var(--foreground) / 0.3)" textAnchor="middle">adj</text>
                  </svg>
                </div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary"><RichText text="Find the opposite side" /></div>
                {PHYSICS_STEPS.slice(0, revealedSteps).map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                    <div className="text-sm leading-relaxed text-foreground"><RichText text={step} /></div>
                  </div>
                ))}
                {revealedSteps < PHYSICS_STEPS.length && (
                  <button
                    onClick={() => { setRevealedSteps((v) => v + 1); lastInteractionRef.current = Date.now(); }}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    Next step <ChevronRight className="h-3 w-3" />
                  </button>
                )}
                {revealedSteps >= PHYSICS_STEPS.length && (
                  <p className="pt-1 text-center text-xs text-muted-foreground/50">All steps revealed.</p>
                )}
              </div>
            )}

            {tab === "concept" && (
              <div className="flex-1 space-y-2 overflow-y-auto">
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Explain like I'm 5</p>
                  </div>
                  <div className="text-sm leading-relaxed text-foreground"><RichText text={PHYSICS_ELI5} /></div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">The concept</p>
                  </div>
                  <div className="text-sm leading-relaxed text-foreground"><RichText text={PHYSICS_CORE_CONCEPT} /></div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/60 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">When you see this</p>
                  </div>
                  <div className="text-sm leading-relaxed text-foreground"><RichText text={PHYSICS_RECOGNITION_CUE} /></div>
                </div>
              </div>
            )}

            {tab === "practice" && (
              <div className="flex-1 space-y-2 overflow-y-auto">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Practice Questions</p>
                {PHYSICS_PRACTICE.map((item, i) => (
                  <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-sm font-bold text-primary">{i + 1}.</span>
                        <div className="text-sm leading-relaxed text-foreground"><RichText text={item.q} /></div>
                      </div>
                      <button
                        onClick={() => { lastInteractionRef.current = Date.now(); setRevealedAnswers((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; }); }}
                        className="shrink-0 text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        {revealedAnswers.has(i) ? "Hide" : "Answer"}
                      </button>
                    </div>
                    {revealedAnswers.has(i) && (
                      <div className="mt-2 space-y-1">
                        {item.steps.map((step, si) => (
                          <div key={si} className="flex items-start gap-2 rounded border border-primary/20 bg-card px-2.5 py-1.5">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{si + 1}</span>
                            <div className="text-xs leading-relaxed text-foreground"><RichText text={step} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>
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

function GoButton() {
  return (
    <Link to="/workspace">
      <button className="group relative h-16 min-w-[200px] rounded-2xl bg-primary px-10 text-xl font-bold text-white select-none overflow-hidden transition-all duration-300 shadow-[0_0_24px_4px_rgba(91,127,239,0.3)] hover:scale-[1.03] hover:shadow-[0_0_44px_10px_rgba(91,127,239,0.45)]">
        {/* Shimmer sweep on hover */}
        <span className="pointer-events-none absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-[150%]" />
        <span className="relative z-10 flex items-end gap-0 justify-center leading-none tracking-tight">
          <span>Go</span>
          <span className="flex items-end mb-0.5 ml-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="inline-block animate-bounce text-white/80"
                style={{ animationDelay: `${i * 160}ms`, animationDuration: "900ms" }}>.</span>
            ))}
          </span>
        </span>
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

  const runHighlight = useCallback(() => {
    if (highlightFired.current) return;
    highlightFired.current = true;
    setTimeout(() => setHighlightedStep(1), 200);
    setTimeout(() => setHighlightedStep(2), 900);
    setTimeout(() => setHighlightedStep(0), 2100);
  }, []);

  useEffect(() => {
    const onScroll = () => setChevronVisible(window.scrollY < 80);
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
                  Go <span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontOpticalSizing: "auto", paddingRight: "0.08em", backgroundImage: "linear-gradient(to bottom, hsl(225 90% 70%), hsl(225 75% 50%) 70%, hsl(225 60% 25%))", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", display: "inline-block", transform: `translateY(${deeperY}px)`, transition: "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)" } as React.CSSProperties}>deeper</span>
                </h1>
                <h1 className="relative text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.75rem]">
                  than the answer.
                </h1>
                <p className="mt-6 max-w-md text-base sm:text-lg md:text-xl leading-relaxed text-muted-foreground">
                  Screenshot a problem. Turn it into a complete learning loop: step-by-step solution, concept deep-dive, and gap-targeted practice.
                </p>
                <div className="mt-10">
                  <GoButton />
                </div>
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
