import { extractProfileRecord } from "@/lib/subscriptionDashboardModules";
import { loadCachedProfileRaw } from "@/lib/profileCacheStorage";
import type { ActiveSubscriptionItem } from "@/api/patientSubscriptions";

/** Logged-in patient id — matches Dart `AppSecureStorage.getSavedUser()?.id`. */
export function readPrimaryUserIdFromCache(): number | null {
  const raw = loadCachedProfileRaw();
  const profile = extractProfileRecord(raw);
  if (!profile) return null;

  const tryValue = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.trunc(v);
    if (typeof v === "string") {
      const n = Number.parseInt(v.trim(), 10);
      if (n > 0) return n;
    }
    return null;
  };

  for (const key of ["id", "user_id", "userId", "patient_id", "patientId"] as const) {
    const found = tryValue(profile[key]);
    if (found != null) return found;
  }

  const user = profile.user;
  if (user && typeof user === "object" && !Array.isArray(user)) {
    const u = user as Record<string, unknown>;
    for (const key of ["id", "user_id", "userId"] as const) {
      const found = tryValue(u[key]);
      if (found != null) return found;
    }
  }
  return null;
}

export function canActivateOnSubscription(
  sub: ActiveSubscriptionItem,
  primaryUserId: number | null,
): Readonly<{ canTap: boolean; disabledHint: string }> {
  const slotUnavailable = "Only the plan owner can assign members here.";

  if (primaryUserId == null) {
    return { canTap: false, disabledHint: slotUnavailable };
  }
  if (!sub.canActivate) {
    return { canTap: false, disabledHint: slotUnavailable };
  }
  if (sub.patientId && String(sub.patientId) !== String(primaryUserId)) {
    return { canTap: false, disabledHint: slotUnavailable };
  }
  return { canTap: true, disabledHint: "" };
}

export function totalMemberSlots(mt: Record<string, number> | null): number {
  if (!mt) return 0;
  let t = 0;
  for (const v of Object.values(mt)) t += v;
  return t;
}
