import type { NetworkListDoctorRow } from "@/api/networkList";

/** `Speciality (3 yrs exp)` — patient_app `_OfflineDoctorCard._specialityWithExperience`. */
export function formatDoctorSpecialtyLine(
  specialtyLabel: string,
  expLabel: string,
): string {
  const spec = specialtyLabel.trim();
  const exp = expLabel.trim();
  if (!spec && !exp) return "";
  if (!spec) return exp ? `(${exp})` : "";
  if (!exp) return spec;
  return `${spec} (${exp})`;
}

/** Port of Dart `VendorMeta.availabilityLabel` from `vendor_meta.timings`. */
export function parseVendorAvailabilityLabel(
  timings: string,
  reference: Date = new Date(),
): string | null {
  const raw = timings.trim();
  if (!raw) return null;

  const pattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  const dayKeys = new Set<string>();
  for (const match of raw.matchAll(pattern)) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    dayKeys.add(`${year}-${month}-${day}`);
  }
  if (dayKeys.size === 0) return null;

  const sorted = [...dayKeys].sort();
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const toDay = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const days = sorted.map(toDay);
  if (days.some((d) => d.getTime() === today.getTime())) return "Available Today";
  if (days.some((d) => d.getTime() === tomorrow.getTime())) return "Available Tomorrow";

  for (const d of days) {
    if (d.getTime() > today.getTime()) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `Available on ${dd}/${mm}/${d.getFullYear()}`;
    }
  }
  return null;
}

export function resolveDoctorAvailabilityLabel(d: NetworkListDoctorRow): string | null {
  const fromVendor = d.vendorMeta?.timings
    ? parseVendorAvailabilityLabel(d.vendorMeta.timings)
    : null;
  return fromVendor;
}

export function resolveConsultationFeeDisplay(d: NetworkListDoctorRow): number | null {
  if (d.vendorMeta?.price != null && d.vendorMeta.price > 0) return d.vendorMeta.price;
  if (d.consultationFee > 0) return d.consultationFee;
  return null;
}

/** Google Maps directions — Dart `NetworkInfo.directionsUri`. */
export function networkDirectionsUrl(coordinates: string): string | null {
  const c = coordinates.trim();
  if (!c.includes(",")) return null;
  const [lat, lng] = c.split(",").map((s) => s.trim());
  if (!lat || !lng || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function isFemaleGender(gender: string): boolean {
  return gender.trim().toLowerCase() === "female";
}
