import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

type WizardNavProps = Readonly<{
  title: string;
  backFallback?: string;
  onBeforeBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void;
  showNext?: boolean;
  children: ReactNode;
}>;

export function WizardScreenShell({
  title,
  backFallback,
  onBeforeBack,
  nextLabel = "Next",
  nextDisabled = false,
  onNext,
  showNext = true,
  children,
}: WizardNavProps) {
  const navigate = useNavigate();

  return (
    <div className="wizard-screen">
      <header className="wizard-screen__top">
        <FlowScreenBack
          className="app-back-btn wizard-screen__back"
          fallbackTo={backFallback}
          onBeforeBack={onBeforeBack}
        />
        <h1 className="wizard-screen__title">{title}</h1>
        <span className="wizard-screen__spacer" aria-hidden />
      </header>

      <main className="wizard-screen__main">{children}</main>

      {showNext ? (
        <footer className="wizard-screen__footer">
          <button
            type="button"
            className="wizard-screen__next"
            disabled={nextDisabled}
            onClick={() => {
              if (onNext) onNext();
              else navigate(-1);
            }}
          >
            {nextLabel}
          </button>
        </footer>
      ) : null}
    </div>
  );
}
