import { CONSULT_QR_COPY } from "@/constants/consultationQrCopy";
import {
  GET_USER_MEDIA_ERRORS,
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
