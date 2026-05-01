import { postGymOptInMultiConfirm } from "@/api/patientGymSubscription";
import { getGymCheck } from "@/api/patientGym";
import { verifyGymPayment } from "@/api/patientGymPayment";
import { writeGymCheckSnapshot } from "@/constants/gymCheckStorage";
import { clearGymFlowV2Overview, readGymFlowV2Overview } from "@/constants/gymFlowV2Storage";
import { GYM_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import { ROUTES } from "@/constants";
import { buildGymMembershipPaymentSuccessState } from "@/lib/bookingSuccessFromInvoice";
import { useToast } from "@/hooks/useToast";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
} from "@/lib/gymMembershipRazorpayPay";
import {
  normalizeRazorpayCheckoutPayload,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import "./GymMembershipOverviewFlowV2.css";

const ACCEPT_TERMS =
  "I accept the Terms & Conditions for gym membership";

function formatRupee(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function prettyLocation(key: string): string {
  const t = key.trim();
  if (!t) return "—";
  return t[0].toUpperCase() + t.slice(1);
}

async function verifyGymPaymentWithOptionalGateway(
  invoiceId: string,
  firstPaymentId: string,
  onCheckoutFailed: (message: string) => void,
): Promise<void> {
  let paymentId = firstPaymentId;
  for (;;) {
    const vr = await verifyGymPayment({
      invoice_id: invoiceId,
      payment_id: paymentId,
    });
    const rzp = vr.razorpay_payload;
    if (rzp == null || Object.keys(rzp).length === 0) return;

    await loadRazorpayScript();
    if (!(globalThis as unknown as { Razorpay?: unknown }).Razorpay) {
      throw new Error("Razorpay Checkout could not load. Check your network or ad blocker.");
    }

    paymentId = await new Promise<string>((resolve, reject) => {
      const onFail = (m: string) => {
        window.removeEventListener(GYM_PAYMENT_DONE_EVENT, onNext);
        onCheckoutFailed(m);
        reject(new Error(m));
      };
      const onNext = (e: Event) => {
        window.removeEventListener(GYM_PAYMENT_DONE_EVENT, onNext);
        const d = (e as CustomEvent<unknown>).detail;
        if (
          d &&
          typeof d === "object" &&
          typeof (d as { razorpay_payment_id?: unknown }).razorpay_payment_id === "string"
        ) {
          resolve((d as { razorpay_payment_id: string }).razorpay_payment_id);
          return;
        }
        reject(new Error("Invalid payment response"));
      };
      window.addEventListener(GYM_PAYMENT_DONE_EVENT, onNext);
      openRazorpayCheckoutWithEvent(
        normalizeRazorpayCheckoutPayload({ ...rzp }),
        GYM_PAYMENT_DONE_EVENT,
        onFail,
      );
    });
  }
}

export function GymMembershipOverviewFlowV2() {
  const navigate = useNavigate();
  const toast = useToast();
  const payload = useMemo(() => readGymFlowV2Overview(), []);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preview = payload?.preview;
  const overview = preview?.overview;

  const optInAmount = overview?.optInAmount ?? payload?.paymentSummary.opt_in_amount ?? 0;
  const totalPending =
    overview?.totalPendingAmount ?? payload?.paymentSummary.pending_amount ?? 0;
  const paymentRequired =
    Boolean(overview?.paymentRequired) || Boolean(payload?.paymentSummary.payment_required);

  const primaryBtnLabel = paymentRequired ? "Confirm & pay" : "Confirm membership";

  const finishSuccess = useCallback(
    (invoiceId: string) => {
      clearGymFlowV2Overview();
      navigate(ROUTES.bookingSuccess, {
        replace: true,
        state: buildGymMembershipPaymentSuccessState({
          invoiceId,
          contactRows: payload?.contactRows,
        }),
      });
    },
    [navigate, payload?.contactRows],
  );

  const onConfirm = useCallback(async () => {
    if (!payload || !termsAccepted) return;
    setSubmitting(true);
    try {
      const confirmed = await postGymOptInMultiConfirm({
        subscription_id: payload.subscriptionId,
        lines: [...payload.optInLines],
      });
      const refreshed = await getGymCheck().catch(() => null);
      if (refreshed) writeGymCheckSnapshot(refreshed);

      const invoiceId = (confirmed.invoice_id ?? "").trim();
      const rp = confirmed.razorpay_payload;
      const hasRzp = rp != null && Object.keys(rp).length > 0;
      const needsGatewayPay = Boolean(confirmed.payment_required && hasRzp);

      if (confirmed.payment_required && !hasRzp) {
        toast.error("Payment is required but checkout options were not returned.");
        return;
      }

      if (!needsGatewayPay) {
        const contactRows = payload.contactRows;
        clearGymFlowV2Overview();
        navigate(ROUTES.bookingSuccess, {
          replace: true,
          state: buildGymMembershipPaymentSuccessState({
            invoiceId: invoiceId || "—",
            contactRows,
          }),
        });
        return;
      }

      if (!invoiceId) {
        toast.error("Missing invoice for payment.");
        return;
      }

      await loadRazorpayScript();
      if (!(globalThis as unknown as { Razorpay?: unknown }).Razorpay) {
        toast.error("Razorpay Checkout could not load.");
        return;
      }

      const paymentId = await new Promise<string>((resolve, reject) => {
        const onFail = (msg: string) => {
          window.removeEventListener(GYM_PAYMENT_DONE_EVENT, onDone);
          if (!isPaymentCancelledMessage(msg)) toast.error(msg);
          reject(new Error(msg));
        };
        const onDone = (e: Event) => {
          window.removeEventListener(GYM_PAYMENT_DONE_EVENT, onDone);
          const detail = (e as CustomEvent<unknown>).detail;
          if (
            detail &&
            typeof detail === "object" &&
            typeof (detail as Record<string, unknown>).razorpay_payment_id === "string"
          ) {
            resolve((detail as { razorpay_payment_id: string }).razorpay_payment_id);
            return;
          }
          reject(new Error("Invalid payment response"));
        };
        window.addEventListener(GYM_PAYMENT_DONE_EVENT, onDone);
        openRazorpayCheckoutWithEvent(
          normalizeRazorpayCheckoutPayload({ ...(rp as Record<string, unknown>) }),
          GYM_PAYMENT_DONE_EVENT,
          onFail,
        );
      });

      await verifyGymPaymentWithOptionalGateway(invoiceId, paymentId, (m) => {
        if (!isPaymentCancelledMessage(m)) toast.error(m);
      });
      const after = await getGymCheck();
      writeGymCheckSnapshot(after);
      finishSuccess(invoiceId);
    } catch (e) {
      if (e instanceof Error && isPaymentCancelledMessage(e.message)) {
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not complete enrolment");
    } finally {
      setSubmitting(false);
    }
  }, [payload, termsAccepted, navigate, toast, finishSuccess]);

  if (!payload) {
    return (
      <div className="gmov2-page">
        <p className="gmov2-empty">Nothing to review. Start again from Gym Membership.</p>
        <Link to={ROUTES.gymMembership} className="gmov2-link">
          Gym Membership
        </Link>
      </div>
    );
  }

  return (
    <div className="gmov2-page">
      <header className="gmov2-header">
        <Link to={ROUTES.gymMembershipContact} className="gmov2-back" aria-label="Back">
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
        <h1 className="gmov2-title">Membership Overview</h1>
      </header>

      <main className="gmov2-main">
        <p className="gmov2-lead">
          Review amounts and details. Accept the terms, then tap the button below to confirm your gym
          membership.
        </p>

        <section className="gmov2-card" aria-label="Price summary">
          <div className="gmov2-card__head">
            <span className="gmov2-card__icon" aria-hidden>
              📄
            </span>
            <h2 className="gmov2-card__title">PRICE SUMMARY</h2>
          </div>
          <div className="gmov2-sum-row">
            <span>Opt-in amount</span>
            <span>{formatRupee(optInAmount)}</span>
          </div>
          <div className="gmov2-sum-row gmov2-sum-row--emph">
            <span>Total pending</span>
            <span>{formatRupee(totalPending)}</span>
          </div>
          {paymentRequired ? (
            <div className="gmov2-pay-note" role="note">
              <span aria-hidden>🔒</span>
              <p>
                Payment is only taken after you confirm. If nothing is due, your membership is submitted
                without checkout.
              </p>
            </div>
          ) : null}

          {preview != null && preview.lines.length > 0 ? (
            <details className="gmov2-breakdown">
              <summary>
                Per-package breakdown
                <span className="gmov2-breakdown__badge">{preview.lines.length} lines</span>
              </summary>
              <div className="gmov2-breakdown__head">
                <span>Package · member</span>
                <span>Pending</span>
              </div>
              {preview.lines.map((l) => (
                <div key={`${l.packageCode}-${l.memberId}`} className="gmov2-line">
                  <div>
                    <p className="gmov2-line__code">{l.packageCode}</p>
                    <p className="gmov2-line__mid">Member ID {l.memberId}</p>
                  </div>
                  <span className="gmov2-line__amt">{formatRupee(l.pendingAmount)}</span>
                </div>
              ))}
            </details>
          ) : null}
        </section>

        <section className="gmov2-card" aria-label="Members and centers">
          <div className="gmov2-card__head">
            <span className="gmov2-card__icon" aria-hidden>
              🎫
            </span>
            <h2 className="gmov2-card__title">MEMBERS &amp; CENTERS</h2>
          </div>
          {payload.contactRows.map((row, i) => (
            <div key={`${row.memberDisplayName}-${i}`} className="gmov2-contact-block">
              {i > 0 ? <hr className="gmov2-sep" /> : null}
              <div className="gmov2-contact-head">
                <span className="gmov2-contact-num">{i + 1}</span>
                <div className="gmov2-contact-titles">
                  <p className="gmov2-contact-pkg">{row.packageDisplayName}</p>
                  <p className="gmov2-contact-member">{row.memberDisplayName}</p>
                </div>
                <span
                  className={`gmov2-role${row.isEmployeePackage ? " gmov2-role--emp" : " gmov2-role--dep"}`}
                >
                  {row.isEmployeePackage ? "Employee" : "Dependent"}
                </span>
              </div>
              <dl className="gmov2-dl">
                <div className="gmov2-dl-row">
                  <dt>Center / city</dt>
                  <dd>{prettyLocation(row.locationLabel)}</dd>
                </div>
                <div className="gmov2-dl-row">
                  <dt>Phone</dt>
                  <dd>{row.phone.trim() || "—"}</dd>
                </div>
                <div className="gmov2-dl-row">
                  <dt>Email</dt>
                  <dd>{row.email.trim() || "—"}</dd>
                </div>
              </dl>
            </div>
          ))}
        </section>

        <section className="gmov2-terms">
          <button
            type="button"
            className={`gmov2-terms__btn${termsAccepted ? " gmov2-terms__btn--on" : ""}`}
            onClick={() => setTermsAccepted((v) => !v)}
          >
            <span className="gmov2-terms__box">{termsAccepted ? "✓" : ""}</span>
            <span className="gmov2-terms__copy">
              <span className="gmov2-terms__hl">Terms &amp; conditions</span>
              <span className="gmov2-terms__body">{ACCEPT_TERMS}</span>
            </span>
          </button>
        </section>

        <p className="gmov2-primary-block">
          <span className="gmov2-primary-label">Primary account</span>
          <span className="gmov2-primary-line">
            {payload.accountPrimaryUser.name} · {payload.accountPrimaryUser.email}
          </span>
        </p>
      </main>

      <footer className="gmov2-footer mobile-frame-fixed-footer">
        {paymentRequired ? (
          <p className="gmov2-foot-hint">After confirm, secure checkout opens if an amount is due.</p>
        ) : null}
        <button
          type="button"
          className={`gmov2-cta${termsAccepted ? "" : " gmov2-cta--disabled"}`}
          disabled={!termsAccepted || submitting}
          onClick={() => {
            if (!termsAccepted) {
              toast.error(`Required: ${ACCEPT_TERMS}`);
              return;
            }
            void onConfirm();
          }}
        >
          {submitting ? "Working…" : primaryBtnLabel}
        </button>
      </footer>
    </div>
  );
}
