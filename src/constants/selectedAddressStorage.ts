const KEY = "opd-mobile-view.selectedAddress.v1";

/** Shown in location strips when no saved selection exists yet. */
export const DEFAULT_LOCATION_ADDRESS_LINE =
  "Isprout, 7th floor, Plot No: 25, Divyasree trinity,";

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
