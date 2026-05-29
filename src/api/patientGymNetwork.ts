import { patientJson } from "@/api/patientHttp";

export type GymNetworkCenter = Readonly<{
  id: string;
  name: string;
  displayAddress: string;
  coordinates: string;
}>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    const s = String(v).trim();
    return s.length ? s : null;
  }
  return null;
}

function statusOk(map: Record<string, unknown>): boolean {
  const status = map.status;
  return (
    status === true ||
    status === 1 ||
    String(status).toLowerCase() === "true" ||
    String(status) === "1" ||
    (status == null && map.data != null)
  );
}

/** Pull center rows from gym `network/list` envelopes (array `data` or nested `data.clnlist`). */
function extractGymCenterRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];

  const tryArray = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);

  const direct = tryArray(root.data);
  if (direct) return direct;

  const dataObj = asRecord(root.data);
  if (dataObj) {
    for (const key of [
      "clnlist",
      "clnList",
      "list",
      "centers",
      "networks",
      "network",
      "items",
      "rows",
      "results",
    ] as const) {
      const hit = tryArray(dataObj[key]);
      if (hit) return hit;
    }
    const nested = tryArray(dataObj.data);
    if (nested) return nested;
  }

  for (const key of ["list", "centers", "network", "items", "rows", "results"] as const) {
    const hit = tryArray(root[key]);
    if (hit) return hit;
  }

  return [];
}

function pickFirstStr(r: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = str(r[k]);
    if (v) return v;
  }
  const net = asRecord(r.network);
  if (net) {
    for (const k of keys) {
      const v = str(net[k]);
      if (v) return v;
    }
  }
  return null;
}

function resolvedAddress(r: Record<string, unknown>): string {
  const direct = pickFirstStr(r, [
    "display_address",
    "displayAddress",
    "practiceaddress",
    "practice_address",
    "address",
    "full_address",
    "location",
  ]);
  if (direct && !direct.startsWith("http")) return direct;

  const addr = asRecord(r.address);
  if (addr) {
    const parts = [
      str(addr.line1),
      str(addr.line2),
      str(addr.city),
      str(addr.state),
      str(addr.country),
      str(addr.pincode),
      str(addr.landmark),
    ].filter((x): x is string => Boolean(x));
    if (parts.length) return parts.join(", ");
  }

  const net = asRecord(r.network);
  if (net) {
    const fromNet = pickFirstStr(net, ["display_address", "address", "full_address"]);
    if (fromNet && !fromNet.startsWith("http")) return fromNet;
  }

  return direct ?? "";
}

function coordinatesFromRow(r: Record<string, unknown>): string {
  const coords = pickFirstStr(r, ["coordinates", "coordinate", "coords"]);
  if (coords && coords.includes(",")) return coords;

  const lat = pickFirstStr(r, ["latitude", "lat"]);
  const lng = pickFirstStr(r, ["longitude", "lng", "lon"]);
  if (lat && lng) return `${lat},${lng}`;

  const net = asRecord(r.network);
  if (net) {
    const netCoords = pickFirstStr(net, ["coordinates"]);
    if (netCoords && netCoords.includes(",")) return netCoords;
  }

  return "";
}

function normalizeGymCenter(raw: unknown, index: number): GymNetworkCenter | null {
  const r = asRecord(raw);
  if (!r) return null;

  const name =
    pickFirstStr(r, [
      "name",
      "practicename",
      "practice_name",
      "clinicname",
      "clinic_name",
      "center_name",
      "network_name",
      "providername",
    ]) ?? `Center ${index + 1}`;

  const id =
    pickFirstStr(r, [
      "id",
      "network_id",
      "networkId",
      "clinicid",
      "clinic_id",
      "clinicId",
      "providerid",
      "provider_id",
    ]) ?? `gym-center-${index}`;

  return {
    id,
    name,
    displayAddress: resolvedAddress(r),
    coordinates: coordinatesFromRow(r),
  };
}

/** `GET /network/list?service=gym&city=...` — matches Dart `GymRepository.fetchGymNetworkCenters`. */
export async function fetchGymNetworkCenters(city: string): Promise<readonly GymNetworkCenter[]> {
  const q = city.trim().toLowerCase();
  if (!q) {
    throw new Error("Select a city to load centers");
  }
  const raw = await patientJson<unknown>(
    `network/list?service=${encodeURIComponent("gym")}&city=${encodeURIComponent(q)}`,
    { method: "GET" },
  );
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid gym centers response");
  }

  const rows = extractGymCenterRows(raw);
  const centers = rows
    .map((row, i) => normalizeGymCenter(row, i))
    .filter((x): x is GymNetworkCenter => x !== null);

  if (centers.length > 0) {
    return centers;
  }

  const map = raw as Record<string, unknown>;
  if (!statusOk(map)) {
    throw new Error(String(map.message ?? "Failed to load gym centers"));
  }

  return centers;
}

export function directionsUriFromCoordinates(coordinates: string): string | null {
  const s = coordinates.trim();
  if (!s) return null;
  const parts = s.split(",");
  if (parts.length !== 2) return null;
  const lat = parts[0]?.trim();
  const lng = parts[1]?.trim();
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}
