import type { NetworkListDoctorRow } from "@/api/networkList";

const KEY = "opd-mobile-view.consultation.networkDoctorDetailEntry";

export type NetworkDoctorDetailEntry = Readonly<{
  doctor: NetworkListDoctorRow;
  specialtyId: string;
  specialtyLabel: string;
}>;

export function writeNetworkDoctorDetailEntry(entry: NetworkDoctorDetailEntry | null): void {
  try {
    if (!entry) {
      sessionStorage.removeItem(KEY);
      return;
    }
    sessionStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function readNetworkDoctorDetailEntry(): NetworkDoctorDetailEntry | null {
  try {
    const raw = sessionStorage.getItem(KEY)?.trim();
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<NetworkDoctorDetailEntry>;
    const doctor = p.doctor;
    if (!doctor || typeof doctor.id !== "string" || !doctor.id.trim()) return null;
    return {
      doctor: doctor as NetworkListDoctorRow,
      specialtyId: typeof p.specialtyId === "string" ? p.specialtyId : "",
      specialtyLabel: typeof p.specialtyLabel === "string" ? p.specialtyLabel : "",
    };
  } catch {
    return null;
  }
}
