/** Persists `bills` + `billDraft` while the checklist route replaces `ClaimNewPage` (state would otherwise reset). */
export const CLAIM_CHECKLIST_ESCROW_STORAGE_KEY = "fh_claim_checklist_escrow_v1";

export function clearClaimChecklistEscrow(): void {
  try {
    globalThis.sessionStorage?.removeItem(CLAIM_CHECKLIST_ESCROW_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type EscrowChecklistFile = Readonly<Record<string, unknown>>;

function cloneFilesBySlot(
  src: Readonly<Record<string, readonly EscrowChecklistFile[]>>,
): Record<string, EscrowChecklistFile[]> {
  const out: Record<string, EscrowChecklistFile[]> = {};
  for (const [k, list] of Object.entries(src)) {
    out[k] = list.map((f) => ({ ...f }));
  }
  return out;
}

/** Merges in-progress checklist uploads into escrow before leaving the checklist route (e.g. Back). */
export function mergeClaimChecklistEscrowProgress(
  localBillId: string,
  filesBySlot: Readonly<Record<string, readonly EscrowChecklistFile[]>>,
): void {
  const id = localBillId.trim();
  if (!id) return;
  try {
    const raw = globalThis.sessionStorage?.getItem(CLAIM_CHECKLIST_ESCROW_STORAGE_KEY);
    if (!raw?.trim()) return;
    const v = JSON.parse(raw) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) return;
    const o = v as Record<string, unknown>;
    const mergedSlots = cloneFilesBySlot(filesBySlot);
    const patchBill = (bill: unknown): unknown => {
      if (bill === null || typeof bill !== "object" || Array.isArray(bill)) return bill;
      const b = bill as Record<string, unknown>;
      if (String(b.localId ?? "").trim() !== id) return bill;
      return { ...b, checklistFilesBySlot: mergedSlots };
    };
    const next: Record<string, unknown> = { ...o };
    next.billDraft = patchBill(o.billDraft);
    if (Array.isArray(o.bills)) {
      next.bills = (o.bills as unknown[]).map((row) => patchBill(row));
    }
    globalThis.sessionStorage?.setItem(CLAIM_CHECKLIST_ESCROW_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
