import { ROUTES } from "@/constants";
import { readVaccinationFlowState, writeVaccinationFlowState } from "@/constants/vaccinationFlowStorage";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import {
  formatPreferredApiDateTime,
  parsePreferredApiDateTime,
  VaccinationSlotPicker,
} from "@/components/vaccination/VaccinationSlotPicker";
import {
  filterSlotsForDay,
  firstDayWithBookableVaccinationSlots,
  getVaccinationBookingDates,
  sameCalendarDay,
  VACCINATION_BOOKING_DAY_COUNT,
  VACCINATION_SLOT_GROUPS,
} from "@/components/vaccination/vaccinationSlotRules";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./VaccinationSlotsPage.css";

export function VaccinationSlotsPage() {
  const navigate = useNavigate();
  const flow = readVaccinationFlowState();
  /** 5 days including today; only slots strictly after current time are listed. */
  const bookingDates = useMemo(
    () => getVaccinationBookingDates(VACCINATION_BOOKING_DAY_COUNT),
    [],
  );
  const [day, setDay] = useState(() =>
    firstDayWithBookableVaccinationSlots(bookingDates, new Date()),
  );
  const [slot, setSlot] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const bookingNow = useMemo(() => new Date(nowTick), [nowTick]);
  const flatAvailable = useMemo(
    () => VACCINATION_SLOT_GROUPS.flatMap((g) => filterSlotsForDay(day, g.slots, bookingNow)),
    [day, bookingNow],
  );
  const canContinue = Boolean(slot) && flatAvailable.length > 0;

  useEffect(() => {
    if (!flow?.memberId) {
      void navigate(ROUTES.vaccinationSelectPeople, { replace: true });
      return;
    }
    if (!flow.selectedServices?.length) {
      void navigate(ROUTES.vaccinationChooseType, { replace: true });
      return;
    }
    if (flow.preferredDateTime) {
      const p = parsePreferredApiDateTime(flow.preferredDateTime);
      if (p) {
        const match = bookingDates.find((d) => sameCalendarDay(d, p.day));
        setDay(match ?? bookingDates[0] ?? p.day);
        setSlot(p.slot12h);
      }
    }
  }, [flow?.memberId, flow?.selectedServices?.length, flow?.preferredDateTime, navigate, bookingDates]);

  const onContinue = () => {
    if (!flow?.memberId || !slot || !flow.selectedServices?.length) return;
    const preferredDateTime = formatPreferredApiDateTime(day, slot);
    writeVaccinationFlowState({
      memberId: flow.memberId,
      memberName: flow.memberName,
      userId: flow.userId,
      selectedServices: flow.selectedServices,
      preferredDateTime,
    });
    void navigate(ROUTES.vaccinationOverview);
  };

  return (
    <div className="hc-page vac-slots-page">
      <header className="hco-top">
        <Link to={ROUTES.vaccinationChooseType} className="hco-back" aria-label="Back">
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
        <h1 className="hco-title">Select Your Vaccine Slots</h1>
        <span className="hco-top__balance" aria-hidden />
      </header>

      <main className="hc-main vac-slots-page__main">
        <VaccinationAddressBar />
        <VaccinationSlotPicker
          selectedDay={day}
          onSelectDay={setDay}
          selectedSlot={slot}
          onSelectSlot={setSlot}
          showContinueFooter={false}
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
