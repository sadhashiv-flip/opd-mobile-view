import { ROUTES } from "@/constants";
import { readDentalSelectedClinicRaw, writeDentalPreferredDateTime } from "@/constants/dentalBookingStorage";
import { DIAG_SELECTED_PERSON_KEY } from "@/constants/diagnosticsSelectedMemberStorage";
import { formatPreferredApiDateTime } from "@/components/vaccination/VaccinationSlotPicker";
import { DentalSlotPicker } from "@/components/dental/DentalSlotPicker";
import {
  DENTAL_BOOKING_DAY_COUNT,
  firstDayWithBookableDentalSlots,
  flatDentalSlotLabelsForDay,
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

  const bookingDates = useMemo(
    () => getDentalBookingDays(DENTAL_BOOKING_DAY_COUNT).dates,
    [],
  );
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const bookingNow = useMemo(() => new Date(nowTick), [nowTick]);

  const [day, setDay] = useState(() => firstDayWithBookableDentalSlots(bookingDates, new Date()));
  const [slot, setSlot] = useState<string | null>(null);

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
    const preferredDateTime = formatPreferredApiDateTime(day, slot);
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
          bookingDates={bookingDates}
          selectedDay={day}
          onSelectDay={setDay}
          selectedSlot={slot}
          onSelectSlot={setSlot}
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
