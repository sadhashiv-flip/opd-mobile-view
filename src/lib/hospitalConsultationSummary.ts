import type { NetworkSlotsPayload } from "@/api/networkSlots";
import type { HospitalVendorBookingContext } from "@/constants/consultationBookingStorage";
import { readHospitalVendorBookingContext } from "@/constants/consultationBookingStorage";

const DOCTOR_NAME_KEY = "opd-mobile-view.consultation.doctorName";
const DOCTOR_QUAL_KEY = "opd-mobile-view.consultation.doctorQualification";
const NETWORK_NAME_KEY = "opd-mobile-view.consultation.networkName";

export type HospitalConsultationSummaryDisplay = Readonly<{
  doctorName: string;
  doctorQualification: string;
  networkName: string;
}>;

function readLs(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeLs(key: string, value: string): void {
  try {
    const v = value.trim();
    if (v) localStorage.setItem(key, v);
  } catch {
    // ignore
  }
}

/** Persist doctor / clinic labels for overview (patient_app uses in-memory `selectedNetworkDoctor`). */
export function persistHospitalConsultationSummaryFields(
  fields: Partial<{
    doctorName: string;
    doctorQualification: string;
    networkName: string;
  }>,
): void {
  if (fields.doctorName != null) writeLs(DOCTOR_NAME_KEY, fields.doctorName);
  if (fields.doctorQualification != null) writeLs(DOCTOR_QUAL_KEY, fields.doctorQualification);
  if (fields.networkName != null) writeLs(NETWORK_NAME_KEY, fields.networkName);
}

export function persistHospitalConsultationSummaryFromSources(
  payload: NetworkSlotsPayload | null | undefined,
  vendorCtx: HospitalVendorBookingContext | null | undefined,
): void {
  persistHospitalConsultationSummaryFields({
    doctorName: payload?.doctor?.name ?? vendorCtx?.doctor.name ?? "",
    doctorQualification:
      payload?.doctor?.qualification ?? vendorCtx?.doctor.qualification ?? "",
    networkName:
      payload?.networkName ??
      payload?.displayAddress ??
      vendorCtx?.network.name ??
      "",
  });
}

/** Overview booking summary — vendor context first, then slots/localStorage. */
export function readHospitalConsultationSummaryDisplay(): HospitalConsultationSummaryDisplay {
  const vendorCtx = readHospitalVendorBookingContext();
  const doctorName =
    vendorCtx?.doctor.name?.trim() ||
    readLs(DOCTOR_NAME_KEY) ||
    "Doctor";
  const doctorQualification =
    vendorCtx?.doctor.qualification?.trim() ||
    readLs(DOCTOR_QUAL_KEY) ||
    "";
  const networkName =
    vendorCtx?.network.name?.trim() ||
    readLs(NETWORK_NAME_KEY) ||
    "";
  return { doctorName, doctorQualification, networkName };
}
