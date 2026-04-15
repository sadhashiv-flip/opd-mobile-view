/** Persists `bills` + `billDraft` while the checklist route replaces `ClaimNewPage` (state would otherwise reset). */
export const CLAIM_CHECKLIST_ESCROW_STORAGE_KEY = "fh_claim_checklist_escrow_v1";

export function clearClaimChecklistEscrow(): void {
  try {
    globalThis.sessionStorage?.removeItem(CLAIM_CHECKLIST_ESCROW_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
