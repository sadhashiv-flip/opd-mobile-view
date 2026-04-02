import type { NominatimSuggestion } from "@/lib/nominatimGeocode";

/** Nominatim-style viewbox: `minLon,maxLat,maxLon,minLat` → Google bounds literal */
export function viewboxToLatLngBoundsLiteral(
  viewbox: string,
): google.maps.LatLngBoundsLiteral | undefined {
  const parts = viewbox.split(",").map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [west, north, east, south] = parts;
  return { west, north, east, south };
}

function componentLong(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
): string {
  if (!components?.length) return "";
  const c = components.find((x) => x.types.includes(type));
  return c?.long_name?.trim() ?? "";
}

export function geocoderResultToSuggestion(
  r: google.maps.GeocoderResult,
): NominatimSuggestion | null {
  const loc = r.geometry?.location;
  if (!loc) return null;
  const lat = loc.lat();
  const lng = loc.lng();
  const ac = r.address_components;
  const num = componentLong(ac, "street_number");
  const route = componentLong(ac, "route");
  let line1 = [num, route].filter(Boolean).join(" ").trim();
  const city =
    componentLong(ac, "locality") ||
    componentLong(ac, "sublocality_level_1") ||
    componentLong(ac, "administrative_area_level_2");
  const state = componentLong(ac, "administrative_area_level_1");
  const postcode = componentLong(ac, "postal_code");
  const displayName = (r.formatted_address ?? "").trim() || `${lat}, ${lng}`;
  if (!line1) {
    line1 = displayName.split(",").slice(0, 2).join(", ").trim() || displayName;
  }
  return {
    lat,
    lon: lng,
    displayName,
    line1,
    city,
    state,
    postcode,
  };
}

export type GoogleGeocodeSearchOptions = Readonly<{
  boundsLiteral?: google.maps.LatLngBoundsLiteral;
  /** ISO 3166-1 alpha-2 (first code used if comma-separated) */
  country?: string;
  maxResults?: number;
}>;

/** Forward geocode using the Maps JavaScript Geocoder (requires script loaded). */
export function googleMapsGeocodeSearch(
  query: string,
  options?: GoogleGeocodeSearchOptions,
): Promise<NominatimSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return Promise.resolve([]);
  const geocoder = new google.maps.Geocoder();
  const country = options?.country?.split(",")[0]?.trim().toLowerCase();
  const request: google.maps.GeocoderRequest = {
    address: q,
    bounds: options?.boundsLiteral,
  };
  if (country) {
    request.componentRestrictions = { country };
  }
  const max = Math.min(8, Math.max(1, options?.maxResults ?? 8));
  return new Promise((resolve) => {
    geocoder.geocode(request, (results, status) => {
      if (status !== "OK" || !results?.length) {
        resolve([]);
        return;
      }
      const out = results
        .map((r) => geocoderResultToSuggestion(r))
        .filter((x): x is NominatimSuggestion => x != null);
      resolve(out.slice(0, max));
    });
  });
}

/** Reverse geocode a point (requires script loaded). */
export function googleMapsReverseGeocode(
  lat: number,
  lng: number,
): Promise<NominatimSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null);
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null);
        return;
      }
      resolve(geocoderResultToSuggestion(results[0]));
    });
  });
}
