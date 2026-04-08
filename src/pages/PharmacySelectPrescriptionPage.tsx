import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { fetchPatientPrescriptions } from "@/api/pharmacyPrescriptions";
import type { PharmacyMockPrescription } from "@/constants/pharmacyMockData";
import { writePharmacyPrescriptionsCache } from "@/constants/pharmacyPrescriptionsCache";
import { readPharmacyFlowState } from "@/constants/pharmacyFlowStorage";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./PharmacyPages.css";

type NavState = Readonly<{ returnPath?: string; prescription?: PharmacyMockPrescription }>;

export function PharmacySelectPrescriptionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const hubReturn = (location.state as NavState | null)?.returnPath ?? ROUTES.dashboard;
  const passState = useMemo((): NavState => ({ returnPath: hubReturn }), [hubReturn]);

  const flow = readPharmacyFlowState();
  const patientId = flow?.patientId;
  const [list, setList] = useState<readonly PharmacyMockPrescription[]>([]);
  const [loading, setLoading] = useState(() => patientId != null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    if (patientId == null) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPatientPrescriptions();
      writePharmacyPrescriptionsCache(patientId, items);
      setList(items);
      setIndex(0);
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

  const rx = list[index] ?? list[0];
  const total = list.length;

  const detailPath = useMemo(
    () => (rx ? generatePath(ROUTES.pharmacyPrescriptionDetail, { prescriptionId: rx.prescriptionId }) : ""),
    [rx],
  );

  if (!flow) {
    return (
      <div className="ph-page">
        <header className="ph-top-wrap">
          <div className="ph-top">
            <Link to={ROUTES.pharmacy} state={passState} className="ph-back" aria-label="Back">
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
    <div className="ph-page">
      <header className="ph-top-wrap">
        <div className="ph-top">
          <Link to={ROUTES.pharmacy} state={passState} className="ph-back" aria-label="Back">
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
          <h1 className="ph-title">Select Prescription</h1>
          <span className="ph-top__spacer" aria-hidden />
        </div>
      </header>

      <main className="ph-page__main">
        <div className="ph-member-card ph-member-card--static">
          <span className="ph-member-card__text">
            <span className="ph-member-card__label">Ordering for</span>
            <span className="ph-member-card__name">{flow.patientName}</span>
          </span>
        </div>

        <div className="ph-select-illu" aria-hidden>
          <img src={PHARMACY_IMAGES.flipHealthPrescription} alt="" />
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
          <div className="ph-empty-files">
            No Flip Health prescriptions found for this profile. Upload a prescription or choose another option on
            the previous screen.
          </div>
        ) : null}

        {!loading && !error && total > 0 ? (
          <>
            <p className="ph-carousel-hint">
              <span aria-hidden>👉</span> Swipe to browse {index + 1} / {total}
            </p>

            {rx ? (
              <article className="ph-rx-card" aria-label={`Prescription ${index + 1} of ${total}`}>
                <div className="ph-rx-card__head">
                  <div className="ph-rx-card__doc">
                    <h2 className="ph-rx-card__name">{rx.doctorName}</h2>
                    <p className="ph-rx-card__spec">{rx.specialty}</p>
                  </div>
                  <span aria-hidden style={{ color: "#bbb" }}>
                    ›
                  </span>
                </div>
                <div className="ph-rx-chips">
                  <span className="ph-rx-chip">📅 {rx.dateLabel}</span>
                  <span className="ph-rx-chip">💊 {rx.medicineCount} medicines</span>
                </div>
                {rx.medicines[0] ? (
                  <div className="ph-rx-med">
                    <div className="ph-rx-med__name">{rx.medicines[0].name}</div>
                    <div className="ph-rx-med__meta">
                      {rx.medicines[0].form} · {rx.medicines[0].durationLabel}
                    </div>
                  </div>
                ) : null}
              </article>
            ) : null}

            <div className="ph-carousel-nav">
              <button
                type="button"
                aria-label="Previous prescription"
                onClick={() => setIndex((i) => (i - 1 + total) % total)}
              >
                ‹
              </button>
              <span className="ph-carousel-dots">
                {index + 1} / {total}
              </span>
              <button
                type="button"
                aria-label="Next prescription"
                onClick={() => setIndex((i) => (i + 1) % total)}
              >
                ›
              </button>
            </div>

            <button
              type="button"
              className="ph-btn-view"
              onClick={() => {
                if (detailPath && rx) void navigate(detailPath, { state: { ...passState, prescription: rx } });
              }}
            >
              👁 View Details & Order →
            </button>
            <p className="ph-bottom-hint">Tap a card to view details & place order</p>
          </>
        ) : null}
      </main>
    </div>
  );
}
