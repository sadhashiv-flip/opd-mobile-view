import type { ServiceRequestRiderUi } from "@/lib/serviceRequestOrderDetail";

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null;
  if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
    return null;
  }
  const s = String(v).trim();
  return s.length ? s : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** patient_app `_riderContactFromVisitorMap` — backend key names vary. */
export function riderContactFromVisitorMap(rider: Record<string, unknown>): string {
  for (const key of [
    "contact",
    "phone",
    "mobile",
    "mobile_no",
    "phone_number",
    "rider_phone",
    "rider_contact",
  ]) {
    const s = str(rider[key])?.trim();
    if (s) return s;
  }
  return "";
}

/**
 * patient_app `PharmacyOrderDetailScreen._showRider` — `HOME_DELIVERY` +
 * `info.additional_info.visitor_info` with name and contact.
 */
export function parsePharmacyRider(
  info: Record<string, unknown> | null | undefined,
): ServiceRequestRiderUi | null {
  if (info == null) return null;
  const visit = (str(info.visit_type) ?? "").trim().toUpperCase();
  if (visit !== "HOME_DELIVERY") return null;
  const infoAdd = asRecord(info.additional_info) ?? asRecord(info.additionalInfo);
  if (infoAdd == null) return null;
  const rider = asRecord(infoAdd.visitor_info) ?? asRecord(infoAdd.visitorInfo);
  if (rider == null) return null;
  const name = str(rider.name)?.trim() ?? "";
  const contact = riderContactFromVisitorMap(rider);
  if (!name || !contact) return null;
  return { name, contact };
}

/** patient_app `_showRider` — hide for `info.status` in 0–4. */
export function showPharmacyRiderCard(
  infoStatus: number | null | undefined,
  info: Record<string, unknown> | null | undefined,
): boolean {
  if (infoStatus != null && [0, 1, 2, 3, 4].includes(infoStatus)) return false;
  return parsePharmacyRider(info) != null;
}
