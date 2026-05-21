import { ROUTES } from "@/constants";
import { readDentalSelectedClinicRaw, writeDentalPreferredDateTime } from "@/constants/dentalBookingStorage";
import { DIAG_SELECTED_PERSON_KEY } from "@/constants/diagnosticsSelectedMemberStorage";
import { DentalSlotPicker } from "@/components/dental/DentalSlotPicker";
import {
  DENTAL_BOOKING_DAY_COUNT,
  firstDayWithBookableDentalSlots,
  flatDentalSlotLabelsForDay,
  formatDentalPreferredDateTime,
  getDentalBookingDays,
} from "@/utils/dentalSlotRules";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./DentalSlotsPage.css";

function readDiagPersonId(): string | null {
  try {
    const s = localStorage.getItem(DIAG_SELECTED_PERSON_KEY);
    return s?.trim() ? s : null;
  } catch {
    return null;
  }
}

export function DentalSlotsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const bookingNow = useMemo(() => new Date(nowTick), [nowTick]);

  const booking = useMemo(
    () => getDentalBookingDays(DENTAL_BOOKING_DAY_COUNT, bookingNow),
    [bookingNow],
  );

  const [day, setDay] = useState(() =>
    firstDayWithBookableDentalSlots(booking.dates, bookingNow),
  );
  const [slot, setSlot] = useState<string | null>(null);

  useEffect(() => {
    setDay((prev) => {
      const stillValid = booking.dates.some(
        (d) =>
          d.getDate() === prev.getDate() &&
          d.getMonth() === prev.getMonth() &&
          d.getFullYear() === prev.getFullYear(),
      );
      if (stillValid) return prev;
      return firstDayWithBookableDentalSlots(booking.dates, bookingNow);
    });
  }, [booking.dates, bookingNow]);

  useEffect(() => {
    const memberId = readDiagPersonId();
    const clinicRaw = readDentalSelectedClinicRaw();
    if (!memberId) {
      toast.error("Select a member first.");
      void navigate(ROUTES.dentalSelectPeople, { replace: true });
      return;
    }
    if (!clinicRaw) {
      toast.error("Select a clinic first.");
      void navigate(ROUTES.dentalNetworkList, { replace: true });
    }
  }, [navigate, toast]);

  const flatAvailable = useMemo(
    () => flatDentalSlotLabelsForDay(day, bookingNow),
    [day, bookingNow],
  );

  const canContinue = Boolean(slot) && flatAvailable.length > 0;

  const onContinue = () => {
    if (!slot || flatAvailable.length === 0) return;
    const preferredDateTime = formatDentalPreferredDateTime(day, slot);
    if (!preferredDateTime) {
      toast.error("Select date and time");
      return;
    }
    writeDentalPreferredDateTime(preferredDateTime);
    void navigate(ROUTES.dentalOverview);
  };

  return (
    <div className="hc-page dental-slots-page">
      <header className="hco-top">
        <Link to={ROUTES.dentalNetworkList} className="hco-back" aria-label="Back">
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
        <h1 className="hco-title">Select Your Dental Slots</h1>
        <span className="hco-top__balance" aria-hidden />
      </header>

      <main className="hc-main dental-slots-page__main">
        <DentalSlotPicker
          bookingDates={booking.dates}
          monthYearLabel={booking.monthYearLabel}
          selectedDay={day}
          onSelectDay={setDay}
          selectedSlot={slot}
          onSelectSlot={setSlot}
          bookingNow={bookingNow}
        />
      </main>

      <footer className="hc-footer">
        <button type="button" className="bottom-continue" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      </footer>
    </div>
  );
}
