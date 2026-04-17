import { patchLabOrderReschedule } from "@/api/patientLabOrderReschedule";
import { fetchDiagnosticSlots, type DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";
import { DIAG_HEALTH_SLOTS_PACKAGE } from "@/constants/diagnosticsHealthFlowStorage";
import { useToast } from "@/hooks/useToast";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import "./LabOrderRescheduleBottomSheet.css";

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDateLocal(iso: string): Date | null {
  const t = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function slotKey(s: DiagnosticSlotPick): string {
  return `${s.slot_id}|${s.slot_date}|${s.start_time}|${s.end_time}`;
}

export type LabOrderReschedulePriorFromApi = Readonly<{
  reason: string | null;
  slotChangeDisplay: string | null;
  atDisplay: string | null;
  countDisplay: string | null;
}>;

export type LabOrderRescheduleBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  subOrderId: string;
  rescheduleCategory: "pathology" | "radiology";
  addressId: string;
  vendorCode: string;
  onCompleted: () => void | Promise<void>;
  /** Last reschedule fields returned on this sub-order (shown read-only above the form). */
  priorReschedule?: LabOrderReschedulePriorFromApi | null;
}>;

export function LabOrderRescheduleBottomSheet({
  open,
  onClose,
  subOrderId,
  rescheduleCategory,
  addressId,
  vendorCode,
  onCompleted,
  priorReschedule,
}: LabOrderRescheduleBottomSheetProps) {
  const toast = useToast();
  const titleId = useId();
  const reasonId = useId();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const { minIso, maxIso } = useMemo(() => {
    const today = new Date();
    const last = new Date(today);
    last.setDate(last.getDate() + 15);
    return { minIso: toIsoDateLocal(today), maxIso: toIsoDateLocal(last) };
  }, []);

  const [selectedDate, setSelectedDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toIsoDateLocal(t);
  });
  const [reason, setReason] = useState("");
  const [slotsLoad, setSlotsLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [slotsErr, setSlotsErr] = useState<string | null>(null);
  const [morning, setMorning] = useState<readonly DiagnosticSlotPick[]>([]);
  const [afternoon, setAfternoon] = useState<readonly DiagnosticSlotPick[]>([]);
  const [evening, setEvening] = useState<readonly DiagnosticSlotPick[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<DiagnosticSlotPick | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);

  const allSlots = useMemo(
    () => [...morning, ...afternoon, ...evening],
    [morning, afternoon, evening],
  );

  const clampDate = useCallback(
    (iso: string): string => {
      if (iso < minIso) return minIso;
      if (iso > maxIso) return maxIso;
      return iso;
    },
    [minIso, maxIso],
  );

  useEffect(() => {
    if (!open) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(clampDate(toIsoDateLocal(tomorrow)));
    setReason("");
    setSelectedSlot(null);
    setSlotsErr(null);
  }, [open, subOrderId, clampDate]);

  const loadSlots = useCallback(async () => {
    const aid = addressId.trim();
    const vc = vendorCode.trim();
    const d = selectedDate.trim();
    if (!aid || !vc || !d) {
      setMorning([]);
      setAfternoon([]);
      setEvening([]);
      setSlotsLoad("idle");
      return;
    }
    setSlotsLoad("loading");
    setSlotsErr(null);
    try {
      const res = await fetchDiagnosticSlots({
        address_id: aid,
        date: d,
        vendor_code: vc,
        package: DIAG_HEALTH_SLOTS_PACKAGE,
        category: rescheduleCategory,
      });
      setMorning(res.morning);
      setAfternoon(res.afternoon);
      setEvening(res.evening);
      setSlotsLoad("ok");
    } catch (e) {
      setMorning([]);
      setAfternoon([]);
      setEvening([]);
      setSlotsLoad("error");
      setSlotsErr(e instanceof Error ? e.message : "Could not load slots");
    }
  }, [addressId, vendorCode, selectedDate, rescheduleCategory]);

  useEffect(() => {
    if (!open) return;
    void loadSlots();
  }, [open, loadSlots]);

  const dateButtonLabel = useMemo(() => {
    const dt = parseIsoDateLocal(selectedDate);
    if (!dt) return selectedDate;
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }, [selectedDate]);

  const onPickDate = useCallback(() => {
    dateInputRef.current?.showPicker?.();
    dateInputRef.current?.click();
  }, []);

  const onDateChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (!v) return;
      setSelectedDate(clampDate(v));
      setSelectedSlot(null);
    },
    [clampDate],
  );

  const onSubmit = useCallback(async () => {
    if (!selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please add reschedule reason");
      return;
    }
    setSubmitBusy(true);
    try {
      await patchLabOrderReschedule(subOrderId, {
        reason: reason.trim(),
        slot: selectedSlot,
        addressId,
      });
      toast.success("Reschedule request submitted");
      onClose();
      await onCompleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      setSubmitBusy(false);
    }
  }, [selectedSlot, reason, subOrderId, addressId, toast, onClose, onCompleted]);

  if (!open) return null;

  const showPrior = Boolean(
    priorReschedule &&
      ((priorReschedule.reason?.trim() ?? "").length > 0 ||
        (priorReschedule.slotChangeDisplay?.trim() ?? "").length > 0 ||
        (priorReschedule.atDisplay?.trim() ?? "").length > 0 ||
        (priorReschedule.countDisplay?.trim() ?? "").length > 0),
  );

  const selectedSlotLabel =
    selectedSlot != null ? `${selectedSlot.start_time} – ${selectedSlot.end_time}` : null;

  return (
    <dialog
      className="od-lab-rs-dialog"
      open
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="od-lab-rs-panel">
        <header className="od-lab-rs-panel__header">
          <h2 id={titleId} className="od-lab-rs-panel__title">
            Reschedule appointment
          </h2>
          <button type="button" className="od-lab-rs-panel__close" aria-label="Close" onClick={onClose}>
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
        <div className="od-lab-rs-scroll">
          {showPrior && priorReschedule ? (
            <div className="od-lab-rs-prior" aria-label="Existing reschedule information">
              <p className="od-lab-rs-prior__title">On file</p>
              {priorReschedule.reason?.trim() ? (
                <div className="od-lab-rs-prior__row">
                  <span className="od-lab-rs-prior__k">Reschedule reason</span>
                  <span className="od-lab-rs-prior__v">{priorReschedule.reason.trim()}</span>
                </div>
              ) : null}
              {priorReschedule.slotChangeDisplay?.trim() ? (
                <div className="od-lab-rs-prior__row">
                  <span className="od-lab-rs-prior__k">Requested slot</span>
                  <span className="od-lab-rs-prior__v">{priorReschedule.slotChangeDisplay.trim()}</span>
                </div>
              ) : null}
              {priorReschedule.atDisplay?.trim() ? (
                <div className="od-lab-rs-prior__row">
                  <span className="od-lab-rs-prior__k">Reschedule time</span>
                  <span className="od-lab-rs-prior__v">{priorReschedule.atDisplay.trim()}</span>
                </div>
              ) : null}
              {priorReschedule.countDisplay?.trim() ? (
                <div className="od-lab-rs-prior__row">
                  <span className="od-lab-rs-prior__k">Reschedule count</span>
                  <span className="od-lab-rs-prior__v">{priorReschedule.countDisplay.trim()}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="od-lab-rs-label" htmlFor={reasonId}>
            Reason for reschedule
          </label>
          <textarea
            id={reasonId}
            className="od-lab-rs-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoComplete="off"
          />
          <div className="od-lab-rs-date-row">
            <label className="od-lab-rs-label" htmlFor={`${reasonId}-date`}>
              Collection date
            </label>
            <input
              id={`${reasonId}-date`}
              ref={dateInputRef}
              type="date"
              className="od-lab-rs-date-input"
              min={minIso}
              max={maxIso}
              value={selectedDate}
              onChange={onDateChange}
            />
            <button
              type="button"
              className="od-lab-rs-date-btn"
              onClick={onPickDate}
              disabled={submitBusy}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>{dateButtonLabel}</span>
            </button>
          </div>
          {slotsLoad === "loading" ? <p className="od-lab-rs-muted">Loading slots…</p> : null}
          {slotsLoad === "error" && slotsErr ? <p className="od-lab-rs-muted">{slotsErr}</p> : null}
          {slotsLoad === "ok" && allSlots.length === 0 ? (
            <p className="od-lab-rs-muted">No slots available for selected date</p>
          ) : null}
          {slotsLoad === "ok" && allSlots.length > 0 ? (
            <div className="od-lab-rs-slots" role="radiogroup" aria-label="Available time slots">
              {allSlots.map((s) => {
                const active = selectedSlot != null && slotKey(selectedSlot) === slotKey(s);
                const label = `${s.start_time} – ${s.end_time}`;
                return (
                  <button
                    key={slotKey(s)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`od-lab-rs-slot${active ? " od-lab-rs-slot--active" : ""}`}
                    disabled={submitBusy}
                    onClick={() => setSelectedSlot(s)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {selectedSlot != null ? (
            <div className="od-lab-rs-review" aria-label="Request summary">
              <p className="od-lab-rs-review__title">New request</p>
              <div className="od-lab-rs-review__row">
                <span className="od-lab-rs-review__k">Reason</span>
                <span className="od-lab-rs-review__v">{reason.trim().length > 0 ? reason.trim() : "—"}</span>
              </div>
              <div className="od-lab-rs-review__row">
                <span className="od-lab-rs-review__k">Collection date</span>
                <span className="od-lab-rs-review__v">{dateButtonLabel}</span>
              </div>
              <div className="od-lab-rs-review__row">
                <span className="od-lab-rs-review__k">Slot</span>
                <span className="od-lab-rs-review__v">{selectedSlotLabel}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="od-lab-rs-footer">
          <button
            type="button"
            className="od-lab-rs-submit"
            disabled={submitBusy || selectedSlot == null}
            onClick={() => void onSubmit()}
          >
            {submitBusy ? "Submitting…" : "Confirm reschedule"}
          </button>
        </div>
      </section>
    </dialog>
  );
}
