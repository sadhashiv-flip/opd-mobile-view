import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import {
  readHospitalSlotsDraft,
  writeHospitalSlotsDraft,
} from "@/constants/consultationBookingStorage";
import { formatNetworkBookTimeSlotForDate } from "@/utils/networkBookTimeSlot";
import {
  filterSlotsAfterNowIfToday,
  findScheduleForDate,
  generateSlotsFromTimings,
  groupSlotsByCategory,
  type GeneratedSlot,
} from "@/utils/consultationSlotGrid";
import {
  formatVendorBookTimeSlot,
  groupVendorSlotsByCategory,
  slotsForVendorDate,
  vendorSlotKey,
  type VendorSlotPick,
} from "@/utils/vendorConsultationSlots";
import { SlotPeriodGlyph } from "@/components/slots/SlotPeriodIcon";
import { useHospitalConsultationSlots } from "@/hooks/useHospitalConsultationSlots";
import { persistHospitalConsultationSummaryFromSources } from "@/lib/hospitalConsultationSummary";
import { useToast } from "@/hooks/useToast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function legacySlotKey(s: GeneratedSlot): string {
  return `${s.timingId}-${s.minutesFromMidnight}`;
}

export function ConsultationAppointmentSlotsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const doctorId = typeof params.doctorId === "string" ? params.doctorId : "";
  const networkId = typeof params.networkId === "string" ? params.networkId : "";
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";

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
  } = useHospitalConsultationSlots(networkId, doctorId);

  const hospitalDraft = useMemo(
    () => readHospitalSlotsDraft(networkId, doctorId),
    [networkId, doctorId],
  );
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => hospitalDraft?.selectedDayIdx ?? 0);
  const [selectedLegacySlot, setSelectedLegacySlot] = useState<GeneratedSlot | null>(null);
  const [selectedVendorSlot, setSelectedVendorSlot] = useState<VendorSlotPick | null>(null);
  const pendingSlotKeyRef = useRef(hospitalDraft?.slotKey?.trim() ?? "");
  const dayInitRef = useRef(false);
  const daysStripRef = useRef<HTMLDivElement>(null);

  const schedules = payload?.schedules ?? [];
  const datedSlots = payload?.datedSlots ?? [];

  const persistHospitalDraft = useCallback(
    (dayIdx: number, key: string) => {
      writeHospitalSlotsDraft(networkId, doctorId, {
        selectedDayIdx: dayIdx,
        slotKey: key,
      });
    },
    [networkId, doctorId],
  );

  const onBeforeBack = useCallback(() => {
    const key = isVendor
      ? selectedVendorSlot
        ? vendorSlotKey(selectedVendorSlot)
        : ""
      : selectedLegacySlot
        ? legacySlotKey(selectedLegacySlot)
        : "";
    persistHospitalDraft(selectedDayIdx, key);
  }, [persistHospitalDraft, selectedDayIdx, selectedLegacySlot, selectedVendorSlot, isVendor]);

  useEffect(() => {
    if (load !== "ok") return;
    if (dayInitRef.current) return;
    dayInitRef.current = true;
    const draft = readHospitalSlotsDraft(networkId, doctorId);
    const maxIdx = Math.max(0, calendarDays.length - 1);
    const dayIdx = Math.min(draft?.selectedDayIdx ?? defaultDayIdx, maxIdx);
    setSelectedDayIdx(dayIdx);
    pendingSlotKeyRef.current = draft?.slotKey?.trim() ?? "";
    setSelectedLegacySlot(null);
    setSelectedVendorSlot(null);
    try {
      persistHospitalConsultationSummaryFromSources(payload, vendorCtx);
      localStorage.setItem(
        "opd-mobile-view.consultation.isVendorOffline",
        isVendor ? "1" : "0",
      );
      if (isVendor && vendorCode) {
        localStorage.setItem("opd-mobile-view.consultation.vendorCode", vendorCode);
      }
    } catch {
      // ignore
    }
  }, [load, networkId, doctorId, calendarDays.length, defaultDayIdx, payload, isVendor, vendorCode, vendorCtx]);

  useEffect(() => {
    if (load === "error" && loadErr) toast.error(loadErr);
  }, [load, loadErr, toast]);

  /** Keep selected date visible in the one-line horizontal strip. */
  useEffect(() => {
    if (load !== "ok") return;
    const active = daysStripRef.current?.querySelector(".cas-day--active");
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [load, selectedDayIdx, calendarDays.length]);

  const selectedCalendarDate = calendarDays[selectedDayIdx] ?? calendarDays[0];

  const legacySlotsForDay = useMemo(() => {
    if (!selectedCalendarDate || isVendor) return [];
    const sch = findScheduleForDate(schedules, selectedCalendarDate);
    if (!sch || sch.timings.length === 0) return [];
    const raw = generateSlotsFromTimings(sch.timings);
    return filterSlotsAfterNowIfToday(selectedCalendarDate, raw);
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

  const hasNoSlotsForSelectedDate =
    load === "ok" &&
    selectedCalendarDate != null &&
    (isVendor
      ? vendorSlotsForDay.length === 0
      : (() => {
          const sch = findScheduleForDate(schedules, selectedCalendarDate);
          if (!sch || sch.timings.length === 0) return true;
          return legacySlotsForDay.length === 0;
        })());

  const hasAnySlots = isVendor ? datedSlots.length > 0 : schedules.length > 0;

  useEffect(() => {
    if (load !== "ok") return;
    const key = pendingSlotKeyRef.current.trim();
    if (!key) return;
    pendingSlotKeyRef.current = "";
    if (isVendor) {
      const match = vendorSlotsForDay.find((s) => vendorSlotKey(s) === key);
      if (match) setSelectedVendorSlot(match);
    } else {
      const match = legacySlotsForDay.find((s) => legacySlotKey(s) === key);
      if (match) setSelectedLegacySlot(match);
    }
  }, [load, legacySlotsForDay, vendorSlotsForDay, isVendor]);

  const activeScheduleForSelected = selectedCalendarDate
    ? findScheduleForDate(schedules, selectedCalendarDate)
    : undefined;

  const canContinue = isVendor
    ? selectedVendorSlot != null && selectedCalendarDate != null
    : selectedLegacySlot != null && selectedCalendarDate != null && activeScheduleForSelected != null;

  return (
    <div className="cas-page">
      <header className="cas-top">
        <FlowScreenBack
          fallbackTo={generatePath(ROUTES.consultationHospitalResults, { specialtyId })}
          className="cas-back"
          onBeforeBack={onBeforeBack}
        />
        <h1 className="cas-title">Appointment - {doctorName}</h1>
      </header>

      <main className="cas-main cas-main--with-sticky-footer">
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
              : "Check the slots available for the next day if your preferred date is unavailable."}
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
                        pendingSlotKeyRef.current = "";
                        persistHospitalDraft(idx, "");
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
                        selectedVendorSlot != null && vendorSlotKey(selectedVendorSlot) === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`cas-slot${active ? " cas-slot--active" : ""}`}
                          role="radio"
                          aria-checked={active}
                          onClick={() => {
                            setSelectedVendorSlot(s);
                            persistHospitalDraft(selectedDayIdx, key);
                          }}
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
                          onClick={() => {
                            setSelectedLegacySlot(s);
                            persistHospitalDraft(selectedDayIdx, key);
                          }}
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

      <footer className="cas-footer cas-footer--sticky">
        <button
          type="button"
          className="cas-confirm"
          disabled={load !== "ok" || !canContinue}
          onClick={() => {
            if (!selectedCalendarDate) return;
            try {
              localStorage.setItem("opd-mobile-view.consultation.doctorName", doctorName);
              localStorage.setItem("opd-mobile-view.consultation.networkId", networkId);
              localStorage.setItem("opd-mobile-view.consultation.doctorId", doctorId);
              localStorage.setItem(
                "opd-mobile-view.consultation.isVendorOffline",
                isVendor ? "1" : "0",
              );
              if (isVendor && selectedVendorSlot) {
                const key = vendorSlotKey(selectedVendorSlot);
                persistHospitalDraft(selectedDayIdx, key);
                const slotId =
                  selectedVendorSlot.vendorSlotId ||
                  datedSlots.find(
                    (ds) =>
                      ds.time === selectedVendorSlot.time24 &&
                      ds.date ===
                        `${selectedCalendarDate.getFullYear()}-${String(selectedCalendarDate.getMonth() + 1).padStart(2, "0")}-${String(selectedCalendarDate.getDate()).padStart(2, "0")}`,
                  )?.vendorSlotId ||
                  "";
                localStorage.setItem("opd-mobile-view.consultation.slotId", slotId);
                localStorage.setItem(
                  "opd-mobile-view.consultation.vendorSlotId",
                  slotId,
                );
                localStorage.setItem(
                  "opd-mobile-view.consultation.slotLabel",
                  selectedVendorSlot.label,
                );
                localStorage.setItem("opd-mobile-view.consultation.dayLabel", "");
                localStorage.setItem(
                  "opd-mobile-view.consultation.timeSlot",
                  formatVendorBookTimeSlot(selectedCalendarDate, selectedVendorSlot.time24),
                );
                if (vendorCode) {
                  localStorage.setItem("opd-mobile-view.consultation.vendorCode", vendorCode);
                }
              } else if (selectedLegacySlot && activeScheduleForSelected) {
                persistHospitalDraft(selectedDayIdx, legacySlotKey(selectedLegacySlot));
                localStorage.setItem(
                  "opd-mobile-view.consultation.slotId",
                  String(selectedLegacySlot.timingId),
                );
                localStorage.removeItem("opd-mobile-view.consultation.vendorSlotId");
                localStorage.setItem(
                  "opd-mobile-view.consultation.slotLabel",
                  selectedLegacySlot.label,
                );
                localStorage.setItem(
                  "opd-mobile-view.consultation.dayLabel",
                  activeScheduleForSelected.day ?? "",
                );
                localStorage.setItem(
                  "opd-mobile-view.consultation.timeSlot",
                  formatNetworkBookTimeSlotForDate(
                    selectedCalendarDate,
                    selectedLegacySlot.label,
                  ),
                );
              }
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
          Continue
        </button>
      </footer>
    </div>
  );
}
