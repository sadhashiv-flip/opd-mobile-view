import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { fetchNetworkSlots, type NetworkDoctorSchedule, type NetworkSlotTiming } from "@/api/networkSlots";
import { formatNetworkBookTimeSlot } from "@/utils/networkBookTimeSlot";
import { useToast } from "@/hooks/useToast";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./ConsultationAppointmentSlotsPage.css";

function timingLabel(t: NetworkSlotTiming): string {
  const o = t.opening.trim();
  const c = t.closing.trim();
  if (o && c) return `${o} – ${c}`;
  return o || c || "Slot";
}

export function ConsultationAppointmentSlotsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const doctorId = typeof params.doctorId === "string" ? params.doctorId : "";
  const networkId = typeof params.networkId === "string" ? params.networkId : "";
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";

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

  useEffect(() => {
    if (!networkId.trim() || !doctorId.trim()) {
      setLoad("error");
      setLoadErr("Missing network or doctor.");
      return;
    }
    let cancelled = false;
    setLoad("loading");
    setLoadErr(null);
    void fetchNetworkSlots(networkId, doctorId)
      .then((data) => {
        if (cancelled) return;
        setDoctorName(data.doctor?.name ?? "Doctor");
        setNetworkLabel(data.networkName ?? data.displayAddress);
        setSchedules(data.schedules);
        setSelectedScheduleIdx(0);
        setSelectedTiming(null);
        setLoad("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoad("error");
        const msg = e instanceof Error ? e.message : "Could not load slots";
        setLoadErr(msg);
        toast.error(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, doctorId, toast]);

  const activeSchedule = schedulesWithSlots[selectedScheduleIdx] ?? null;
  const slotTimings = activeSchedule?.timings ?? [];

  const selectTiming = useCallback((t: NetworkSlotTiming) => {
    setSelectedTiming(t);
  }, []);

  const isSelectedTiming = useCallback(
    (t: NetworkSlotTiming) => selectedTiming?.id === t.id,
    [selectedTiming],
  );

  return (
    <div className="cas-page">
      <header className="cas-top">
        <Link
          to={generatePath(ROUTES.consultationHospitalResults, { specialtyId })}
          className="cas-back"
          aria-label="Back"
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
        <h1 className="cas-title">Appointment - {doctorName}</h1>
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
                      onClick={() => selectTiming(t)}
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
          onClick={() => {
            if (!selectedTiming) return;
            try {
              localStorage.setItem("opd-mobile-view.consultation.slotId", String(selectedTiming.id));
              localStorage.setItem("opd-mobile-view.consultation.slotLabel", timingLabel(selectedTiming));
              localStorage.setItem(
                "opd-mobile-view.consultation.dayLabel",
                activeSchedule?.day ?? "",
              );
              if (activeSchedule && selectedTiming) {
                localStorage.setItem(
                  "opd-mobile-view.consultation.timeSlot",
                  formatNetworkBookTimeSlot(activeSchedule.day, selectedTiming.opening),
                );
              }
              localStorage.setItem("opd-mobile-view.consultation.doctorName", doctorName);
              localStorage.setItem("opd-mobile-view.consultation.networkId", networkId);
              localStorage.setItem("opd-mobile-view.consultation.doctorId", doctorId);
            } catch {
              // ignore
            }
            navigate(
              generatePath(ROUTES.consultationHospitalOverview, {
                specialtyId,
                networkId,
                doctorId,
              }),
            );
          }}
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}
