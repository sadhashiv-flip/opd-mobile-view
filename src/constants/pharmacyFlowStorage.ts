import { readSelectedAddress } from "@/constants/selectedAddressStorage";

const KEY = "opd-mobile-view.pharmacy.flow.v1";

export type PharmacyFlowState = Readonly<{
  memberId: string;
  patientName: string;
  /** `POST /medicine` payload `patient_id`. */
  patientId: number;
  /**
   * Last delivery address used in the pharmacy flow; kept in sync with the location strip
   * ({@link readSelectedAddress}) when the user changes address on `/pharmacy`.
   */
  addressId?: string;
}>;

function safeParse(raw: string | null): PharmacyFlowState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const memberId = typeof o.memberId === "string" ? o.memberId : "";
    const patientName = typeof o.patientName === "string" ? o.patientName : "";
    const pidRaw = o.patientId;
    const patientId =
      typeof pidRaw === "number" && Number.isFinite(pidRaw)
        ? pidRaw
        : typeof pidRaw === "string"
          ? Number(pidRaw)
          : NaN;
    if (!memberId || !patientName || !Number.isFinite(patientId)) return null;
    const aidRaw = o.addressId;
    const addressId =
      typeof aidRaw === "string" && aidRaw.trim().length > 0 ? aidRaw.trim() : undefined;
    const base = { memberId, patientName, patientId } as const;
    return addressId ? { ...base, addressId } : base;
  } catch {
    return null;
  }
}

export function readPharmacyFlowState(): PharmacyFlowState | null {
  try {
    return safeParse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function writePharmacyFlowState(next: PharmacyFlowState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearPharmacyFlowState(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * `address_id` for `POST /medicine`: prefer global selection (matches the location strip and
 * {@link ensureDefaultSelectedAddressIfNeeded}); fall back to flow snapshot if nothing is stored.
 */
export function resolvePharmacyOrderAddressId(flow: PharmacyFlowState | null): string | null {
  const fromStore = readSelectedAddress()?.id?.trim();
  if (fromStore) return fromStore;
  const fromFlow = flow?.addressId?.trim();
  return fromFlow || null;
}
