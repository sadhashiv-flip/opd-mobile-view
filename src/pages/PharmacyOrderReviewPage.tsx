import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { postMedicineOrder } from "@/api/pharmacy";
import {
  clearPharmacyReviewDraft,
  readPharmacyReviewDraft,
  type PharmacyReviewDraft,
  type PharmacyReviewOrderKind,
} from "@/constants/pharmacyReviewDraft";
import { readPharmacyFlowState, resolvePharmacyOrderAddressId } from "@/constants/pharmacyFlowStorage";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { ROUTES } from "@/constants";
import {
  buildPharmacyPassState,
  pharmacyReviewBackPath,
  readPharmacyBackPath,
  readPharmacyHubReturn,
} from "@/lib/pharmacyFlowNav";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { useToast } from "@/hooks/useToast";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { clearPharmacyReviewStep } from "@/lib/bookingFlowStackCleanup";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import "./PharmacyPages.css";
import "./PharmacyOrderReviewPage.css";

type NavState = Readonly<{
  returnPath?: string;
  backPath?: string;
  orderKind?: PharmacyReviewOrderKind;
}>;

const COPY = {
  title: "Review your order",
  subtitle: "Please verify the details below before placing your order.",
  orderFor: "Order for",
  deliverTo: "Deliver to",
  changeAddress: "Change",
  noAddress: "No delivery address selected. Add one to continue.",
  addAddress: "Add address",
  orderType: "Order type",
  uploadedTitle: "Uploaded Prescriptions",
  selectedTitle: "Selected prescriptions",
  confirmPlace: "Confirm & place order",
  otcSummary:
    "Our pharmacy team will call you to collect the list of over-the-counter items you need and confirm the order.",
  disclaimer:
    "Medicine delivery timelines vary depending on factors like location, type of medication, order timing, and quantity ordered.",
  placeOrderTitle: "Place this order?",
  placeOrderBody: "Tap Place order to confirm, or Cancel to keep reviewing your details.",
  placeOrderCancel: "Cancel",
  placeOrderConfirm: "Place order",
} as const;

function parseOrderKind(raw: unknown): PharmacyReviewOrderKind | null {
  const s = typeof raw === "string" ? raw.toUpperCase() : "";
  if (s === "OTC" || s === "UPLOAD" || s === "FLIPHEALTH") return s as PharmacyReviewOrderKind;
  return null;
}

function introForKind(kind: PharmacyReviewOrderKind): { label: string; Icon: () => ReactElement } {
  if (kind === "OTC") {
    return {
      label: "OTC medicines",
      Icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 11V7a3 3 0 016 0v4M5 9h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"
            stroke="#ff541e"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ),
    };
  }
  if (kind === "UPLOAD") {
    return {
      label: "Uploaded prescriptions",
      Icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
            stroke="#ff541e"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path d="M14 2v6h6M12 11v6M9 14l3 3 3-3" stroke="#ff541e" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      ),
    };
  }
  return {
    label: "Flip Health prescriptions",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01" stroke="#ff541e" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  let out = "";
  for (const p of parts.slice(0, 2)) {
    out += p[0]?.toUpperCase() ?? "";
  }
  return out;
}

export function PharmacyOrderReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const st = location.state as NavState | null;
  const hubReturn = readPharmacyHubReturn(location);
  const orderKind = parseOrderKind(st?.orderKind);
  const reviewBackPath = useMemo(() => {
    if (orderKind) {
      const fromState = readPharmacyBackPath(location, "");
      if (fromState) return fromState;
      return pharmacyReviewBackPath(orderKind);
    }
    return ROUTES.pharmacy;
  }, [location, orderKind]);
  const passState = useMemo(
    () => buildPharmacyPassState(hubReturn, reviewBackPath),
    [hubReturn, reviewBackPath],
  );
  const draft = useMemo(() => readPharmacyReviewDraft(), [location.pathname, location.state]);

  const flow = readPharmacyFlowState();
  const addr = readSelectedAddress();

  const [members, setMembers] = useState<GymMemberListRow[]>([]);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [placeConfirmOpen, setPlaceConfirmOpen] = useState(false);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const list = await fetchAllPatientMembers();
        if (!c) setMembers(patientMembersToGymRows(list));
      } catch {
        if (!c) setMembers([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    void ensureDefaultSelectedAddressIfNeeded();
  }, []);

  const memberRow = useMemo(() => {
    if (!flow) return null;
    return members.find((m) => m.id === flow.memberId) ?? null;
  }, [flow, members]);

  const relationshipLabel = useMemo(() => {
    if (!memberRow) return "self";
    return memberRow.subtitle.trim().toLowerCase() || (memberRow.section === "self" ? "self" : "family");
  }, [memberRow]);

  const intro = orderKind ? introForKind(orderKind) : null;

  const canPlace = useMemo((): boolean => {
    if (!orderKind || !draft || draft.kind !== orderKind) return false;
    switch (draft.kind) {
      case "OTC":
        return true;
      case "UPLOAD":
        return draft.files.length > 0;
      case "FLIPHEALTH":
        return draft.prescriptions.length > 0;
      default: {
        const _e: never = draft;
        return _e;
      }
    }
  }, [draft, orderKind]);

  const hasAddress = Boolean(addr?.id?.trim());

  const confirmDisabled = !hasAddress || !canPlace || busy;

  const navigateAway = useCallback(() => {
    void navigate(reviewBackPath, { state: passState });
  }, [navigate, passState, reviewBackPath]);

  useEffect(() => {
    if (!orderKind || !flow) {
      toast.error("Open pharmacy from the menu to continue.");
      navigateAway();
      return;
    }
    if (!draft || draft.kind !== orderKind) {
      toast.error("Review session expired. Start again from pharmacy.");
      navigateAway();
    }
  }, [draft, flow, navigateAway, orderKind, toast]);

  const preparePlaceOrder = useCallback(async () => {
    if (!flow || !orderKind || !draft || draft.kind !== orderKind || confirmDisabled) return;
    await ensureDefaultSelectedAddressIfNeeded();
    const addressId = resolvePharmacyOrderAddressId(readPharmacyFlowState());
    if (!addressId) {
      toast.error(COPY.noAddress);
      return;
    }
    setPlaceConfirmOpen(true);
  }, [confirmDisabled, draft, flow, orderKind, toast]);

  const executePlaceOrder = useCallback(async () => {
    if (!flow || !orderKind || !draft || draft.kind !== orderKind) return;
    setPlaceConfirmOpen(false);
    setBusy(true);
    try {
      const addressId = resolvePharmacyOrderAddressId(readPharmacyFlowState());
      if (!addressId) {
        toast.error(COPY.noAddress);
        return;
      }

      let prescriptions: Parameters<typeof postMedicineOrder>[0]["prescriptions"];
      if (draft.kind === "OTC") {
        prescriptions = [];
      } else if (draft.kind === "UPLOAD") {
        prescriptions = draft.files.map((f) => ({
          type: "OTHER" as const,
          prescription_id: f.prescriptionId,
        }));
      } else {
        prescriptions = draft.prescriptions.map((p) => ({
          type: "FLIPHEALTH" as const,
          prescription_id: p.apiPrescriptionId.trim(),
        }));
      }

      const result = await postMedicineOrder({
        address_id: addressId,
        prescriptions,
        patient_id: flow.patientId,
      });

      const sel = readSelectedAddress();
      clearPharmacyReviewDraft();
      void navigate(ROUTES.pharmacyOrderSuccess, {
        state: {
          ...passState,
          orderKind:
            draft.kind === "OTC" ? ("OTC" as const) : draft.kind === "UPLOAD" ? ("UPLOAD" as const) : ("FLIPHEALTH" as const),
          message: result.message,
          orderId: result.orderId,
          invoiceId: result.invoiceId,
          patientName: result.patientNameFromApi ?? flow.patientName,
          addressLine: sel?.displayLine ?? "",
          itemCount:
            draft.kind === "OTC" ? 0 : draft.kind === "UPLOAD" ? draft.files.length : draft.prescriptions.length,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  }, [draft, flow, navigate, orderKind, passState, toast]);

  useEffect(() => {
    if (!placeConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPlaceConfirmOpen(false);
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [placeConfirmOpen]);

  if (!flow || !orderKind || !draft || draft.kind !== orderKind || !intro) {
    return (
      <div className="ph-review-page">
        <p className="ph-review-loading">Loading…</p>
      </div>
    );
  }

  const { Icon: IntroIcon, label: introLabel } = intro;

  return (
    <div className="ph-review-page">
      <header className="ph-review-top">
        <FlowScreenBack
          fallbackTo={reviewBackPath}
          fallbackNavigate={{ state: passState }}
          className="app-back-btn ph-back"
          onBeforeBack={clearPharmacyReviewStep}
        />
        <h1 className="ph-review-title">{COPY.title}</h1>
        <span className="ph-top__spacer" aria-hidden />
      </header>

      <div className="ph-review-body">
        <section className="ph-review-intro">
          <div className="ph-review-intro__icon" aria-hidden>
            <IntroIcon />
          </div>
          <div className="ph-review-intro__text">
            <p className="ph-review-intro__label">{introLabel}</p>
            <p className="ph-review-intro__sub">{COPY.subtitle}</p>
          </div>
        </section>

        <section className="ph-review-card">
          <div className="ph-review-card__head">
            <span className="ph-review-card__head-ic" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
                  stroke="#ff541e"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <h2 className="ph-review-card__title">{COPY.orderFor}</h2>
          </div>
          <div className="ph-review-card__body">
            <div className="ph-review-avatar" aria-hidden>
              {initials(flow.patientName) || "—"}
            </div>
            <div className="ph-review-patient">
              <p className="ph-review-patient__name">{flow.patientName}</p>
              <p className="ph-review-patient__rel">{relationshipLabel}</p>
            </div>
          </div>
        </section>

        <section className="ph-review-card">
          <div className="ph-review-card__head ph-review-card__head--row">
            <div className="ph-review-card__head-left">
              <span className="ph-review-card__head-ic" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
                    fill="#ff541e"
                  />
                  <circle cx="12" cy="10" r="2.5" fill="#fff" />
                </svg>
              </span>
              <h2 className="ph-review-card__title">{COPY.deliverTo}</h2>
            </div>
            {hasAddress ? (
              <button type="button" className="ph-review-change" onClick={() => setAddrSheetOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 9h16M10 5L5 9v11h14V9l-5-4-5 4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {COPY.changeAddress}
              </button>
            ) : null}
          </div>
          <div className="ph-review-card__body ph-review-card__body--stack">
            {!hasAddress ? (
              <>
                <p className="ph-review-muted">{COPY.noAddress}</p>
                <button type="button" className="ph-review-add-addr" onClick={() => setAddrSheetOpen(true)}>
                  + {COPY.addAddress}
                </button>
              </>
            ) : (
              <>
                <div className="ph-review-addr-pill-row">
                  <span className="ph-review-addr-pill">{(addr?.tag ?? "HOME").toUpperCase()}</span>
                </div>
                <p className="ph-review-addr-line">{addr?.displayLine}</p>
              </>
            )}
          </div>
        </section>

        <ContentSection kind={orderKind} draft={draft} />

        <div className="ph-review-warn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="#ed6c02" strokeWidth="1.5" />
            <path d="M12 8v5M12 16h.01" stroke="#ed6c02" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <p>{COPY.disclaimer}</p>
        </div>
      </div>

      <footer className="ph-review-footer">
        <button
          type="button"
          className="ph-review-confirm"
          disabled={confirmDisabled}
          onClick={() => void preparePlaceOrder()}
        >
          {/* {busy ? (
            <span className="ph-review-confirm__spinner" aria-hidden />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
          } */}
          <span className="ph-review-confirm__label">{COPY.confirmPlace}</span>
          {!busy ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>
      </footer>

      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />

      {placeConfirmOpen ? (
        <div className="ph-modal-overlay" role="presentation" onClick={() => setPlaceConfirmOpen(false)}>
          <div
            className="ph-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ph-review-place-title"
            aria-describedby="ph-review-place-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ph-modal__art" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogConfirm} alt="" />
            </div>
            <h2 id="ph-review-place-title" className="ph-modal__title">
              {COPY.placeOrderTitle}
            </h2>
            <p id="ph-review-place-desc" className="ph-modal__text">
              {COPY.placeOrderBody}
            </p>
            <div className="ph-modal__actions">
              <button type="button" className="ph-btn-grey" onClick={() => setPlaceConfirmOpen(false)}>
                {COPY.placeOrderCancel}
              </button>
              <button type="button" className="ph-btn-orange" onClick={() => void executePlaceOrder()}>
                {COPY.placeOrderConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContentSection({
  kind,
  draft,
}: Readonly<{ kind: PharmacyReviewOrderKind; draft: PharmacyReviewDraft }>) {
  if (draft.kind !== kind) return null;

  if (draft.kind === "OTC") {
    return (
      <section className="ph-review-card">
        <div className="ph-review-card__head">
          <span className="ph-review-card__head-ic" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 11V7a3 3 0 016 0v4M5 9h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"
                stroke="#ff541e"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <h2 className="ph-review-card__title">{COPY.orderType}</h2>
        </div>
        <div className="ph-review-card__body ph-review-card__body--stack">
          <span className="ph-review-chip">OTC medicines</span>
          <p className="ph-review-otc-copy">{COPY.otcSummary}</p>
        </div>
      </section>
    );
  }

  if (draft.kind === "UPLOAD") {
    const n = draft.files.length;
    return (
      <section className="ph-review-card">
        <div className="ph-review-card__head ph-review-card__head--row">
          <div className="ph-review-card__head-left">
            <span className="ph-review-card__head-ic" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#ff541e" strokeWidth="1.5" />
                <path d="M14 2v6h6" stroke="#ff541e" strokeWidth="1.5" />
              </svg>
            </span>
            <h2 className="ph-review-card__title">{COPY.uploadedTitle}</h2>
          </div>
          <span className="ph-review-count">{n}</span>
        </div>
        <div className="ph-review-card__body ph-review-card__body--stack">
          {draft.files.length === 0 ? (
            <p className="ph-review-muted">—</p>
          ) : (
            <ul className="ph-review-file-list">
              {draft.files.map((f, i) => (
                <li key={`${f.prescriptionId}-${i}`}>
                  {i > 0 ? <div className="ph-review-divider" /> : null}
                  <div className="ph-review-file-row">
                    <span className="ph-review-file-ic" aria-hidden>
                      {f.isPdf ? (
                        <span className="ph-review-file-pdf">PDF</span>
                      ) : f.isImage ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <rect x="4" y="5" width="16" height="14" rx="2" stroke="#ff541e" strokeWidth="1.5" />
                          <circle cx="9" cy="10" r="1.5" fill="#ff541e" />
                          <path d="M4 17l5-5 4 4 5-6" stroke="#ff541e" strokeWidth="1.25" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M8 6h11M8 12h11M8 18h7" stroke="#ff541e" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                    <span className="ph-review-file-name">{f.fileName}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle cx="12" cy="12" r="9" fill="#43a047" />
                      <path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
                    </svg>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  const n = draft.prescriptions.length;
  return (
    <section className="ph-review-card">
      <div className="ph-review-card__head ph-review-card__head--row">
        <div className="ph-review-card__head-left">
          <span className="ph-review-card__head-ic" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01" stroke="#ff541e" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <h2 className="ph-review-card__title">{COPY.selectedTitle}</h2>
        </div>
        <span className="ph-review-count">{n}</span>
      </div>
      <div className="ph-review-card__body ph-review-card__body--stack">
        {draft.prescriptions.length === 0 ? (
          <p className="ph-review-muted">—</p>
        ) : (
          <ul className="ph-review-rx-list">
            {draft.prescriptions.map((p, i) => (
              <li key={`${p.apiPrescriptionId}-${i}`}>
                {i > 0 ? <div className="ph-review-divider" /> : null}
                <div className="ph-review-rx-row">
                  <span className="ph-review-file-ic" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 4v4m6 2v6a6 6 0 01-12 0V10m12 0a6 6 0 10-12 0"
                        stroke="#ff541e"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path d="M10 14h4" stroke="#ff541e" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div className="ph-review-rx-meta">
                    <p className="ph-review-rx-doc">{p.doctorLabel}</p>
                    <div className="ph-review-rx-chips">
                      {p.dateLabel.trim() ? (
                        <span className="ph-review-mini-chip">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
                          </svg>
                          {p.dateLabel}
                        </span>
                      ) : null}
                      <span className="ph-review-mini-chip">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {p.medicineCount === 1 ? "1 medicine" : `${p.medicineCount} medicines`}
                      </span>
                      {p.isChronic ? (
                        <span className="ph-review-mini-chip ph-review-mini-chip--warn">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M12 4v4l3 3-3 4-3-4 3-3z" stroke="currentColor" strokeWidth="1.2" />
                          </svg>
                          Chronic
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
