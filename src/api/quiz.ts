import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QuizQuestion } from "@/types/quiz";

export interface RawQuizQuestion {
  topic: string;
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

export interface GenerateQuizResult {
  questions?: RawQuizQuestion[];
  error?: string;
}

/** Calls the generate-quiz edge function for the given topics. */
export async function generateQuiz(topics: string[]): Promise<GenerateQuizResult> {
  const { data, error } = await supabase.functions.invoke("generate-quiz", { body: { topics } });
  if (error) return { error: "error" };
  return (data ?? {}) as GenerateQuizResult;
}

/**
 * Maps raw AI quiz questions to the runner's QuizQuestion shape (multiple
 * choice, options shuffled). Ported verbatim from the old Index inline mapper.
 */
export function toQuizQuestions(raw: RawQuizQuestion[]): QuizQuestion[] {
  return raw.map((q) => {
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
}

export function useGenerateQuizMutation() {
  return useMutation({ mutationFn: (topics: string[]) => generateQuiz(topics) });
}
