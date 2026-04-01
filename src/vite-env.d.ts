/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Base URL for relative profile image paths (no trailing slash required). */
  readonly VITE_IMAGE_URL?: string;
  /** ≥16 chars; used to encrypt auth payload in localStorage (required for prod build). */
  readonly VITE_SESSION_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
