import type { GymMembershipPlan } from "@/constants/gymPlans";
import { useEffect } from "react";
import "./GymBenefitsModal.css";

type GymBenefitsModalProps = Readonly<{
  plan: GymMembershipPlan | null;
  onClose: () => void;
}>;

export function GymBenefitsModal({ plan, onClose }: GymBenefitsModalProps) {
  useEffect(() => {
    if (!plan) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [plan, onClose]);

  if (!plan) {
    return null;
  }

  const tierWord = plan.tier.split(" ")[1] ?? "";
  const accentClass =
    tierWord === "PRO" ? "gbm-title-accent gbm-title-accent--pro" : "gbm-title-accent gbm-title-accent--elite";

  return (
    <div
      className="gbm-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gbm-dialog-title"
    >
      <button type="button" className="gbm-backdrop" aria-label="Close" onClick={onClose} />
      <div className="gbm-panel">
        <header className="gbm-header">
          <h2 id="gbm-dialog-title" className="gbm-title">
            {plan.cardTitle ? (
              <span className="gbm-title-package">{plan.cardTitle}</span>
            ) : (
              <>
                <span>Cult </span>
                <span className={accentClass}>{tierWord}</span>
                <span> Benefits</span>
              </>
            )}
          </h2>
          <button type="button" className="gbm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {plan.tncHtml ? (
          <div
            className="gbm-html"
            // API terms HTML (partner-controlled)
            dangerouslySetInnerHTML={{ __html: plan.tncHtml }}
          />
        ) : (
          <ul className="gbm-list">
            {plan.benefits.map((line) => (
              <li key={line} className="gbm-item">
                <span className="gbm-check" aria-hidden="true">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
