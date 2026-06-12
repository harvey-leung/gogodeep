// Shared domain types for core objects. Kept permissive where the AI returns
// loosely-shaped JSON (Diagnosis), so callers can stop using `as any`.

export interface PracticeProblem {
  id?: number;
  question: string;
  answer: string;
  options?: string[];
}

export interface Diagnosis {
  mode?: string;
  concept_label?: string;
  question_summary?: string;
  what_happened?: string;
  core_concept?: string;
  underlying_concept?: string;
  recognition_cue?: string;
  steps?: string[];
  practice_problems?: PracticeProblem[];
  error_category?: string | null;
  error_tag?: string;
  explanation?: string;
  input_status?: "ok" | "blurry" | "not_stem" | string;
  // The AI tool output carries extra fields depending on mode.
  [key: string]: unknown;
}

// A raw row from the error_logs table (the scan history source of truth).
export interface ErrorLog {
  id: string;
  error_category: string | null;
  specific_error_tag: string | null;
  topic: string | null;
  created_at: string | null;
}

// A scan as displayed in dashboard lists (derived from ErrorLog).
export interface Scan {
  id: string;
  label: string;
  created_at: string | null;
  error_category: string | null;
}
