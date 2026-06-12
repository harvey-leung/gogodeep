// Central React Query key factory so keys are defined in exactly one place.

export const queryKeys = {
  dashboard: (uid: string) => ["dashboard", uid] as const,
  scans: (uid: string) => ["scans", uid] as const,
  profile: (uid: string) => ["profile", uid] as const,
};
