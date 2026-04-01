import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./Toast.css";

export type ToastVariant = "success" | "error" | "info";

type ToastItem = Readonly<{
  id: string;
  message: string;
  variant: ToastVariant;
}>;

export type ShowToastOptions = Readonly<{
  variant?: ToastVariant;
  /** ms; `0` keeps the toast until dismissed */
  duration?: number;
}>;

export type ToastApi = Readonly<{
  /** Returns toast id (for `dismiss`). */
  show: (message: string, options?: ShowToastOptions) => string;
  success: (message: string, durationMs?: number) => string;
  error: (message: string, durationMs?: number) => string;
  info: (message: string, durationMs?: number) => string;
  dismiss: (id: string) => void;
}>;

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION_MS = 4200;
const MAX_VISIBLE = 5;

function nextId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ToastViewportProps = Readonly<{
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
}>;

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <section
      className="toast-viewport"
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {toasts.map((t) => (
        <article
          key={t.id}
          className={`toast-item toast-item--${t.variant}`}
          {...(t.variant === "error" ? { role: "alert" as const } : {})}
        >
          <span className="toast-item__body">{t.message}</span>
          <button
            type="button"
            className="toast-item__close"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </article>
      ))}
    </section>
  );
}

type ToastProviderProps = Readonly<{
  children: ReactNode;
}>;

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options?: ShowToastOptions): string => {
      const id = nextId();
      const variant = options?.variant ?? "info";
      const duration = options?.duration ?? DEFAULT_DURATION_MS;

      setToasts((prev) => {
        const next = [...prev, { id, message, variant }];
        return next.length > MAX_VISIBLE ? next.slice(-MAX_VISIBLE) : next;
      });

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, durationMs?: number) => show(message, { variant: "success", duration: durationMs }),
    [show],
  );

  const error = useCallback(
    (message: string, durationMs?: number) => show(message, { variant: "error", duration: durationMs }),
    [show],
  );

  const info = useCallback(
    (message: string, durationMs?: number) => show(message, { variant: "info", duration: durationMs }),
    [show],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  const value = useMemo<ToastApi>(
    () => ({ show, success, error, info, dismiss }),
    [show, success, error, info, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
