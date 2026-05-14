import {
  mergeFcmDataWithDetails,
  resolveSupportTicketPathFromFcmData,
} from "@/lib/fcmSupportTicketNavigation";

/** Safe single path segment for `:param` routes (alphanumeric, `_`, `.`, `-`). */
const SAFE_SEGMENT = /^[\w.-]+$/;
const MAX_PATH_LEN = 512;

export function isSafeFcmPathSegment(segment: string): boolean {
  const s = segment.trim();
  return s.length > 0 && s.length <= 200 && SAFE_SEGMENT.test(s);
}

function encodeSeg(segment: string): string {
  return encodeURIComponent(segment.trim());
}

function pickPrimaryId(merged: Record<string, string>): string | null {
  const keys = ["id", "entity_id", "entityId", "target_id", "targetId"] as const;
  for (const k of keys) {
    const v = merged[k]?.trim();
    if (v && isSafeFcmPathSegment(v)) return v;
  }
  return null;
}

function coalesceFcmDetailScalar(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && Number.isInteger(v)) {
    return String(v);
  }
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

/** Reads claim / reimbursement id from raw `details` JSON (top-level `id` is often a notification key). */
function pickClaimIdFromDetailsString(detailsStr: string | undefined): string | null {
  if (!detailsStr?.trim()) return null;
  try {
    const o = JSON.parse(detailsStr) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const keys = ["claim_id", "claimId", "reimbursement_id", "id"] as const;
    for (const k of keys) {
      const s = coalesceFcmDetailScalar(o[k]);
      if (s && isSafeFcmPathSegment(s)) return s;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolves `/claims/:claimId` segment: explicit keys, then `details`, then generic `id`. */
function pickClaimsRouteId(merged: Record<string, string>): string | null {
  for (const k of ["claim_id", "claimId", "reimbursement_id", "reimbursementId"] as const) {
    const v = merged[k]?.trim();
    if (v && isSafeFcmPathSegment(v)) return v;
  }
  const fromDetails = pickClaimIdFromDetailsString(merged.details);
  if (fromDetails) return fromDetails;
  return pickPrimaryId(merged);
}

function pickOrderKind(merged: Record<string, string>): string | null {
  const v = (merged.order_kind ?? merged.orderKind ?? "").trim();
  return v && isSafeFcmPathSegment(v) ? v : null;
}

function pickInvoiceId(merged: Record<string, string>, primary: string | null): string | null {
  const v = (merged.invoice_id ?? merged.invoiceId ?? "").trim();
  if (v && isSafeFcmPathSegment(v)) return v;
  return primary;
}

/**
 * Resolves same-origin relative path from `path`, `link`, or `url` data keys.
 * Rejects protocol-relative URLs and foreign origins.
 */
export function resolveExplicitInternalPathFromMerged(
  merged: Record<string, string>,
): string | null {
  const origin = globalThis.location?.origin ?? "https://app.invalid";

  const tryRaw = (raw: string | undefined): string | null => {
    if (!raw?.trim()) return null;
    const v = raw.trim();
    if (v.length > MAX_PATH_LEN) return null;

    if (v.startsWith("/")) {
      if (v.startsWith("//")) return null;
      const pathOnly = v.split("?")[0]?.split("#")[0] ?? "";
      if (!pathOnly.startsWith("/")) return null;
      return pathOnly;
    }

    try {
      const u = new URL(v, origin);
      if (u.origin !== new URL(origin).origin) return null;
      const p = u.pathname.split("?")[0] ?? "";
      if (!p.startsWith("/")) return null;
      return p.length > MAX_PATH_LEN ? null : p;
    } catch {
      return null;
    }
  };

  return (
    tryRaw(merged.path) ??
    tryRaw(merged.link) ??
    tryRaw(merged.url) ??
    null
  );
}

function withIdPath(base: string, id: string | null): string | null {
  return id ? `${base}${encodeSeg(id)}` : null;
}

type TypedPathRule = {
  types: readonly string[];
  path: (merged: Record<string, string>, id: string | null) => string | null;
};

/** Maps FCM `data.type` / `notification_type` / `screen` plus ids to in-app paths. Add rows for new backend kinds. */
const TYPED_PATH_RULES: readonly TypedPathRule[] = [
  {
    types: ["video_call", "video", "ongoing_appointment", "live_consultation", "appointment_video"],
    path: (_, id) => withIdPath("/video/", id),
  },
  {
    types: ["consultation_chat", "medical_chat", "consultation_message"],
    path: (_, id) => withIdPath("/medical-records/consultations/chat/", id),
  },
  {
    types: ["pharmacy_prescription", "prescription"],
    path: (_, id) => withIdPath("/pharmacy/prescription/", id),
  },
  {
    types: ["health_club", "blog", "article"],
    path: (_, id) => withIdPath("/health-club/", id),
  },
  {
    types: ["fitness_tag", "workout_tag", "fitness_category"],
    path: (_, id) => withIdPath("/services/fitness/tag/", id),
  },
  {
    types: ["chronic", "chronic_condition", "chronic_program"],
    path: (_, id) => withIdPath("/services/chronic/", id),
  },
  {
    types: ["claim", "reimbursement"],
    path: (merged) => withIdPath("/claims/", pickClaimsRouteId(merged)),
  },
  {
    types: ["wallet", "wallet_subscription", "opd_wallet"],
    path: (_, id) => withIdPath("/wallet/", id),
  },
  {
    types: ["lab_order", "order_lab"],
    path: (_, id) => withIdPath("/order/lab/", id),
  },
  {
    types: ["gym_order"],
    path: (_, id) => withIdPath("/order/gym/", id),
  },
  {
    types: ["consultation_order"],
    path: (_, id) => withIdPath("/order/consultation/", id),
  },
  {
    types: ["order", "invoice"],
    path: (m, id) => {
      const kind = pickOrderKind(m);
      const inv = pickInvoiceId(m, id);
      if (kind && inv) return `/order/${encodeSeg(kind)}/${encodeSeg(inv)}`;
      return null;
    },
  },
  {
    types: ["digital_diary", "diary", "diary_log"],
    path: (_, id) => withIdPath("/digital-diary/", id),
  },
  {
    types: ["notifications", "notification_inbox", "notification_list", "notification"],
    path: () => "/notifications",
  },
  {
    types: ["dashboard", "home"],
    path: () => "/dashboard",
  },
  {
    types: ["services", "services_hub"],
    path: () => "/services",
  },
  {
    types: ["orders", "orders_list", "my_orders"],
    path: () => "/orders",
  },
  {
    types: ["cart", "cart_overview"],
    path: () => "/cart-overview",
  },
];

export function resolveTypedNotificationDeepLink(merged: Record<string, string>): string | null {
  const raw = (merged.type ?? merged.notification_type ?? merged.screen ?? "").trim();
  const t = raw.toLowerCase().replace(/\s+/g, "_");
  if (!t) return null;

  const id = pickPrimaryId(merged);

  for (const rule of TYPED_PATH_RULES) {
    if (!rule.types.includes(t)) continue;
    return rule.path(merged, id);
  }
  return null;
}

/**
 * Single entry: explicit internal path → support ticket rules → typed `type` + id.
 */
export function resolveFcmNavigatePathFromData(
  data: Record<string, string> | undefined,
): string | null {
  if (!data || typeof data !== "object") return null;
  const merged = mergeFcmDataWithDetails({ ...data });

  const explicit = resolveExplicitInternalPathFromMerged(merged);
  if (explicit) return explicit;

  const support = resolveSupportTicketPathFromFcmData(merged);
  if (support) return support;

  return resolveTypedNotificationDeepLink(merged);
}

export function resolveFcmNavigatePathFromPayload(payload: {
  data?: Record<string, string>;
}): string | null {
  return resolveFcmNavigatePathFromData(payload.data);
}
