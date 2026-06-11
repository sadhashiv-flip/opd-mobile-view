import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { AppBackChevron } from "@/components/navigation/AppBackChevron";
import { ROUTES } from "@/constants";
import { CHRONIC_ASSETS } from "@/constants/chronicAssets";
import { useToast } from "@/hooks/useToast";
import {
  addChronicParameter,
  addChronicProfileCategory,
  fetchChronicConditions,
  fetchChronicParametersByDate,
  fetchChronicProfileCategory,
  updateChronicCondition,
  type ChronicConditionRow,
  type ChronicProfileEntry,
} from "@/api/patientChronic";
import {
  CHRONIC_DIABETES_DIET_GUIDE,
  CHRONIC_NUTRITION_PLAN_KEYS,
  CHRONIC_PARAMETER_TYPES,
  CHRONIC_PROFILE_SECTIONS,
  chronicConditionMetaById,
  isChronicConditionId,
} from "@/lib/chronicConditions";
import temperatureIcon from "@/assets/activities/temperature.svg";
import spo2Icon from "@/assets/activities/spo2.svg";
import heartRateIcon from "@/assets/activities/heart_rate.svg";
import bpIcon from "@/assets/activities/bp.svg";
import glucoseIcon from "@/assets/activities/glucose.svg";
import "./ChronicPages.css";

type NavState = Readonly<{ returnPath?: string }>;
type ProfileSection = "symptom" | "medicine" | "notes";

function toYmd(dateObj: Date): string {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatPrettyDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PARAMETER_ICONS: Record<"TEMP" | "O2" | "HR" | "BP" | "GL", string> = {
  TEMP: temperatureIcon,
  O2: spo2Icon,
  HR: heartRateIcon,
  BP: bpIcon,
  GL: glucoseIcon,
};

const PARAMETER_CARD_ORDER: readonly ("O2" | "TEMP" | "BP" | "GL" | "HR")[] = [
  "O2",
  "TEMP",
  "BP",
  "GL",
  "HR",
];

function displayConditionTitle(conditionId: string): string {
  if (conditionId === "CoronaryArtery") return "Coronary Artery";
  return conditionId;
}

function toProfileApiCategory(
  section: ProfileSection,
): "symptom" | "medicine" | "note" {
  return section === "notes" ? "note" : section;
}

export function ChronicConditionDetailPage() {
  const { conditionId = "" } = useParams<{ conditionId: string }>();
  const toast = useToast();
  const location = useLocation();
  const navState = (location.state as NavState | null) ?? null;
  const returnPath = navState?.returnPath ?? ROUTES.chronic;

  const meta = useMemo(() => chronicConditionMetaById(conditionId), [conditionId]);
  const validConditionId = isChronicConditionId(conditionId) ? conditionId : null;
  const pageTitle = useMemo(
    () => (validConditionId ? displayConditionTitle(validConditionId) : meta?.title ?? "Condition"),
    [meta?.title, validConditionId],
  );

  const [loading, setLoading] = useState(true);
  const [conditionRow, setConditionRow] = useState<ChronicConditionRow | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => toYmd(new Date()));
  const [logsDate, setLogsDate] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [profileEntries, setProfileEntries] = useState<Record<string, ChronicProfileEntry[]>>({});
  const [activeSection, setActiveSection] = useState<ProfileSection>("symptom");

  const [newParamType, setNewParamType] =
    useState<(typeof CHRONIC_PARAMETER_TYPES)[number]["apiType"]>("TEMP");
  const [newParamValue, setNewParamValue] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [newSectionValue, setNewSectionValue] = useState("");
  const [newDose, setNewDose] = useState("");
  const [criticalModalOpen, setCriticalModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [nutritionModalOpen, setNutritionModalOpen] = useState(false);
  const [dietGuideModalOpen, setDietGuideModalOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [editHistory, setEditHistory] = useState("");
  const [editSince, setEditSince] = useState("");
  const nutritionPlanImages = useMemo(
    () =>
      CHRONIC_NUTRITION_PLAN_KEYS.map(
        (k) => new URL(`../assets/chronic/nutritionPlan/${k}.png`, import.meta.url).href,
      ),
    [],
  );
  const selectedParamMeta = useMemo(
    () => CHRONIC_PARAMETER_TYPES.find((param) => param.apiType === newParamType) ?? null,
    [newParamType],
  );
  const isBpType = newParamType === "BP";
  const isNewParamValueValid = isBpType
    ? Number(bpSystolic) > 0 && Number(bpDiastolic) > 0
    : Number(newParamValue) > 0;
  const isNewParamValueInvalid = !isNewParamValueValid;
  const resolvedParameterValue = isBpType
    ? `${bpSystolic.trim()}/${bpDiastolic.trim()}`
    : newParamValue.trim();

  const loadConditionAndParams = useCallback(async () => {
    if (!validConditionId) return;
    const [conditions, params] = await Promise.all([
      fetchChronicConditions(),
      fetchChronicParametersByDate(selectedDate),
    ]);
    const row = conditions.find((c) => c.condition === validConditionId) ?? null;
    setConditionRow(row);
    const map: Record<string, string> = {};
    for (const p of params) {
      map[p.type] = p.value;
    }
    setParamValues(map);
  }, [selectedDate, validConditionId]);

  const loadSection = useCallback(
    async (section: ProfileSection, dateYmd = logsDate) => {
      const list = await fetchChronicProfileCategory({
        category: toProfileApiCategory(section),
        dateIso: dateYmd ? new Date(dateYmd).toISOString() : undefined,
      });
      setProfileEntries((prev) => ({ ...prev, [section]: list }));
    },
    [logsDate],
  );

  const loadAll = useCallback(async () => {
    if (!validConditionId) return;
    setLoading(true);
    try {
      await loadConditionAndParams();
      await Promise.all(CHRONIC_PROFILE_SECTIONS.map((sec) => loadSection(sec.categoryApiValue)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load chronic details");
    } finally {
      setLoading(false);
    }
  }, [loadConditionAndParams, loadSection, toast, validConditionId]);

  useEffect(() => {
    if (!profileModalOpen) return;
    loadSection(activeSection, logsDate).catch(() => {});
  }, [activeSection, loadSection, logsDate, profileModalOpen]);

  useEffect(() => {
    loadAll().catch(() => {});
  }, [loadAll]);

  useEffect(() => {
    if (!conditionRow) return;
    setEditNote(conditionRow.note);
    setEditHistory(conditionRow.history);
    setEditSince(conditionRow.since?.slice(0, 10) ?? "");
  }, [conditionRow]);

  if (!meta || !validConditionId) {
    return <Navigate to={ROUTES.chronic} replace />;
  }

  if (!loading && !conditionRow) {
    return <Navigate to={ROUTES.chronic} replace />;
  }

  return (
    <div className="chronic-page chronic-page--detail">
      <header className="chronic-page__header">
        <Link to={returnPath} className="app-back-btn chronic-page__back" aria-label="Back">
          <AppBackChevron size={22} />
        </Link>
        <h1 className="chronic-page__title">{pageTitle}</h1>
        <span className="chronic-page__spacer" aria-hidden />
      </header>

      <main className="chronic-page__main">
        {loading ? <p className="chronic-muted">Loading…</p> : null}

        {!loading && conditionRow ? (
          <>
            <section className="chronic-summary">
              <div>
                <h2>{pageTitle} Program</h2>
                <p>
                  Since:{" "}
                  {conditionRow.since
                    ? formatPrettyDate(conditionRow.since)
                    : "—"}
                </p>
                <p>Notes: {conditionRow.note || "—"}</p>
                <p>Hereditary: {conditionRow.history || "—"}</p>
              </div>
              <button
                type="button"
                className="chronic-summary__edit"
                onClick={() => setEditOpen(true)}
                aria-label="Edit condition"
              >
                ✎
              </button>
            </section>

            <section className="chronic-quick-grid">
              <button
                type="button"
                className="chronic-quick-card"
                onClick={() => setNutritionModalOpen(true)}
              >
                <span className="chronic-quick-card__icon-wrap">
                  <img
                    src={CHRONIC_ASSETS.enrollBenefits[0].icon}
                    alt=""
                    className="chronic-quick-card__icon"
                  />
                </span>
                <h3>Nutrition Plan</h3>
                <p>Open your chronic nutrition plan.</p>
                <span className="chronic-quick-card__cta">
                  Tap to open <span aria-hidden>›</span>
                </span>
              </button>
              <button
                type="button"
                className="chronic-quick-card"
                onClick={() => setDietGuideModalOpen(true)}
              >
                <span className="chronic-quick-card__icon-wrap">
                  <img
                    src={CHRONIC_ASSETS.enrollBenefits[5].icon}
                    alt=""
                    className="chronic-quick-card__icon"
                  />
                </span>
                <h3>Diet Charts</h3>
                <p>Open condition-specific dietary guidance.</p>
                <span className="chronic-quick-card__cta">
                  Tap to open <span aria-hidden>›</span>
                </span>
              </button>
            </section>

            <section className="chronic-block">
              <div className="chronic-block__head">
                <h3>Critical Parameters</h3>
                <label className="chronic-date-chip">
                  <span aria-hidden>📅</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="chronic-params-grid">
                {PARAMETER_CARD_ORDER.map((type) => {
                  const p = CHRONIC_PARAMETER_TYPES.find((item) => item.apiType === type);
                  if (!p) return null;
                  return (
                  <button
                    key={p.apiType}
                    type="button"
                    className="chronic-param-card"
                    onClick={() => {
                      setNewParamType(p.apiType);
                      setCriticalModalOpen(true);
                    }}
                  >
                    <img
                      src={PARAMETER_ICONS[p.apiType]}
                      alt=""
                      className="chronic-param-card__icon"
                    />
                    <span>{p.label}</span>
                    <strong>
                      {paramValues[p.apiType] ? `${paramValues[p.apiType]} ${p.units}` : "--"}
                    </strong>
                  </button>
                  );
                })}
              </div>
            </section>

            <section className="chronic-block">
              <h3>Your logs</h3>
              <div className="chronic-profile-list">
                {CHRONIC_PROFILE_SECTIONS.map((sec) => (
                  <button
                    key={sec.key}
                    type="button"
                    className="chronic-profile-item"
                    onClick={() => {
                      setActiveSection(sec.categoryApiValue);
                      setProfileModalOpen(true);
                    }}
                  >
                    <div className="chronic-profile-item__copy">
                      <p className="chronic-profile-item__title">{sec.title}</p>
                      <p className="chronic-profile-item__hint">Track day-wise entries</p>
                    </div>
                    <span className="chronic-profile-item__arrow" aria-hidden>
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </main>

      {criticalModalOpen ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop chronic-modal__backdrop--soft"
            aria-label="Close"
            onClick={() => setCriticalModalOpen(false)}
          />
          <dialog
            className="chronic-modal__sheet chronic-modal__sheet--bottom chronic-crt-sheet"
            open
            aria-modal="true"
          >
            <div className="chronic-crt-sheet__head">
              <h3>Add critical parameter</h3>
            </div>
            <div className="chronic-crt-sheet__types" role="tablist" aria-label="Parameter type">
              {CHRONIC_PARAMETER_TYPES.map((p) => {
                const active = p.apiType === newParamType;
                return (
                  <button
                    key={p.apiType}
                    type="button"
                    className={`chronic-crt-sheet__type${active ? " chronic-crt-sheet__type--active" : ""}`}
                    onClick={() => {
                      setNewParamType(p.apiType);
                      setNewParamValue("");
                      setBpSystolic("");
                      setBpDiastolic("");
                    }}
                  >
                    {active ? <span className="chronic-crt-sheet__tick">✓</span> : null}
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="chronic-crt-sheet__field">
              {isBpType ? (
                <div className="chronic-crt-sheet__bp-grid">
                  <div className="chronic-crt-sheet__input-wrap">
                    <input
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      placeholder="Systolic"
                    />
                  </div>
                  <div className="chronic-crt-sheet__input-wrap">
                    <input
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      placeholder="Diastolic"
                    />
                  </div>
                </div>
              ) : (
                <div className="chronic-crt-sheet__input-wrap">
                  <input
                    type="number"
                    value={newParamValue}
                    onChange={(e) => setNewParamValue(e.target.value)}
                    placeholder="Value"
                  />
                  <small>{selectedParamMeta?.units ?? ""}</small>
                </div>
              )}
            </div>
            {isNewParamValueInvalid ? (
              <p className="chronic-crt-sheet__error">
                {isBpType
                  ? "Enter valid systolic and diastolic values."
                  : "Enter a valid value."}
              </p>
            ) : null}
            <div className="chronic-crt-sheet__actions">
              <button
                type="button"
                className="chronic-btn"
                disabled={isNewParamValueInvalid}
                onClick={() => {
                  if (isNewParamValueInvalid) return;
                  addChronicParameter({
                    type: newParamType,
                    value: resolvedParameterValue,
                  })
                    .then(async (msg) => {
                      toast.success(msg);
                      setNewParamValue("");
                      setBpSystolic("");
                      setBpDiastolic("");
                      setCriticalModalOpen(false);
                      await loadConditionAndParams();
                    })
                    .catch((e) => {
                      toast.error(e instanceof Error ? e.message : "Could not add parameter");
                    });
                }}
              >
                Submit
              </button>
            </div>
          </dialog>
        </div>
      ) : null}

      {profileModalOpen ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop chronic-modal__backdrop--soft"
            aria-label="Close"
            onClick={() => setProfileModalOpen(false)}
          />
          <dialog
            className="chronic-modal__sheet chronic-modal__sheet--bottom chronic-crt-sheet chronic-profile-sheet"
            open
            aria-modal="true"
          >
            <div className="chronic-crt-sheet__head chronic-profile-sheet__head">
              <h3>
                Add {CHRONIC_PROFILE_SECTIONS.find((s) => s.categoryApiValue === activeSection)?.title}
              </h3>
              <label className="chronic-date-chip">
                <span aria-hidden>📅</span>
                <input
                  type="date"
                  value={logsDate}
                  onChange={(e) => {
                    setLogsDate(e.target.value);
                  }}
                />
              </label>
              <button
                type="button"
                className="chronic-profile-sheet__reset"
                onClick={() => {
                  setLogsDate("");
                }}
              >
                Reset
              </button>
            </div>
            <div className="chronic-profile-sheet__entries">
              {(profileEntries[activeSection] ?? []).length === 0 ? (
                <p className="chronic-muted">No entries for selected date.</p>
              ) : (
                (profileEntries[activeSection] ?? []).map((entry) => (
                  <article key={entry.id} className="chronic-entry">
                    <p>{entry.value || "—"}</p>
                    {activeSection === "medicine" && entry.dose ? (
                      <small>Dose: {entry.dose}</small>
                    ) : null}
                    <small>
                      {entry.datetime
                        ? new Date(entry.datetime).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </small>
                  </article>
                ))
              )}
            </div>
            <div className="chronic-crt-sheet__field">
              {activeSection === "medicine" ? (
                <div className="chronic-crt-sheet__bp-grid">
                  <div className="chronic-crt-sheet__input-wrap">
                    <input
                      value={newSectionValue}
                      onChange={(e) => setNewSectionValue(e.target.value)}
                      placeholder="Medicine"
                    />
                  </div>
                  <div className="chronic-crt-sheet__input-wrap">
                    <input
                      type="number"
                      value={newDose}
                      onChange={(e) => setNewDose(e.target.value)}
                      placeholder="Dose"
                    />
                  </div>
                </div>
              ) : (
                <div className="chronic-crt-sheet__input-wrap">
                  <input
                    value={newSectionValue}
                    onChange={(e) => setNewSectionValue(e.target.value)}
                    placeholder={`Enter ${activeSection}`}
                  />
                </div>
              )}
            </div>
            {newSectionValue.trim() === "" ||
            (activeSection === "medicine" && newDose.trim() === "") ? (
              <p className="chronic-crt-sheet__error">Enter a valid value.</p>
            ) : null}
            <div className="chronic-crt-sheet__actions">
              <button
                type="button"
                className="chronic-btn"
                disabled={
                  newSectionValue.trim() === "" ||
                  (activeSection === "medicine" && newDose.trim() === "")
                }
                onClick={() => {
                  const value = newSectionValue.trim();
                  if (!value) return;
                  const dose =
                    activeSection === "medicine" && newDose.trim()
                      ? Number(newDose)
                      : undefined;
                  addChronicProfileCategory({
                    category: toProfileApiCategory(activeSection),
                    value,
                    dose,
                  })
                    .then(async (msg) => {
                      toast.success(msg);
                      setNewSectionValue("");
                      setNewDose("");
                      await loadSection(activeSection);
                    })
                    .catch((e) => {
                      toast.error(e instanceof Error ? e.message : "Could not add entry");
                    });
                }}
              >
                Submit
              </button>
            </div>
          </dialog>
        </div>
      ) : null}

      {nutritionModalOpen ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop chronic-modal__backdrop--soft"
            aria-label="Close"
            onClick={() => setNutritionModalOpen(false)}
          />
          <dialog
            className="chronic-modal__sheet chronic-modal__sheet--bottom chronic-nutrition-sheet"
            open
            aria-modal="true"
            aria-labelledby="chronic-nutrition-sheet-title"
          >
            <span className="chronic-sheet-handle" aria-hidden />
            <div className="chronic-nutrition-sheet__header">
              <h3 id="chronic-nutrition-sheet-title">Nutrition Plan</h3>
              <button
                type="button"
                className="chronic-nutrition-sheet__close"
                aria-label="Close nutrition plan"
                onClick={() => setNutritionModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="chronic-nutrition-sheet__scroll">
              <div className="chronic-feature-grid chronic-feature-grid--single">
                {nutritionPlanImages.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" />
                ))}
              </div>
            </div>
          </dialog>
        </div>
      ) : null}

      {dietGuideModalOpen ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop chronic-modal__backdrop--soft"
            aria-label="Close"
            onClick={() => setDietGuideModalOpen(false)}
          />
          <dialog
            className="chronic-modal__sheet chronic-modal__sheet--bottom chronic-diet-sheet"
            open
            aria-modal="true"
            aria-labelledby="chronic-diet-sheet-title"
          >
            <span className="chronic-sheet-handle" aria-hidden />
            <div className="chronic-diet-sheet__header">
              <h3 id="chronic-diet-sheet-title">Dietary Guide</h3>
              <button
                type="button"
                className="chronic-diet-sheet__close"
                aria-label="Close dietary guide"
                onClick={() => setDietGuideModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="chronic-diet-sheet__scroll">
              <div className="chronic-diet-guide">
                {validConditionId === "Diabetes" ? (
                  CHRONIC_DIABETES_DIET_GUIDE.map((guide) => (
                    <article key={guide.title} className="chronic-diet-guide__section">
                      <h4>{guide.title}</h4>
                      <ul>
                        {guide.details.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </article>
                  ))
                ) : (
                  <p className="chronic-muted">
                    Dietary guide is available for Diabetes in this release.
                  </p>
                )}
              </div>
            </div>
          </dialog>
        </div>
      ) : null}

      {editOpen && conditionRow ? (
        <div className="chronic-modal">
          <button
            type="button"
            className="chronic-modal__backdrop chronic-modal__backdrop--soft"
            aria-label="Close"
            onClick={() => setEditOpen(false)}
          />
          <dialog
            className="chronic-modal__sheet chronic-modal__sheet--bottom chronic-crt-sheet chronic-edit-sheet"
            open
            aria-modal="true"
          >
            <div className="chronic-crt-sheet__head">
              <h3>Edit {pageTitle} Program</h3>
            </div>
            <div className="chronic-crt-sheet__field">
              <div className="chronic-crt-sheet__input-wrap">
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Notes"
                />
              </div>
            </div>
            <div className="chronic-crt-sheet__field">
              <div className="chronic-crt-sheet__input-wrap">
                <input
                  value={editHistory}
                  onChange={(e) => setEditHistory(e.target.value)}
                  placeholder="Hereditary"
                />
              </div>
            </div>
            <div className="chronic-crt-sheet__field">
              <div className="chronic-crt-sheet__input-wrap chronic-edit-sheet__date-wrap">
                <input
                  type="date"
                  value={editSince}
                  onChange={(e) => setEditSince(e.target.value)}
                />
              </div>
            </div>
            <div className="chronic-crt-sheet__actions">
              <button
                type="button"
                className="chronic-btn"
                onClick={() => {
                  updateChronicCondition(conditionRow.id, {
                    note: editNote.trim(),
                    history: editHistory.trim(),
                    since: editSince,
                    ended: null,
                  })
                    .then(async () => {
                      toast.success("Condition updated.");
                      setEditOpen(false);
                      await loadConditionAndParams();
                    })
                    .catch((e) => {
                      toast.error(
                        e instanceof Error ? e.message : "Could not update condition",
                      );
                    });
                }}
              >
                Save
              </button>
            </div>
          </dialog>
        </div>
      ) : null}
    </div>
  );
}
