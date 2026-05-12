import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { fetchNetworkSlots, type NetworkDoctorSchedule } from "@/api/networkSlots";
import { formatNetworkBookTimeSlotForDate } from "@/utils/networkBookTimeSlot";
import {
  buildFiveCalendarDaysStartingTomorrow,
  filterSlotsAfterNowIfToday,
  findScheduleForDate,
  generateSlotsFromTimings,
  groupSlotsByCategory,
  type GeneratedSlot,
} from "@/utils/consultationSlotGrid";
import { useToast } from "@/hooks/useToast";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./ConsultationAppointmentSlotsPage.css";

function formatMonthYearIST(date: Date): string {
  try {
    const s = date.toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
    return `${s} (IST)`;
  } catch {
    const s = date.toLocaleString("en-IN", { month: "long", year: "numeric" });
    return `${s} (IST)`;
  }
}

function formatWeekdayShortIST(d: Date): string {
  try {
    return d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
  } catch {
    return d.toLocaleDateString("en-IN", { weekday: "short" });
  }
}

function slotKey(s: GeneratedSlot): string {
  return `${s.timingId}-${s.minutesFromMidnight}`;
}

export function ConsultationAppointmentSlotsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const doctorId = typeof params.doctorId === "string" ? params.doctorId : "";
  const networkId = typeof params.networkId === "string" ? params.networkId : "";
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";

  const [load, setLoad] = useState<"loading" | "error" | "ok">("loading");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState("Doctor");
  const [schedules, setSchedules] = useState<readonly NetworkDoctorSchedule[]>([]);

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null);

  const fiveDays = useMemo(() => buildFiveCalendarDaysStartingTomorrow(), []);

  useEffect(() => {
    if (!networkId.trim() || !doctorId.trim()) {
      setLoad("error");
      setLoadErr("Missing network or doctor.");
      return;
    }
    let cancelled = false;
    setLoad("loading");
    setLoadErr(null);
    void fetchNetworkSlots(networkId, doctorId)
      .then((data) => {
        if (cancelled) return;
        setDoctorName(data.doctor?.name ?? "Doctor");
        setSchedules(data.schedules);
        setSelectedDayIdx(0);
        setSelectedSlot(null);
        try {
          localStorage.setItem("opd-mobile-view.consultation.networkName", data.networkName ?? "");
          localStorage.setItem(
            "opd-mobile-view.consultation.doctorQualification",
            data.doctor?.qualification ?? "",
          );
        } catch {
          // ignore
        }
        setLoad("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoad("error");
        const msg = e instanceof Error ? e.message : "Could not load slots";
        setLoadErr(msg);
        toast.error(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, doctorId, toast]);

  const selectedCalendarDate = fiveDays[selectedDayIdx] ?? fiveDays[0];

  const slotsForSelectedDay = useMemo(() => {
    if (!selectedCalendarDate) return [];
    const sch = findScheduleForDate(schedules, selectedCalendarDate);
    if (!sch || sch.timings.length === 0) return [];
    const raw = generateSlotsFromTimings(sch.timings);
    return filterSlotsAfterNowIfToday(selectedCalendarDate, raw);
  }, [schedules, selectedCalendarDate]);

  const categorized = useMemo(() => groupSlotsByCategory(slotsForSelectedDay), [slotsForSelectedDay]);

  const hasNoSlotsForSelectedDate =
    load === "ok" &&
    selectedCalendarDate != null &&
    (() => {
      const sch = findScheduleForDate(schedules, selectedCalendarDate);
      if (!sch || sch.timings.length === 0) return true;
      return slotsForSelectedDay.length === 0;
    })();

  const selectSlot = useCallback((s: GeneratedSlot) => {
    setSelectedSlot(s);
  }, []);

  const isSlotSelected = useCallback(
    (s: GeneratedSlot) => selectedSlot != null && slotKey(selectedSlot) === slotKey(s),
    [selectedSlot],
  );

  const activeScheduleForSelected = selectedCalendarDate
    ? findScheduleForDate(schedules, selectedCalendarDate)
    : undefined;

  return (
    <div className="cas-page">
      <header className="cas-top">
        <Link
          to={generatePath(ROUTES.consultationHospitalResults, { specialtyId })}
          className="cas-back"
          aria-label="Back"
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
        </Link>
        <h1 className="cas-title">Appointment - {doctorName}</h1>
      </header>

      <main className="cas-main">
        <div className="cas-alert" role="note">
          <span className="cas-alert__ic" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#FF7043" strokeWidth="2" />
              <path
                d="M12 10v5M12 7.5v.01"
                stroke="#FF7043"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="cas-alert__txt">
            Check the slots available for the next day if your preferred date is unavailable.
          </p>
        </div>

        {load === "loading" && <div className="cas-loading">Loading slots…</div>}
        {load === "error" && (
          <div className="cas-loading cas-loading--err" role="alert">
            {loadErr ?? "Could not load slots"}
          </div>
        )}
        {load === "ok" && schedules.length === 0 && (
          <div className="cas-loading">No open slots for this doctor right now.</div>
        )}
        {load === "ok" && schedules.length > 0 && (
          <>
            <div className="cas-row">
              <div className="cas-row__left">
                <span className="cas-row__ic" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#FF7043" strokeWidth="2" />
                    <path d="M12 7v6l3 2" stroke="#FF7043" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>{" "}
                Choose date and time
              </div>
              <div className="cas-row__right">
                {selectedCalendarDate ? formatMonthYearIST(selectedCalendarDate) : ""}
              </div>
            </div>

            <div className="cas-days" role="radiogroup" aria-label="Choose date">
              {fiveDays.map((d, idx) => {
                const active = idx === selectedDayIdx;
                return (
                  <button
                    key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
                    type="button"
                    className={`cas-day${active ? " cas-day--active" : ""}`}
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelectedDayIdx(idx);
                      setSelectedSlot(null);
                    }}
                  >
                    <div className="cas-day__num">{d.getDate()}</div>
                    <div className="cas-day__dow">{formatWeekdayShortIST(d)}</div>
                  </button>
                );
              })}
            </div>

            <div className="cas-divider" />

            {hasNoSlotsForSelectedDate ? (
              <div className="cas-empty-slots">No slots available for this date</div>
            ) : (
              categorized.map((group) => (
                <section key={group.category} className="cas-section">
                  <div className="cas-section__head">
                    <span className="cas-sun" aria-hidden="true">
                      ☀
                    </span>
                    {group.title}
                  </div>
                  <div className="cas-slots" role="radiogroup" aria-label={`${group.title} slots`}>
                    {group.slots.map((s) => {
                      const active = isSlotSelected(s);
                      return (
                        <button
                          key={slotKey(s)}
                          type="button"
                          className={`cas-slot${active ? " cas-slot--active" : ""}`}
                          role="radio"
                          aria-checked={active}
                          onClick={() => selectSlot(s)}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </main>

      <footer className="cas-footer">
        <button
          type="button"
          className="cas-confirm"
          disabled={load !== "ok" || !selectedSlot || !selectedCalendarDate}
          onClick={() => {
            if (!selectedSlot || !selectedCalendarDate || !activeScheduleForSelected) return;
            try {
              localStorage.setItem("opd-mobile-view.consultation.slotId", String(selectedSlot.timingId));
              localStorage.setItem("opd-mobile-view.consultation.slotLabel", selectedSlot.label);
              localStorage.setItem(
                "opd-mobile-view.consultation.dayLabel",
                activeScheduleForSelected.day ?? "",
              );
              localStorage.setItem(
                "opd-mobile-view.consultation.timeSlot",
                formatNetworkBookTimeSlotForDate(selectedCalendarDate, selectedSlot.label),
              );
              localStorage.setItem("opd-mobile-view.consultation.doctorName", doctorName);
              localStorage.setItem("opd-mobile-view.consultation.networkId", networkId);
              localStorage.setItem("opd-mobile-view.consultation.doctorId", doctorId);
            } catch {
              // ignore
            }
            navigate(
              generatePath(ROUTES.consultationHospitalOverview, {
                specialtyId,
                networkId,
                doctorId,
              }),
            );
          }}
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}
