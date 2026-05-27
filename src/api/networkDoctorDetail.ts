import { patientJson } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";

export type DoctorReviewsSummary = Readonly<{
  recommendation: number;
  responseCount: number;
  percentage: number;
}>;

export type DoctorRegistration = Readonly<{
  number: string;
  year: string;
  councilName: string;
}>;

export type PracticeTimings = Readonly<{
  beginTime: string;
  endTime: string;
  availableDays: readonly string[];
  hoursLabel: string;
}>;

export type DoctorPractice = Readonly<{
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  geolocation: string;
  doctorPracticeTimings: string;
  doctorConsultationFee: string;
  timings: PracticeTimings | null;
  fullAddress: string;
  directionsUrl: string | null;
}>;

export type NetworkDoctorDetail = Readonly<{
  id: string;
  name: string;
  speciality: string;
  experience: string;
  photoUrl: string | null;
  specializations: readonly string[];
  qualifications: readonly string[];
  practices: readonly DoctorPractice[];
  bio: string;
  languages: readonly string[];
  registration: DoctorRegistration | null;
  reviews: DoctorReviewsSummary | null;
}>;

export type NetworkDoctorCustomerReview = Readonly<{
  reviewText: string;
  reviewedOn: string;
  anonymous: boolean;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseIntField(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function strList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => str(e)).filter(Boolean);
}

function practiceDirectionsUrl(geolocation: string): string | null {
  const s = geolocation.trim();
  if (!s.includes(",")) return null;
  const [lat, lng] = s.split(",").map((p) => p.trim());
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

function buildPracticeFullAddress(address: string, city: string, pincode: string): string {
  return [address, city, pincode].map((p) => p.trim()).filter(Boolean).join(", ");
}

function parsePracticeTimings(raw: unknown): PracticeTimings | null {
  const m = asRecord(raw);
  if (!m) return null;
  const beginTime = str(m.begin_time);
  const endTime = str(m.end_time);
  const availableDays = strList(m.available_days);
  let hoursLabel = "";
  if (beginTime && endTime) hoursLabel = `${beginTime} – ${endTime}`;
  else if (beginTime) hoursLabel = beginTime;
  else if (endTime) hoursLabel = endTime;
  return { beginTime, endTime, availableDays, hoursLabel };
}

function parsePractice(json: Record<string, unknown>): DoctorPractice {
  const address = str(json.address);
  const city = str(json.city);
  const pincode = str(json.pincode);
  const geolocation = str(json.geolocation);
  return {
    id: str(json.id),
    name: str(json.name),
    address,
    city,
    pincode,
    geolocation,
    doctorPracticeTimings: str(json.doctor_practice_timings),
    doctorConsultationFee: str(json.doctor_consultation_fee),
    timings: parsePracticeTimings(json.timings),
    fullAddress: buildPracticeFullAddress(address, city, pincode),
    directionsUrl: practiceDirectionsUrl(geolocation),
  };
}

function parseReviews(raw: unknown): DoctorReviewsSummary | null {
  const m = asRecord(raw);
  if (!m) return null;
  return {
    recommendation: parseIntField(m.recommendation),
    responseCount: parseIntField(m.response_count ?? m.responseCount),
    percentage: parseIntField(m.percentage),
  };
}

export function reviewsHasDisplayableData(reviews: DoctorReviewsSummary | null | undefined): boolean {
  if (!reviews) return false;
  return reviews.percentage > 0 || reviews.responseCount > 0 || reviews.recommendation > 0;
}

function unwrapDetailData(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  const inner = asRecord(root.data);
  if (inner) {
    const merged = { ...inner };
    if (!("reviews" in merged) && asRecord(root.reviews)) {
      merged.reviews = root.reviews;
    }
    const doctor = asRecord(root.doctor);
    if (!("reviews" in merged) && doctor && asRecord(doctor.reviews)) {
      merged.reviews = doctor.reviews;
    }
    return merged;
  }
  return root;
}

export function parseNetworkDoctorDetail(raw: unknown): NetworkDoctorDetail {
  const json = unwrapDetailData(raw);
  if (!json) {
    return {
      id: "",
      name: "",
      speciality: "",
      experience: "",
      photoUrl: null,
      specializations: [],
      qualifications: [],
      practices: [],
      bio: "",
      languages: [],
      registration: null,
      reviews: null,
    };
  }

  const practicesRaw = Array.isArray(json.practices) ? json.practices : [];
  const practices = practicesRaw
    .map((e) => asRecord(e))
    .filter((e): e is Record<string, unknown> => e != null)
    .map(parsePractice);

  const reg = asRecord(json.registration);
  const photoRaw = str(json.photo);
  const photoUrl = photoRaw ? resolveProfileImageUrl(photoRaw) : null;

  return {
    id: str(json.id),
    name: str(json.name),
    speciality: str(json.speciality),
    experience: str(json.experience),
    photoUrl,
    specializations: strList(json.specializations),
    qualifications: strList(json.qualifications),
    practices,
    bio: str(json.bio),
    languages: strList(json.languages),
    registration: reg
      ? {
          number: str(reg.number),
          year: str(reg.year),
          councilName: str(reg.council_name),
        }
      : null,
    reviews: parseReviews(json.reviews),
  };
}

export function initialPracticeSelection(
  detail: NetworkDoctorDetail,
  listNetworkId: string,
): string | null {
  if (detail.practices.length === 0) return null;
  if (detail.practices.length === 1) return detail.practices[0].id;
  const fromList = listNetworkId.trim();
  if (fromList) {
    const match = detail.practices.filter((p) => p.id === fromList);
    if (match.length === 1) return match[0].id;
  }
  return null;
}

export function formatPracticeDaysLabel(days: readonly string[]): string {
  if (days.length === 0) return "";
  return days
    .map((d) => {
      const t = d.trim();
      return t.length > 3 ? t.slice(0, 3).toLowerCase() : t.toLowerCase();
    })
    .join(", ");
}

export async function fetchNetworkDoctorDetail(
  doctorId: string,
  vendorCode: string,
): Promise<NetworkDoctorDetail> {
  const id = doctorId.trim();
  const code = vendorCode.trim();
  if (!id || !code) {
    throw new Error("Doctor or vendor information is missing.");
  }
  const raw = await patientJson<unknown>(
    `/patient/network/doctor/${encodeURIComponent(id)}?vendor_code=${encodeURIComponent(code)}`,
  );
  return parseNetworkDoctorDetail(raw);
}

export function parseNetworkDoctorCustomerReviews(raw: unknown): NetworkDoctorCustomerReview[] {
  const root = asRecord(raw);
  const data = root?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((e) => asRecord(e))
    .filter((e): e is Record<string, unknown> => e != null)
    .map((e) => ({
      reviewText: str(e.review_text),
      reviewedOn: str(e.reviewed_on),
      anonymous: e.anonymous === true,
    }))
    .filter((r) => r.reviewText.length > 0);
}

export async function fetchNetworkDoctorCustomerReviews(
  doctorId: string,
  vendorCode: string,
): Promise<NetworkDoctorCustomerReview[]> {
  const id = doctorId.trim();
  const code = vendorCode.trim();
  if (!id || !code) return [];
  const raw = await patientJson<unknown>(
    `/patient/network/doctor/${encodeURIComponent(id)}/reviews?vendor_code=${encodeURIComponent(code)}`,
  );
  return parseNetworkDoctorCustomerReviews(raw);
}
