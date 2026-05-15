import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/useToast";
import "./ProfilePhotoSourceSheet.css";

export type ProfilePhotoSourceSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Called with a chosen image file (camera capture or file picker). Parent uploads to API. */
  onPicked: (file: File) => void;
}>;

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const n = file.name.toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(n);
}

function IconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9h2l1.5-2h9L18 9h2a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const t of stream.getTracks()) {
    t.stop();
  }
}

/** `getUserMedia` works only in a secure context in modern browsers. */
function canUseLiveCamera(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia) && globalThis.isSecureContext;
}

/**
 * `enumerateDevices()` often returns no `videoinput` until the user has granted
 * camera permission once, so we also treat touch / narrow viewports as likely
 * camera-capable and still offer "Take a picture" (fails gracefully if absent).
 */
function likelyHasPhysicalCamera(devices: MediaDeviceInfo[]): boolean {
  return devices.some((d) => d.kind === "videoinput");
}

/** Phone / tablet: offer "Take a picture" even when enumerateDevices is empty (pre-permission) or over HTTP. */
function isLikelyPhoneOrTablet(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.maxTouchPoints > 0) return true;
  if (typeof globalThis.matchMedia === "function") {
    if (globalThis.matchMedia("(pointer: coarse)").matches) return true;
    if (globalThis.matchMedia("(max-width: 768px)").matches) return true;
  }
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

async function waitForVideoFrameSize(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  if (video.videoWidth >= 2 && video.videoHeight >= 2) return;
  await new Promise<void>((resolve, reject) => {
    const t = globalThis.setTimeout(() => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("loadedmetadata", onReady);
      reject(new Error("Camera preview is not ready yet."));
    }, timeoutMs);
    const onReady = () => {
      if (video.videoWidth >= 2 && video.videoHeight >= 2) {
        globalThis.clearTimeout(t);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("loadedmetadata", onReady);
        resolve();
      }
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("loadedmetadata", onReady);
    onReady();
  });
}

type ImageCaptureCtor = new (track: MediaStreamTrack) => {
  takePhoto?: () => Promise<Blob>;
};

async function videoFrameToJpegFile(
  video: HTMLVideoElement,
  videoTrack: MediaStreamTrack,
): Promise<File | null> {
  const g = globalThis as typeof globalThis & { ImageCapture?: ImageCaptureCtor };
  const ImageCaptureClass = g.ImageCapture;
  if (ImageCaptureClass && typeof ImageCaptureClass === "function") {
    try {
      const ic = new ImageCaptureClass(videoTrack);
      if (typeof ic.takePhoto === "function") {
        const blob = await ic.takePhoto();
        if (blob && blob.size > 0) {
          const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
          return new File([blob], `profile-${Date.now()}.jpg`, { type });
        }
      }
    } catch {
      /* fall through to canvas */
    }
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 2 || h < 2) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size < 1) {
          resolve(null);
          return;
        }
        resolve(new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.88,
    );
  });
}

/**
 * Bottom sheet: update profile photo from camera (live capture → file → parent upload) or from files.
 */
export function ProfilePhotoSourceSheet({ open, onClose, onPicked }: ProfilePhotoSourceSheetProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Opens the OS camera app when live `getUserMedia` preview is not available (e.g. HTTP dev URL on phone). */
  const cameraCaptureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Show "Take a picture": live preview when possible, else native capture input on mobile. */
  const [cameraAvailable, setCameraAvailable] = useState(
    () => isLikelyPhoneOrTablet() || canUseLiveCamera(),
  );
  const [cameraPermissionBusy, setCameraPermissionBusy] = useState(false);
  const [inlineCaptureStream, setInlineCaptureStream] = useState<MediaStream | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setCameraPermissionBusy(false);
      setCaptureBusy(false);
      setInlineCaptureStream((s) => {
        if (s) stopMediaStream(s);
        return null;
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const mobileOrTablet = isLikelyPhoneOrTablet();

    if (!canUseLiveCamera()) {
      // HTTP / non-secure: still offer native camera via `<input capture>` on phones.
      setCameraAvailable(mobileOrTablet);
      return () => {
        cancelled = true;
      };
    }

    const md = navigator.mediaDevices;
    if (!md?.enumerateDevices) {
      setCameraAvailable(mobileOrTablet || true);
      return () => {
        cancelled = true;
      };
    }

    void md
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        if (likelyHasPhysicalCamera(devices)) {
          setCameraAvailable(true);
          return;
        }
        setCameraAvailable(mobileOrTablet);
      })
      .catch(() => {
        if (!cancelled) setCameraAvailable(mobileOrTablet || true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = inlineCaptureStream;
    if (!video) return;
    if (!stream) {
      video.srcObject = null;
      return;
    }
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [inlineCaptureStream]);

  const discardInlineCapture = useCallback(() => {
    setInlineCaptureStream((s) => {
      if (s) stopMediaStream(s);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (inlineCaptureStream) {
        discardInlineCapture();
        return;
      }
      onClose();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [open, onClose, inlineCaptureStream, discardInlineCapture]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isLikelyImageFile(file)) return;
    onPicked(file);
    onClose();
  };

  const requestCameraAndShowPreview = useCallback(async () => {
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) {
      toast.error("Camera is not available in this browser.");
      return;
    }
    if (!globalThis.isSecureContext) {
      toast.error("Live camera preview needs HTTPS. Use “Take a picture” on a secure site, or choose an image.");
      return;
    }

    setCameraPermissionBusy(true);
    let stream: MediaStream | null = null;
    try {
      try {
        stream = await md.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        const over =
          e instanceof DOMException &&
          (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError");
        if (over) {
          stream = await md.getUserMedia({ video: true, audio: false });
        } else {
          throw e;
        }
      }
      setInlineCaptureStream(stream);
    } catch (e) {
      stopMediaStream(stream);
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        toast.error(
          "Camera access was denied. Allow camera permission in your browser settings to take a photo.",
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        toast.error("No camera was found on this device.");
      } else {
        toast.error(e instanceof Error ? e.message : "Could not access the camera.");
      }
    } finally {
      setCameraPermissionBusy(false);
    }
  }, [toast]);

  const handleBackdropClick = () => {
    if (inlineCaptureStream) {
      discardInlineCapture();
      return;
    }
    onClose();
  };

  const handleCapturePhoto = useCallback(async () => {
    const video = videoRef.current;
    const stream = inlineCaptureStream;
    if (!video || !stream) return;

    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") {
      toast.error("Camera is not ready. Try again.");
      return;
    }

    setCaptureBusy(true);
    try {
      await waitForVideoFrameSize(video, 5000);
      const file = await videoFrameToJpegFile(video, track);
      if (!file) {
        toast.error("Could not capture this frame. Try again.");
        return;
      }

      stopMediaStream(stream);
      setInlineCaptureStream(null);
      onPicked(file);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not capture photo.");
    } finally {
      setCaptureBusy(false);
    }
  }, [inlineCaptureStream, onClose, onPicked, toast]);

  const handleTakePicture = useCallback(() => {
    if (canUseLiveCamera()) {
      void requestCameraAndShowPreview();
      return;
    }
    // Non-secure context or older environments: OS camera via file input `capture`.
    if (cameraCaptureInputRef.current) {
      cameraCaptureInputRef.current.click();
      return;
    }
    toast.error("Camera is not available in this browser.");
  }, [requestCameraAndShowPreview, toast]);

  if (!open) return null;

  return (
    <>
      <div className="profile-photo-sheet__backdrop" role="presentation" onClick={handleBackdropClick}>
        {!inlineCaptureStream ? (
          <div
            className="profile-photo-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-photo-sheet-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="profile-photo-sheet__grab" aria-hidden />
            <h2 id="profile-photo-sheet-title" className="profile-photo-sheet__title">
              Update profile photo
            </h2>
            {cameraAvailable ? (
              <p className="profile-photo-sheet__hint">
                {canUseLiveCamera()
                  ? "You can take a new picture with the camera preview, or choose an existing image."
                  : "Take a new photo with your camera, or choose an image from your gallery (use HTTPS for in-app camera preview)."}
              </p>
            ) : null}
            <div className="profile-photo-sheet__actions">
              {cameraAvailable ? (
                <button
                  type="button"
                  className="profile-photo-sheet__option"
                  disabled={cameraPermissionBusy}
                  aria-busy={cameraPermissionBusy}
                  onClick={handleTakePicture}
                >
                  <span className="profile-photo-sheet__option-icon" aria-hidden>
                    <IconCamera />
                  </span>
                  {cameraPermissionBusy ? "Requesting camera…" : "Take a picture"}
                  <span className="profile-photo-sheet__option-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                className="profile-photo-sheet__option"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="profile-photo-sheet__option-icon" aria-hidden>
                  <IconFolder />
                </span>
                {cameraAvailable ? "Choose from files" : "Choose image"}
                <span className="profile-photo-sheet__option-chevron" aria-hidden>
                  ›
                </span>
              </button>
            </div>
            <button type="button" className="profile-photo-sheet__cancel" onClick={onClose}>
              Cancel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="profile-photo-sheet__hidden-input"
              tabIndex={-1}
              aria-hidden
              onChange={handleChange}
            />
            <input
              ref={cameraCaptureInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="profile-photo-sheet__hidden-input"
              tabIndex={-1}
              aria-hidden
              onChange={handleChange}
            />
          </div>
        ) : null}
      </div>

      {inlineCaptureStream ? (
        <div
          className="profile-photo-sheet__camera-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-photo-capture-title"
          onClick={(ev) => ev.stopPropagation()}
        >
          <p id="profile-photo-capture-title" className="profile-photo-sheet__camera-title">
            Take your photo
          </p>
          <div className="profile-photo-sheet__camera-video-wrap">
            <video
              ref={videoRef}
              className="profile-photo-sheet__camera-video"
              playsInline
              muted
              autoPlay
            />
          </div>
          <div className="profile-photo-sheet__camera-actions">
            <button
              type="button"
              className="profile-photo-sheet__camera-btn profile-photo-sheet__camera-btn--ghost"
              disabled={captureBusy}
              onClick={discardInlineCapture}
            >
              Back
            </button>
            <button
              type="button"
              className="profile-photo-sheet__camera-btn profile-photo-sheet__camera-btn--primary"
              disabled={captureBusy}
              aria-busy={captureBusy}
              onClick={() => void handleCapturePhoto()}
            >
              {captureBusy ? "Saving…" : "Capture & upload"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
