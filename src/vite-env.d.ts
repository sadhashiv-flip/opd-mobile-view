/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Optional base for `POST /upload` (no trailing slash). Defaults to `VITE_API_BASE_URL`. */
  readonly VITE_API_UPLOAD_URL?: string;
  /** `app_name` header for `POST /upload` (e.g. document uploads). Defaults to `co-flip-health`. */
  readonly VITE_UPLOAD_APP_NAME?: string;
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
  /** POST gym payment init (returns payment_required, razorpay_payload, invoice_id). Default: `gym/payment_init`. */
  readonly VITE_GYM_PAYMENT_INIT_PATH?: string;
  /** POST verify after Razorpay success. Default: `gym/payment_verify`. */
  readonly VITE_GYM_PAYMENT_VERIFY_PATH?: string;
  /** POST free confirm when payment_required is false. Default: `gym/payment_confirm`. */
  readonly VITE_GYM_PAYMENT_CONFIRM_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
