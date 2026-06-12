import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Diagnosis, ErrorLog } from "@/types/domain";
import { queryKeys } from "./queryKeys";

/** All of a user's scans (error_logs), newest first. */
export async function fetchErrorLogs(userId: string): Promise<ErrorLog[]> {
  const { data } = await (supabase as any)
    .from("error_logs")
    .select("id, error_category, specific_error_tag, topic, created_at")
    .eq("student_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ErrorLog[];
}

/** The stored diagnosis JSON for a single scan, or null if missing. */
export async function fetchScanDiagnosis(scanId: string): Promise<Diagnosis | null> {
  const { data, error } = await (supabase as any)
    .from("error_logs")
    .select("diagnosis")
    .eq("id", scanId)
    .single();
  if (error || !data?.diagnosis) return null;
  return data.diagnosis as Diagnosis;
}

export function useScans(userId: string) {
  return useQuery({
    queryKey: queryKeys.scans(userId),
    queryFn: () => fetchErrorLogs(userId),
  });
}
