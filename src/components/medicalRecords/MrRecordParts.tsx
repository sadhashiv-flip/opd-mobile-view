import type { ReactNode } from "react";
import {
  HealthLogMedicineIcon,
  HealthLogSymptomIcon,
  MrIconAccessTime,
  MrIconScience,
} from "@/components/medicalRecords/MedicalRecordsIcons";
import "./MedicalRecordsCards.css";

export function MrClockMeta({ text }: Readonly<{ text: string }>) {
  if (!text) return null;
  return (
    <span className="mr-record-meta">
      <MrIconAccessTime size={13} />
      {text}
    </span>
  );
}

export function MrDoseTag({ dose }: Readonly<{ dose: string }>) {
  if (!dose) return null;
  return (
    <span className="mr-dose-tag">
      <MrIconScience size={12} />
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
  className,
}: Readonly<{ children: ReactNode; onClick?: () => void; className?: string }>) {
  const cls = ["mr-health-card", className].filter(Boolean).join(" ");
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function MrMedicineIcon() {
  return <HealthLogMedicineIcon />;
}

export function MrSymptomIcon() {
  return <HealthLogSymptomIcon />;
}
