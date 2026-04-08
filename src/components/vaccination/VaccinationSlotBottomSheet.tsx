import { useEffect, useMemo, useState } from "react";
import {
  formatPreferredApiDateTime,
  parsePreferredApiDateTime,
  VaccinationSlotPicker,
} from "@/components/vaccination/VaccinationSlotPicker";
import {
  firstDayWithBookableVaccinationSlots,
  getVaccinationBookingDates,
  sameCalendarDay,
  VACCINATION_BOOKING_DAY_COUNT,
} from "@/components/vaccination/vaccinationSlotRules";
import "@/components/address/AddressBottomSheet.css";

export type VaccinationSlotBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Current `YYYY-MM-DD HH:mm:ss` from flow state */
  preferredDateTime: string;
  onApplied: (nextPreferredDateTime: string) => void;
}>;

export function VaccinationSlotBottomSheet({
  open,
  onClose,
  preferredDateTime,
  onApplied,
}: VaccinationSlotBottomSheetProps) {
  const bookingDates = useMemo(
    () => getVaccinationBookingDates(VACCINATION_BOOKING_DAY_COUNT),
    [],
  );
  const [day, setDay] = useState(() =>
    firstDayWithBookableVaccinationSlots(bookingDates, new Date()),
  );

  const [slot, setSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const parsed = parsePreferredApiDateTime(preferredDateTime);
    if (parsed) {
      const match = bookingDates.find((d) => sameCalendarDay(d, parsed.day));
      setDay(match ?? bookingDates[0] ?? parsed.day);
      setSlot(parsed.slot12h);
    } else {
      setDay(firstDayWithBookableVaccinationSlots(bookingDates, new Date()));
      setSlot(null);
    }
  }, [open, preferredDateTime, bookingDates]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const apply = () => {
    if (!slot) return;
    onApplied(formatPreferredApiDateTime(day, slot));
    onClose();
  };

  if (!open) return null;

  return (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="vac-slot-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section
        className="addr-sheet"
        style={{ maxHeight: "min(85dvh, 640px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="addr-sheet__header">
          <h2 id="vac-slot-sheet-title" className="addr-sheet__title" style={{ flex: 1 }}>
            Select Your Vaccine Slots
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
        <div
          className="addr-sheet__list"
          style={{ overflowY: "auto", maxHeight: "min(72dvh, 560px)", paddingTop: 4 }}
        >
          <VaccinationSlotPicker
            selectedDay={day}
            onSelectDay={setDay}
            selectedSlot={slot}
            onSelectSlot={setSlot}
            onContinue={apply}
            continueLabel="Apply"
          />
        </div>
      </section>
    </dialog>
  );
}
