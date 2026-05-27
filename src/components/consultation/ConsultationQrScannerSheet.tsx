import { CONSULT_QR_COPY } from "@/constants/consultationQrCopy";
import { getSuggestedSecureDevUrl } from "@/lib/getUserMediaCompat";
import { requestCameraAccess } from "@/lib/requestCameraAccess";
import { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "@/components/address/AddressBottomSheet.css";
import "./ConsultationQrScannerSheet.css";

export type ConsultationQrScannerSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onScanned: (qrData: string) => void;
}>;

type CameraGate = "requesting" | "granted" | "blocked";

const SCANNER_CONFIG = { fps: 10, qrbox: { width: 240, height: 240 } } as const;

async function startQrScanner(
  scanner: Html5Qrcode,
  onDecoded: (text: string) => void,
  isHandled: () => boolean,
): Promise<void> {
  const onScan = (decoded: string) => {
    if (isHandled()) return;
    const text = decoded.trim();
    if (!text) return;
    onDecoded(text);
  };

  try {
    await scanner.start(
      { facingMode: "environment" },
      SCANNER_CONFIG,
      onScan,
      () => {
        // per-frame decode miss — ignore
      },
    );
    return;
  } catch {
    // Desktop Edge often has no rear camera; fall back to any camera.
  }

  try {
    await scanner.start({ video: true }, SCANNER_CONFIG, onScan, () => {
      // per-frame decode miss — ignore
    });
    return;
  } catch {
    // Last resort: first enumerated device.
  }

  const cameras = await Html5Qrcode.getCameras();
  if (cameras.length === 0) {
    throw new Error("NO_CAMERA");
  }
  await scanner.start(cameras[0]!.id, SCANNER_CONFIG, onScan, () => {
    // per-frame decode miss — ignore
  });
}

export function ConsultationQrScannerSheet({
  open,
  onClose,
  onScanned,
}: ConsultationQrScannerSheetProps) {
  const readerId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [cameraGate, setCameraGate] = useState<CameraGate>("requesting");
  const [cameraErr, setCameraErr] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch {
      // ignore teardown errors
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setCameraGate("requesting");
    setCameraErr(null);
    const result = await requestCameraAccess();
    if (result.ok) {
      setCameraGate("granted");
      return true;
    }
    setCameraGate("blocked");
    setCameraErr(result.message);
    return false;
  }, []);

  useEffect(() => {
    if (!open) {
      handledRef.current = false;
      setCameraGate("requesting");
      setCameraErr(null);
      void stopScanner();
      return;
    }

    handledRef.current = false;
    void requestPermission();
  }, [open, requestPermission, stopScanner]);

  useEffect(() => {
    if (!open || cameraGate !== "granted") return;

    let cancelled = false;

    void (async () => {
      await stopScanner();
      if (cancelled) return;

      // Reader div must exist before html5-qrcode binds to it.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled) return;

      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      try {
        await startQrScanner(scanner, (text) => {
          handledRef.current = true;
          void stopScanner().then(() => onScanned(text));
        }, () => handledRef.current);
      } catch {
        if (!cancelled) {
          setCameraGate("blocked");
          setCameraErr(CONSULT_QR_COPY.cameraNotFound);
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, cameraGate, readerId, onScanned, stopScanner]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const showReader = cameraGate === "granted";
  const secureDevUrl = getSuggestedSecureDevUrl();

  return (
    <dialog
      className="addr-sheet-dialog consult-qr-scanner-dialog"
      open
      aria-modal="true"
      aria-labelledby="consult-qr-scanner-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="consult-qr-scanner">
        <header className="consult-qr-scanner__top">
          <h2 id="consult-qr-scanner-title" className="consult-qr-scanner__title">
            {CONSULT_QR_COPY.scannerTitle}
          </h2>
          <button type="button" className="addr-sheet__close" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <p className="consult-qr-scanner__hint">{CONSULT_QR_COPY.alignHint}</p>

        {cameraGate === "requesting" ? (
          <p className="consult-qr-scanner__status" aria-live="polite">
            {CONSULT_QR_COPY.requestingCamera}
          </p>
        ) : null}

        {cameraGate === "blocked" && cameraErr ? (
          <div className="consult-qr-scanner__blocked">
            <p className="consult-qr-scanner__err" role="alert">
              {cameraErr}
            </p>
            {secureDevUrl ? (
              <div className="consult-qr-scanner__secure-url">
                <a
                  className="consult-qr-scanner__secure-link"
                  href={secureDevUrl}
                  rel="noopener noreferrer"
                >
                  {secureDevUrl}
                </a>
                <p className="consult-qr-scanner__secure-hint">
                  {CONSULT_QR_COPY.cameraRequiresHttpsHint}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              className="consult-qr-scanner__retry"
              onClick={() => void requestPermission()}
            >
              {CONSULT_QR_COPY.tryAgain}
            </button>
          </div>
        ) : null}

        <div
          id={readerId}
          className="consult-qr-scanner__reader"
          hidden={!showReader}
          aria-hidden={!showReader}
        />
      </div>
    </dialog>
  );
}
