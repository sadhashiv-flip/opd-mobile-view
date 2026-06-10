import { CONSULT_QR_COPY } from "@/constants/consultationQrCopy";
import {
  GET_USER_MEDIA_ERRORS,
  getCameraAccessBlockReason,
  getSuggestedSecureDevUrl,
  getUserMediaCompat,
} from "@/lib/getUserMediaCompat";

export type CameraAccessFailureReason =
  | "unsupported"
  | "insecure"
  | "denied"
  | "not_found"
  | "error";

export type CameraAccessResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: CameraAccessFailureReason; message: string }>;

function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}

function insecureCameraMessage(): string {
  const secureUrl = getSuggestedSecureDevUrl();
  if (secureUrl) {
    return `${CONSULT_QR_COPY.cameraRequiresHttps} ${secureUrl}`;
  }
  return CONSULT_QR_COPY.cameraRequiresHttps;
}

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

/** Best-effort preflight; falls back to `unknown` when Permissions API is unavailable. */
export async function queryCameraPermissionState(): Promise<CameraPermissionState> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Requests camera access when needed (patient_app `PermissionService.requestCameraPermission`).
 * Skips `getUserMedia` when permission is already granted; surfaces denied without a silent fail.
 */
export async function ensureCameraAccess(): Promise<CameraAccessResult> {
  const preflight = getCameraAccessBlockReason();
  if (preflight) {
    return mapPreflightError(preflight);
  }

  const state = await queryCameraPermissionState();
  if (state === "granted") {
    return { ok: true };
  }
  if (state === "denied") {
    return {
      ok: false,
      reason: "denied",
      message: CONSULT_QR_COPY.cameraPermissionDenied,
    };
  }

  return requestCameraAccess();
}

function mapPreflightError(code: string): CameraAccessResult {
  if (code === GET_USER_MEDIA_ERRORS.SECURE_CONTEXT_REQUIRED) {
    return {
      ok: false,
      reason: "insecure",
      message: insecureCameraMessage(),
    };
  }
  return {
    ok: false,
    reason: "unsupported",
    message: CONSULT_QR_COPY.cameraNotSupported,
  };
}

/**
 * Prompts for camera permission via `getUserMedia` (patient_app `PermissionService.requestCameraPermission`).
 * Stops tracks immediately so scanners like html5-qrcode can open their own stream.
 */
export async function requestCameraAccess(): Promise<CameraAccessResult> {
  let stream: MediaStream | null = null;
  try {
    try {
      stream = await getUserMediaCompat({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === GET_USER_MEDIA_ERRORS.SECURE_CONTEXT_REQUIRED) {
          return mapPreflightError(e.message);
        }
        if (e.message === GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED) {
          return mapPreflightError(e.message);
        }
      }
      const over =
        e instanceof DOMException &&
        (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError");
      if (over) {
        stream = await getUserMediaCompat({ video: true, audio: false });
      } else {
        throw e;
      }
    }
    stopStream(stream);
    return { ok: true };
  } catch (e) {
    stopStream(stream);
    if (e instanceof Error) {
      if (e.message === GET_USER_MEDIA_ERRORS.SECURE_CONTEXT_REQUIRED) {
        return mapPreflightError(e.message);
      }
      if (e.message === GET_USER_MEDIA_ERRORS.MEDIADEVICES_UNSUPPORTED) {
        return mapPreflightError(e.message);
      }
    }
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        ok: false,
        reason: "denied",
        message: CONSULT_QR_COPY.cameraPermissionDenied,
      };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return {
        ok: false,
        reason: "not_found",
        message: CONSULT_QR_COPY.cameraNotFound,
      };
    }
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : CONSULT_QR_COPY.cameraPermissionRequired,
    };
  }
}
