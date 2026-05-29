import {
  fetchGymPackages,
  postGymQuote,
  postGymOptInMultiPreview,
  displayQuotePackageName,
  type GymQuoteData,
  type GymSubscriptionRow,
} from "@/api/patientGymSubscription";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import { ROUTES } from "@/constants";
import {
  clearGymFlowV2Draft,
  readGymFlowV2Draft,
  writeGymFlowV2Overview,
  readGymFlowV2LineForms,
  writeGymFlowV2LineForms,
} from "@/constants/gymFlowV2Storage";
import {
  buildLineForms,
  employeeMemberRow,
  lineFormsToOptInLines,
  lineFormsToQuoteLines,
  lineValidationMessage,
  isLineValid,
  pricingForDependent,
  type GymLineFormModel,
} from "@/lib/gymSubscriptionFlow";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { useToast } from "@/hooks/useToast";
import { portalToMobileFrame } from "@/lib/mobileFramePortal";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./HealthCheckupsOverviewPage.css";
import "./GymMembershipContactPage.css";

function prettyLocation(key: string): string {
  const t = key.trim();
  if (!t.length) return "—";
  return t[0].toUpperCase() + t.slice(1);
}

function selectedLocationKey(current: GymLineFormModel): string {
  return current.locationOptions.some((option) => option.key === current.locationKey)
    ? current.locationKey
    : "";
}

function locationLabelForKey(current: GymLineFormModel): string {
  return (
    current.locationOptions.find((option) => option.key === current.locationKey)?.label ||
    prettyLocation(current.locationKey)
  );
}

function normalizeGymLineForms(forms: GymLineFormModel[]): GymLineFormModel[] {
  return forms.map((form) => {
    const firstOption = form.locationOptions[0] as unknown;
    if (typeof firstOption !== "string") return form;
    const restoredOptions = (form.locationOptions as unknown as string[]).map((key) => ({
      key,
      label: prettyLocation(key),
    }));
    return { ...form, locationOptions: restoredOptions };
  });
}

function patchForm(
  forms: GymLineFormModel[],
  index: number,
  patch: Partial<GymLineFormModel>,
): GymLineFormModel[] {
  return forms.map((f, i) => (i === index ? { ...f, ...patch } : f));
}

export function GymMembershipContactPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [packagesRows, setPackagesRows] = useState<GymSubscriptionRow[]>([]);
  const [familyRows, setFamilyRows] = useState<GymMemberListRow[]>([]);
  const [forms, setForms] = useState<GymLineFormModel[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteData, setQuoteData] = useState<GymQuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const activeSubscription = useMemo(() => {
    if (!packagesRows.length || subIndex < 0 || subIndex >= packagesRows.length) return null;
    return packagesRows[subIndex];
  }, [packagesRows, subIndex]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = readGymFlowV2Draft();
      if (!draft) {
        navigate(ROUTES.gymMembership, { replace: true });
        return;
      }
      setLoading(true);
      try {
        const [pkgs, members] = await Promise.all([
          fetchGymPackages(),
          Promise.all([fetchAllPatientMembers(), fetchAnySubscriptionCanActivate()]).then(([list, canAct]) =>
            patientMembersToGymRows(list, { subscriptionCanActivate: canAct }),
          ),
        ]);
        if (cancelled) return;
        setPackagesRows([...pkgs]);
        setFamilyRows(members);
        const idx = Math.min(Math.max(0, draft.selectedSubscriptionIndex), Math.max(0, pkgs.length - 1));
        setSubIndex(idx);
        const sub = pkgs[idx];
        if (!sub) {
          navigate(ROUTES.gymMembership, { replace: true });
          return;
        }
        const storedLines = readGymFlowV2LineForms();
        const built =
          storedLines && storedLines.length > 0
            ? normalizeGymLineForms(storedLines)
            : buildLineForms(
                sub,
                members,
                draft.selectedEmployeePackageCodes,
                draft.selectedDependentPackageCodes,
                draft.dependentMemberIdsByPackage,
              );
        setForms(built);
        writeGymFlowV2LineForms(built);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load gym checkout");
          navigate(ROUTES.gymMembership, { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

  const completedCount = useMemo(() => forms.filter((f) => isLineValid(f)).length, [forms]);

  const onFetchQuote = useCallback(async () => {
    if (!activeSubscription || forms.length === 0) return;
    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      if (!isLineValid(f)) {
        toast.error(`Gym — ${f.memberDisplayName}: ${lineValidationMessage(f)}`);
        setActiveIndex(i);
        return;
      }
    }
    setQuoteLoading(true);
    try {
      const lines = lineFormsToQuoteLines(forms);
      const q = await postGymQuote({
        subscription_id: activeSubscription.subscriptionId,
        lines,
      });
      setQuoteData(q);
      setQuoteOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Quote failed");
    } finally {
      setQuoteLoading(false);
    }
  }, [activeSubscription, forms, toast]);

  const onContinueAfterQuote = useCallback(async () => {
    if (!activeSubscription || forms.length === 0) return;
    for (const f of forms) {
      if (!isLineValid(f)) {
        toast.error(`Gym — ${f.memberDisplayName}: ${lineValidationMessage(f)}`);
        return;
      }
    }
    setPreviewLoading(true);
    try {
      const optInLines = lineFormsToOptInLines(forms);
      const { payment, preview } = await postGymOptInMultiPreview({
        subscription_id: activeSubscription.subscriptionId,
        lines: [...optInLines],
      });
      const emp = employeeMemberRow(familyRows);
      const accountPrimaryUser = emp
        ? {
            name: emp.name,
            email: emp.email?.trim() || "—",
            phone: emp.phone?.trim() || "—",
          }
        : {
            name: forms[0]?.memberDisplayName ?? "—",
            email: forms[0]?.email?.trim() || "—",
            phone: forms[0]?.phone?.trim() || "—",
          };

      writeGymFlowV2Overview({
        subscriptionId: activeSubscription.subscriptionId,
        optInLines,
        preview,
        paymentSummary: {
          opt_in_amount: payment.opt_in_amount ?? preview?.overview.optInAmount ?? null,
          pending_amount: payment.pending_amount ?? preview?.overview.totalPendingAmount ?? null,
          payment_required: payment.payment_required || Boolean(preview?.overview.paymentRequired),
        },
        contactRows: forms.map((f) => ({
          packageDisplayName: f.packageDisplayName,
          memberDisplayName: f.memberDisplayName,
          isEmployeePackage: f.isEmployeePackage,
          locationLabel: locationLabelForKey(f),
          phone: f.phone.trim(),
          email: f.email.trim(),
        })),
        accountPrimaryUser,
      });
      clearGymFlowV2Draft();
      setQuoteOpen(false);
      navigate(ROUTES.gymMembershipOverview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load confirmation");
    } finally {
      setPreviewLoading(false);
    }
  }, [activeSubscription, forms, familyRows, navigate, toast]);

  const isLastMember = forms.length > 0 && activeIndex === forms.length - 1;
  const canFetchQuote = forms.length > 0 && forms.every((f) => isLineValid(f));

  if (loading || !activeSubscription) {
    return (
      <div className="gym-contact-page">
        <header className="hco-top">
          <Link to={ROUTES.gymMembership} className="hco-back" aria-label="Back">
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
          <h1 className="hco-title">Location &amp; contact</h1>
          <span className="hco-top__spacer" aria-hidden />
        </header>
        <main className="gym-contact-main">
          <p className="gym-contact-loading" aria-busy="true">
            Loading…
          </p>
        </main>
      </div>
    );
  }

  const current = forms[activeIndex];

  return (
    <div className="gym-contact-page">
      <header className="hco-top">
        <Link to={ROUTES.gymMembership} className="hco-back" aria-label="Back to packages">
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
        <h1 className="hco-title">Location &amp; contact</h1>
        <span className="hco-top__spacer" aria-hidden />
      </header>

      <main className="gym-contact-main">
        <div className="gym-contact-progress">
          <span className="gym-contact-progress__label">
            {completedCount}/{forms.length} completed
          </span>
          <span
            className={`gym-contact-progress__pill${completedCount === forms.length ? " gym-contact-progress__pill--ok" : ""}`}
          >
            {completedCount === forms.length ? "Ready" : "Pending"}
          </span>
        </div>

        <div className="gym-contact-tabs" role="tablist" aria-label="Members">
          {forms.map((f, index) => {
            const valid = isLineValid(f);
            const sel = index === activeIndex;
            return (
              <button
                key={`${f.packageCode}-${f.memberId}-${index}`}
                type="button"
                role="tab"
                aria-selected={sel}
                className={`gym-contact-tab${sel ? " gym-contact-tab--active" : ""}`}
                onClick={() => setActiveIndex(index)}
              >
                <span className="gym-contact-tab__text">
                  {index + 1}. {f.memberDisplayName}
                </span>
                <span className={valid ? "gym-contact-tab__ok" : "gym-contact-tab__warn"} aria-hidden>
                  {valid ? "✓" : "…"}
                </span>
              </button>
            );
          })}
        </div>

        {current ? (
          <section className="gym-contact-card" aria-label="Member details">
            <div className="gym-contact-card__head">
              <div>
                <p className="gym-contact-card__pkg">{current.packageDisplayName}</p>
                <p className="gym-contact-card__member">Member: {current.memberDisplayName}</p>
              </div>
              <span
                className={`gym-contact-badge${current.isEmployeePackage ? " gym-contact-badge--emp" : " gym-contact-badge--dep"}`}
              >
                {current.isEmployeePackage ? "Employee" : "Dependent"}
              </span>
            </div>

            <label className="gym-contact-field">
              <span className="gym-contact-field__label">
                Location <span className="gym-contact-req">*</span>
              </span>
              <select
                className="gym-contact-select"
                value={selectedLocationKey(current)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForms((prev) => {
                    const next = patchForm(prev, activeIndex, { locationKey: v });
                    writeGymFlowV2LineForms(next);
                    return next;
                  });
                }}
              >
                <option value="">Choose location</option>
                {current.locationOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {!current.isEmployeePackage &&
            current.locationKey &&
            pricingForDependent(activeSubscription, current.packageCode, current.locationKey) ? (
              <p className="gym-contact-price-hint">
                Price ({prettyLocation(current.locationKey)}): ₹
                {pricingForDependent(
                  activeSubscription,
                  current.packageCode,
                  current.locationKey,
                )!.finalAmount.toLocaleString("en-IN")}{" "}
                incl. tax
              </p>
            ) : null}

            <label className="gym-contact-field">
              <span className="gym-contact-field__label">
                Full name <span className="gym-contact-req">*</span>
              </span>
              <input
                className="gym-contact-input"
                value={current.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForms((prev) => {
                    const next = patchForm(prev, activeIndex, { name });
                    writeGymFlowV2LineForms(next);
                    return next;
                  });
                }}
                autoComplete="name"
              />
            </label>

            <label className="gym-contact-field">
              <span className="gym-contact-field__label">
                Phone <span className="gym-contact-req">*</span>
              </span>
              <input
                className="gym-contact-input"
                inputMode="tel"
                value={current.phone}
                onChange={(e) => {
                  const phone = e.target.value;
                  setForms((prev) => {
                    const next = patchForm(prev, activeIndex, { phone });
                    writeGymFlowV2LineForms(next);
                    return next;
                  });
                }}
                autoComplete="tel"
              />
            </label>

            <label className="gym-contact-field">
              <span className="gym-contact-field__label">
                Email{" "}
                {current.isEmployeePackage ? <span className="gym-contact-req">*</span> : null}
              </span>
              <input
                className="gym-contact-input"
                type="email"
                inputMode="email"
                value={current.email}
                onChange={(e) => {
                  const email = e.target.value;
                  setForms((prev) => {
                    const next = patchForm(prev, activeIndex, { email });
                    writeGymFlowV2LineForms(next);
                    return next;
                  });
                }}
                autoComplete="email"
              />
            </label>

            {current.isEmployeePackage ? (
              <label className="gym-contact-field">
                <span className="gym-contact-field__label">Personal email (optional)</span>
                <input
                  className="gym-contact-input"
                  type="email"
                  inputMode="email"
                  value={current.personalEmail}
                  onChange={(e) => {
                    const personalEmail = e.target.value;
                    setForms((prev) => {
                      const next = patchForm(prev, activeIndex, { personalEmail });
                      writeGymFlowV2LineForms(next);
                      return next;
                    });
                  }}
                  autoComplete="email"
                />
              </label>
            ) : null}

            <p
              className={`gym-contact-validation${isLineValid(current) ? " gym-contact-validation--ok" : ""}`}
            >
              {lineValidationMessage(current)}
            </p>

            {forms.length > 1 ? (
              <div className="gym-contact-nav-row">
                <button
                  type="button"
                  className="gym-contact-nav"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="gym-contact-nav"
                  disabled={activeIndex >= forms.length - 1}
                  onClick={() => setActiveIndex((i) => Math.min(forms.length - 1, i + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="gym-contact-footer mobile-frame-fixed-footer">
        {!isLastMember ? (
          <p className="gym-contact-footer__hint">Complete this member and move to the last member.</p>
        ) : (
          <button
            type="button"
            className={`gym-contact-cta${canFetchQuote ? "" : " gym-contact-cta--disabled"}`}
            disabled={!canFetchQuote || quoteLoading}
            onClick={() => void onFetchQuote()}
          >
            {quoteLoading ? "Loading…" : "Continue"}
          </button>
        )}
      </footer>

      {quoteOpen && quoteData
        ? portalToMobileFrame(
            <div className="gym-quote-overlay" role="dialog" aria-modal="true" aria-label="Price quote">
              <button
                type="button"
                className="gym-quote-overlay__backdrop"
                aria-label="Close"
                onClick={() => setQuoteOpen(false)}
              />
              <div className="gym-quote-sheet">
                <div className="gym-quote-sheet__handle" aria-hidden />
                <div className="gym-quote-sheet__header">
                  <h2 className="gym-quote-sheet__title">Price quote</h2>
                  <button type="button" className="gym-quote-sheet__close" onClick={() => setQuoteOpen(false)}>
                    ×
                  </button>
                </div>
                <div className="gym-quote-sheet__body">
                  <p className="gym-quote-sheet__section-title">Per member</p>
                  {quoteData.lines.map((line) => (
                    <div key={`${line.packageCode}-${line.memberId}`} className="gym-quote-line">
                      <p className="gym-quote-line__title">{displayQuotePackageName(line)}</p>
                      <p className="gym-quote-line__meta">
                        {line.memberType} · {line.locationKey}
                      </p>
                      <div className="gym-quote-line__rows">
                        <span>Package amount</span>
                        <span>₹ {line.packageAmount.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="gym-quote-line__rows gym-quote-line__rows--bold">
                        <span>Pending</span>
                        <span>₹ {line.pendingAmount.toLocaleString("en-IN")}</span>
                      </div>
                      {line.walletApplicable ? (
                        <p className="gym-quote-line__wallet">Wallet may apply toward this line</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="gym-quote-sheet__footer">
                  <div className="gym-quote-sum">
                    <span>Total package</span>
                    <span>₹ {quoteData.overview.totalPackageAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="gym-quote-sum">
                    <span>Total pay</span>
                    <span>₹ {quoteData.overview.totalPayAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="gym-quote-sum gym-quote-sum--bold">
                    <span>Pending</span>
                    <span>₹ {quoteData.overview.totalPendingAmount.toLocaleString("en-IN")}</span>
                  </div>
                  {quoteData.overview.paymentRequired ? (
                    <div className="gym-quote-sum gym-quote-sum--primary">
                      <span>To pay now</span>
                      <span>₹ {quoteData.overview.amountRequiredForPayment.toLocaleString("en-IN")}</span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="gym-quote-cta"
                    disabled={previewLoading}
                    onClick={() => void onContinueAfterQuote()}
                  >
                    {previewLoading
                      ? "Loading…"
                      : quoteData.overview.paymentRequired
                        ? `Continue to payment (₹${quoteData.overview.amountRequiredForPayment.toLocaleString("en-IN")})`
                        : "Continue"}
                  </button>
                </div>
              </div>
            </div>,
          )
        : null}
    </div>
  );
}
