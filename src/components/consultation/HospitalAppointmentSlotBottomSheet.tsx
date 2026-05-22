import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchNetworkSlots, type NetworkDoctorSchedule } from "@/api/networkSlots";
import { formatNetworkBookTimeSlotForDate } from "@/utils/networkBookTimeSlot";
import { SlotPeriodGlyph } from "@/components/slots/SlotPeriodIcon";
import { useToast } from "@/hooks/useToast";
import {
  buildFiveCalendarDaysStartingTomorrow,
  filterSlotsAfterNowIfToday,
  findScheduleForDate,
  generateSlotsFromTimings,
  groupSlotsByCategory,
  isSameCalendarDay,
  parseTimeToMinutes,
  type GeneratedSlot,
} from "@/utils/consultationSlotGrid";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/ConsultationAppointmentSlotsPage.css";
import "@/components/consultation/HospitalAppointmentSlotBottomSheet.css";

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

/** Parse `YYYY-MM-DD` prefix from stored `time_slot` (same shape as overview). */
function parseStoredBookingDate(timeSlotApi: string): Date | null {
  const re = /^(\d{4})-(\d{2})-(\d{2})\s/;
  const m = re.exec(timeSlotApi.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d);
}

/** Time portion after date from stored `time_slot`. */
function parseStoredBookingTimeLine(timeSlotApi: string): string | null {
  const re = /^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/;
  const m = re.exec(timeSlotApi.trim());
  return m ? m[4].trim() : null;
}

export type HospitalAppointmentSlotBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  networkId: string;
  doctorId: string;
  onApplied?: () => void;
}>;

export function HospitalAppointmentSlotBottomSheet({
  open,
  onClose,
  networkId,
  doctorId,
  onApplied,
}: HospitalAppointmentSlotBottomSheetProps) {
  const toast = useToast();
  const [load, setLoad] = useState<"loading" | "error" | "ok">("loading");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState("Doctor");
  const [networkLabel, setNetworkLabel] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<readonly NetworkDoctorSchedule[]>([]);

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null);

  const fiveDays = useMemo(() => buildFiveCalendarDaysStartingTomorrow(), []);

  useEffect(() => {
    if (!open) return;
    if (!networkId.trim() || !doctorId.trim()) {
      setLoad("error");
      setLoadErr("Missing network or doctor.");
      return;
    }
    let cancelled = false;
    setLoad("loading");
    setLoadErr(null);
    const run = async () => {
      try {
        const data = await fetchNetworkSlots(networkId, doctorId);
        if (cancelled) return;
        setDoctorName(data.doctor?.name ?? "Doctor");
        setNetworkLabel(data.networkName ?? data.displayAddress);
        try {
          localStorage.setItem("opd-mobile-view.consultation.networkName", data.networkName ?? "");
          localStorage.setItem(
            "opd-mobile-view.consultation.doctorQualification",
            data.doctor?.qualification ?? "",
          );
        } catch {
          // ignore
        }
        setSchedules(data.schedules);
        setSelectedDayIdx(0);
        setSelectedSlot(null);
        setLoad("ok");
      } catch (e: unknown) {
        if (cancelled) return;
        setLoad("error");
        const msg = e instanceof Error ? e.message : "Could not load slots";
        setLoadErr(msg);
        toast.error(msg);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, networkId, doctorId, toast]);

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

  const activeScheduleForSelected = selectedCalendarDate
    ? findScheduleForDate(schedules, selectedCalendarDate)
    : undefined;

  /** Restore prior slot from localStorage — same calendar + grid as ConsultationAppointmentSlotsPage. */
  useEffect(() => {
    if (!open || load !== "ok" || schedules.length === 0) return;
    let timeSlotApi = "";
    try {
      timeSlotApi = localStorage.getItem("opd-mobile-view.consultation.timeSlot")?.trim() ?? "";
    } catch {
      return;
    }
    if (!timeSlotApi) return;

    const bookedDate = parseStoredBookingDate(timeSlotApi);
    const timeLine = parseStoredBookingTimeLine(timeSlotApi);
    if (!bookedDate || !timeLine) return;

    const dayIdx = fiveDays.findIndex((d) => isSameCalendarDay(d, bookedDate));
    if (dayIdx < 0) return;

    const calendarDay = fiveDays[dayIdx];
    if (calendarDay === undefined) return;

    const sch = findScheduleForDate(schedules, calendarDay);
    if (!sch) return;

    const raw = generateSlotsFromTimings(sch.timings);
    const filtered = filterSlotsAfterNowIfToday(calendarDay, raw);
    const wantMin = parseTimeToMinutes(timeLine);
    let match: GeneratedSlot | undefined;
    if (wantMin === null) {
      match = filtered.find((s) => s.label.trim() === timeLine.trim());
    } else {
      match = filtered.find((s) => s.minutesFromMidnight === wantMin);
    }

    setSelectedDayIdx(dayIdx);
    setSelectedSlot(match ?? null);
  }, [open, load, schedules, fiveDays]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const selectSlot = useCallback((s: GeneratedSlot) => {
    setSelectedSlot(s);
  }, []);

  const isSlotSelected = useCallback(
    (s: GeneratedSlot) => selectedSlot != null && slotKey(selectedSlot) === slotKey(s),
    [selectedSlot],
  );

  const apply = useCallback(() => {
    if (!selectedSlot || !selectedCalendarDate || !activeScheduleForSelected) return;
    try {
      localStorage.setItem("opd-mobile-view.consultation.slotId", String(selectedSlot.timingId));
      localStorage.setItem("opd-mobile-view.consultation.slotLabel", selectedSlot.label);
      localStorage.setItem("opd-mobile-view.consultation.dayLabel", activeScheduleForSelected.day ?? "");
      localStorage.setItem(
        "opd-mobile-view.consultation.timeSlot",
        formatNetworkBookTimeSlotForDate(selectedCalendarDate, selectedSlot.label),
      );
      localStorage.setItem("opd-mobile-view.consultation.doctorName", doctorName);
      localStorage.setItem("opd-mobile-view.consultation.networkId", networkId);
      localStorage.setItem("opd-mobile-view.consultation.doctorId", doctorId);
      if (networkLabel?.trim()) {
        localStorage.setItem("opd-mobile-view.consultation.networkName", networkLabel.trim());
      }
    } catch {
      // ignore
    }
    onApplied?.();
    onClose();
  }, [
    selectedSlot,
    selectedCalendarDate,
    activeScheduleForSelected,
    doctorName,
    networkId,
    doctorId,
    networkLabel,
    onApplied,
    onClose,
  ]);

  if (!open) return null;

  return (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="hosp-cas-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="hosp-cas-sheet">
        <div className="cas-page hosp-cas-sheet__inner">
          <header className="cas-top hosp-cas-top">
            <h1 id="hosp-cas-sheet-title" className="cas-title">
              Appointment - {doctorName}
            </h1>
            <button type="button" className="addr-sheet__close" aria-label="Close" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <main className="cas-main">
            {networkLabel ? (
              <div className="cas-network-note" role="note">
                {networkLabel}
              </div>
            ) : null}

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
                Flip Health will call and try to schedule an appointment with the doctor on the selected date
                and time slot.
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
                        <SlotPeriodGlyph period={group.category} />
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
              onClick={apply}
            >
              Confirm
            </button>
          </footer>
        </div>
      </div>
    </dialog>
  );
}
