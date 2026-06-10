import {
  fetchPatientParameters,
  submitPatientParameter,
} from "@/api/patientParameters";
import { DigitalDiaryAddSheet } from "@/components/digitalDiary/DigitalDiaryAddSheet";
import { DigitalDiaryWorkoutSection } from "@/components/digitalDiary/DigitalDiaryWorkoutSection";
import { MrIconCalendarToday } from "@/components/medicalRecords/MedicalRecordsIcons";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import { useToast } from "@/hooks/useToast";
import {
  activityLogTitleForApiType,
  activityTypeSupportsSubmit,
  formatDiaryEntrySummary,
  isDigitalDiaryActivityType,
  type DigitalDiaryActivityType,
} from "@/lib/digitalDiary";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import "./DigitalDiaryPages.css";

function localYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DigitalDiaryLogPage() {
  const { activityType: rawType } = useParams<{ activityType: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const decoded = rawType ? decodeURIComponent(rawType) : "";
  const apiType: DigitalDiaryActivityType | null =
    decoded && isDigitalDiaryActivityType(decoded) ? decoded : null;

  const [selectedDate, setSelectedDate] = useState(() => localYyyyMmDd(new Date()));
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);

  /** Recomputed each render so `max` / “today” stay correct across midnight & long sessions */
  const todayStr = localYyyyMmDd(new Date());
  const isToday = selectedDate === todayStr;

  const title = apiType ? activityLogTitleForApiType(apiType) : "Activity";

  const loadActivities = useCallback(async () => {
    if (!apiType) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPatientParameters(apiType, selectedDate);
      setEntries(rows);
    } catch (e) {
      setEntries([]);
      setError(
        e instanceof Error ? e.message : DIGITAL_DIARY_COPY.logLoadError,
      );
    } finally {
      setLoading(false);
    }
  }, [apiType, selectedDate]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const onSubmitBody = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setSubmitting(true);
      try {
        await submitPatientParameter(body);
        await loadActivities();
        toast.success(DIGITAL_DIARY_COPY.submitSuccess);
        return true;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : DIGITAL_DIARY_COPY.submitError,
        );
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [loadActivities, toast],
  );

  const openNativeDatePicker = useCallback(() => {
    dateInputRef.current?.showPicker?.();
    dateInputRef.current?.click();
  }, []);

  const onDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    if (!v) return;
    setSelectedDate(v);
  }, []);

  /** Workout uses inline exercise catalog (patient_app); other types use the FAB + sheet. */
  const showFab =
    apiType != null &&
    isToday &&
    activityTypeSupportsSubmit(apiType) &&
    apiType !== "workout";

  const dateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map((x) => Number.parseInt(x, 10));
    if (!y || !m || !d) return selectedDate;
    const dt = new Date(y, m - 1, d);
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(dt);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "numeric",
      }),
    [],
  );

  if (!decoded || !apiType) {
    return <Navigate to={ROUTES.digitalDiary} replace />;
  }

  return (
    <div className="dd-page dd-page--log">
      <header className="dd-log-header">
        <div className="dd-log-header__top">
          <button
            type="button"
            className="app-back-btn dd-screen-header__back"
            aria-label="Back"
            onClick={() => navigate(ROUTES.digitalDiary)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="dd-log-header__title">{title}</h1>
        </div>
        <div className="dd-log-header__tools">
          <div className="dd-log__date-row">
            <input
              ref={dateInputRef}
              className="dd-log__date-input"
              type="date"
              min="2020-01-01"
              max={todayStr}
              value={selectedDate}
              onChange={onDateChange}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              type="button"
              className="dd-log__date-btn"
              onClick={openNativeDatePicker}
              aria-label={`Choose diary date. Selected ${dateLabel}`}
            >
              <MrIconCalendarToday size={18} className="dd-log__date-btn-ic" />
              <span className="dd-log__date-btn-label">{dateLabel}</span>
            </button>
          </div>
          <button
            type="button"
            className="dd-log__refresh"
            aria-label="Refresh"
            onClick={() => void loadActivities()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 12a8 8 0 018-8M20 12a8 8 0 01-8 8M4 4v6h6M20 20v-6h-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {!isToday ? (
        <p className="dd-log__today-hint" role="status">
          {DIGITAL_DIARY_COPY.addOnlyToday}
        </p>
      ) : null}

      <main className="dd-log__main">
        {loading ? (
          <p className="dd-log__meta">Loading…</p>
        ) : null}

        {!loading && error ? (
          <div className="dd-empty">
            <p>{error}</p>
            <button type="button" className="dd-btn" onClick={() => void loadActivities()}>
              {DIGITAL_DIARY_COPY.logRetry}
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {apiType === "workout" ? (
              <>
                <DigitalDiaryWorkoutSection
                  enabled={isToday}
                  calendarDayKey={selectedDate}
                  submitting={submitting}
                  onSubmitBody={onSubmitBody}
                />
                <h3 className="dd-workout-log__heading">
                  {DIGITAL_DIARY_COPY.workoutLogSectionTitle}
                </h3>
              </>
            ) : null}

            {entries.length === 0 ? (
              <div className="dd-empty">
                <div className="dd-empty__icon" aria-hidden>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 6h16v12H4z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p>{DIGITAL_DIARY_COPY.logEmpty}</p>
              </div>
            ) : (
              <ul className="dd-list">
                {entries.map((e, i) => {
                  const summary = formatDiaryEntrySummary(e, apiType);
                  let rawTime = "";
                  const dtRaw = e.datetime;
                  if (typeof dtRaw === "string") {
                    rawTime = dtRaw;
                  } else if (typeof dtRaw === "number" && Number.isFinite(dtRaw)) {
                    const ms = dtRaw < 1e12 ? dtRaw * 1000 : dtRaw;
                    rawTime = new Date(ms).toISOString();
                  }
                  let timeLabel = "—";
                  if (rawTime.length > 0) {
                    const dt = new Date(rawTime);
                    if (!Number.isNaN(dt.getTime())) {
                      timeLabel = timeFmt.format(dt);
                    }
                  }
                  return (
                    <li key={`${rawTime}-${i}`}>
                      <div className="dd-row">
                        <span
                          className={`dd-row__summary${apiType === "mood" ? " dd-row__summary--mood" : ""}`}
                        >
                          {summary}
                        </span>
                        <span className="dd-row__time">{timeLabel}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </main>

      {showFab ? (
        <button
          type="button"
          className="dd-fab"
          onClick={() => setSheetOpen(true)}
          disabled={submitting}
        >
          <span className="dd-fab__plus" aria-hidden>
            +
          </span>
          {DIGITAL_DIARY_COPY.fabAdd}
        </button>
      ) : null}

      <DigitalDiaryAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        apiType={apiType}
        isSubmitting={submitting}
        onSubmit={onSubmitBody}
      />

      <HomeBottomNav />
    </div>
  );
}
