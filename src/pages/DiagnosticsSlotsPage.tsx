import { ROUTES } from "@/constants";
import {
  DIAG_LAB_SLOT_PAYLOAD_KEY,
  DIAG_LAB_SLOTS_PACKAGE,
  DIAG_LAB_VENDOR_CODE_KEY,
} from "@/constants/diagnosticsLabFlowStorage";
import {
  DIAG_HEALTH_SLOTS_PACKAGE,
  readHealthVendorMeta,
  writeHealthPathologySlotJson,
  writeHealthRadiologySlotJson,
} from "@/constants/diagnosticsHealthFlowStorage";
import { readSelectedAddress, subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import { fetchDiagnosticSlots, type DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HeaderTexts } from "@/constants/HeaderTexts";
import { useToast } from "@/hooks/useToast";
import "./ConsultationAppointmentSlotsPage.css";

type DayChip = Readonly<{ day: string; date: string; dow: string }>;

function slotKey(p: DiagnosticSlotPick): string {
  return `${p.slot_id}|${p.slot_date}|${p.start_time}|${p.end_time}`;
}

function initialHealthPhase(): "pathology" | "radiology" {
  const m = readHealthVendorMeta();
  if (!m) return "pathology";
  if (m.needPathology) return "pathology";
  if (m.needRadiology) return "radiology";
  return "pathology";
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

  const [selectedDate, setSelectedDate] = useState<string>("");

  const [labVendorCode, setLabVendorCode] = useState(() => {
    try {
      return localStorage.getItem(DIAG_LAB_VENDOR_CODE_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  });
  const [healthPhase, setHealthPhase] = useState<"pathology" | "radiology">(initialHealthPhase);

  const [labMorning, setLabMorning] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labAfternoon, setLabAfternoon] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labEvening, setLabEvening] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labSlotLoading, setLabSlotLoading] = useState(false);
  const [labSelectedPick, setLabSelectedPick] = useState<DiagnosticSlotPick | null>(null);

  useEffect(() => {
    const first = labDays[0]?.date;
    if (first) setSelectedDate(first);
  }, [labDays]);

  useEffect(() => {
    if (!isLabTests) return;
    try {
      const next = localStorage.getItem(DIAG_LAB_VENDOR_CODE_KEY)?.trim() ?? "";
      setLabVendorCode(next);
    } catch {
      setLabVendorCode("");
    }
  }, [isLabTests, selectedAddressId]);

  const loadLabSlots = useCallback(async () => {
    if (!isLabTests) return;
    const addr = readSelectedAddress();
    const code = labVendorCode.trim() || "unknown";
    if (!addr?.id.trim() || !selectedDate) {
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

  const loadHealthSlots = useCallback(async () => {
    if (isLabTests) return;
    const meta = readHealthVendorMeta();
    const addr = readSelectedAddress();
    if (!meta || !addr?.id.trim() || !selectedDate) {
      setLabMorning([]);
      setLabAfternoon([]);
      setLabEvening([]);
      return;
    }
    const category = healthPhase;
    const vendorCode =
      healthPhase === "pathology" ? meta.pathVendorCode.trim() : meta.radVendorCode.trim();
    if (!vendorCode) {
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
        vendor_code: vendorCode,
        package: DIAG_HEALTH_SLOTS_PACKAGE,
        category,
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
  }, [isLabTests, healthPhase, selectedDate, toast]);

  useEffect(() => {
    if (!isLabTests) return;
    void loadLabSlots();
  }, [isLabTests, loadLabSlots, selectedAddressId]);

  useEffect(() => {
    if (isLabTests) return;
    void loadHealthSlots();
  }, [isLabTests, loadHealthSlots, selectedAddressId]);

  useEffect(() => {
    setLabSelectedPick(null);
  }, [selectedDate, healthPhase]);

  const monthBanner = useMemo(() => {
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return "";
    const d = new Date(`${selectedDate}T12:00:00`);
    return `${d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} ( IST )`;
  }, [selectedDate]);

  const pickLabSlot = (p: DiagnosticSlotPick) => {
    setLabSelectedPick(p);
  };

  const healthMeta = !isLabTests ? readHealthVendorMeta() : null;
  const healthSlotHint =
    !isLabTests && healthMeta?.needPathology && healthMeta.needRadiology
      ? healthPhase === "pathology"
        ? "Step 1 of 2: pathology collection time"
        : "Step 2 of 2: radiology visit time"
      : null;

  const confirmDisabled =
    isLabTests && (!labSelectedPick || !labVendorCode) ? true : !isLabTests && !labSelectedPick;

  const confirmLabel =
    !isLabTests &&
    healthMeta?.needPathology &&
    healthMeta.needRadiology &&
    healthPhase === "pathology" &&
    labSelectedPick
      ? "Continue to radiology"
      : "Confirm";

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

      <main className="cas-main cas-main--with-sticky-footer">
        <div className="cas-note">
          Note : Flip Health will call and try to schedule your sample collection in your preferred slot or the next
          available slot
        </div>

        {healthSlotHint ? <p className="cas-note">{healthSlotHint}</p> : null}

        {isLabTests && !labVendorCode ? (
          <p className="cas-note" role="alert">
            Go back and select a lab partner first.
          </p>
        ) : null}

        {!isLabTests && !healthMeta ? (
          <p className="cas-note" role="alert">
            Go back and complete vendor selection first.
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
          {labDays.map((d) => {
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
      </main>

      <footer className="cas-footer cas-footer--sticky">
        <button
          type="button"
          className="cas-confirm"
          disabled={confirmDisabled}
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
                navigate(generatePath(ROUTES.diagnosticsOverview, { type }));
                return;
              }

              if (!isLabTests && labSelectedPick) {
                const meta = readHealthVendorMeta();
                if (!meta) return;

                if (healthPhase === "pathology") {
                  writeHealthPathologySlotJson(JSON.stringify(labSelectedPick));
                  localStorage.setItem("opd-mobile-view.diagnostics.date", labSelectedPick.slot_date);
                  localStorage.setItem(
                    "opd-mobile-view.diagnostics.slotLabel",
                    `${labSelectedPick.start_time} – ${labSelectedPick.end_time}`,
                  );
                  if (meta.needRadiology) {
                    setHealthPhase("radiology");
                    setLabSelectedPick(null);
                    return;
                  }
                  navigate(generatePath(ROUTES.diagnosticsOverview, { type }));
                  return;
                }

                writeHealthRadiologySlotJson(JSON.stringify(labSelectedPick));
                localStorage.setItem("opd-mobile-view.diagnostics.date", labSelectedPick.slot_date);
                localStorage.setItem(
                  "opd-mobile-view.diagnostics.slotLabel",
                  `${labSelectedPick.start_time} – ${labSelectedPick.end_time}`,
                );
                navigate(generatePath(ROUTES.diagnosticsOverview, { type }));
              }
            } catch {
              // ignore storage errors
            }
          }}
        >
          {confirmLabel}
        </button>
      </footer>
    </div>
  );
}
