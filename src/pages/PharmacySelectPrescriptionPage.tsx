import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { fetchPatientPrescriptions } from "@/api/pharmacyPrescriptions";
import type { PharmacyMockPrescription } from "@/constants/pharmacyMockData";
import { pharmacyFlipRxSelectionKey } from "@/constants/pharmacyMockData";
import { writePharmacyReviewDraft, type PharmacyReviewFlipRx } from "@/constants/pharmacyReviewDraft";
import { writePharmacyPrescriptionsCache } from "@/constants/pharmacyPrescriptionsCache";
import { readPharmacyFlowState } from "@/constants/pharmacyFlowStorage";
import { ROUTES } from "@/constants";
import { currentLocationPath } from "@/lib/flowReturnPath";
import {
  buildPharmacyPassState,
  readPharmacyBackPath,
  readPharmacyHubReturn,
  type PharmacyFlowNavState,
} from "@/lib/pharmacyFlowNav";
import { useToast } from "@/hooks/useToast";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import {
  readPharmacyFlipRxSelection,
  writePharmacyFlipRxSelection,
} from "@/constants/pharmacyFlipRxSelectionStorage";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { clearPharmacyDownstreamFromPrescriptionSelect } from "@/lib/bookingFlowStackCleanup";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./PharmacyPages.css";

type NavState = PharmacyFlowNavState &
  Readonly<{ prescription?: PharmacyMockPrescription }>;

const COPY = {
  multiHint: "Tap a card to select. You can pick multiple prescriptions.",
  noneHint: "Select one or more prescriptions to continue",
  selectAll: "Select all",
  clearSelection: "Clear",
  viewDetails: "View details",
  noPrescriptions: "No prescriptions available",
  noPrescriptionConsultHint:
    "Book a virtual consultation to get a prescription from our doctors",
  consultDoctor: "Consult Doctor",
  consultADoctor: "Consult a Doctor",
} as const;

function sortByDateDesc(list: readonly PharmacyMockPrescription[]): PharmacyMockPrescription[] {
  return [...list].sort((a, b) => {
    const ta = Date.parse(a.dateLabel);
    const tb = Date.parse(b.dateLabel);
    const da = Number.isNaN(ta) ? 0 : ta;
    const db = Number.isNaN(tb) ? 0 : tb;
    return db - da;
  });
}

function toReviewEntry(rx: PharmacyMockPrescription): PharmacyReviewFlipRx {
  return {
    apiPrescriptionId: pharmacyFlipRxSelectionKey(rx),
    doctorLabel: rx.doctorName,
    dateLabel: rx.dateLabel,
    medicineCount: rx.medicineCount,
  };
}

function ConsultDoctorVideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 8h8a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PharmacySelectPrescriptionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const mod = useProfileModuleGates();
  const hubReturn = readPharmacyHubReturn(location);
  const backPath = readPharmacyBackPath(location, ROUTES.pharmacy);
  const passState = useMemo(
    (): NavState => buildPharmacyPassState(hubReturn, backPath),
    [hubReturn, backPath],
  );

  const flow = readPharmacyFlowState();
  const patientId = flow?.patientId;
  const [list, setList] = useState<readonly PharmacyMockPrescription[]>([]);
  const [loading, setLoading] = useState(() => patientId != null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState(() =>
    patientId != null ? readPharmacyFlipRxSelection(patientId) : new Set<string>(),
  );

  const sorted = useMemo(() => sortByDateDesc(list), [list]);
  const total = sorted.length;
  const keys = useMemo(() => sorted.map((rx) => pharmacyFlipRxSelectionKey(rx)), [sorted]);

  const selectedCount = useMemo(() => keys.filter((k) => selectedIds.has(k)).length, [keys, selectedIds]);
  const hasSelection = selectedCount > 0;
  const allSelected = total > 0 && selectedCount === total;

  const load = useCallback(async () => {
    if (patientId == null) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPatientPrescriptions();
      writePharmacyPrescriptionsCache(patientId, items);
      setList(items);
      setSelectedIds((prev) => {
        const valid = new Set(items.map((rx) => pharmacyFlipRxSelectionKey(rx)));
        const next = new Set<string>();
        for (const id of prev) {
          if (valid.has(id)) next.add(id);
        }
        if (next.size === 0) {
          const stored = readPharmacyFlipRxSelection(patientId);
          for (const id of stored) {
            if (valid.has(id)) next.add(id);
          }
        }
        writePharmacyFlipRxSelection(patientId, next);
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load prescriptions";
      setError(msg);
      toast.error(msg);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleKey = useCallback(
    (key: string) => {
      if (patientId == null) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        writePharmacyFlipRxSelection(patientId, next);
        return next;
      });
    },
    [patientId],
  );

  const selectAll = useCallback(() => {
    if (patientId == null) return;
    const next = new Set(keys);
    writePharmacyFlipRxSelection(patientId, next);
    setSelectedIds(next);
  }, [keys, patientId]);

  const clearSelection = useCallback(() => {
    if (patientId == null) return;
    writePharmacyFlipRxSelection(patientId, []);
    setSelectedIds(new Set());
  }, [patientId]);

  const onToggleSelectAll = useCallback(() => {
    if (allSelected) clearSelection();
    else selectAll();
  }, [allSelected, clearSelection, selectAll]);

  const continueToReview = useCallback(() => {
    if (!flow) {
      toast.error("Session expired. Open pharmacy again.");
      void navigate(ROUTES.pharmacy, { state: passState, replace: true });
      return;
    }
    const chosen = sorted.filter((rx) => selectedIds.has(pharmacyFlipRxSelectionKey(rx)));
    if (chosen.length === 0) {
      toast.error("Select at least one prescription.");
      return;
    }
    writePharmacyReviewDraft({
      kind: "FLIPHEALTH",
      prescriptions: chosen.map(toReviewEntry),
    });
    void navigate(ROUTES.pharmacyReview, {
      state: {
        ...passState,
        backPath: ROUTES.pharmacySelectPrescription,
        orderKind: "FLIPHEALTH" as const,
      },
    });
  }, [flow, navigate, passState, selectedIds, sorted, toast]);

  const showFooter = !loading && !error && total > 0;
  const canBookVirtualConsultation = !mod.loaded || mod.consultation.sheetVirtual;
  const showConsultAppBar =
    canBookVirtualConsultation && !loading && !error && total > 0;

  const openVirtualConsultation = useCallback(() => {
    if (!canBookVirtualConsultation) return;
    void navigate(generatePath(ROUTES.consultationSelectPeople, { type: "virtual" }), {
      state: { returnPath: currentLocationPath(location) },
    });
  }, [canBookVirtualConsultation, location, navigate]);

  const consultAppBarAction = showConsultAppBar ? (
    <button type="button" className="ph-top-consult" onClick={openVirtualConsultation}>
      <span>{COPY.consultDoctor}</span>
      <ConsultDoctorVideoIcon />
    </button>
  ) : (
    <span className="ph-top__spacer" aria-hidden />
  );

  if (!flow) {
    return (
      <div className="ph-page">
        <header className="ph-top-wrap">
          <div className="ph-top">
            <FlowScreenBack
              fallbackTo={backPath}
              fallbackNavigate={{ state: passState }}
              className="app-back-btn ph-back"
              onBeforeBack={clearPharmacyDownstreamFromPrescriptionSelect}
            />
            <h1 className="ph-title">Select Prescription</h1>
            <span className="ph-top__spacer" aria-hidden />
          </div>
        </header>
        <div className="ph-page__main">
          <div className="ph-error">
            <div className="ph-error-illu" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogError} alt="" />
            </div>
            Open pharmacy from the home or services menu to continue.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ph-page${showFooter ? " ph-page--flip-select" : ""}`}>
      <header className="ph-top-wrap">
        <div className="ph-top">
          <FlowScreenBack
            fallbackTo={backPath}
            fallbackNavigate={{ state: passState }}
            className="app-back-btn ph-back"
            onBeforeBack={clearPharmacyDownstreamFromPrescriptionSelect}
          />
          <h1 className="ph-title">Select Prescription</h1>
          {consultAppBarAction}
        </div>
      </header>

      <main className={`ph-page__main${showFooter ? " ph-page__main--flip-select" : ""}`}>
        <div className="ph-dart-upload-member">
          <span className="ph-dart-upload-member__ic" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
                stroke="#ff541e"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="ph-dart-upload-member__text">
            <span className="ph-dart-upload-member__label">Ordering for</span>
            <span className="ph-dart-upload-member__name">{flow.patientName}</span>
          </div>
        </div>

        {loading ? <div className="ph-loading">Loading prescriptions…</div> : null}

        {!loading && error ? (
          <div className="ph-error ph-error--compact">
            <p>{error}</p>
            <button type="button" className="ph-btn-orange ph-btn-orange--retry" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && total === 0 ? (
          <div className="ph-flip-empty">
            <div className="ph-flip-empty__illu" aria-hidden>
              <img src={PHARMACY_IMAGES.flipHealthPrescription} alt="" />
            </div>
            <p className="ph-flip-empty__text">{COPY.noPrescriptions}</p>
            {canBookVirtualConsultation ? (
              <>
                <p className="ph-flip-empty__hint">{COPY.noPrescriptionConsultHint}</p>
                <button
                  type="button"
                  className="ph-btn-orange ph-flip-empty__cta"
                  onClick={openVirtualConsultation}
                >
                  {COPY.consultADoctor}
                  <ConsultDoctorVideoIcon />
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && total > 0 ? (
          <>
            <div className="ph-flip-list-header">
              <div className="ph-flip-list-count">
                <span
                  className={`ph-flip-list-count__num${hasSelection ? " ph-flip-list-count__num--accent" : ""}`}
                  aria-live="polite"
                >
                  {hasSelection ? `${selectedCount}/${total}` : `${total}`}
                </span>
                <span className="ph-flip-list-count__suffix">
                  {hasSelection ? "selected" : total === 1 ? "prescription" : "prescriptions"}
                </span>
              </div>
              <button type="button" className="ph-flip-list-selectall" onClick={onToggleSelectAll}>
                {allSelected ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M5 5h14v14H5V5z"
                      stroke="#ff541e"
                      strokeWidth="2"
                      fill="rgba(255,84,30,0.12)"
                    />
                    <path d="M8 12l3 3 5-6" stroke="#ff541e" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 5h14v14H5V5z" stroke="#ff541e" strokeWidth="2" />
                  </svg>
                )}
                {hasSelection && allSelected ? COPY.clearSelection : COPY.selectAll}
              </button>
            </div>
            <p className="ph-flip-list-hint">{COPY.multiHint}</p>

            <div className="ph-flip-list">
              {sorted.map((rx) => {
                const key = pharmacyFlipRxSelectionKey(rx);
                const selected = selectedIds.has(key);
                const detailPath = generatePath(ROUTES.pharmacyPrescriptionDetail, { prescriptionId: rx.prescriptionId });
                const preview = rx.medicines.slice(0, 3);
                const extra = rx.medicines.length - preview.length;

                return (
                  <article key={key} className={`ph-flip-rx-card${selected ? " ph-flip-rx-card--selected" : ""}`}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      className="ph-flip-rx-card__main"
                      onClick={() => toggleKey(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleKey(key);
                        }
                      }}
                    >
                    <div className="ph-flip-rx-card__head">
                      <span
                        className={`ph-flip-rx-card__tick${selected ? " ph-flip-rx-card__tick--on" : ""}`}
                        aria-hidden
                      >
                        {selected ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        ) : null}
                      </span>
                      <span className="ph-flip-rx-card__avatar" aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 4l1.5 3 3.5.5-2.5 2.5.6 3.5L12 12.5 8.9 13.5l.6-3.5L7 7.5l3.5-.5L12 4z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                          <path d="M7 20h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className="ph-flip-rx-card__meta">
                        <h2 className="ph-flip-rx-card__name">{rx.doctorName}</h2>
                        <p className="ph-flip-rx-card__spec">{rx.specialty}</p>
                        <div className="ph-flip-rx-card__date">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>{rx.dateLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ph-flip-rx-card__divider" aria-hidden />

                    <div className="ph-flip-rx-card__meds">
                      <div className="ph-flip-rx-card__med-count">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M9 11V7a3 3 0 016 0v4M5 9h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                        </svg>
                        <span>
                          {rx.medicineCount} {rx.medicineCount === 1 ? "medicine" : "medicines"}
                        </span>
                      </div>
                      {preview.map((m) => (
                        <div key={`${key}-${m.name}`} className="ph-flip-rx-med-row">
                          <span className="ph-flip-rx-med-row__ic" aria-hidden>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M12 6v12M9 9l3-3 3 3M9 15l3 3 3-3"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                          <div className="ph-flip-rx-med-row__text">
                            <div className="ph-flip-rx-med-row__name">{m.name}</div>
                            <div className="ph-flip-rx-med-row__sub">
                              {m.form} · {m.durationLabel}
                            </div>
                          </div>
                        </div>
                      ))}
                      {extra > 0 ? <span className="ph-flip-rx-card__more">+ {extra} more</span> : null}
                    </div>
                    </div>

                    <div className="ph-flip-rx-card__footer">
                      <button
                        type="button"
                        className="ph-flip-rx-card__detail"
                        onClick={() =>
                          void navigate(detailPath, {
                            state: {
                              ...passState,
                              backPath: ROUTES.pharmacySelectPrescription,
                              prescription: rx,
                            },
                          })
                        }
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"
                            stroke="currentColor"
                            strokeWidth="1.75"
                          />
                          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                        </svg>
                        {COPY.viewDetails}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </main>

      {showFooter ? (
        <div className="ph-footer-btn ph-footer-btn--flip">
          {hasSelection ? (
            <div className="ph-flip-footer-meta">
              <span className="ph-flip-footer-meta__check" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="ph-flip-footer-meta__text">
                {selectedCount} Selected
              </span>
              <button type="button" className="ph-flip-footer-clear" onClick={clearSelection}>
                {COPY.clearSelection}
              </button>
            </div>
          ) : (
            <div className="ph-flip-footer-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 5v.01M10 22a2 2 0 104 0 2 2 0 00-4 0zm4-12a4 4 0 11-8 0 4 4 0 018 0z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>{COPY.noneHint}</span>
            </div>
          )}
          <button
            type="button"
            className="ph-footer-btn__inner ph-footer-btn__inner--review"
            disabled={!hasSelection}
            onClick={() => continueToReview()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <span className="ph-footer-order-label">
              {hasSelection
                ? `Review order · ${selectedCount} ${selectedCount === 1 ? "prescription" : "prescriptions"}`
                : "Review order"}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
