import { useMemo, useState } from "react";
import { Link, Navigate, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { AppBackChevron } from "@/components/navigation/AppBackChevron";
import { ROUTES } from "@/constants";
import {
  CHRONIC_ASSETS,
  CHRONIC_DETAIL_HERO_IMAGE,
} from "@/constants/chronicAssets";
import { useToast } from "@/hooks/useToast";
import { createChronicCondition } from "@/api/patientChronic";
import {
  CHRONIC_ENROLLMENT_JOURNEY,
  chronicConditionMetaById,
  isChronicConditionId,
} from "@/lib/chronicConditions";
import "./ChronicPages.css";

type NavState = Readonly<{ returnPath?: string }>;

function toYmd(dateIsoValue: string): string {
  const d = new Date(dateIsoValue);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ChronicConditionEnrollPage() {
  const { conditionId = "" } = useParams<{ conditionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const navState = (location.state as NavState | null) ?? null;
  const returnPath = navState?.returnPath ?? ROUTES.chronic;

  const meta = useMemo(() => chronicConditionMetaById(conditionId), [conditionId]);
  const validConditionId = isChronicConditionId(conditionId) ? conditionId : null;

  const [openedJourneyIndex, setOpenedJourneyIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState("");
  const [since, setSince] = useState("");
  const [busy, setBusy] = useState(false);

  if (!meta || !validConditionId) {
    return <Navigate to={ROUTES.chronic} replace />;
  }

  const submitEnabled = note.trim() !== "" && history.trim() !== "" && since.trim() !== "" && !busy;

  return (
    <div className="chronic-page">
      <header className="chronic-page__header">
        <Link to={returnPath} className="app-back-btn chronic-page__back" aria-label="Back">
          <AppBackChevron size={22} />
        </Link>
        <h1 className="chronic-page__title">{meta.title}</h1>
        <span className="chronic-page__spacer" aria-hidden />
      </header>

      <main className="chronic-page__main">
        <section className="chronic-hero">
          <img src={CHRONIC_DETAIL_HERO_IMAGE[validConditionId]} alt={meta.title} className="chronic-hero__img" />
        </section>

        <section className="chronic-block">
          <h3>Benefits you get</h3>
          <ul className="chronic-list-grid">
            {CHRONIC_ASSETS.enrollBenefits.map((benefit) => (
              <li key={benefit.title}>
                <img src={benefit.icon} alt="" className="chronic-benefit__icon" />
                <span>{benefit.title}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="chronic-block">
          <h3>Your journey with us</h3>
          <div className="chronic-accordion">
            {CHRONIC_ENROLLMENT_JOURNEY.map((item, idx) => {
              const open = idx === openedJourneyIndex;
              return (
                <button
                  key={item}
                  type="button"
                  className={`chronic-accordion__item${open ? " chronic-accordion__item--open" : ""}`}
                  onClick={() => setOpenedJourneyIndex(idx)}
                >
                  <span className="chronic-accordion__index">{idx + 1}</span>
                  <span className="chronic-accordion__text">{item}</span>
                </button>
              );
            })}
          </div>
        </section>

        <button type="button" className="chronic-btn chronic-btn--full" onClick={() => setModalOpen(true)}>
          Let&apos;s Go
        </button>
      </main>

      {modalOpen ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop"
            aria-label="Close"
            onClick={() => !busy && setModalOpen(false)}
          />
          <dialog className="chronic-modal__sheet" open aria-modal="true">
            <h3>Add Condition Details</h3>
            <label className="chronic-field">
              <span>Notes</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Enter notes" />
            </label>
            <label className="chronic-field">
              <span>Heredity</span>
              <input
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                placeholder="Family history"
              />
            </label>
            <label className="chronic-field">
              <span>Since</span>
              <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
            </label>
            <div className="chronic-modal__actions">
              <button
                type="button"
                className="chronic-btn chronic-btn--ghost"
                onClick={() => setModalOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chronic-btn"
                disabled={!submitEnabled}
                onClick={() => {
                  if (!submitEnabled) return;
                  setBusy(true);
                  createChronicCondition({
                    condition: validConditionId,
                    note: note.trim(),
                    history: history.trim(),
                    since: toYmd(since),
                    ended: null,
                  })
                    .then(() => {
                      toast.success("Condition added successfully.");
                      void navigate(generatePath(ROUTES.chronicDetail, { conditionId: validConditionId }), {
                        replace: true,
                      });
                    })
                    .catch((e) => {
                      toast.error(
                        e instanceof Error ? e.message : "Could not add chronic condition",
                      );
                    })
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </dialog>
        </div>
      ) : null}
    </div>
  );
}
