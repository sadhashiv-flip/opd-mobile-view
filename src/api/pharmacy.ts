import { patientFetchChecked } from "@/api/patientHttp";

export type MedicineOrderPrescription =
  | Readonly<{ type: "OTHER"; prescription_id: string }>
  | Readonly<{ type: "FLIPHEALTH"; prescription_id: string }>;

export type PostMedicineOrderPayload = Readonly<{
  address_id: string;
  prescriptions: readonly MedicineOrderPrescription[];
  patient_id: number;
}>;

/** Parsed `POST /medicine` body — aligns with Flutter `PharmacyOrderResponse`. */
export type MedicineOrderApiResult = Readonly<{
  message: string;
  orderId: string;
  invoiceId: string;
  patientNameFromApi: string | null;
}>;

function parseMedicineOrderJson(raw: unknown): MedicineOrderApiResult {
  const empty: MedicineOrderApiResult = {
    message: "",
    orderId: "",
    invoiceId: "",
    patientNameFromApi: null,
  };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const message = typeof o.message === "string" ? o.message : "";
  const data = o.data;
  if (!data || typeof data !== "object") {
    return { ...empty, message };
  }
  const d = data as Record<string, unknown>;
  const rawId = d.id;
  const rawInv = d.invoice_id;
  const orderId =
    typeof rawId === "string" || typeof rawId === "number"
      ? String(rawId).trim()
      : "";
  const invoiceId =
    typeof rawInv === "string" || typeof rawInv === "number"
      ? String(rawInv).trim()
      : "";
  let patientNameFromApi: string | null = null;
  const user = d.user;
  if (user && typeof user === "object") {
    const n = (user as Record<string, unknown>).name;
    if (typeof n === "string" && n.trim()) patientNameFromApi = n.trim();
  }
  return { message, orderId, invoiceId, patientNameFromApi };
}

/** POST `/medicine` — OTC uses `prescriptions: []`. Returns server summary when present. */
export async function postMedicineOrder(payload: PostMedicineOrderPayload): Promise<MedicineOrderApiResult> {
  const res = await patientFetchChecked("medicine", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!text.trim()) {
    return { message: "", orderId: "", invoiceId: "", patientNameFromApi: null };
  }
  try {
    return parseMedicineOrderJson(JSON.parse(text) as unknown);
  } catch {
    return { message: "", orderId: "", invoiceId: "", patientNameFromApi: null };
  }
}
