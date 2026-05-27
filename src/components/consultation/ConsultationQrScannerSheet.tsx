import { CONSULT_QR_COPY } from "@/constants/consultationQrCopy";
import { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "@/components/address/AddressBottomSheet.css";
import "./ConsultationQrScannerSheet.css";

export type ConsultationQrScannerSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onScanned: (qrData: string) => void;
}>;

export function ConsultationQrScannerSheet({
  open,
  onClose,
  onScanned,
}: ConsultationQrScannerSheetProps) {
  const readerId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [err, setErr] = useState<string | null>(null);

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

  useEffect(() => {
    if (!open) {
      handledRef.current = false;
      setErr(null);
      void stopScanner();
      return;
    }

    if (!globalThis.isSecureContext) {
      setErr("Camera scanning requires HTTPS or localhost.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(CONSULT_QR_COPY.cameraPermissionRequired);
      return;
    }

    let cancelled = false;
    handledRef.current = false;
    setErr(null);

    const start = async () => {
      await stopScanner();
      if (cancelled) return;
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (handledRef.current) return;
            const text = decoded.trim();
            if (!text) return;
            handledRef.current = true;
            void stopScanner().then(() => onScanned(text));
          },
          () => {
            // per-frame decode miss — ignore
          },
        );
      } catch {
        if (!cancelled) {
          setErr(CONSULT_QR_COPY.cameraPermissionRequired);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, readerId, onScanned, stopScanner]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

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
        {err ? (
          <p className="consult-qr-scanner__err" role="alert">
            {err}
          </p>
        ) : (
          <div id={readerId} className="consult-qr-scanner__reader" />
        )}
      </div>
    </dialog>
  );
}
