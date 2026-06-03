import { loadCachedProfileRaw } from "@/lib/profileCacheStorage";
import {
  parseProfileModuleGates,
  type ProfileModuleGates,
} from "@/lib/moduleGatesFromProfile";
import { useMemo } from "react";

export type UseProfileModuleGatesResult = ProfileModuleGates &
  Readonly<{ loaded: boolean }>;

/**
 * Module gates from cached `GET /patient/profile` (login / profile screen / SSO).
 * Does not call the profile API — avoids refetch on every tab navigation.
 */
export function useProfileModuleGates(): UseProfileModuleGatesResult {
  return useMemo(() => {
    const raw = loadCachedProfileRaw();
    return {
      ...parseProfileModuleGates(raw),
      loaded: true,
    };
  }, []);
}
