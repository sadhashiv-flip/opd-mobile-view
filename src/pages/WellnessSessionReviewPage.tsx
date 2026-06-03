import { postWellnessSession } from "@/api/wellnessSession";
import { WellnessSectionCard } from "@/components/wellness/WellnessSectionCard";
import {
  WELLNESS_DISCLAIMER_EMERGENCY,
  WELLNESS_REVIEW_HINT,
} from "@/constants/wellnessCopy";
import { ROUTES, WELLNESS_SESSION_KIND } from "@/constants";
import type { WellnessFormSnapshot } from "@/lib/wellnessSessionForm";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useState } from "react";
import "./WellnessFlow.css";

export type WellnessReviewLocationState = Readonly<{
  form: WellnessFormSnapshot;
}>;

function ReviewRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="wellness-review-row">
      <span className="wellness-review-row__label">{label}</span>
      <span className="wellness-review-row__value">{value || "—"}</span>
    </div>
  );
}

export function WellnessSessionReviewPage() {
  const { wellnessKind } = useParams<{ wellnessKind: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const isMental = wellnessKind === WELLNESS_SESSION_KIND.mentalWellness;
  const isNutrition = wellnessKind === WELLNESS_SESSION_KIND.nutrition;
  const state = location.state as WellnessReviewLocationState | null;
  const form = state?.form;

  const formPath = generatePath(ROUTES.servicesWellness, {
    wellnessKind: wellnessKind ?? WELLNESS_SESSION_KIND.mentalWellness,
  });

  const onConnect = useCallback(async () => {
    if (!form) return;
    const ok = globalThis.confirm("Would you like to raise a request?");
    if (!ok) return;

    setSubmitting(true);
    try {
      const result = await postWellnessSession({
        phone: form.phone.trim(),
        email: form.email.trim(),
        service: form.service,
        language: form.language.trim(),
        ...(isMental ? { service_area: form.serviceArea.trim() } : {}),
        patient_id: form.patientId,
      });
      void navigate(ROUTES.servicesWellnessSuccess, {
        replace: true,
        state: {
          nutrition: isNutrition,
          service: form.service,
          memberName: form.memberSummaryLine,
          language: form.language,
          invoiceId: result.invoiceId,
          orderId: result.orderId,
          message: result.message,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, isMental, isNutrition, navigate, toast]);

  if (!wellnessKind || (!isMental && !isNutrition) || !form) {
    return <Navigate to={formPath} replace />;
  }

  return (
    <div className="wellness-flow-page">
      <header className="wellness-flow-page__header">
        <Link to={formPath} state={{ restoreForm: form }} className="wellness-flow-page__back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="wellness-flow-page__title">Review your request</h1>
        <span className="wellness-flow-page__header-spacer" aria-hidden />
      </header>

      <main className="wellness-flow-page__main">
        <div className="wellness-review-intro">
          <span className="wellness-review-intro__icon" aria-hidden>
            ✓
          </span>
          <p>{WELLNESS_REVIEW_HINT}</p>
        </div>

        <WellnessSectionCard
          title="For whom"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z"
                fill="currentColor"
              />
            </svg>
          }
        >
          <ReviewRow label="Patient" value={form.memberSummaryLine} />
        </WellnessSectionCard>

        <WellnessSectionCard
          title="Contact details"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"
                fill="currentColor"
              />
            </svg>
          }
        >
          <ReviewRow label="Name" value={form.name} />
          <ReviewRow label="Mobile number" value={form.phone} />
          <ReviewRow label="Email address" value={form.email} />
        </WellnessSectionCard>

        <WellnessSectionCard
          title="Request summary"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V18z"
                fill="currentColor"
              />
            </svg>
          }
        >
          <ReviewRow label="Select service" value={form.service} />
          {isMental ? <ReviewRow label="Select category" value={form.serviceArea} /> : null}
          <ReviewRow label="Preferred language" value={form.language} />
        </WellnessSectionCard>

        <p className="wellness-flow-page__note">{WELLNESS_DISCLAIMER_EMERGENCY}</p>
      </main>

      <footer className="wellness-flow-page__footer">
        <button
          type="button"
          className="wellness-flow-page__cta"
          disabled={submitting}
          onClick={() => void onConnect()}
        >
          {submitting ? "Submitting…" : "Connect"}
        </button>
      </footer>
    </div>
  );
}
