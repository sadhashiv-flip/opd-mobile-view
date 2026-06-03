import { patientFetchChecked, patientJson } from "@/api/patientHttp";
import { asRecord, pickStr } from "@/lib/medicalRecordRow";

export type WellnessTypeOption = Readonly<{ value: string; label: string }>;

export type WellnessSessionSubmitResult = Readonly<{
  message: string;
  invoiceId: string;
  orderId: string;
}>;

function parseWellnessTypeList(raw: unknown): WellnessTypeOption[] {
  const fromArray = (arr: unknown[]): WellnessTypeOption[] =>
    arr.map((item, i) => {
      if (typeof item === "string") {
        const t = item.trim();
        return { value: t, label: t };
      }
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        return { value: `item-${i}`, label: String(item) };
      }
      const o = item as Record<string, unknown>;
      const label = String(
        o.name ?? o.title ?? o.label ?? o.type ?? o.service_area ?? `Option ${i + 1}`,
      ).trim();
      const value = String(o.value ?? o.id ?? o.key ?? o.code ?? label).trim();
      return { value: value || label, label: label || value };
    });

  if (Array.isArray(raw)) return fromArray(raw);
  const rec = asRecord(raw);
  if (!rec) return [];
  const nested = rec.data ?? rec.types ?? rec.items ?? rec.results;
  if (Array.isArray(nested)) return fromArray(nested);
  return [];
}

/** Maps for picking ids — mirrors Flutter `WellnessSessionResponse._mapsForPick`. */
function mapsForPick(json: Record<string, unknown>): Array<Record<string, unknown> | null> {
  const out: Array<Record<string, unknown> | null> = [];
  const add = (m: Record<string, unknown> | null) => {
    if (m && Object.keys(m).length > 0) out.push(m);
  };
  const addNested = (parent: Record<string, unknown> | null) => {
    if (!parent) return;
    add(asRecord(parent.service));
    add(asRecord(parent.invoice));
    add(asRecord(parent.order));
    add(asRecord(parent.booking));
    add(asRecord(parent.session));
  };
  const dm = asRecord(json.data);
  if (dm) {
    addNested(dm);
    add(dm);
  }
  const dr = json.data;
  if (Array.isArray(dr)) {
    for (const item of dr) {
      const em = asRecord(item);
      addNested(em);
      add(em);
    }
  }
  add(json);
  return out;
}

function pickFromMaps(maps: Array<Record<string, unknown> | null>, keys: string[]): string {
  for (const m of maps) {
    if (!m) continue;
    for (const k of keys) {
      const s = pickStr(m[k]);
      if (s && s !== "null") return s;
    }
  }
  return "";
}

function parseWellnessSessionResponse(raw: unknown): WellnessSessionSubmitResult {
  const json = asRecord(raw) ?? {};
  const maps = mapsForPick(json);
  let invoiceId = pickFromMaps(maps, [
    "invoice_id",
    "invoiceId",
    "invoice",
    "patient_invoice_id",
    "patientInvoiceId",
  ]);
  if (!invoiceId) {
    const dm = asRecord(json.data);
    const dr = json.data;
    const invoiceMaps: Array<Record<string, unknown> | null> = [asRecord(dm?.invoice)];
    if (Array.isArray(dr)) {
      for (const item of dr) {
        invoiceMaps.push(asRecord(asRecord(item)?.invoice));
      }
    }
    invoiceId = pickFromMaps(invoiceMaps, ["invoice_id", "invoiceId", "id"]);
  }
  const orderId = pickFromMaps(maps, ["order_id", "orderId", "service_id", "serviceId"]);
  const message = pickStr(json.message) || "";
  return { message, invoiceId, orderId };
}

/** GET /patient/mental_wellness/type — categories for Mental Wellness only. */
export async function fetchMentalWellnessTypes(): Promise<WellnessTypeOption[]> {
  const raw = await patientJson<unknown>("mental_wellness/type", { method: "GET" });
  return parseWellnessTypeList(raw);
}

/** POST /patient/wellness/session */
export async function postWellnessSession(
  payload: Record<string, unknown>,
): Promise<WellnessSessionSubmitResult> {
  const raw = await patientFetchChecked("wellness/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  let body: unknown = raw;
  try {
    body = await raw.json();
  } catch {
    /* non-json */
  }
  return parseWellnessSessionResponse(body);
}
