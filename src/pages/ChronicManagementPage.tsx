import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, generatePath, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import {
  createChronicCondition,
  fetchChronicCheck,
  fetchChronicConditions,
  updateChronicOptIn,
  type ChronicConditionRow,
} from "@/api/patientChronic";
import { CHRONIC_ASSETS, CHRONIC_PROGRAM_CARD_IMAGE } from "@/constants/chronicAssets";
import { CHRONIC_PROGRAMS, type ChronicConditionId } from "@/lib/chronicConditions";
import "./ChronicPages.css";

type NavState = Readonly<{ returnPath?: string; fromDashboard?: boolean }>;
type ChronicPromoCard = "order" | "optin" | null;

function toYmd(dateIsoValue: string): string {
  const d = new Date(dateIsoValue);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolveChronicPromoCard(check: {
  chronicModule: boolean;
  medicineModule: boolean;
  available: boolean;
} | null): ChronicPromoCard {
  if (!check) return null;
  if (!check.chronicModule || !check.medicineModule) return null;
  // Priority: valid order flow beats opt-in if backend sends inconsistent flags.
  if (check.available) return "order";
  return "optin";
}

export function ChronicManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const navState = (location.state as NavState | null) ?? null;
  const returnPath = navState?.returnPath ?? ROUTES.services;

  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState<{
    chronicModule: boolean;
    medicineModule: boolean;
    available: boolean;
    amount: number;
  } | null>(null);
  const [conditions, setConditions] = useState<ChronicConditionRow[]>([]);
  const [optInOpen, setOptInOpen] = useState(false);
  const [optInBusy, setOptInBusy] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedInactiveProgram, setSelectedInactiveProgram] = useState<ChronicConditionId | null>(null);
  const [enrollNote, setEnrollNote] = useState("");
  const [enrollHistory, setEnrollHistory] = useState("");
  const [enrollSince, setEnrollSince] = useState("");
  const [enrollBusy, setEnrollBusy] = useState(false);

  const activeConditionSet = useMemo(
    () => new Set(conditions.map((c) => c.condition)),
    [conditions],
  );
  const promoCard = useMemo(() => resolveChronicPromoCard(check), [check]);
  const selectedProgramMeta = useMemo(
    () =>
      selectedInactiveProgram
        ? CHRONIC_PROGRAMS.find((program) => program.id === selectedInactiveProgram) ?? null
        : null,
    [selectedInactiveProgram],
  );
  const letsGoEnabled =
    enrollNote.trim() !== "" && enrollHistory.trim() !== "" && enrollSince.trim() !== "" && !enrollBusy;
  const letsGoDisabled = !letsGoEnabled;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [checkRes, conditionsRes] = await Promise.all([
        fetchChronicCheck(),
        fetchChronicConditions(),
      ]);
      setCheck(checkRes);
      setConditions(conditionsRes);
      if (
        (navState?.fromDashboard || returnPath === ROUTES.dashboard) &&
        resolveChronicPromoCard(checkRes) === "optin"
      ) {
        setOptInOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load chronic details");
    } finally {
      setLoading(false);
    }
  }, [navState?.fromDashboard, returnPath, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenProgram = useCallback(
    (conditionId: ChronicConditionId) => {
      if (activeConditionSet.has(conditionId)) {
        void navigate(generatePath(ROUTES.chronicDetail, { conditionId }), {
          state: { returnPath: ROUTES.chronic },
        });
        return;
      }
      setSelectedInactiveProgram(conditionId);
      setEnrollNote("");
      setEnrollHistory("");
      setEnrollSince("");
      setEnrollOpen(true);
    },
    [activeConditionSet, navigate],
  );

  const handleOptIn = useCallback(async () => {
    setOptInBusy(true);
    try {
      const message = await updateChronicOptIn();
      toast.success(message);
      setOptInOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update chronic opt-in");
    } finally {
      setOptInBusy(false);
    }
  }, [load, toast]);

  if (loading) {
    return (
      <div className="chronic-page">
        <header className="chronic-page__header">
          <Link to={returnPath} className="chronic-page__back" aria-label="Back">
            <span aria-hidden>←</span>
          </Link>
          <h1 className="chronic-page__title">Chronic Management</h1>
          <span className="chronic-page__spacer" aria-hidden />
        </header>
        <main className="chronic-page__main">
          <p className="chronic-muted" aria-busy="true">Loading…</p>
        </main>
      </div>
    );
  }

  if (check && !check.chronicModule) {
    return <Navigate to={ROUTES.services} replace />;
  }

  return (
    <div className="chronic-page">
      <header className="chronic-page__header">
        <Link to={returnPath} className="chronic-page__back" aria-label="Back">
          <span aria-hidden>←</span>
        </Link>
        <h1 className="chronic-page__title">Chronic Management</h1>
        <button type="button" className="chronic-refresh" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <main className="chronic-page__main">
        <section className="chronic-hero">
          <img
            src={CHRONIC_ASSETS.banners.chronicManagementBanner}
            alt="Chronic care banner"
            className="chronic-hero__img"
          />
        </section>

        {promoCard === "order" ? (
          <button
            type="button"
            className="chronic-banner-btn"
            onClick={() => {
              void navigate(ROUTES.pharmacy, {
                state: { returnPath: ROUTES.chronic },
              });
            }}
          >
            <img
              src={CHRONIC_ASSETS.banners.chronicOrderBanner}
              alt="Order chronic medicines"
              className="chronic-banner-btn__img"
            />
          </button>
        ) : null}

        {promoCard === "optin" ? (
          <button type="button" className="chronic-banner-btn" onClick={() => setOptInOpen(true)}>
            <img
              src={CHRONIC_ASSETS.banners.optInBanner}
              alt="Opt in chronic medicines"
              className="chronic-banner-btn__img"
            />
          </button>
        ) : null}

        <section className="chronic-programs">
          <h2>Choose from our programs</h2>
          <div className="chronic-programs__grid">
            {CHRONIC_PROGRAMS.map((program) => {
              const active = activeConditionSet.has(program.id);
              return (
                <button
                  key={program.id}
                  type="button"
                  className="chronic-program-card"
                  onClick={() => handleOpenProgram(program.id)}
                >
                  <img
                    src={CHRONIC_PROGRAM_CARD_IMAGE[program.id]}
                    alt={program.title}
                    className="chronic-program-card__img"
                  />
                  <div className="chronic-program-card__body">
                    <div className="chronic-program-card__top">
                      <h3>{program.title}</h3>
                    </div>
                    <p>{program.shortDescription}</p>
                    <div className="chronic-program-card__meta">
                      <span className={`chronic-pill ${active ? "chronic-pill--active" : ""}`}>
                        {active ? "Active" : "Inactive"}
                      </span>
                      <span className="chronic-program-card__arrow" aria-hidden>
                        ›
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {optInOpen ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop"
            aria-label="Close"
            onClick={() => !optInBusy && setOptInOpen(false)}
          />
          <dialog
            className="chronic-modal__sheet chronic-modal__sheet--bottom chronic-crt-sheet chronic-optin-sheet"
            open
            aria-modal="true"
          >
            <div className="chronic-sheet-handle" aria-hidden />
            <h3>Opt in for Chronic Medicines</h3>
            <p>
              By opting in,{" "}
              <strong>
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(check?.amount ?? 0)}
              </strong>{" "}
              will be deducted from your wallet. This amount is non-refundable.
            </p>
            <div className="chronic-modal__actions">
              <button
                type="button"
                className="chronic-btn chronic-btn--ghost"
                onClick={() => setOptInOpen(false)}
                disabled={optInBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chronic-btn"
                onClick={() => {
                  handleOptIn().catch(() => {});
                }}
                disabled={optInBusy}
              >
                {optInBusy ? "Updating…" : "Opt In"}
              </button>
            </div>
          </dialog>
        </div>
      ) : null}

      {enrollOpen && selectedInactiveProgram && selectedProgramMeta ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop chronic-modal__backdrop--soft"
            aria-label="Close"
            onClick={() => {
              if (enrollBusy) return;
              setEnrollOpen(false);
            }}
          />
          <dialog
            className="chronic-modal__sheet chronic-modal__sheet--bottom chronic-crt-sheet chronic-enroll-sheet"
            open
            aria-modal="true"
          >
            <div className="chronic-crt-sheet__head">
              <h3>{selectedProgramMeta.title}</h3>
            </div>
            <p className="chronic-enroll-sheet__subtitle">
              Add your condition details to begin this program.
            </p>
            <div className="chronic-crt-sheet__field">
              <div className="chronic-crt-sheet__input-wrap">
                <input
                  value={enrollNote}
                  onChange={(e) => setEnrollNote(e.target.value)}
                  placeholder="Notes"
                />
              </div>
            </div>
            <div className="chronic-crt-sheet__field">
              <div className="chronic-crt-sheet__input-wrap">
                <input
                  value={enrollHistory}
                  onChange={(e) => setEnrollHistory(e.target.value)}
                  placeholder="Hereditary"
                />
              </div>
            </div>
            <div className="chronic-crt-sheet__field">
              <div className="chronic-crt-sheet__input-wrap">
                <input
                  type="date"
                  value={enrollSince}
                  onChange={(e) => setEnrollSince(e.target.value)}
                />
              </div>
            </div>
            {letsGoDisabled ? (
              <p className="chronic-crt-sheet__error">Please fill all required details.</p>
            ) : null}
            <div className="chronic-crt-sheet__actions">
              <button
                type="button"
                className="chronic-btn"
                disabled={letsGoDisabled}
                onClick={() => {
                  if (letsGoDisabled) return;
                  setEnrollBusy(true);
                  createChronicCondition({
                    condition: selectedInactiveProgram,
                    note: enrollNote.trim(),
                    history: enrollHistory.trim(),
                    since: toYmd(enrollSince),
                    ended: null,
                  })
                    .then(async () => {
                      toast.success("Condition added successfully.");
                      setEnrollOpen(false);
                      await load();
                    })
                    .catch((e) => {
                      toast.error(
                        e instanceof Error ? e.message : "Could not add chronic condition",
                      );
                    })
                    .finally(() => setEnrollBusy(false));
                }}
              >
                {enrollBusy ? "Submitting…" : "Let's Go"}
              </button>
            </div>
          </dialog>
        </div>
      ) : null}
    </div>
  );
}
