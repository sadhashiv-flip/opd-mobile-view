import { ROUTES } from "@/constants";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import {
  DIAG_LAB_SLOTS_PACKAGE,
  DIAG_LAB_VENDOR_CODE_KEY,
  readLabSlotPayload,
  writeLabSlotPayload,
} from "@/constants/diagnosticsLabFlowStorage";
import {
  DIAG_HEALTH_SLOTS_PACKAGE,
  readHealthPathologySlotPick,
  readHealthRadiologySlotPick,
  readHealthSlotPhase,
  readHealthVendorMeta,
  writeHealthPathologySlotJson,
  writeHealthRadiologySlotJson,
  writeHealthSlotPhase,
  type HealthSlotPhase,
} from "@/constants/diagnosticsHealthFlowStorage";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { readSelectedAddress, subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import { fetchDiagnosticSlots, type DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { labSlotsBucketsEmpty, type LabSlotBuckets } from "@/lib/labSlotSelection";
import { LabTestSlotPicker } from "@/components/diagnostics/LabTestSlotPicker";
import { SlotPeriodSectionHead } from "@/components/slots/SlotPeriodIcon";
import { clearLabSlotStep } from "@/lib/bookingFlowStackCleanup";
import { useToast } from "@/hooks/useToast";
import { useHasSelectedDeliveryAddress } from "@/hooks/useSelectedAddressLine";
import { deliveryAddressChooserAriaLabel } from "@/constants/selectedAddressStorage";
import "./ConsultationAppointmentSlotsPage.css";

type DayChip = Readonly<{ day: string; date: string; dow: string }>;

function slotKey(p: DiagnosticSlotPick): string {
  return `${p.slot_id}|${p.slot_date}|${p.start_time}|${p.end_time}`;
}

function labDateFromStored(
  days: readonly DayChip[],
  stored: DiagnosticSlotPick | null,
): string {
  const storedDate = stored?.slot_date?.trim();
  if (storedDate && days.some((d) => d.date === storedDate)) return storedDate;
  return days[0]?.date ?? "";
}

function healthDateFromStored(
  days: readonly DayChip[],
  stored: DiagnosticSlotPick | null,
): string {
  const storedDate = stored?.slot_date?.trim();
  if (storedDate && days.some((d) => d.date === storedDate)) return storedDate;
  return days[0]?.date ?? "";
}

function initialHealthPhase(): HealthSlotPhase {
  const stored = readHealthSlotPhase();
  if (stored) return stored;
  const m = readHealthVendorMeta();
  if (!m) return "pathology";
  if (m.needPathology) return "pathology";
  if (m.needRadiology) return "radiology";
  return "pathology";
}

function initialHealthSlotPick(phase: HealthSlotPhase): DiagnosticSlotPick | null {
  return phase === "pathology" ? readHealthPathologySlotPick() : readHealthRadiologySlotPick();
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

  /** Lab cart flow — matches patient_app `LabTestController._generateDates` (5 days from today). */
  const labDays = useMemo((): readonly DayChip[] => {
    const out: DayChip[] = [];
    const base = new Date();
    for (let i = 0; i < 5; i++) {
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

  const storedLabPick = isLabTests ? readLabSlotPayload() : null;

  const initialHealthPhaseValue = initialHealthPhase();
  const initialHealthPick = initialHealthSlotPick(initialHealthPhaseValue);

  const [selectedDate, setSelectedDate] = useState(() => {
    if (isLabTests) return labDateFromStored(labDays, storedLabPick);
    return healthDateFromStored(ahcSlotDays, initialHealthPick);
  });
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const hasDeliveryAddress = useHasSelectedDeliveryAddress();

  const [labVendorCode, setLabVendorCode] = useState(() => {
    try {
      return localStorage.getItem(DIAG_LAB_VENDOR_CODE_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  });
  const [healthPhase, setHealthPhase] = useState<HealthSlotPhase>(initialHealthPhaseValue);

  const [labMorning, setLabMorning] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labAfternoon, setLabAfternoon] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labEvening, setLabEvening] = useState<readonly DiagnosticSlotPick[]>([]);
  const [labSlotLoading, setLabSlotLoading] = useState(false);
  const [labSlotsFetched, setLabSlotsFetched] = useState(false);
  const [labSelectedPick, setLabSelectedPick] = useState<DiagnosticSlotPick | null>(() =>
    isLabTests ? storedLabPick : initialHealthPick,
  );
  /** First load scans forward from today when the current day has no slots (patient_app lab flow). */
  const labSlotScanForwardRef = useRef(!storedLabPick);
  const [labAutoAdvancedToDate, setLabAutoAdvancedToDate] = useState<string | null>(null);

  /**
   * Lab: restore date/slot when returning with a saved pick (back from overview).
   * Health: restore date/slot per pathology/radiology phase when navigating back into this screen.
   */
  useEffect(() => {
    if (isLabTests) {
      const stored = readLabSlotPayload();
      if (stored) {
        const d = labDateFromStored(labDays, stored);
        if (d) {
          labSlotScanForwardRef.current = false;
          setSelectedDate(d);
          setLabSelectedPick(stored);
          return;
        }
      }
      const first = labDays[0]?.date;
      if (first) setSelectedDate(first);
      setLabSelectedPick(null);
      labSlotScanForwardRef.current = true;
      return;
    }

    writeHealthSlotPhase(healthPhase);
    const phasePick =
      healthPhase === "pathology" ? readHealthPathologySlotPick() : readHealthRadiologySlotPick();
    const d = healthDateFromStored(ahcSlotDays, phasePick);
    if (d) {
      setSelectedDate(d);
      setLabSelectedPick(phasePick);
      return;
    }
    const first = ahcSlotDays[0]?.date;
    if (first) {
      setSelectedDate(first);
      setLabSelectedPick(null);
    }
  }, [isLabTests, labDays, ahcSlotDays, healthPhase]);

  useEffect(() => {
    if (!isLabTests) return;
    labSlotScanForwardRef.current = true;
    setLabAutoAdvancedToDate(null);
    setLabSlotsFetched(false);
    try {
      const next = localStorage.getItem(DIAG_LAB_VENDOR_CODE_KEY)?.trim() ?? "";
      setLabVendorCode(next);
    } catch {
      setLabVendorCode("");
    }
  }, [isLabTests, selectedAddressId]);

  const applyLabSlotBuckets = useCallback(
    (res: LabSlotBuckets, dateForRestore: string) => {
      setLabMorning(res.morning);
      setLabAfternoon(res.afternoon);
      setLabEvening(res.evening);
      const all = [...res.morning, ...res.afternoon, ...res.evening];
      const keepIfListed = (pick: DiagnosticSlotPick | null) =>
        pick && all.some((s) => slotKey(s) === slotKey(pick)) ? pick : null;

      setLabSelectedPick((prev) => {
        if (prev) return keepIfListed(prev);
        if (!isLabTests) return null;
        const stored = readLabSlotPayload();
        if (stored && stored.slot_date === dateForRestore) return keepIfListed(stored);
        return null;
      });
    },
    [isLabTests],
  );

  const loadLabSlots = useCallback(async () => {
    if (!isLabTests) return;
    const addr = readSelectedAddress();
    const code = labVendorCode.trim() || "unknown";
    if (!addr?.id.trim() || !selectedDate) {
      setLabMorning([]);
      setLabAfternoon([]);
      setLabEvening([]);
      setLabSlotsFetched(false);
      return;
    }

    const scanForward = labSlotScanForwardRef.current;
    const startIdx = Math.max(
      0,
      labDays.findIndex((d) => d.date === selectedDate),
    );
    const datesToTry = scanForward
      ? labDays.slice(startIdx).map((d) => d.date)
      : [selectedDate];

    setLabSlotLoading(true);
    if (scanForward) setLabAutoAdvancedToDate(null);

    try {
      let lastEmpty: LabSlotBuckets = { morning: [], afternoon: [], evening: [] };
      let matchedDate: string | null = null;

      for (const date of datesToTry) {
        const res = await fetchDiagnosticSlots({
          address_id: addr.id.trim(),
          date,
          vendor_code: code,
          package: DIAG_LAB_SLOTS_PACKAGE,
        });
        if (!labSlotsBucketsEmpty(res)) {
          matchedDate = date;
          applyLabSlotBuckets(res, date);
          if (scanForward && date !== selectedDate) {
            setLabAutoAdvancedToDate(date);
            setSelectedDate(date);
          }
          break;
        }
        lastEmpty = res;
      }

      if (!matchedDate) {
        applyLabSlotBuckets(lastEmpty, selectedDate);
        setLabAutoAdvancedToDate(null);
      }
    } catch (e) {
      setLabMorning([]);
      setLabAfternoon([]);
      setLabEvening([]);
      setLabSelectedPick(null);
      setLabAutoAdvancedToDate(null);
      toast.error(e instanceof Error ? e.message : "Could not load slots");
    } finally {
      labSlotScanForwardRef.current = false;
      setLabSlotLoading(false);
      setLabSlotsFetched(true);
    }
  }, [applyLabSlotBuckets, isLabTests, labDays, labVendorCode, selectedDate, toast]);

  const onLabDateSelect = useCallback((date: string) => {
    labSlotScanForwardRef.current = false;
    setLabAutoAdvancedToDate(null);
    setSelectedDate(date);
  }, []);

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
    const needCategory =
      healthPhase === "pathology" ? meta.needPathology : meta.needRadiology;
    if (!needCategory) {
      setLabMorning([]);
      setLabAfternoon([]);
      setLabEvening([]);
      return;
    }
    const vendorCode =
      (healthPhase === "pathology" ? meta.pathVendorCode : meta.radVendorCode).trim() ||
      "unknown";
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
      const all = [...res.morning, ...res.afternoon, ...res.evening];
      const keepIfListed = (pick: DiagnosticSlotPick | null) =>
        pick && all.some((s) => slotKey(s) === slotKey(pick)) ? pick : null;
      setLabSelectedPick((prev) => {
        if (prev) return keepIfListed(prev);
        const stored =
          healthPhase === "pathology" ? readHealthPathologySlotPick() : readHealthRadiologySlotPick();
        if (stored && stored.slot_date === selectedDate) return keepIfListed(stored);
        return null;
      });
    } catch (e) {
      setLabMorning([]);
      setLabAfternoon([]);
      setLabEvening([]);
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
    setLabSelectedPick((prev) => {
      if (!prev) return null;
      return prev.slot_date === selectedDate ? prev : null;
    });
  }, [selectedDate]);

  const monthBanner = useMemo(() => {
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return "";
    const d = new Date(`${selectedDate}T12:00:00`);
    return `${d.toLocaleDateString("en-IN", { month: "short", year: "numeric" })} ( IST )`;
  }, [selectedDate]);

  const pickLabSlot = (p: DiagnosticSlotPick) => {
    setLabSelectedPick(p);
    if (isLabTests) {
      writeLabSlotPayload(p);
      return;
    }
    if (healthPhase === "pathology") {
      writeHealthPathologySlotJson(JSON.stringify(p));
    } else {
      writeHealthRadiologySlotJson(JSON.stringify(p));
    }
  };

  const healthMeta = !isLabTests ? readHealthVendorMeta() : null;

  /** patient_app `containsPathology` / `containsRadiology` → tab strip when both categories apply. */
  const showPathRadTabs =
    !isLabTests &&
    healthMeta != null &&
    healthMeta.needPathology &&
    healthMeta.needRadiology;

  /** Lab route is always `lab-tests`; health-checkups uses pathology/radiology branch above. */
  const slotHeaderTitle = !isLabTests
    ? healthPhase === "pathology"
      ? "Pathology Slot"
      : "Radiology Slot"
    : "Pick a Slot";

  const storedPathPick = !isLabTests ? readHealthPathologySlotPick() : null;
  const storedRadPick = !isLabTests ? readHealthRadiologySlotPick() : null;
  const pathTabDone =
    storedPathPick != null || (healthPhase === "pathology" && labSelectedPick != null);
  const radTabDone =
    storedRadPick != null || (healthPhase === "radiology" && labSelectedPick != null);

  const allBucketsEmpty =
    labMorning.length === 0 && labAfternoon.length === 0 && labEvening.length === 0;

  const confirmDisabled =
    isLabTests && (!labSelectedPick || !labVendorCode) ? true : !isLabTests && !labSelectedPick;

  const confirmLabel = useMemo(() => {
    if (isLabTests) return "Confirm Slot";
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
        <FlowScreenBack
          fallbackTo={
            isLabTests
              ? generatePath(ROUTES.diagnosticsVendors, { type })
              : generatePath(ROUTES.diagnosticsPlan, { type })
          }
          className="app-back-btn cas-back"
          ariaLabel="Back"
          onBeforeBack={isLabTests ? clearLabSlotStep : undefined}
        />
        <h1 className="cas-title">{slotHeaderTitle}</h1>
      </header>

      {!isLabTests ? (
        <button
          type="button"
          className="cas-loc-bar"
          aria-label={deliveryAddressChooserAriaLabel(hasDeliveryAddress)}
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
        {!isLabTests ? (
          <div className="cas-note">
            Note : Flip Health will call and try to schedule your sample collection in your preferred slot or the next
            available slot
          </div>
        ) : null}

        {!isLabTests && !healthMeta ? (
          <p className="cas-note cas-note--alert" role="alert">
            Go back and choose a package to continue.
          </p>
        ) : null}

        {showPathRadTabs ? (
          <div className="cas-ahc-tabs" role="tablist" aria-label="Slot steps">
            <div
              className={`cas-ahc-tab${healthPhase === "pathology" ? " cas-ahc-tab--active" : ""}`}
              role="tab"
              aria-selected={healthPhase === "pathology"}
            >
              <span className="cas-ahc-tab__ic" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 3h6v3h-1v4l2 7H8l2-7V6H9V3z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <path d="M7 17h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </span>
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
              <span className="cas-ahc-tab__ic" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" stroke="currentColor" strokeWidth="1.75" />
                  <path
                    d="M12 9v6M9 12h6"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
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

        {isLabTests ? (
          labSlotLoading && !labSlotsFetched ? (
            <div className="cas-lab-initial-load" aria-busy="true">
              <p className="cas-note cas-note--loading">Loading slots…</p>
            </div>
          ) : (
            <>
              <LabTestSlotPicker
                monthBanner={monthBanner}
                days={labDays}
                selectedDate={selectedDate}
                onSelectDate={onLabDateSelect}
                autoAdvancedToDate={labAutoAdvancedToDate}
                morning={labMorning}
                afternoon={labAfternoon}
                evening={labEvening}
                selectedPick={labSelectedPick}
                onSelectSlot={pickLabSlot}
                isLoading={labSlotLoading}
              />
              {labSlotLoading && labSlotsFetched ? (
                <div className="cas-lab-inline-load" aria-hidden="true">
                  <span className="cas-lab-inline-load__spinner" />
                </div>
              ) : null}
            </>
          )
        ) : !isLabTests && !healthMeta ? null : (
          <>
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

            <div className="cas-days-wrap">
              <div className="cas-days cas-days--scroll" role="radiogroup" aria-label="Choose day">
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

            {labSlotLoading ? <p className="cas-note cas-note--loading">Loading slots…</p> : null}

            {allBucketsEmpty && !labSlotLoading ? (
              <div className="cas-empty-ahc">
                <p className="cas-empty-ahc__title">No slots available</p>
                <p className="cas-empty-ahc__sub">Try another date or check back later.</p>
              </div>
            ) : (
              <>
                <section className="cas-section">
                  <SlotPeriodSectionHead period="morning" />
                  <div className={slotsGridClass} role="radiogroup" aria-label="Morning slots">
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
                  <SlotPeriodSectionHead period="afternoon" />
                  <div className={slotsGridClass} role="radiogroup" aria-label="Afternoon slots">
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
                  <SlotPeriodSectionHead period="evening" />
                  <div className={slotsGridClass} role="radiogroup" aria-label="Evening slots">
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
          </>
        )}
      </main>

      <footer className="cas-footer cas-footer--sticky">
        <button
          type="button"
          className={`cas-confirm${isLabTests && !labSelectedPick ? " cas-confirm--dim" : ""}`}
          disabled={!isLabTests && (confirmDisabled || !healthMeta)}
          onClick={() => {
            if (isLabTests && !labVendorCode.trim()) {
              toast.error("Go back and select a lab partner first.");
              return;
            }
            if (isLabTests && !labSelectedPick) {
              toast.error("Please select a time slot");
              return;
            }
            try {
              if (isLabTests && labSelectedPick) {
                writeLabSlotPayload(labSelectedPick);
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
                    writeHealthSlotPhase("radiology");
                    const radStored = readHealthRadiologySlotPick();
                    setHealthPhase("radiology");
                    setSelectedDate(healthDateFromStored(ahcSlotDays, radStored));
                    setLabSelectedPick(radStored);
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
