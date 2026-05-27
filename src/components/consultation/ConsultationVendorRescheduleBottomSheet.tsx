import { patchConsultationReschedule } from "@/api/patientConsultationReschedule";
import type { ConsultationVendorRescheduleContext } from "@/api/patientInvoices";
import { CONSULT_QR_COPY } from "@/constants/consultationQrCopy";
import { useHospitalConsultationSlots } from "@/hooks/useHospitalConsultationSlots";
import { useToast } from "@/hooks/useToast";
import {
  formatDateKey,
  formatVendorBookTimeSlot,
  groupVendorSlotsByCategory,
  slotsForVendorDate,
  vendorSlotKey,
  type VendorSlotPick,
} from "@/utils/vendorConsultationSlots";
import { SlotPeriodGlyph } from "@/components/slots/SlotPeriodIcon";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/ConsultationAppointmentSlotsPage.css";
import "./ConsultationVendorRescheduleBottomSheet.css";

function formatWeekdayShortIST(d: Date): string {
  try {
    return d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
  } catch {
    return d.toLocaleDateString("en-IN", { weekday: "short" });
  }
}

export type ConsultationVendorRescheduleBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  context: ConsultationVendorRescheduleContext;
  onCompleted: () => void | Promise<void>;
}>;

export function ConsultationVendorRescheduleBottomSheet({
  open,
  onClose,
  appointmentId,
  context,
  onCompleted,
}: ConsultationVendorRescheduleBottomSheetProps) {
  const toast = useToast();
  const titleId = useId();
  const reasonId = useId();
  const { load, loadErr, payload, calendarDays, defaultDayIdx } = useHospitalConsultationSlots(
    context.networkId,
    context.doctorId,
    { enabled: open, vendorCode: context.vendorCode, includeUserId: false },
  );

  const datedSlots = payload?.datedSlots ?? [];
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<VendorSlotPick | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const daysStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedDayIdx(defaultDayIdx);
    setSelectedSlot(null);
    setReason("");
  }, [open, defaultDayIdx]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || load !== "ok") return;
    const active = daysStripRef.current?.querySelector(".cas-day--active");
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [open, load, selectedDayIdx, calendarDays.length]);

  const selectedDate = calendarDays[selectedDayIdx] ?? calendarDays[0];
  const slotsForDay = selectedDate ? slotsForVendorDate(datedSlots, selectedDate) : [];
  const categorized = groupVendorSlotsByCategory(slotsForDay);

  const submit = useCallback(async () => {
    const apptId = appointmentId.trim();
    if (!apptId) {
      toast.error(CONSULT_QR_COPY.appointmentIdMissing);
      return;
    }
    if (!selectedSlot || !selectedDate) {
      toast.error("Please select a new slot.");
      return;
    }
    const slotId =
      selectedSlot.vendorSlotId ||
      datedSlots.find(
        (s) => s.date === formatDateKey(selectedDate) && s.time === selectedSlot.time24,
      )?.vendorSlotId ||
      "";
    if (!slotId) {
      toast.error("Could not resolve slot id. Pick another slot.");
      return;
    }
    setSubmitting(true);
    try {
      await patchConsultationReschedule(apptId, {
        slot_id: slotId,
        time_slot: formatVendorBookTimeSlot(selectedDate, selectedSlot.time24),
        reschedule_reason: reason.trim() || undefined,
      });
      toast.success("Appointment rescheduled");
      await onCompleted();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule appointment");
    } finally {
      setSubmitting(false);
    }
  }, [
    appointmentId,
    selectedSlot,
    selectedDate,
    datedSlots,
    reason,
    toast,
    onCompleted,
    onClose,
  ]);

  if (!open) return null;

  return (
    <dialog
      className="addr-sheet-dialog consult-vendor-rsch-dialog"
      open
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="consult-vendor-rsch">
        <header className="consult-vendor-rsch__head">
          <h2 id={titleId} className="consult-vendor-rsch__title">
            Reschedule appointment
          </h2>
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

        <div className="consult-vendor-rsch__body">
          <label className="consult-vendor-rsch__label" htmlFor={reasonId}>
            Reason (optional)
          </label>
          <textarea
            id={reasonId}
            className="consult-vendor-rsch__reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you rescheduling?"
          />

          {load === "loading" && <div className="cas-loading">Loading slots…</div>}
          {load === "error" && (
            <div className="cas-loading cas-loading--err" role="alert">
              {loadErr ?? "Could not load slots"}
            </div>
          )}
          {load === "ok" && calendarDays.length === 0 && (
            <div className="cas-loading">No slots available to reschedule.</div>
          )}
          {load === "ok" && calendarDays.length > 0 && (
            <>
              <div
                ref={daysStripRef}
                className="cas-days-wrap hide-scrollbar consult-vendor-rsch__days-wrap"
                aria-label="Scroll dates horizontally"
              >
                <div className="cas-days cas-days--scroll" role="radiogroup" aria-label="Choose date">
                  {calendarDays.map((d, idx) => (
                    <button
                      key={formatDateKey(d)}
                      type="button"
                      className={`cas-day${idx === selectedDayIdx ? " cas-day--active" : ""}`}
                      role="radio"
                      aria-checked={idx === selectedDayIdx}
                      onClick={() => {
                        setSelectedDayIdx(idx);
                        setSelectedSlot(null);
                      }}
                    >
                      <div className="cas-day__num">{d.getDate()}</div>
                      <div className="cas-day__dow">{formatWeekdayShortIST(d)}</div>
                    </button>
                  ))}
                </div>
              </div>
              {slotsForDay.length === 0 ? (
                <div className="cas-empty-slots">No slots for this date</div>
              ) : (
                categorized.map((group) => (
                  <section key={group.category} className="cas-section">
                    <div className="cas-section__head">
                      <SlotPeriodGlyph period={group.category} />
                      {group.title}
                    </div>
                    <div className="cas-slots" role="radiogroup">
                      {group.slots.map((s) => {
                        const key = vendorSlotKey(s);
                        const active =
                          selectedSlot != null && vendorSlotKey(selectedSlot) === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`cas-slot${active ? " cas-slot--active" : ""}`}
                            onClick={() => setSelectedSlot(s)}
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
        </div>

        <footer className="consult-vendor-rsch__foot">
          <button
            type="button"
            className="cas-confirm"
            disabled={submitting || load !== "ok" || !selectedSlot}
            onClick={() => void submit()}
          >
            {submitting ? "Rescheduling…" : "Confirm reschedule"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
