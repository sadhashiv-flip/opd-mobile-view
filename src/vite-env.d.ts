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
  /** Razorpay Key Id (public) for Checkout — never put Key Secret here. */
  readonly VITE_RAZORPAY_KEY_ID?: string;
  /** Checkout modal title. Defaults to "Gym membership". */
  readonly VITE_RAZORPAY_BUSINESS_NAME?: string;
  /** POST path for server to create a Razorpay order. Default: `payments/razorpay/create-order`. */
  readonly VITE_RAZORPAY_CREATE_ORDER_PATH?: string;
  /** POST path to verify payment signature after success. Default: `payments/razorpay/verify`. */
  readonly VITE_RAZORPAY_VERIFY_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
