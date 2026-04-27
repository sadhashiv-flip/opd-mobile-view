/** Session draft for `/pharmacy/review` — mirrors Flutter `PharmacyOrderReviewScreen` arguments + payload hints. */

export type PharmacyReviewOrderKind = "OTC" | "UPLOAD" | "FLIPHEALTH";

export type PharmacyReviewUploadFile = Readonly<{
  fileName: string;
  isImage: boolean;
  isPdf: boolean;
  prescriptionId: string;
}>;

export type PharmacyReviewFlipRx = Readonly<{
  /** `POST /medicine` `prescription_id` for `FLIPHEALTH`. */
  apiPrescriptionId: string;
  doctorLabel: string;
  dateLabel: string;
  medicineCount: number;
  isChronic?: boolean;
}>;

export type PharmacyReviewDraft =
  | Readonly<{ kind: "OTC" }>
  | Readonly<{ kind: "UPLOAD"; files: readonly PharmacyReviewUploadFile[] }>
  | Readonly<{ kind: "FLIPHEALTH"; prescriptions: readonly PharmacyReviewFlipRx[] }>;

const KEY = "opd-mobile-view.pharmacy.reviewDraft.v1";

export function writePharmacyReviewDraft(next: PharmacyReviewDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readPharmacyReviewDraft(): PharmacyReviewDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const kind = o.kind;
    if (kind === "OTC") return { kind: "OTC" };
    if (kind === "UPLOAD" && Array.isArray(o.files)) {
      const files = (o.files as unknown[]).filter(Boolean) as PharmacyReviewUploadFile[];
      return { kind: "UPLOAD", files };
    }
    if (kind === "FLIPHEALTH" && Array.isArray(o.prescriptions)) {
      const prescriptions = (o.prescriptions as unknown[]).filter(Boolean) as PharmacyReviewFlipRx[];
      return { kind: "FLIPHEALTH", prescriptions };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPharmacyReviewDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
