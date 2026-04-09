import { useEffect, useMemo } from "react";
import type { VisionServiceSlotRow, VisionServiceSlotsData } from "@/api/visionServiceSlots";
import "@/pages/HealthCheckupsPage.css";
import "@/components/vaccination/VaccinationSlotPicker.css";

const GROUPS = [
  { id: "morning" as const, label: "Morning", pick: (s: VisionServiceSlotsData["slots"]) => s.morning },
  { id: "afternoon" as const, label: "Afternoon", pick: (s: VisionServiceSlotsData["slots"]) => s.afternoon },
  { id: "evening" as const, label: "Evening", pick: (s: VisionServiceSlotsData["slots"]) => s.evening },
] as const;

function PeriodIcon({ period }: Readonly<{ period: "morning" | "afternoon" | "evening" }>) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const, "aria-hidden": true };
  if (period === "morning") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path
          d="M12 2v2M12 20v2M2 12h2M20 12h2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (period === "afternoon") {
    return (
      <svg {...common}>
        <path d="M4 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="10" r="3.5" fill="currentColor" />
        <path
          d="M8 6c1.5-1 3.5-1 5 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8 10c1.5 1 3.5 1 5 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

function filterForDate(rows: readonly VisionServiceSlotRow[], iso: string): VisionServiceSlotRow[] {
  return rows.filter((r) => r.slot_date === iso);
}

export type VisionSlotPickerProps = Readonly<{
  daysList: readonly string[];
  slots: VisionServiceSlotsData["slots"];
  selectedIsoDate: string;
  onSelectIsoDate: (iso: string) => void;
  selectedSlotId: string | null;
  onSelectSlotId: (id: string | null) => void;
}>;

export function VisionSlotPicker({
  daysList,
  slots,
  selectedIsoDate,
  onSelectIsoDate,
  selectedSlotId,
  onSelectSlotId,
}: VisionSlotPickerProps) {
  const monthLabel = useMemo(() => {
    const d = new Date(`${selectedIsoDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }, [selectedIsoDate]);

  const flatForDay = useMemo(() => {
    const m = filterForDate(slots.morning, selectedIsoDate);
    const a = filterForDate(slots.afternoon, selectedIsoDate);
    const e = filterForDate(slots.evening, selectedIsoDate);
    return [...m, ...a, ...e];
  }, [slots, selectedIsoDate]);

  useEffect(() => {
    if (flatForDay.length === 0) {
      if (selectedSlotId !== null) onSelectSlotId(null);
      return;
    }
    if (selectedSlotId != null && !flatForDay.some((r) => r.slot_id === selectedSlotId)) {
      onSelectSlotId(null);
    }
  }, [selectedIsoDate, selectedSlotId, onSelectSlotId, flatForDay]);

  return (
    <div className="vac-slot-pick">
      <div className="vac-slot-pick__row-label">
        <span className="vac-slot-pick__label">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
            <path
              d="M12 7v6l4 2"
              stroke="#FF541E"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Choose date and time
        </span>
        <span className="vac-slot-pick__month">{monthLabel}</span>
      </div>

      <div className="vac-slot-pick__dates" role="list">
        {daysList.map((iso) => {
          const d = new Date(`${iso}T12:00:00`);
          const sel = iso === selectedIsoDate;
          const num = Number.isNaN(d.getTime()) ? "—" : d.getDate();
          const dow = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { weekday: "short" });
          return (
            <button
              key={iso}
              type="button"
              role="listitem"
              className={`vac-slot-pick__date${sel ? " vac-slot-pick__date--selected" : ""}`}
              onClick={() => onSelectIsoDate(iso)}
            >
              <span className="vac-slot-pick__date-num">{num}</span>
              <span className="vac-slot-pick__date-dow">{dow}</span>
            </button>
          );
        })}
      </div>

      {GROUPS.map((g) => {
        const rows = filterForDate(g.pick(slots), selectedIsoDate);
        if (rows.length === 0) return null;
        return (
          <section key={g.id} className="vac-slot-pick__group">
            <div className="vac-slot-pick__group-head">
              <span className="vac-slot-pick__sun" aria-hidden>
                <PeriodIcon period={g.id} />
              </span>
              {g.label}
            </div>
            <div className="vac-slot-pick__pills">
              {rows.map((row) => {
                const on = selectedSlotId === row.slot_id;
                return (
                  <button
                    key={row.slot_id}
                    type="button"
                    className={`vac-slot-pick__pill${on ? " vac-slot-pick__pill--selected" : ""}`}
                    onClick={() => onSelectSlotId(row.slot_id)}
                  >
                    {row.start_time}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {flatForDay.length === 0 ? (
        <p className="vac-slot-pick__empty" role="status">
          No slots left for this day. Pick another date.
        </p>
      ) : null}
    </div>
  );
}
