const KEY = "opd-mobile-view.selectedAddress.v1";

/** Shown when no address exists from GET /patient/address + selection (never use fake static text). */
export const ADD_DELIVERY_ADDRESS_PROMPT = "Add delivery address";

/** Fallback for {@link useSelectedAddressLine} — empty; UI uses {@link ADD_DELIVERY_ADDRESS_PROMPT}. */
export const DEFAULT_LOCATION_ADDRESS_LINE = "";

export type SelectedAddressSnapshot = Readonly<{
  id: string;
  displayLine: string;
  /** e.g. HOME, WORK — shown in location strips when set */
  tag?: string;
}>;

const listeners = new Set<() => void>();

/** Subscribe to changes from {@link writeSelectedAddress} (same tab). */
export function subscribeSelectedAddress(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function notifySelectedAddressListeners(): void {
  for (const fn of listeners) fn();
}

/**
 * Stable primitive for {@link useSyncExternalStore} — {@link readSelectedAddress} builds a new object on every call,
 * which must not be used directly as `getSnapshot` (new reference each time → infinite re-renders).
 */
export function getSelectedAddressSyncSnapshot(): string {
  const s = readSelectedAddress();
  if (!s) return "";
  const tagNorm = s.tag?.trim() ? s.tag.trim().toUpperCase() : "HOME";
  return `${s.id}\u001e${tagNorm}`;
}

export function readSelectedAddress(): SelectedAddressSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const displayLine = typeof o.displayLine === "string" ? o.displayLine : "";
    if (!id || !displayLine) return null;
    const tagRaw = o.tag;
    const tag =
      typeof tagRaw === "string" && tagRaw.trim().length > 0 ? tagRaw.trim() : undefined;
    return tag ? { id, displayLine, tag } : { id, displayLine };
  } catch {
    return null;
  }
}

export function writeSelectedAddress(snapshot: SelectedAddressSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota / private mode
  }
  notifySelectedAddressListeners();
}
