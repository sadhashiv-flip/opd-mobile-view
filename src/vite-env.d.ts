/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Optional base for `POST /upload` (no trailing slash). Defaults to `VITE_API_BASE_URL`. */
  readonly VITE_API_UPLOAD_URL?: string;
  /** Base URL for relative profile image paths (no trailing slash required). */
  readonly VITE_IMAGE_URL?: string;
  /** ≥16 chars; used to encrypt auth payload in localStorage (required for prod build). */
  readonly VITE_SESSION_SECRET?: string;
  /** Nominatim `countrycodes` (e.g. `in`). Defaults to `in` in the address form. */
  readonly VITE_NOMINATIM_COUNTRY_CODES?: string;
  /** Google Maps JavaScript API key (Maps + Geocoder on the address form). */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Loader `region` bias (e.g. `in`). Defaults to `in`. */
  readonly VITE_GOOGLE_MAPS_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
