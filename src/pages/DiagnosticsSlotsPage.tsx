import { ROUTES } from "@/constants";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
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
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { readSelectedAddress, subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import { fetchDiagnosticSlots, type DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HeaderTexts } from "@/constants/HeaderTexts";
import { useToast } from "@/hooks/useToast";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
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

  /** Lab cart flow — today through next 6 days. */
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

  /**
   * AHC / health checkup — matches patient_app `HealthCheckupsController._initDates`:
   * next 7 days starting **tomorrow** (`now.add(Duration(days: i + 1))`).
   */
  const ahcSlotDays = useMemo((): readonly DayChip[] => {
    const out: DayChip[] = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i + 1);
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

  const displayDays = isLabTests ? labDays : ahcSlotDays;

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const hSlotsLocRaw = useSelectedAddressLine("");

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

  /** Reset date strip when switching pathology ↔ radiology (patient_app re-inits per category). */
  useEffect(() => {
    const days = isLabTests ? labDays : ahcSlotDays;
    const first = days[0]?.date;
    if (first) setSelectedDate(first);
  }, [isLabTests, labDays, ahcSlotDays, healthPhase]);

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

  /** Lab route is always `lab-tests`; health-checkups uses pathology/radiology branch above. */
  const slotHeaderTitle = !isLabTests
    ? healthPhase === "pathology"
      ? "Pathology Slot"
      : "Radiology Slot"
    : HeaderTexts.labTests.title;

  const pathTabDone =
    healthPhase === "radiology" || (healthPhase === "pathology" && labSelectedPick != null);
  const radTabDone = healthPhase === "radiology" && labSelectedPick != null;

  const allBucketsEmpty =
    labMorning.length === 0 && labAfternoon.length === 0 && labEvening.length === 0;

  const confirmDisabled =
    isLabTests && (!labSelectedPick || !labVendorCode) ? true : !isLabTests && !labSelectedPick;

  const confirmLabel = useMemo(() => {
    if (isLabTests) return "Confirm";
    const m = healthMeta;
    if (!m) return "Continue to Overview";
    if (m.needPathology && m.needRadiology && healthPhase === "pathology") return "Next: Radiology Slot";
    return "Continue to Overview";
  }, [isLabTests, healthMeta, healthPhase]);

  const slotsGridClass = !isLabTests ? "cas-slots cas-slots--dense" : "cas-slots";

  const slotBtnClass = (active: boolean) =>
    `${!isLabTests ? "cas-slot cas-slot--dense" : "cas-slot"}${active ? " cas-slot--active" : ""}`;

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
        <h1 className="cas-title">{slotHeaderTitle}</h1>
      </header>

      {!isLabTests ? (
        <button
          type="button"
          className="cas-loc-bar"
          aria-label={hSlotsLocRaw.trim() ? "Choose address" : "Add delivery address"}
          onClick={() => setAddrSheetOpen(true)}
        >
          <span className="cas-loc-bar__pin" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z" fill="#FF541E" />
              <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
            </svg>
          </span>
          <span className="cas-loc-bar__body">
            <AddressStripLabels
              layout="stack"
              addrRaw={hSlotsLocRaw}
              titleClassName="cas-loc-bar__title"
              addrClassName="cas-loc-bar__addr"
              promptClassName="cas-loc-bar__addr cas-loc-bar__addr--prompt"
            />
          </span>
          <span className="cas-loc-bar__chev" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      ) : null}

      <main className="cas-main cas-main--with-sticky-footer">
        <div className="cas-note">
          Note : Flip Health will call and try to schedule your sample collection in your preferred slot or the next
          available slot
        </div>

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

        {!isLabTests && healthMeta?.needPathology && healthMeta.needRadiology ? (
          <div className="cas-ahc-tabs" role="tablist" aria-label="Slot steps">
            <div
              className={`cas-ahc-tab${healthPhase === "pathology" ? " cas-ahc-tab--active" : ""}`}
              role="tab"
              aria-selected={healthPhase === "pathology"}
            >
              <span>Pathology</span>
              {pathTabDone ? (
                <span className="cas-ahc-tab__done" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : null}
            </div>
            <div
              className={`cas-ahc-tab${healthPhase === "radiology" ? " cas-ahc-tab--active" : ""}`}
              role="tab"
              aria-selected={healthPhase === "radiology"}
            >
              <span>Radiology</span>
              {radTabDone ? (
                <span className="cas-ahc-tab__done" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : null}
            </div>
          </div>
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

        <div className={isLabTests ? undefined : "cas-days-wrap"}>
          <div
            className={`cas-days${!isLabTests ? " cas-days--scroll" : ""}`}
            role="radiogroup"
            aria-label="Choose day"
          >
            {displayDays.map((d) => {
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
        </div>

        <div className="cas-divider" />

        {labSlotLoading ? <p className="cas-note">Loading slots…</p> : null}

        {!isLabTests && allBucketsEmpty && !labSlotLoading ? (
          <div className="cas-empty-ahc">
            <p className="cas-empty-ahc__title">No slots available</p>
            <p className="cas-empty-ahc__sub">Try another date or check back later.</p>
          </div>
        ) : (
          <>
            <section className="cas-section">
              <div className="cas-section__head">
                <span className="cas-sun" aria-hidden="true">
                  ☀
                </span>
                <span>Morning</span>
              </div>
              <div className={slotsGridClass} role="radiogroup" aria-label="Morning slots">
                {labMorning.length === 0 && !labSlotLoading && isLabTests ? (
                  <span className="cas-note">No morning slots</span>
                ) : null}
                {labMorning.map((s) => {
                  const active = labSelectedPick != null && slotKey(labSelectedPick) === slotKey(s);
                  const label = `${s.start_time} – ${s.end_time}`;
                  return (
                    <button
                      key={slotKey(s)}
                      type="button"
                      className={slotBtnClass(active)}
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
              <div className={slotsGridClass} role="radiogroup" aria-label="Afternoon slots">
                {labAfternoon.length === 0 && !labSlotLoading && isLabTests ? (
                  <span className="cas-note">No afternoon slots</span>
                ) : null}
                {labAfternoon.map((s) => {
                  const active = labSelectedPick != null && slotKey(labSelectedPick) === slotKey(s);
                  const label = `${s.start_time} – ${s.end_time}`;
                  return (
                    <button
                      key={slotKey(s)}
                      type="button"
                      className={slotBtnClass(active)}
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
              <div className={slotsGridClass} role="radiogroup" aria-label="Evening slots">
                {labEvening.length === 0 && !labSlotLoading && isLabTests ? (
                  <span className="cas-note">No evening slots</span>
                ) : null}
                {labEvening.map((s) => {
                  const active = labSelectedPick != null && slotKey(labSelectedPick) === slotKey(s);
                  const label = `${s.start_time} – ${s.end_time}`;
                  return (
                    <button
                      key={slotKey(s)}
                      type="button"
                      className={slotBtnClass(active)}
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
        )}
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

      {!isLabTests ? <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} /> : null}
    </div>
  );
}
