/**
 * Forward / reverse geocode (OpenStreetMap Nominatim).
 * Respect usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_HEADERS: HeadersInit = {
  Accept: "application/json",
};

export type NominatimSuggestion = Readonly<{
  lat: number;
  lon: number;
  displayName: string;
  /** Best-effort for form autofill */
  line1: string;
  city: string;
  state: string;
  postcode: string;
}>;

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function numFromCell(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") return Number.parseFloat(v);
  return Number.NaN;
}

function parseRow(row: Record<string, unknown>): NominatimSuggestion | null {
  const lat = numFromCell(row.lat);
  const lon = numFromCell(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const addr = asRecord(row.address);
  let line1 = "";
  let city = "";
  let state = "";
  let postcode = "";

  if (addr) {
    const house = str(addr.house_number);
    const road =
      str(addr.road) ||
      str(addr.pedestrian) ||
      str(addr.path) ||
      str(addr.neighbourhood) ||
      str(addr.suburb);
    line1 = [house, road].filter(Boolean).join(" ").trim();
    city =
      str(addr.city) ||
      str(addr.town) ||
      str(addr.village) ||
      str(addr.municipality) ||
      str(addr.city_district) ||
      str(addr.county);
    state = str(addr.state) || str(addr.region) || str(addr.province);
    postcode = str(addr.postcode);
  }

  let displayName =
    typeof row.display_name === "string" ? row.display_name.trim() : "";
  if (!displayName && addr) {
    displayName = [line1, city, state, postcode].filter(Boolean).join(", ");
  }
  if (!displayName) {
    displayName = `${lat}, ${lon}`;
  }

  if (!line1) {
    line1 = displayName.split(",").slice(0, 2).join(", ").trim() || displayName;
  }

  return {
    lat,
    lon,
    displayName,
    line1,
    city,
    state,
    postcode,
  };
}

export type NominatimSearchOptions = Readonly<{
  /** Nominatim `viewbox`: minLon,maxLat,maxLon,minLat — use with `bounded` */
  viewbox?: string;
  /** ISO 3166-1alpha2 codes, comma-separated (e.g. `in`) */
  countrycodes?: string;
}>;

/** Returns up to `limit` suggestions (default 8). */
export async function nominatimSearchSuggestions(
  query: string,
  limit = 8,
  options?: NominatimSearchOptions,
): Promise<NominatimSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    format: "json",
    q,
    limit: String(limit),
    addressdetails: "1",
  });
  const cc = options?.countrycodes?.trim();
  if (cc) params.set("countrycodes", cc);
  const vb = options?.viewbox?.trim();
  if (vb) {
    params.set("viewbox", vb);
    params.set("bounded", "1");
  }
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseRow(item as Record<string, unknown>))
    .filter((x): x is NominatimSuggestion => x != null);
}

/** Reverse geocode a point into structured address fields when available. */
export async function nominatimReverse(
  lat: number,
  lon: number,
): Promise<NominatimSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const params = new URLSearchParams({
    format: "json",
    lat: String(lat),
    lon: String(lon),
    addressdetails: "1",
  });
  const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  const row = asRecord(await res.json());
  if (!row || str(row.error)) return null;
  return parseRow(row);
}

/** First result only (legacy). */
export async function nominatimSearch(
  query: string,
): Promise<{ lat: number; lon: number; displayName: string } | null> {
  const list = await nominatimSearchSuggestions(query, 1);
  const first = list[0];
  if (!first) return null;
  return { lat: first.lat, lon: first.lon, displayName: first.displayName };
}
