/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /**
   * Optional server root for `POST /upload` (no trailing slash), e.g. `http://localhost:2017`.
   * Not `{...}/patient` — upload is `{this}/upload`, not `{...}/patient/upload`.
   * If unset, `patient` is stripped from `VITE_API_BASE_URL` when it ends with `/patient`.
   */
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
  /** POST gym opt-in / enrolment. Default: `gym/optIn`. */
  readonly VITE_GYM_OPTIN_PATH?: string;
  /**
   * Gym payment resource base (no trailing slash), e.g. `gym/payment`.
   * Used for `PATCH {base}/:invoice_id?useWallet=&status=confirm` like `offline/appointment/payment/:id`.
   */
  readonly VITE_GYM_PAYMENT_PATH?: string;
  /**
   * Override POST URL to open checkout when there is no invoice yet.
   * Default: same as {@link VITE_GYM_PAYMENT_PATH} / `gym/payment` (`POST gym/payment`).
   * Set to `gym/payment_init` only if the server still exposes that route.
   */
  readonly VITE_GYM_PAYMENT_INIT_PATH?: string;
  /**
   * POST verify after Razorpay — body `{ invoice_id, payment_id }`. Default: `gym/payment_verify`.
   */
  readonly VITE_GYM_PAYMENT_VERIFY_PATH?: string;
  /** @deprecated Prefer `PATCH` on {@link VITE_GYM_PAYMENT_PATH}/:id?status=confirm. Kept for env override only. */
  readonly VITE_GYM_PAYMENT_CONFIRM_PATH?: string;
  /**
   * WebSocket URL for video consultation signaling (e.g. API Gateway `wss://…/production`).
   * Required to open the video call screen; join REST still uses {@link VITE_API_BASE_URL}.
   */
  readonly VITE_SOCKET_URL?: string;
  /** Firebase Web SDK — same values as Flutter `firebase_options.dart` (not service-account JSON). */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Google Analytics / Firebase Analytics (optional). */
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
