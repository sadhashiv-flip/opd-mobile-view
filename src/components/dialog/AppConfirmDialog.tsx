import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import "./AppConfirmDialog.css";

export type AppConfirmOptions = Readonly<{
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button (delete / clear actions). */
  variant?: "default" | "destructive";
}>;

type Pending = AppConfirmOptions & Readonly<{ resolve: (ok: boolean) => void }>;

const AppConfirmContext = createContext<((opts: AppConfirmOptions) => Promise<boolean>) | null>(null);

export function useAppConfirm(): (opts: AppConfirmOptions) => Promise<boolean> {
  const ctx = useContext(AppConfirmContext);
  if (!ctx) {
    throw new Error("useAppConfirm must be used within AppConfirmProvider");
  }
  return ctx;
}

function AppConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant,
  onCancel,
  onConfirm,
}: Readonly<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: "default" | "destructive";
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onCancel();
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  const destructive = variant === "destructive";

  return (
    <div
      className="app-confirm-root"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-confirm-title"
      aria-describedby="app-confirm-desc"
    >
      <button type="button" className="app-confirm-backdrop" aria-label="Cancel" onClick={onCancel} />
      <div className="app-confirm-panel">
        <div className="app-confirm-header">
          <span
            className={`app-confirm-icon${destructive ? " app-confirm-icon--destructive" : ""}`}
            aria-hidden
          >
            !
          </span>
          <h2 id="app-confirm-title" className="app-confirm-title">
            {title}
          </h2>
        </div>
        <p id="app-confirm-desc" className="app-confirm-body">
          {message}
        </p>
        <div className="app-confirm-actions">
          <button type="button" className="app-confirm-btn app-confirm-btn--cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`app-confirm-btn${destructive ? " app-confirm-btn--destructive" : " app-confirm-btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppConfirmProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [pending, setPending] = useState<Pending | null>(null);

  const requestConfirm = useCallback((opts: AppConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        if (prev) prev.resolve(false);
        return { ...opts, resolve };
      });
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    setPending((p) => {
      if (p) p.resolve(ok);
      return null;
    });
  }, []);

  const variant = pending?.variant ?? "default";
  const confirmLabel = pending?.confirmLabel ?? "OK";
  const cancelLabel = pending?.cancelLabel ?? "Cancel";

  return (
    <AppConfirmContext.Provider value={requestConfirm}>
      {children}
      <AppConfirmModal
        open={pending != null}
        title={pending?.title ?? ""}
        message={pending?.message ?? ""}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant={variant}
        onCancel={() => finish(false)}
        onConfirm={() => finish(true)}
      />
    </AppConfirmContext.Provider>
  );
}
