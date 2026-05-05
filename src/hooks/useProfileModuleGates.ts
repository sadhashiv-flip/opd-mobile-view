import { fetchPatientProfileRaw } from "@/api/patientProfile";
import { loadCachedProfileRaw } from "@/lib/profileCacheStorage";
import {
  parseProfileModuleGates,
  type ProfileModuleGates,
} from "@/lib/moduleGatesFromProfile";
import { useEffect, useState } from "react";

export type UseProfileModuleGatesResult = ProfileModuleGates &
  Readonly<{ loaded: boolean }>;

/**
 * Reads cached profile for immediate module gates, then refreshes via `GET /patient/profile`
 * (updates localStorage through {@link fetchPatientProfileRaw}).
 */
export function useProfileModuleGates(): UseProfileModuleGatesResult {
  const [gates, setGates] = useState<ProfileModuleGates>(() =>
    parseProfileModuleGates(loadCachedProfileRaw()),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPatientProfileRaw()
      .then((raw) => {
        if (cancelled) return;
        setGates(parseProfileModuleGates(raw));
      })
      .catch(() => {
        if (cancelled) return;
        setGates(parseProfileModuleGates(loadCachedProfileRaw()));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...gates, loaded };
}
