import type { ReactNode } from "react";
import "./MedicalRecordsCards.css";

export function MrClockMeta({ text }: Readonly<{ text: string }>) {
  if (!text) return null;
  return (
    <span className="mr-record-meta">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      {text}
    </span>
  );
}

export function MrDoseTag({ dose }: Readonly<{ dose: string }>) {
  if (!dose) return null;
  return (
    <span className="mr-dose-tag">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 3h6v4l3 7H6l3-7V3zM10 14v7M14 14v7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      Dose: {dose}
    </span>
  );
}

export function MrStatusPill({
  label,
  tone = "primary",
}: Readonly<{ label: string; tone?: "primary" | "warning" | "info" | "success" | "error" }>) {
  return <span className={`mr-status-pill mr-status-pill--${tone}`}>{label}</span>;
}

export function MrGradientIcon({
  gradient,
  children,
  size = 46,
}: Readonly<{ gradient: string; children: ReactNode; size?: number }>) {
  return (
    <span
      className="mr-record-card__icon mr-record-card__icon--gradient"
      style={{ background: gradient, width: size, height: size, minWidth: size }}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function MrHealthCardShell({
  children,
  onClick,
}: Readonly<{ children: ReactNode; onClick?: () => void }>) {
  if (onClick) {
    return (
      <button type="button" className="mr-health-card" onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className="mr-health-card">{children}</div>;
}

export function MrMedicineIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8a2 2 0 012 2v1.5a3.5 3.5 0 01-7 0V6a2 2 0 012-2zM7 10.5a5 5 0 0010 0V20a1 1 0 01-1 1H8a1 1 0 01-1-1v-9.5z"
        fill="#fff"
      />
    </svg>
  );
}

export function MrSymptomIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.75" />
      <path d="M8 15s1.5-1 4-1 4 1 4 1M9 9h.01M15 9h.01" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
