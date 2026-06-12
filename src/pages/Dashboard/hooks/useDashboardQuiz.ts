import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { addBonusXP, QUIZ_XP } from "@/lib/xp";
import { SCAN_CACHE_KEY, storageKeys } from "@/lib/storageKeys";
import { generateQuiz, toQuizQuestions } from "@/api/quiz";
import type { DashboardData } from "@/types/dashboard";
import type { QuizConfig, QuizHistoryEntry, QuizQuestion, QuizState } from "@/types/quiz";

/**
 * Recap-quiz generation + the quiz runner state machine. These are coupled
 * (the completion flow re-seeds the recap questions for deep users), so they
 * live in one hook. Ported verbatim from the old Index Dashboard.
 */
export function useDashboardQuiz({
  userId,
  data,
  setData,
}: {
  userId: string;
  data: DashboardData | null;
  setData: Dispatch<SetStateAction<DashboardData | null>>;
}) {
  const QUIZ_SAVE_KEY = storageKeys.quizSave(userId);
  const QUIZ_HIST_KEY = storageKeys.quizHistory(userId);
  const QUIZ_CACHE_Q_KEY = storageKeys.recapQuizQuestions(userId);
  const QUIZ_CACHE_D_KEY = storageKeys.recapQuizDate(userId);
  const QUIZ_DONE_KEY = storageKeys.recapQuizDone(userId);

  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizGenError, setQuizGenError] = useState<"limit" | "error" | null>(null);
  const [quizConfig] = useState<QuizConfig>({ numQuestions: 10, typed: true, multipleChoice: true, trueOrFalse: true, selectedConcepts: [] });
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [quizKey, setQuizKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeElapsedRef = useRef(0);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(QUIZ_HIST_KEY) ?? "[]"); } catch { return []; }
  });
  const [quizDoneToday, setQuizDoneToday] = useState(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      return localStorage.getItem(QUIZ_DONE_KEY) === today;
    } catch { return false; }
  });

  const fetchRecapQuiz = useCallback((topics: string[]) => {
    const today = new Date().toISOString().split("T")[0];
    setQuizLoading(true);
    setQuizQuestions(null);
    setQuizGenError(null);
    generateQuiz(topics).then((result) => {
      setQuizLoading(false);
      if (!Array.isArray(result?.questions) || !result.questions.length) {
        console.error("[Quiz] generate-quiz failed:", result);
        setQuizGenError(result?.error === "daily_quiz_limit" ? "limit" : "error");
        return;
      }
      const questions = toQuizQuestions(result.questions);
      setQuizQuestions(questions);
      try {
        localStorage.setItem(QUIZ_CACHE_D_KEY, today);
        localStorage.setItem(QUIZ_CACHE_Q_KEY, JSON.stringify(questions));
      } catch { /* ignore */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      } catch { /* ignore */ }
    }

    // New day: reset done flag
    if (cachedDate !== today) {
      try { localStorage.removeItem(QUIZ_DONE_KEY); } catch { /* ignore */ }
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
    try { localStorage.setItem(QUIZ_SAVE_KEY, JSON.stringify({ quiz, elapsed: elapsedSecs })); } catch { /* ignore */ }
  }, [quiz, elapsedSecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // On quiz completion: save history, clear progress, handle deep/free
  useEffect(() => {
    if (!quiz?.showStats) return;
    try { localStorage.removeItem(QUIZ_SAVE_KEY); } catch { /* ignore */ }
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
    try { localStorage.setItem(QUIZ_HIST_KEY, JSON.stringify(newHistory)); } catch { /* ignore */ }

    if (data?.plan === "deep" && data.recentScans.length >= 3) {
      // Deep users: generate fresh questions for next round
      const topics = data.recentScans.slice(0, 5).map((s) => s.label).filter(Boolean);
      if (!topics.length) return;
      generateQuiz(topics).then((result) => {
        if (!Array.isArray(result?.questions) || !result.questions.length) return;
        const questions = toQuizQuestions(result.questions);
        setQuizQuestions(questions);
        const today = new Date().toISOString().split("T")[0];
        try {
          localStorage.setItem(QUIZ_CACHE_D_KEY, today);
          localStorage.setItem(QUIZ_CACHE_Q_KEY, JSON.stringify(questions));
        } catch { /* ignore */ }
      });
    } else {
      // Free/intermediate: mark daily recap quiz as done, no more today
      const today = new Date().toISOString().split("T")[0];
      try { localStorage.setItem(QUIZ_DONE_KEY, today); } catch { /* ignore */ }
      setQuizDoneToday(true);
      setQuizQuestions(null);
    }
    // Award quiz XP for everyone
    addBonusXP(userId, QUIZ_XP, "quiz");
    setData((prev) => prev ? { ...prev, totalXP: prev.totalXP + QUIZ_XP, todayXP: prev.todayXP + QUIZ_XP } : prev);
    window.dispatchEvent(new CustomEvent("whale-notify", {
      detail: { message: `+${QUIZ_XP} XP — quiz complete!`, type: "success" },
    }));
  }, [quiz?.showStats]); // eslint-disable-line react-hooks/exhaustive-deps

  const startQuizWithConfig = (cfg: QuizConfig) => {
    if (!data) return;
    const byTopic: Record<string, { question: string; answer: string; options?: string[] }[]> = {};
    for (const scan of data.recentScans) {
      const raw = localStorage.getItem(SCAN_CACHE_KEY(scan.id));
      if (!raw) continue;
      try {
        const stored = JSON.parse(raw);
        const problems: { question: string; answer: string; options?: string[] }[] = stored.diagnosis?.practice_problems ?? [];
        for (const p of problems) { (byTopic[scan.label] ??= []).push(p); }
      } catch { /* ignore */ }
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
    try { localStorage.removeItem(QUIZ_SAVE_KEY); } catch { /* ignore */ }
    setConfirmRestart(false);
    setQuizKey((k) => k + 1);
    setQuiz({ questions: qs, current: 0, revealed: false, userInput: "", results: [], currentResult: null, showStats: false, selectedMcIdx: null });
  };

  return {
    quiz, setQuiz,
    quizQuestions,
    quizLoading,
    quizGenError,
    quizDoneToday,
    quizConfig,
    elapsedSecs,
    confirmRestart, setConfirmRestart,
    fetchRecapQuiz,
    startQuiz,
    startQuizWithConfig,
  };
}
