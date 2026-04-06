import { ROUTES } from "@/constants";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { HeaderTexts } from "@/constants/HeaderTexts";
import "./ConsultationAppointmentSlotsPage.css";

type DayChip = Readonly<{ day: string; date: string; dow: string }>;
type Slot = Readonly<{ id: string; label: string; disabled?: boolean }>;

const DAYS: readonly DayChip[] = [
  { day: "10", dow: "Mon", date: "2025-09-10" },
  { day: "11", dow: "Tue", date: "2025-09-11" },
  { day: "12", dow: "Wed", date: "2025-09-12" },
  { day: "13", dow: "Thu", date: "2025-09-13" },
  { day: "14", dow: "Fri", date: "2025-09-14" },
] as const;

const MORNING: readonly Slot[] = [
  { id: "m1", label: "7 AM–8 AM" },
  { id: "m2", label: "8 AM–9 AM" },
  { id: "m3", label: "9 AM–10 AM", disabled: true },
  { id: "m4", label: "10 AM–11 AM" },
  { id: "m5", label: "11 AM–12 PM" },
] as const;

const AFTERNOON: readonly Slot[] = [
  { id: "a1", label: "7 AM–8 AM" },
  { id: "a2", label: "8 AM–9 AM" },
  { id: "a3", label: "9 AM–10 AM" },
  { id: "a4", label: "10 AM–11 AM" },
  { id: "a5", label: "11 AM–12 PM" },
] as const;

export function DiagnosticsSlotsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";

  const [selectedDate, setSelectedDate] = useState(DAYS[0].date);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(MORNING[0].id);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string>(MORNING[0].label);

  const isSelected = (id: string) => selectedSlotId === id;

  return (
    <div className="cas-page">
      <header className="cas-top">
        <Link
          to={generatePath(ROUTES.diagnosticsVendors, { type })}
          className="cas-back"
          aria-label="Back to vendors"
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
        <h1 className="cas-title">{type === "health-checkups" ? HeaderTexts.healthCheckups.title : HeaderTexts.labTests.title}</h1>
      </header>

      <main className="cas-main">
        <div className="cas-note">
          Note : Flip Health will call and try to schedule your sample collection in your preferred slot or the next
          available slot
        </div>

        <div className="cas-row">
          <div className="cas-row__left">
            <span className="cas-row__ic" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
                <path d="M12 7v6l3 2" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>choose date and time</span>
          </div>
          <div className="cas-row__right">Sept 2025 ( IST )</div>
        </div>

        <div className="cas-days" role="radiogroup" aria-label="Choose day">
          {DAYS.map((d) => {
            const active = selectedDate === d.date;
            return (
              <button
                key={d.date}
                type="button"
                className={`cas-day${active ? " cas-day--active" : ""}`}
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedDate(d.date)}
              >
                <div className="cas-day__num">{d.day}</div>
                <div className="cas-day__dow">{d.dow}</div>
              </button>
            );
          })}
        </div>

        <div className="cas-divider" />

        <section className="cas-section">
          <div className="cas-section__head">
            <span className="cas-sun" aria-hidden="true">
              ☀
            </span>
            <span>Morning</span>
          </div>
          <div className="cas-slots" role="radiogroup" aria-label="Morning slots">
            {MORNING.map((s) => {
              const active = isSelected(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`cas-slot${active ? " cas-slot--active" : ""}${s.disabled ? " cas-slot--disabled" : ""}`}
                  disabled={!!s.disabled}
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSelectedSlotId(s.id);
                    setSelectedSlotLabel(s.label);
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="cas-section">
          <div className="cas-section__head">
            <span className="cas-sun cas-sun--pm" aria-hidden="true">
              ✷
            </span>
            <span>Afternoon</span>
          </div>
          <div className="cas-slots" role="radiogroup" aria-label="Afternoon slots">
            {AFTERNOON.map((s) => {
              const active = isSelected(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`cas-slot${active ? " cas-slot--active" : ""}`}
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSelectedSlotId(s.id);
                    setSelectedSlotLabel(s.label);
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="cas-footer">
        <button
          type="button"
          className="cas-confirm"
          onClick={() => {
            try {
              localStorage.setItem("opd-mobile-view.diagnostics.date", selectedDate);
              localStorage.setItem("opd-mobile-view.diagnostics.slotId", selectedSlotId);
              localStorage.setItem("opd-mobile-view.diagnostics.slotLabel", selectedSlotLabel);
            } catch {
              // ignore storage errors
            }
            navigate(generatePath(ROUTES.diagnosticsOverview, { type }));
          }}
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}

