import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import type { User } from "@supabase/supabase-js";
import PageTransition from "@/components/PageTransition";
import { whaleToast } from "@/lib/whaleToast";
import { SCAN_CACHE_KEY, sessionKeys } from "@/lib/storageKeys";
import { calcScanXP, CHALLENGE_BONUS_XP } from "@/lib/xp";
import { useDashboardData } from "@/api/dashboard";
import { fetchScanDiagnosis } from "@/api/scans";
import type { DashboardData } from "@/types/dashboard";
import { useDailyClaim } from "./hooks/useDailyClaim";
import { useDailyGoal } from "./hooks/useDailyGoal";
import { useDashboardQuiz } from "./hooks/useDashboardQuiz";
import { HeroGreeting } from "./components/HeroGreeting";
import { LevelCard } from "./components/LevelCard";
import { DailyChallengeCard } from "./components/DailyChallengeCard";
import { RecapQuizCard } from "./components/RecapQuizCard";
import { StatsGrid } from "./components/StatsGrid";
import { BlueSpeech } from "./components/BlueSpeech";
import { DiveBackIn } from "./components/DiveBackIn";
import { StreamCard } from "./components/StreamCard";
import { QuizDialog } from "./components/QuizDialog";

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

const DAILY_CHALLENGES = [
  "Find all solutions: |2x − 5| = 9",
  "Differentiate y = x³ · eˣ using the product rule",
  "Solve the quadratic: 6x² + x − 2 = 0",
  "Right triangle — hyp = 13, one leg = 5. Find the missing side.",
  "Balance this equation: Fe + O₂ → Fe₂O₃",
  "Evaluate ∫₀³ x² dx step by step",
  "Convert the recurring decimal 0.̄3 to an exact fraction",
];

const Dashboard = ({ user }: { user: User }) => {
  const username = user.user_metadata?.username ?? user.email?.split("@")[0] ?? "there";
  const greeting = GREETING_PHRASES[new Date().getUTCDay() * 4 % 9];
  const todayChallenge = DAILY_CHALLENGES[new Date().getUTCDay()];

  const navigate = useNavigate();
  const location = useLocation();

  const [heroPhase, setHeroPhase] = useState<0 | 1 | 2>(0);

  // Dashboard data via React Query; kept in local state so optimistic XP bumps
  // (claim, quiz completion) work exactly as before.
  const query = useDashboardData(user.id);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (query.data) { setData(query.data); setLoading(false); }
  }, [query.data]);

  const { dailyClaim, claim } = useDailyClaim(user.id, (amount) =>
    setData((prev) => prev ? { ...prev, totalXP: prev.totalXP + amount, todayXP: prev.todayXP + amount } : prev)
  );
  const goal = useDailyGoal(user.id);
  const {
    quiz, setQuiz, quizQuestions, quizLoading, quizGenError, quizDoneToday, quizConfig,
    elapsedSecs, confirmRestart, setConfirmRestart, fetchRecapQuiz, startQuiz, startQuizWithConfig,
  } = useDashboardQuiz({ userId: user.id, data, setData });

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
      sessionStorage.setItem(sessionKeys.challenge, todayChallenge);
      sessionStorage.setItem(sessionKeys.challengeBonus, "1");
      sessionStorage.setItem(sessionKeys.challengeXp, String(calcScanXP(todayChallenge, null) + CHALLENGE_BONUS_XP));
    } catch { /* ignore */ }
    navigate("/dive");
  };

  async function handleScanClick(scanId: string) {
    const raw = localStorage.getItem(SCAN_CACHE_KEY(scanId));
    if (raw) {
      try {
        navigate("/report", { state: { ...JSON.parse(raw), scanId } });
        return;
      } catch { /* fall through to fetch */ }
    }
    const diagnosis = await fetchScanDiagnosis(scanId);
    if (!diagnosis) {
      navigate("/dive");
      return;
    }
    navigate("/report", { state: { diagnosis, mode: diagnosis?.mode ?? "guide", scanId } });
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

      <HeroGreeting heroPhase={heroPhase} setHeroPhase={setHeroPhase} greeting={greeting} username={username} />

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
              {greeting},{" "}
              <span className="text-primary">{username}</span>
            </h1>
          </div>

          {/* ── Level bar + action cards — full width ──────────────── */}
          <div className="mb-8 flex gap-3 items-stretch">
            {!loading && data && (
              <LevelCard data={data} dailyClaim={dailyClaim} onClaim={claim} onScan={() => navigate("/dive")} />
            )}
            <DailyChallengeCard todayChallenge={todayChallenge} onStart={startDailyChallenge} />
            <RecapQuizCard
              data={data}
              quizDoneToday={quizDoneToday}
              quizLoading={quizLoading}
              quizQuestions={quizQuestions}
              quizGenError={quizGenError}
              onStartQuiz={() => startQuiz()}
              onNavigate={navigate}
              fetchRecapQuiz={fetchRecapQuiz}
            />
          </div>

          {/* Main layout — left content + Blue floats right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
            <div className="min-w-0 space-y-5">
              <StatsGrid
                loading={loading}
                data={data}
                dailyGoal={goal.dailyGoal}
                editingGoal={goal.editingGoal}
                goalDraft={goal.goalDraft}
                setGoalDraft={goal.setGoalDraft}
                beginEdit={goal.beginEdit}
                cancel={goal.cancel}
                commit={goal.commit}
                onNavigate={navigate}
              />
            </div>
            <BlueSpeech loading={loading} blueSpeech={blueSpeech} plan={data?.plan} onUpgrade={() => navigate("/pricing")} />
          </div>

          {/* ── Full-width bottom: Dive back in + Stream ───── */}
          <div className="mt-6 grid grid-cols-2 gap-6">
            <DiveBackIn loading={loading} recentScans={data?.recentScans ?? []} onScanClick={handleScanClick} />
            <StreamCard onStart={() => navigate("/stream")} />
          </div>

        </div>
      </div>

      <QuizDialog
        quiz={quiz}
        setQuiz={setQuiz}
        elapsedSecs={elapsedSecs}
        confirmRestart={confirmRestart}
        setConfirmRestart={setConfirmRestart}
        startQuiz={startQuiz}
        startQuizWithConfig={startQuizWithConfig}
        quizConfig={quizConfig}
      />
    </PageTransition>
  );
};

export default Dashboard;
