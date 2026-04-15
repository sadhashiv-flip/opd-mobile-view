import { ROUTES } from "@/constants";
import {
  DIAG_LAB_SLOT_PAYLOAD_KEY,
  DIAG_LAB_SLOTS_PACKAGE,
  DIAG_LAB_VENDOR_CODE_KEY,
} from "@/constants/diagnosticsLabFlowStorage";
import { readSelectedAddress, subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import { fetchDiagnosticSlots, type DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HeaderTexts } from "@/constants/HeaderTexts";
import { useToast } from "@/hooks/useToast";
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

function slotKey(p: DiagnosticSlotPick): string {
  return `${p.slot_id}|${p.slot_date}|${p.start_time}|${p.end_time}`;
}

export function DiagnosticsSlotsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const toast = useToast();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const isLabTests = type === "lab-tests";

  const selectedAddressId = useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.id?.trim() ?? "",
    () => "",
  );

  const labDays = useMemo((): readonly DayChip[] => {
    const out: DayChip[] = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      const date = `${y}-${m}-${dayNum}`;
      out.push({
        date,
        day: String(d.getDate()),
        dow: d.toLocaleDateString("en-IN", { weekday: "short" }),
      });
    }
    return out;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(DAYS[0].date);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(MORNING[0].id);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string>(MORNING[0].label);

  const [labVendorCode, setLabVendorCode] = useState(() => {
    try {
      return localStorage.getItem(DIAG_LAB_VENDOR_CODE_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  });
  const [labMorning, setLabMorning] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labAfternoon, setLabAfternoon] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labEvening, setLabEvening] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labSlotLoading, setLabSlotLoading] = useState(false);
  const [labSelectedPick, setLabSelectedPick] = useState<DiagnosticSlotPick | null>(null);

  useEffect(() => {
    if (!isLabTests) return;
    try {
      const next = localStorage.getItem(DIAG_LAB_VENDOR_CODE_KEY)?.trim() ?? "";
      setLabVendorCode(next);
    } catch {
      setLabVendorCode("");
    }
    const first = labDays[0]?.date;
    if (first) setSelectedDate(first);
  }, [isLabTests, labDays]);

  const loadLabSlots = useCallback(async () => {
    if (!isLabTests) return;
    const addr = readSelectedAddress();
    const code = labVendorCode.trim();
    if (!addr?.id.trim() || !code || !selectedDate) {
      setLabMorning([]);
      setLabAfternoon([]);
      setLabEvening([]);
      return;
    }
    setLabSlotLoading(true);
    try {
      const res = await fetchDiagnosticSlots({
        address_id: addr.id.trim(),
        date: selectedDate,
        vendor_code: code,
        package: DIAG_LAB_SLOTS_PACKAGE,
      });
      setLabMorning(res.morning);
      setLabAfternoon(res.afternoon);
      setLabEvening(res.evening);
      setLabSelectedPick((prev) => {
        if (!prev) return prev;
        const all = [...res.morning, ...res.afternoon, ...res.evening];
        return all.some((s) => slotKey(s) === slotKey(prev)) ? prev : null;
      });
    } catch (e) {
      setLabMorning([]);
      setLabAfternoon([]);
      setLabEvening([]);
      setLabSelectedPick(null);
      toast.error(e instanceof Error ? e.message : "Could not load slots");
    } finally {
      setLabSlotLoading(false);
    }
  }, [isLabTests, labVendorCode, selectedDate, toast]);

  useEffect(() => {
    if (!isLabTests) return;
    void loadLabSlots();
  }, [isLabTests, loadLabSlots, selectedAddressId]);

  useEffect(() => {
    if (!isLabTests) return;
    setLabSelectedPick(null);
  }, [isLabTests, selectedDate]);

  const isSelected = (id: string) => selectedSlotId === id;

  const monthBanner = useMemo(() => {
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return isLabTests ? "" : "Sept 2025 ( IST )";
    }
    const d = new Date(`${selectedDate}T12:00:00`);
    return `${d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} ( IST )`;
  }, [selectedDate, isLabTests]);

  const dayChips = isLabTests ? labDays : DAYS;

  const pickLabSlot = (p: DiagnosticSlotPick) => {
    setLabSelectedPick(p);
  };

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
        <h1 className="cas-title">
          {type === "health-checkups" ? HeaderTexts.healthCheckups.title : HeaderTexts.labTests.title}
        </h1>
      </header>

      <main className={`cas-main${isLabTests ? " cas-main--with-sticky-footer" : ""}`}>
        <div className="cas-note">
          Note : Flip Health will call and try to schedule your sample collection in your preferred slot or the next
          available slot
        </div>

        {isLabTests && !labVendorCode ? (
          <p className="cas-note" role="alert">
            Go back and select a lab partner first.
          </p>
        ) : null}

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
          <div className="cas-row__right">{monthBanner || " "}</div>
        </div>

        <div className="cas-days" role="radiogroup" aria-label="Choose day">
          {dayChips.map((d) => {
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

        {isLabTests ? (
          <>
            {labSlotLoading ? <p className="cas-note">Loading slots…</p> : null}
            <section className="cas-section">
              <div className="cas-section__head">
                <span className="cas-sun" aria-hidden="true">
                  ☀
                </span>
                <span>Morning</span>
              </div>
              <div className="cas-slots" role="radiogroup" aria-label="Morning slots">
                {labMorning.length === 0 && !labSlotLoading ? (
                  <span className="cas-note">No morning slots</span>
                ) : null}
                {labMorning.map((s) => {
                  const active = labSelectedPick != null && slotKey(labSelectedPick) === slotKey(s);
                  const label = `${s.start_time} – ${s.end_time}`;
                  return (
                    <button
                      key={slotKey(s)}
                      type="button"
                      className={`cas-slot${active ? " cas-slot--active" : ""}`}
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickLabSlot(s)}
                    >
                      {label}
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
                {labAfternoon.length === 0 && !labSlotLoading ? (
                  <span className="cas-note">No afternoon slots</span>
                ) : null}
                {labAfternoon.map((s) => {
                  const active = labSelectedPick != null && slotKey(labSelectedPick) === slotKey(s);
                  const label = `${s.start_time} – ${s.end_time}`;
                  return (
                    <button
                      key={slotKey(s)}
                      type="button"
                      className={`cas-slot${active ? " cas-slot--active" : ""}`}
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickLabSlot(s)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="cas-section">
              <div className="cas-section__head">
                <span className="cas-sun cas-sun--pm" aria-hidden="true">
                  ☾
                </span>
                <span>Evening</span>
              </div>
              <div className="cas-slots" role="radiogroup" aria-label="Evening slots">
                {labEvening.length === 0 && !labSlotLoading ? (
                  <span className="cas-note">No evening slots</span>
                ) : null}
                {labEvening.map((s) => {
                  const active = labSelectedPick != null && slotKey(labSelectedPick) === slotKey(s);
                  const label = `${s.start_time} – ${s.end_time}`;
                  return (
                    <button
                      key={slotKey(s)}
                      type="button"
                      className={`cas-slot${active ? " cas-slot--active" : ""}`}
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickLabSlot(s)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <>
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
          </>
        )}
      </main>

      <footer className={`cas-footer${isLabTests ? " cas-footer--sticky" : ""}`}>
        <button
          type="button"
          className="cas-confirm"
          disabled={isLabTests && (!labSelectedPick || !labVendorCode)}
          onClick={() => {
            try {
              if (isLabTests && labSelectedPick) {
                localStorage.setItem("opd-mobile-view.diagnostics.date", labSelectedPick.slot_date);
                localStorage.setItem("opd-mobile-view.diagnostics.slotId", labSelectedPick.slot_id);
                localStorage.setItem(
                  "opd-mobile-view.diagnostics.slotLabel",
                  `${labSelectedPick.start_time} – ${labSelectedPick.end_time}`,
                );
                localStorage.setItem(DIAG_LAB_SLOT_PAYLOAD_KEY, JSON.stringify(labSelectedPick));
              } else {
                localStorage.setItem("opd-mobile-view.diagnostics.date", selectedDate);
                localStorage.setItem("opd-mobile-view.diagnostics.slotId", selectedSlotId);
                localStorage.setItem("opd-mobile-view.diagnostics.slotLabel", selectedSlotLabel);
              }
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
