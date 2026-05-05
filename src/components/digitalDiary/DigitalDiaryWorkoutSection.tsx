import { fetchPatientExercises } from "@/api/patientExercises";
import { WorkoutExerciseMinutesSheet } from "@/components/digitalDiary/WorkoutExerciseMinutesSheet";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import { activitySubmitPayloads } from "@/lib/digitalDiary";
import { useCallback, useEffect, useState, type FormEvent } from "react";

const EXERCISE_PAGE_LIMIT = 20;

export type DigitalDiaryWorkoutSectionProps = Readonly<{
  enabled: boolean;
  /** When this changes (e.g. user picked another day), the catalog collapses — patient_app `pickDate`. */
  calendarDayKey: string;
  submitting: boolean;
  onSubmitBody: (body: Record<string, unknown>) => Promise<boolean>;
}>;

export function DigitalDiaryWorkoutSection({
  enabled,
  calendarDayKey,
  submitting,
  onSubmitBody,
}: DigitalDiaryWorkoutSectionProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [exercises, setExercises] = useState<Record<string, unknown>[]>([]);
  const [exercisesBusy, setExercisesBusy] = useState(false);
  const [exercisesLoadError, setExercisesLoadError] = useState<string | null>(null);
  const [exercisesHasMore, setExercisesHasMore] = useState(false);
  const [exercisePage, setExercisePage] = useState(1);

  const [minutesOpen, setMinutesOpen] = useState(false);
  const [pickedExercise, setPickedExercise] = useState<Record<string, unknown> | null>(null);

  const dismissCatalog = useCallback(() => {
    setCatalogOpen(false);
    setExercises([]);
    setExercisesLoadError(null);
    setExercisesHasMore(false);
    setExercisePage(1);
  }, []);

  useEffect(() => {
    dismissCatalog();
    setSearchInput("");
    setAppliedSearch("");
  }, [calendarDayKey, dismissCatalog]);

  const beginWorkoutAddFlow = useCallback(async () => {
    setCatalogOpen(true);
    setSearchInput("");
    setAppliedSearch("");
    setExercisePage(1);
    setExercisesBusy(true);
    setExercisesLoadError(null);
    try {
      const list = await fetchPatientExercises({
        page: 1,
        limit: EXERCISE_PAGE_LIMIT,
        nameSearch: null,
      });
      setExercises(list);
      setExercisesHasMore(list.length >= EXERCISE_PAGE_LIMIT);
    } catch (e) {
      setExercises([]);
      setExercisesLoadError(
        e instanceof Error ? e.message : DIGITAL_DIARY_COPY.workoutCatalogGenericError,
      );
    } finally {
      setExercisesBusy(false);
    }
  }, []);

  const applySearch = useCallback(async (ev?: FormEvent) => {
    ev?.preventDefault();
    const q = searchInput.trim();
    setAppliedSearch(q);
    setExercisesBusy(true);
    setExercisesLoadError(null);
    try {
      const list = await fetchPatientExercises({
        page: 1,
        limit: EXERCISE_PAGE_LIMIT,
        nameSearch: q || null,
      });
      setExercisePage(1);
      setExercises(list);
      setExercisesHasMore(list.length >= EXERCISE_PAGE_LIMIT);
    } catch (e) {
      setExercises([]);
      setExercisesLoadError(
        e instanceof Error ? e.message : DIGITAL_DIARY_COPY.workoutCatalogGenericError,
      );
    } finally {
      setExercisesBusy(false);
    }
  }, [searchInput]);

  const clearSearch = useCallback(async () => {
    setSearchInput("");
    setAppliedSearch("");
    setExercisesBusy(true);
    setExercisesLoadError(null);
    try {
      const list = await fetchPatientExercises({
        page: 1,
        limit: EXERCISE_PAGE_LIMIT,
        nameSearch: null,
      });
      setExercisePage(1);
      setExercises(list);
      setExercisesHasMore(list.length >= EXERCISE_PAGE_LIMIT);
    } catch (e) {
      setExercises([]);
      setExercisesLoadError(
        e instanceof Error ? e.message : DIGITAL_DIARY_COPY.workoutCatalogGenericError,
      );
    } finally {
      setExercisesBusy(false);
    }
  }, []);

  const loadMoreExercises = useCallback(async () => {
    if (!exercisesHasMore || exercisesBusy) return;
    setExercisesBusy(true);
    try {
      const nextPage = exercisePage + 1;
      const list = await fetchPatientExercises({
        page: nextPage,
        limit: EXERCISE_PAGE_LIMIT,
        nameSearch: appliedSearch.trim() || null,
      });
      if (list.length === 0) {
        setExercisesHasMore(false);
      } else {
        setExercisePage(nextPage);
        setExercises((prev) => [...prev, ...list]);
        setExercisesHasMore(list.length >= EXERCISE_PAGE_LIMIT);
      }
    } catch {
      setExercisesHasMore(false);
    } finally {
      setExercisesBusy(false);
    }
  }, [appliedSearch, exercisePage, exercisesBusy, exercisesHasMore]);

  const exerciseDisplayName = useCallback((ex: Record<string, unknown>) => {
    const n = ex.name;
    const s = n != null ? String(n).trim() : "";
    return s.length > 0 ? s : "Workout";
  }, []);

  const openMinutesFor = useCallback((ex: Record<string, unknown>) => {
    const idRaw = ex.id;
    const id = idRaw != null ? String(idRaw).trim() : "";
    if (!id) return;
    setPickedExercise(ex);
    setMinutesOpen(true);
  }, []);

  const pickedName = pickedExercise ? exerciseDisplayName(pickedExercise) : "";

  const submitMinutes = useCallback(
    async (minutes: string): Promise<boolean> => {
      if (!pickedExercise) return false;
      const idRaw = pickedExercise.id;
      const sourceId = idRaw != null ? String(idRaw).trim() : "";
      if (!sourceId) return false;
      const body = activitySubmitPayloads.workoutFromExercise({ sourceId, minutes });
      const ok = await onSubmitBody(body);
      if (ok) dismissCatalog();
      return ok;
    },
    [dismissCatalog, onSubmitBody, pickedExercise],
  );

  if (!enabled) return null;

  return (
    <section className="dd-workout-add" aria-label="Log exercise">
      {!catalogOpen ? (
        <button
          type="button"
          className="dd-workout-add__primary"
          disabled={exercisesBusy}
          onClick={() => void beginWorkoutAddFlow()}
        >
          {DIGITAL_DIARY_COPY.workoutAddExercise}
        </button>
      ) : (
        <>
          <div className="dd-workout-add__toolbar">
            <button type="button" className="dd-workout-add__cancel" onClick={dismissCatalog}>
              {DIGITAL_DIARY_COPY.workoutCancelCatalog}
            </button>
          </div>
          <h2 className="dd-workout-add__heading">{DIGITAL_DIARY_COPY.workoutChooseTitle}</h2>
          <form className="dd-workout-add__search-row" onSubmit={(e) => void applySearch(e)}>
            <input
              type="search"
              className="dd-workout-add__search"
              placeholder={DIGITAL_DIARY_COPY.workoutSearchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              enterKeyHint="search"
            />
            <button type="submit" className="dd-workout-add__search-go">
              Search
            </button>
            <button type="button" className="dd-workout-add__clear" onClick={() => void clearSearch()}>
              {DIGITAL_DIARY_COPY.workoutSearchClear}
            </button>
          </form>

          {exercisesLoadError ? (
            <p className="dd-workout-add__err" role="alert">
              {exercisesLoadError}
            </p>
          ) : null}

          {exercisesBusy && exercises.length === 0 ? (
            <div className="dd-workout-add__loading" role="status">
              <div className="dd-log__meta">Loading…</div>
            </div>
          ) : null}

          {!exercisesBusy && exercises.length === 0 && !exercisesLoadError ? (
            <p className="dd-workout-add__empty">{DIGITAL_DIARY_COPY.workoutNoResults}</p>
          ) : null}

          {exercises.length > 0 ? (
            <ul className="dd-workout-add__grid">
              {exercises.map((ex, idx) => {
                const keyRaw = ex.id;
                const key = keyRaw != null ? String(keyRaw) : `ex-${idx}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="dd-workout-add__tile"
                      onClick={() => openMinutesFor(ex)}
                    >
                      {exerciseDisplayName(ex)}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {exercisesBusy && exercises.length > 0 ? (
            <div className="dd-workout-add__progress" aria-hidden />
          ) : null}

          {exercisesHasMore ? (
            <button
              type="button"
              className="dd-workout-add__more"
              disabled={exercisesBusy}
              onClick={() => void loadMoreExercises()}
            >
              {DIGITAL_DIARY_COPY.workoutLoadMore}
            </button>
          ) : null}
        </>
      )}

      <WorkoutExerciseMinutesSheet
        open={minutesOpen}
        exerciseName={pickedName}
        isSubmitting={submitting}
        onClose={() => {
          setMinutesOpen(false);
          setPickedExercise(null);
        }}
        onSubmit={submitMinutes}
      />
    </section>
  );
}
