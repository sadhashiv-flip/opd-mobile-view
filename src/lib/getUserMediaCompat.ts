export const GET_USER_MEDIA_ERRORS = {
  MEDIADEVICES_UNSUPPORTED: "MEDIADEVICES_UNSUPPORTED",
  SECURE_CONTEXT_REQUIRED: "SECURE_CONTEXT_REQUIRED",
} as const;

function isLocalhostHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * When opened over `http://` on a LAN IP, returns the matching `https://` URL for mobile camera testing.
 */
export function getSuggestedSecureDevUrl(): string | null {
  if (typeof location === "undefined" || globalThis.isSecureContext) {
    return null;
  }
  const { hostname, port, pathname, search } = location;
  if (isLocalhostHost(hostname)) {
    return null;
  }
  const portSuffix = port ? `:${port}` : "";
  return `https://${hostname}${portSuffix}${pathname}${search}`;
}

/** True when the page can use camera APIs (secure origin or localhost). */
export function isCameraSecureContext(): boolean {
  if (globalThis.isSecureContext) return true;
  if (typeof location === "undefined") return false;
  return isLocalhostHost(location.hostname);
}

function hasModernGetUserMedia(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

function hasLegacyGetUserMedia(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    getUserMedia?: (
      c: MediaStreamConstraints,
      success: (s: MediaStream) => void,
      failure: (e: unknown) => void,
    ) => void;
  };
  return typeof nav.getUserMedia === "function";
}

/**
 * Why camera APIs are unavailable before calling `getUserMedia`.
 * Checks secure context first — on HTTP LAN URLs Edge hides `mediaDevices` entirely.
 */
export function getCameraAccessBlockReason():
  | typeof GET_USER_MEDIA_ERRORS.SECURE_CONTEXT_REQUIRED
  | typeof GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED
  | null {
  if (typeof navigator === "undefined") {
    return GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED;
  }
  if (!isCameraSecureContext()) {
    return GET_USER_MEDIA_ERRORS.SECURE_CONTEXT_REQUIRED;
  }
  if (hasModernGetUserMedia() || hasLegacyGetUserMedia()) {
    return null;
  }
  return GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED;
}

/**
 * `navigator.mediaDevices` is missing on insecure http (except localhost) and some WebViews.
 * Falls back to legacy `navigator.getUserMedia` when present.
 */
export function getUserMediaCompat(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const block = getCameraAccessBlockReason();
  if (block === GET_USER_MEDIA_ERRORS.SECURE_CONTEXT_REQUIRED) {
    return Promise.reject(new Error(GET_USER_MEDIA_ERRORS.SECURE_CONTEXT_REQUIRED));
  }
  if (block === GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED) {
    return Promise.reject(new Error(GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED));
  }

  const md = navigator.mediaDevices;
  if (md?.getUserMedia) {
    return md.getUserMedia(constraints);
  }

  const nav = navigator as Navigator & {
    getUserMedia?: (
      c: MediaStreamConstraints,
      success: (s: MediaStream) => void,
      failure: (e: unknown) => void,
    ) => void;
  };
  if (typeof nav.getUserMedia === "function") {
    return new Promise((resolve, reject) => {
      nav.getUserMedia!.call(navigator, constraints, resolve, reject);
    });
  }

  return Promise.reject(new Error(GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED));
}
