import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatNetworkBookTimeSlotForDate } from "@/utils/networkBookTimeSlot";
import { SlotPeriodGlyph } from "@/components/slots/SlotPeriodIcon";
import { useHospitalConsultationSlots } from "@/hooks/useHospitalConsultationSlots";
import { persistHospitalConsultationSummaryFromSources } from "@/lib/hospitalConsultationSummary";
import {
  filterSlotsAfterNowIfToday,
  findScheduleForDate,
  generateSlotsFromTimings,
  groupSlotsByCategory,
  isSameCalendarDay,
  parseTimeToMinutes,
  type GeneratedSlot,
} from "@/utils/consultationSlotGrid";
import {
  formatDateKey,
  formatVendorBookTimeSlot,
  groupVendorSlotsByCategory,
  slotsForVendorDate,
  vendorSlotKey,
  type VendorSlotPick,
} from "@/utils/vendorConsultationSlots";
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
    return date.toLocaleString("en-IN", { month: "long", year: "numeric" });
  }
}

function formatWeekdayShortIST(d: Date): string {
  try {
    return d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
  } catch {
    return d.toLocaleDateString("en-IN", { weekday: "short" });
  }
}

function legacySlotKey(s: GeneratedSlot): string {
  return `${s.timingId}-${s.minutesFromMidnight}`;
}

function parseStoredBookingDate(timeSlotApi: string): Date | null {
  const re = /^(\d{4})-(\d{2})-(\d{2})[\s,]/;
  const m = re.exec(timeSlotApi.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d);
}

function parseStoredBookingTimeLine(timeSlotApi: string): string | null {
  const re = /^(\d{4})-(\d{2})-(\d{2})[\s,]+(.+)$/;
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
  const {
    isVendor,
    load,
    loadErr,
    payload,
    calendarDays,
    defaultDayIdx,
    doctorName,
    vendorCode,
    vendorCtx,
  } = useHospitalConsultationSlots(networkId, doctorId, { enabled: open });

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedLegacySlot, setSelectedLegacySlot] = useState<GeneratedSlot | null>(null);
  const [selectedVendorSlot, setSelectedVendorSlot] = useState<VendorSlotPick | null>(null);
  const daysStripRef = useRef<HTMLDivElement>(null);

  const schedules = payload?.schedules ?? [];
  const datedSlots = payload?.datedSlots ?? [];
  const networkLabel = payload?.networkName ?? payload?.displayAddress ?? null;

  const selectedCalendarDate = calendarDays[selectedDayIdx] ?? calendarDays[0];

  const legacySlotsForDay = useMemo(() => {
    if (!selectedCalendarDate || isVendor) return [];
    const sch = findScheduleForDate(schedules, selectedCalendarDate);
    if (!sch || sch.timings.length === 0) return [];
    return filterSlotsAfterNowIfToday(
      selectedCalendarDate,
      generateSlotsFromTimings(sch.timings),
    );
  }, [schedules, selectedCalendarDate, isVendor]);

  const vendorSlotsForDay = useMemo(() => {
    if (!selectedCalendarDate || !isVendor) return [];
    return slotsForVendorDate(datedSlots, selectedCalendarDate);
  }, [datedSlots, selectedCalendarDate, isVendor]);

  const categorizedLegacy = useMemo(
    () => groupSlotsByCategory(legacySlotsForDay),
    [legacySlotsForDay],
  );
  const categorizedVendor = useMemo(
    () => groupVendorSlotsByCategory(vendorSlotsForDay),
    [vendorSlotsForDay],
  );

  const hasAnySlots = isVendor ? datedSlots.length > 0 : schedules.length > 0;

  const hasNoSlotsForSelectedDate =
    load === "ok" &&
    selectedCalendarDate != null &&
    (isVendor
      ? vendorSlotsForDay.length === 0
      : legacySlotsForDay.length === 0);

  const activeScheduleForSelected = selectedCalendarDate
    ? findScheduleForDate(schedules, selectedCalendarDate)
    : undefined;

  useEffect(() => {
    if (!open || load !== "ok") return;
    setSelectedDayIdx(defaultDayIdx);
    setSelectedLegacySlot(null);
    setSelectedVendorSlot(null);
    persistHospitalConsultationSummaryFromSources(payload, vendorCtx);
  }, [open, load, defaultDayIdx, payload, vendorCtx]);

  useEffect(() => {
    if (!open || load !== "ok" || calendarDays.length === 0) return;
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

    const dayIdx = calendarDays.findIndex((d) => isSameCalendarDay(d, bookedDate));
    if (dayIdx < 0) return;

    const calendarDay = calendarDays[dayIdx];
    if (!calendarDay) return;

    if (isVendor) {
      const slots = slotsForVendorDate(datedSlots, calendarDay);
      const wantMin = parseTimeToMinutes(timeLine);
      const match = slots.find((s) => {
        if (wantMin != null) return s.minutesFromMidnight === wantMin;
        return s.label.trim().toLowerCase() === timeLine.trim().toLowerCase();
      });
      setSelectedDayIdx(dayIdx);
      setSelectedVendorSlot(match ?? null);
      return;
    }

    const sch = findScheduleForDate(schedules, calendarDay);
    if (!sch) return;
    const filtered = filterSlotsAfterNowIfToday(
      calendarDay,
      generateSlotsFromTimings(sch.timings),
    );
    const wantMin = parseTimeToMinutes(timeLine);
    const match = filtered.find((s) => {
      if (wantMin != null) return s.minutesFromMidnight === wantMin;
      return s.label.trim() === timeLine.trim();
    });
    setSelectedDayIdx(dayIdx);
    setSelectedLegacySlot(match ?? null);
  }, [open, load, schedules, calendarDays, datedSlots, isVendor]);

  useEffect(() => {
    if (!open || load !== "ok") return;
    const active = daysStripRef.current?.querySelector(".cas-day--active");
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [open, load, selectedDayIdx, calendarDays.length]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const canApply = isVendor
    ? selectedVendorSlot != null && selectedCalendarDate != null
    : selectedLegacySlot != null &&
      selectedCalendarDate != null &&
      activeScheduleForSelected != null;

  const apply = useCallback(() => {
    if (!selectedCalendarDate) return;
    try {
      localStorage.setItem("opd-mobile-view.consultation.doctorName", doctorName);
      localStorage.setItem("opd-mobile-view.consultation.networkId", networkId);
      localStorage.setItem("opd-mobile-view.consultation.doctorId", doctorId);
      localStorage.setItem(
        "opd-mobile-view.consultation.isVendorOffline",
        isVendor ? "1" : "0",
      );
      if (networkLabel?.trim()) {
        localStorage.setItem("opd-mobile-view.consultation.networkName", networkLabel.trim());
      }
      if (isVendor && selectedVendorSlot) {
        const slotId =
          selectedVendorSlot.vendorSlotId ||
          datedSlots.find(
            (ds) =>
              ds.time === selectedVendorSlot.time24 &&
              ds.date === formatDateKey(selectedCalendarDate),
          )?.vendorSlotId ||
          "";
        localStorage.setItem("opd-mobile-view.consultation.slotId", slotId);
        localStorage.setItem("opd-mobile-view.consultation.vendorSlotId", slotId);
        localStorage.setItem("opd-mobile-view.consultation.slotLabel", selectedVendorSlot.label);
        localStorage.setItem("opd-mobile-view.consultation.dayLabel", "");
        localStorage.setItem(
          "opd-mobile-view.consultation.timeSlot",
          formatVendorBookTimeSlot(selectedCalendarDate, selectedVendorSlot.time24),
        );
        if (vendorCode) {
          localStorage.setItem("opd-mobile-view.consultation.vendorCode", vendorCode);
        }
      } else if (selectedLegacySlot && activeScheduleForSelected) {
        localStorage.setItem(
          "opd-mobile-view.consultation.slotId",
          String(selectedLegacySlot.timingId),
        );
        localStorage.removeItem("opd-mobile-view.consultation.vendorSlotId");
        localStorage.setItem("opd-mobile-view.consultation.slotLabel", selectedLegacySlot.label);
        localStorage.setItem(
          "opd-mobile-view.consultation.dayLabel",
          activeScheduleForSelected.day ?? "",
        );
        localStorage.setItem(
          "opd-mobile-view.consultation.timeSlot",
          formatNetworkBookTimeSlotForDate(selectedCalendarDate, selectedLegacySlot.label),
        );
      }
    } catch {
      // ignore
    }
    onApplied?.();
    onClose();
  }, [
    selectedCalendarDate,
    doctorName,
    networkId,
    doctorId,
    isVendor,
    selectedVendorSlot,
    selectedLegacySlot,
    activeScheduleForSelected,
    networkLabel,
    datedSlots,
    vendorCode,
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
                {isVendor
                  ? "Pick an available slot from the dates shown below."
                  : "Flip Health will call and try to schedule an appointment with the doctor on the selected date and time slot."}
              </p>
            </div>

            {load === "loading" && <div className="cas-loading">Loading slots…</div>}
            {load === "error" && (
              <div className="cas-loading cas-loading--err" role="alert">
                {loadErr ?? "Could not load slots"}
              </div>
            )}
            {load === "ok" && !hasAnySlots && (
              <div className="cas-loading">No open slots for this doctor right now.</div>
            )}
            {load === "ok" && hasAnySlots && calendarDays.length > 0 && (
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

                <div
                  ref={daysStripRef}
                  className="cas-days-wrap hide-scrollbar"
                  aria-label="Scroll dates horizontally"
                >
                  <div className="cas-days cas-days--scroll" role="radiogroup" aria-label="Choose date">
                    {calendarDays.map((d, idx) => {
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
                            setSelectedLegacySlot(null);
                            setSelectedVendorSlot(null);
                          }}
                        >
                          <div className="cas-day__num">{d.getDate()}</div>
                          <div className="cas-day__dow">{formatWeekdayShortIST(d)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="cas-divider" />

                {hasNoSlotsForSelectedDate ? (
                  <div className="cas-empty-slots">No slots available for this date</div>
                ) : isVendor ? (
                  categorizedVendor.map((group) => (
                    <section key={group.category} className="cas-section">
                      <div className="cas-section__head">
                        <SlotPeriodGlyph period={group.category} />
                        {group.title}
                      </div>
                      <div className="cas-slots" role="radiogroup" aria-label={`${group.title} slots`}>
                        {group.slots.map((s) => {
                          const key = vendorSlotKey(s);
                          const active =
                            selectedVendorSlot != null &&
                            vendorSlotKey(selectedVendorSlot) === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`cas-slot${active ? " cas-slot--active" : ""}`}
                              role="radio"
                              aria-checked={active}
                              onClick={() => setSelectedVendorSlot(s)}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))
                ) : (
                  categorizedLegacy.map((group) => (
                    <section key={group.category} className="cas-section">
                      <div className="cas-section__head">
                        <SlotPeriodGlyph period={group.category} />
                        {group.title}
                      </div>
                      <div className="cas-slots" role="radiogroup" aria-label={`${group.title} slots`}>
                        {group.slots.map((s) => {
                          const key = legacySlotKey(s);
                          const active =
                            selectedLegacySlot != null && legacySlotKey(selectedLegacySlot) === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`cas-slot${active ? " cas-slot--active" : ""}`}
                              role="radio"
                              aria-checked={active}
                              onClick={() => setSelectedLegacySlot(s)}
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
              disabled={load !== "ok" || !canApply}
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
