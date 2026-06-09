/** Session stash for vision / dental / vaccine order detail when a post-payment refresh returns sparse data. */

const KEY_PREFIX = "opd-mobile-view.orderDetail.carryForward.";

function storageKey(invoiceId: string): string {
  return `${KEY_PREFIX}${invoiceId.trim()}`;
}

export function writeOrderDetailCarryForward(
  invoiceId: string,
  payload: Record<string, unknown>,
): void {
  const id = invoiceId.trim();
  if (!id) return;
  try {
    sessionStorage.setItem(storageKey(id), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function readOrderDetailCarryForward(invoiceId: string): Record<string, unknown> | null {
  const id = invoiceId.trim();
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function clearOrderDetailCarryForward(invoiceId: string): void {
  const id = invoiceId.trim();
  if (!id) return;
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    // ignore
  }
}
