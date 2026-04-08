import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchNetworkSlots, type NetworkDoctorSchedule, type NetworkSlotTiming } from "@/api/networkSlots";
import { formatNetworkBookTimeSlot } from "@/utils/networkBookTimeSlot";
import { useToast } from "@/hooks/useToast";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/ConsultationAppointmentSlotsPage.css";
import "@/components/consultation/HospitalAppointmentSlotBottomSheet.css";

function timingLabel(t: NetworkSlotTiming): string {
  const o = t.opening.trim();
  const c = t.closing.trim();
  if (o && c) return `${o} – ${c}`;
  return o || c || "Slot";
}

export type HospitalAppointmentSlotBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  networkId: string;
  doctorId: string;
  onApplied?: () => void;
}>;

export function HospitalAppointmentSlotBottomSheet({
  open,
  onClose,
  networkId,
  doctorId,
  onApplied,
}: HospitalAppointmentSlotBottomSheetProps) {
  const toast = useToast();
  const [load, setLoad] = useState<"loading" | "error" | "ok">("loading");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState("Doctor");
  const [networkLabel, setNetworkLabel] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<readonly NetworkDoctorSchedule[]>([]);

  const [selectedScheduleIdx, setSelectedScheduleIdx] = useState(0);
  const [selectedTiming, setSelectedTiming] = useState<NetworkSlotTiming | null>(null);

  const schedulesWithSlots = useMemo(
    () => schedules.filter((s) => s.timings.length > 0),
    [schedules],
  );

  const activeSchedule = schedulesWithSlots[selectedScheduleIdx] ?? null;
  const slotTimings = activeSchedule?.timings ?? [];

  const isSelectedTiming = useCallback(
    (t: NetworkSlotTiming) => selectedTiming?.id === t.id,
    [selectedTiming],
  );

  useEffect(() => {
    if (!open) return;
    if (!networkId.trim() || !doctorId.trim()) {
      setLoad("error");
      setLoadErr("Missing network or doctor.");
      return;
    }
    let cancelled = false;
    setLoad("loading");
    setLoadErr(null);
    const run = async () => {
      try {
        const data = await fetchNetworkSlots(networkId, doctorId);
        if (cancelled) return;
        setDoctorName(data.doctor?.name ?? "Doctor");
        setNetworkLabel(data.networkName ?? data.displayAddress);
        try {
          localStorage.setItem("opd-mobile-view.consultation.networkName", data.networkName ?? "");
          localStorage.setItem(
            "opd-mobile-view.consultation.doctorQualification",
            data.doctor?.qualification ?? "",
          );
        } catch {
          // ignore
        }
        setSchedules(data.schedules);
        setSelectedScheduleIdx(0);
        setSelectedTiming(null);
        setLoad("ok");
      } catch (e: unknown) {
        if (cancelled) return;
        setLoad("error");
        const msg = e instanceof Error ? e.message : "Could not load slots";
        setLoadErr(msg);
        toast.error(msg);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, networkId, doctorId, toast]);

  /** Restore prior slot from localStorage when reopening the sheet. */
  useEffect(() => {
    if (!open || load !== "ok" || schedulesWithSlots.length === 0) return;
    let slotIdRaw: string | null = null;
    try {
      slotIdRaw = localStorage.getItem("opd-mobile-view.consultation.slotId");
    } catch {
      return;
    }
    if (!slotIdRaw?.trim()) return;
    const id = Number(slotIdRaw.trim());
    if (!Number.isFinite(id)) return;
    for (let i = 0; i < schedulesWithSlots.length; i++) {
      const t = schedulesWithSlots[i].timings.find((x) => x.id === id);
      if (t) {
        setSelectedScheduleIdx(i);
        setSelectedTiming(t);
        return;
      }
    }
  }, [open, load, schedulesWithSlots]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const apply = useCallback(() => {
    if (!selectedTiming || !activeSchedule) return;
    try {
      localStorage.setItem("opd-mobile-view.consultation.slotId", String(selectedTiming.id));
      localStorage.setItem("opd-mobile-view.consultation.slotLabel", timingLabel(selectedTiming));
      localStorage.setItem("opd-mobile-view.consultation.dayLabel", activeSchedule.day ?? "");
      localStorage.setItem(
        "opd-mobile-view.consultation.timeSlot",
        formatNetworkBookTimeSlot(activeSchedule.day, selectedTiming.opening),
      );
      localStorage.setItem("opd-mobile-view.consultation.doctorName", doctorName);
      localStorage.setItem("opd-mobile-view.consultation.networkId", networkId);
      localStorage.setItem("opd-mobile-view.consultation.doctorId", doctorId);
      if (networkLabel?.trim()) {
        localStorage.setItem("opd-mobile-view.consultation.networkName", networkLabel.trim());
      }
    } catch {
      // ignore
    }
    onApplied?.();
    onClose();
  }, [
    selectedTiming,
    activeSchedule,
    doctorName,
    networkId,
    doctorId,
    networkLabel,
    onApplied,
    onClose,
  ]);

  if (!open) return null;

  return (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="hosp-cas-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="hosp-cas-sheet">
        <div className="cas-page hosp-cas-sheet__inner">
          <header className="cas-top hosp-cas-top">
            <h1 id="hosp-cas-sheet-title" className="cas-title">
              Appointment - {doctorName}
            </h1>
            <button type="button" className="addr-sheet__close" aria-label="Close" onClick={onClose}>
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

          <main className="cas-main">
            {networkLabel ? (
              <div className="cas-network-note" role="note">
                {networkLabel}
              </div>
            ) : null}

            <div className="cas-note">
              Note : Flip Health will call and try to schedule ur appointment in your preferred slot or
              the next available slot
            </div>

            {load === "loading" && <div className="cas-loading">Loading slots…</div>}
            {load === "error" && (
              <div className="cas-loading cas-loading--err" role="alert">
                {loadErr ?? "Could not load slots"}
              </div>
            )}
            {load === "ok" && schedulesWithSlots.length === 0 && (
              <div className="cas-loading">No open slots for this doctor right now.</div>
            )}
            {load === "ok" && schedulesWithSlots.length > 0 && (
              <>
                <div className="cas-row">
                  <div className="cas-row__left">
                    <span className="cas-row__ic" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
                        <path d="M12 7v6l3 2" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                    choose day and time
                  </div>
                  <div className="cas-row__right">Available days</div>
                </div>

                <div className="cas-days" role="radiogroup" aria-label="Choose day">
                  {schedulesWithSlots.map((s, idx) => {
                    const active = idx === selectedScheduleIdx;
                    return (
                      <button
                        key={`${s.short_code}-${s.id}`}
                        type="button"
                        className={`cas-day${active ? " cas-day--active" : ""}`}
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setSelectedScheduleIdx(idx);
                          setSelectedTiming(null);
                        }}
                      >
                        <div className="cas-day__num">{s.short_code.toUpperCase()}</div>
                        <div className="cas-day__dow">{s.day}</div>
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
                    Available hours
                  </div>
                  <div className="cas-slots" role="radiogroup" aria-label="Time slots">
                    {slotTimings.map((t) => {
                      const active = isSelectedTiming(t);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`cas-slot${active ? " cas-slot--active" : ""}`}
                          role="radio"
                          aria-checked={active}
                          onClick={() => setSelectedTiming(t)}
                        >
                          {timingLabel(t)}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </main>

          <footer className="cas-footer">
            <button
              type="button"
              className="cas-confirm"
              disabled={load !== "ok" || !selectedTiming}
              onClick={apply}
            >
              Confirm
            </button>
          </footer>
        </div>
      </div>
    </dialog>
  );
}
