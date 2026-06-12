// Recap-quiz types (dashboard quiz runner).

export type QuizQuestion = {
  topic: string;
  question: string;
  answer: string;
  mode: "typed" | "mc" | "tf";
  tfStatement?: string;
  tfCorrect?: boolean;
  mcOptions?: string[];
  mcCorrectIdx?: number;
};

export type QuizState = {
  questions: QuizQuestion[];
  current: number;
  revealed: boolean;
  userInput: string;
  results: Array<"correct" | "incorrect">;
  currentResult: "correct" | "incorrect" | null;
  showStats: boolean;
  selectedMcIdx: number | null;
};

export type QuizHistoryEntry = {
  id: string;
  date: string;
  score: number;
  total: number;
  elapsedSecs: number;
  topics: string[];
};

export type QuizConfig = {
  numQuestions: number;
  typed: boolean;
  multipleChoice: boolean;
  trueOrFalse: boolean;
  selectedConcepts: string[];
};
