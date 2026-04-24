/**
 * Reimbursement claim status codes — aligned with Flutter `flip_health`
 * `ClaimsController.statusFilters` / `ClaimStatusConfig.fromStatus`.
 */
export const CLAIM_STATUS = {
  ALL: -1,
  /** Submitted */
  SUBMITTED: 0,
  /** Settled */
  SETTLED: 1,
  /** Denied */
  DENIED: 2,
  /** Action required (e.g. missing documents) */
  ACTION_REQUIRED: 3,
  /** In review */
  IN_REVIEW: 4,
  /** Approved */
  APPROVED: 5,
  /** Waiting approval */
  WAITING_APPROVAL: 6,
  /** Disputed */
  DISPUTED: 7,
  /** Pending disbursement */
  PENDING_DISBURSEMENT: 8,
} as const;

export type ClaimStatusFilter = Readonly<{
  status: number;
  label: string;
  /** CSS color for chips / hero */
  color: string;
}>;

/** Filter chips for list page (matches Dart `statusFilters`). */
export const CLAIM_STATUS_FILTERS: readonly ClaimStatusFilter[] = [
  { status: CLAIM_STATUS.ALL, label: "All", color: "#607D8B" },
  { status: CLAIM_STATUS.SUBMITTED, label: "Submitted", color: "#2196F3" },
  { status: CLAIM_STATUS.IN_REVIEW, label: "In Review", color: "#FF9800" },
  { status: CLAIM_STATUS.ACTION_REQUIRED, label: "Action Required", color: "#E53935" },
  { status: CLAIM_STATUS.APPROVED, label: "Approved", color: "#4CAF50" },
  { status: CLAIM_STATUS.PENDING_DISBURSEMENT, label: "Pending Disbursement", color: "#00BCD4" },
  { status: CLAIM_STATUS.SETTLED, label: "Settled", color: "#43A047" },
  { status: CLAIM_STATUS.DENIED, label: "Denied", color: "#D32F2F" },
  { status: CLAIM_STATUS.DISPUTED, label: "Disputed", color: "#FF5722" },
];

export type ClaimBadgeVariant =
  | "submitted"
  | "review"
  | "action"
  | "approved"
  | "settled"
  | "denied"
  | "disputed"
  | "pendingPay"
  | "muted";

/**
 * Primary label + badge style for list/detail (Dart `ClaimStatusConfig`).
 */
export function claimStatusBadge(
  statusCode: number | null,
  statusLabel: string | null,
): { text: string; variant: ClaimBadgeVariant } {
  const c = statusCode;
  if (c === CLAIM_STATUS.SUBMITTED) return { text: "Submitted", variant: "submitted" };
  if (c === CLAIM_STATUS.SETTLED) return { text: "Settled", variant: "settled" };
  if (c === CLAIM_STATUS.DENIED) return { text: "Denied", variant: "denied" };
  if (c === CLAIM_STATUS.ACTION_REQUIRED) return { text: "Action Required", variant: "action" };
  if (c === CLAIM_STATUS.IN_REVIEW) return { text: "In Review", variant: "review" };
  if (c === CLAIM_STATUS.APPROVED) return { text: "Approved", variant: "approved" };
  if (c === CLAIM_STATUS.WAITING_APPROVAL) return { text: "Waiting Approval", variant: "review" };
  if (c === CLAIM_STATUS.DISPUTED) return { text: "Disputed", variant: "disputed" };
  if (c === CLAIM_STATUS.PENDING_DISBURSEMENT) return { text: "Pending Disbursement", variant: "pendingPay" };
  if (c != null && Number.isFinite(c)) return { text: `Status ${c}`, variant: "muted" };
  const lbl = statusLabel?.trim();
  if (lbl) return { text: lbl, variant: "muted" };
  return { text: "Submitted", variant: "submitted" };
}

/** Hero gradient — Dart uses solid `config.color` with slight alpha variation. */
export function claimHeroGradientCss(statusCode: number | null): string {
  const b = claimStatusBadge(statusCode, null);
  const colors: Record<ClaimBadgeVariant, string> = {
    submitted: "#2196F3",
    review: "#FF9800",
    action: "#E53935",
    approved: "#4CAF50",
    settled: "#43A047",
    denied: "#D32F2F",
    disputed: "#FF5722",
    pendingPay: "#00BCD4",
    muted: "#607D8B",
  };
  const top = colors[b.variant] ?? colors.muted;
  return `linear-gradient(180deg, ${top} 0%, ${top}dd 55%, ${top}cc 100%)`;
}

/** Show approved amount in header (Dart: status 1, 5, 8). */
export function claimShouldShowApprovedAmount(statusCode: number | null): boolean {
  const c = statusCode;
  return c === CLAIM_STATUS.SETTLED || c === CLAIM_STATUS.APPROVED || c === CLAIM_STATUS.PENDING_DISBURSEMENT;
}

/** Accent for timeline dots (matches filter chip colors). */
export function claimStatusTimelineColor(statusCode: number | null): string {
  if (statusCode == null || !Number.isFinite(statusCode)) return "#FF9800";
  const row = CLAIM_STATUS_FILTERS.find((f) => f.status === statusCode);
  return row?.color ?? "#607D8B";
}
