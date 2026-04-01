import { useEffect, useState } from "react";
import "./GymTermsSheet.css";

const TERMS_SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: "1. YOUR AGREEMENT",
    body: "By proceeding with this purchase, you agree to be bound by these terms and conditions, our membership rules, and the policies of the fitness partner. Membership fees, taxes, and any applicable surcharges are due as displayed at checkout. Access to facilities and classes is subject to availability, centre rules, and the duration of the plan you select.",
  },
  {
    title: "2. PRIVACY",
    body: "We process your personal data to provide this service, manage your membership, and comply with law. Health and contact information you provide may be shared with the gym operator solely for membership administration. You may request access or correction of your data as permitted under applicable privacy laws.",
  },
  {
    title: "3. CANCELLATIONS & REFUNDS",
    body: "Refund and cancellation policies follow the partner gym’s rules and the plan you purchased. Promotional or corporate-sponsored benefits may have additional restrictions as communicated at the time of enrolment.",
  },
];

type GymTermsSheetProps = Readonly<{
  open: boolean;
  membershipPhrase: string;
  onClose: () => void;
  onAccept: () => void;
}>;

export function GymTermsSheet({ open, membershipPhrase, onClose, onAccept }: GymTermsSheetProps) {
  const [readChecked, setReadChecked] = useState(false);

  useEffect(() => {
    if (!open) {
      setReadChecked(false);
    }
  }, [open]);

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
      e.stopImmediatePropagation();
      onClose();
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="gts-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gts-intro-title"
    >
      <button type="button" className="gts-backdrop" aria-label="Close" onClick={onClose} />
      <div className="gts-sheet">
        <header className="gts-header">
          <p id="gts-intro-title" className="gts-intro">
            Please review and accept the terms &amp; conditions to proceed with{" "}
            {membershipPhrase} purchase.
          </p>
          <button type="button" className="gts-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="gts-body">
          <div className="gts-scroll" tabIndex={0}>
            {TERMS_SECTIONS.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </section>
            ))}
            <p>
              Continued use of your membership constitutes acceptance of updates posted here. For
              questions, contact support through the app.
            </p>
          </div>
          <label className="gts-agree">
            <input
              type="checkbox"
              checked={readChecked}
              onChange={(e) => setReadChecked(e.target.checked)}
            />
            <span>I have read and agree to the terms &amp; conditions above.</span>
          </label>
        </div>
        <footer className="gts-footer">
          <button
            type="button"
            className="gts-accept"
            disabled={!readChecked}
            onClick={() => {
              onAccept();
              onClose();
            }}
          >
            Accept &amp; Proceed
          </button>
        </footer>
      </div>
    </div>
  );
}
