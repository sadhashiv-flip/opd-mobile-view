import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { DIAG_SELECTED_PERSON_KEY } from "@/constants/diagnosticsSelectedMemberStorage";
import {
  readVisionSelectedClinic,
  writeVisionSelectedSlot,
} from "@/constants/visionBookingStorage";
import type { VisionNetworkService } from "@/api/networkList";
import { resolveSelectedAddressLocation } from "@/api/networkList";
import {
  fetchVisionServiceSlots,
  type VisionServiceSlotRow,
  type VisionServiceSlotsData,
} from "@/api/visionServiceSlots";
import { VisionSlotPicker } from "@/components/vision/VisionSlotPicker";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./DentalSlotsPage.css";

function readDiagPersonId(): string | null {
  try {
    const s = localStorage.getItem(DIAG_SELECTED_PERSON_KEY);
    return s?.trim() ? s : null;
  } catch {
    return null;
  }
}

function visionTypeToService(visionType: string): VisionNetworkService | null {
  if (visionType === VISION_ROUTE_TYPE.eyeCheckup) return "vision.clinic";
  if (visionType === VISION_ROUTE_TYPE.glassesLens) return "vision.store";
  return null;
}

function findSlotById(data: VisionServiceSlotsData, slotId: string): VisionServiceSlotRow | null {
  const all = [...data.slots.morning, ...data.slots.afternoon, ...data.slots.evening];
  return all.find((s) => s.slot_id === slotId) ?? null;
}

export function VisionSlotsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim() ?? "";

  const apiService = visionTypeToService(visionType);

  const [payload, setPayload] = useState<VisionServiceSlotsData | null>(null);
  const [load, setLoad] = useState<"loading" | "error" | "ok">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (visionType !== VISION_ROUTE_TYPE.eyeCheckup && visionType !== VISION_ROUTE_TYPE.glassesLens) {
      return;
    }
    if (!apiService) return;

    const memberId = readDiagPersonId();
    const clinic = readVisionSelectedClinic();
    if (!memberId) {
      toast.error("Select a member first.");
      void navigate(generatePath(ROUTES.visionSelectPeople, { visionType }), { replace: true });
      return;
    }
    if (!clinic?.networkEntityId?.trim()) {
      toast.error("Select a clinic first.");
      void navigate(generatePath(ROUTES.visionNetworkList, { visionType }), { replace: true });
      return;
    }

    let cancelled = false;
    const networkId = clinic.networkEntityId.trim();

    (async () => {
      setLoad("loading");
      setErrorMsg(null);
      try {
        const loc = await resolveSelectedAddressLocation();
        const data = await fetchVisionServiceSlots({
          location: loc,
          service: apiService,
          networkId,
        });
        if (cancelled) return;
        setPayload(data);
        const firstDay = data.daysList[0] ?? "";
        setSelectedIsoDate(firstDay);
        setSelectedSlotId(null);
        setLoad("ok");
      } catch (e) {
        if (cancelled) return;
        setPayload(null);
        setLoad("error");
        const msg = e instanceof Error ? e.message : "Could not load slots";
        setErrorMsg(msg);
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visionType, apiService, navigate, toast]);

  const flatForSelectedDay = useMemo(() => {
    if (!payload) return [];
    const iso = selectedIsoDate;
    const { slots } = payload;
    return [...slots.morning, ...slots.afternoon, ...slots.evening].filter((r) => r.slot_date === iso);
  }, [payload, selectedIsoDate]);

  const canContinue = Boolean(selectedSlotId) && flatForSelectedDay.some((r) => r.slot_id === selectedSlotId);

  const onContinue = () => {
    if (!payload || !selectedSlotId) return;
    const row = findSlotById(payload, selectedSlotId);
    if (!row) return;
    writeVisionSelectedSlot(row);
    void navigate(ROUTES.vision, { state: { visionType } });
  };

  if (visionType !== VISION_ROUTE_TYPE.eyeCheckup && visionType !== VISION_ROUTE_TYPE.glassesLens) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (!apiService) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <div className="hc-page dental-slots-page">
      <header className="hco-top">
        <Link
          to={generatePath(ROUTES.visionNetworkList, { visionType })}
          className="hco-back"
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
        <h1 className="hco-title">Select Your Vision Slots</h1>
        <span className="hco-top__balance" aria-hidden />
      </header>

      <main className="hc-main dental-slots-page__main">
        {load === "loading" ? (
          <p className="hc-member-loading" aria-busy="true">
            Loading slots…
          </p>
        ) : null}

        {load === "error" && errorMsg ? (
          <p className="hc-member-error__text" role="alert">
            {errorMsg}
          </p>
        ) : null}

        {load === "ok" && payload && payload.daysList.length === 0 ? (
          <p className="vac-slot-pick__empty" role="status">
            No available days for booking.
          </p>
        ) : null}

        {load === "ok" && payload && payload.daysList.length > 0 ? (
          <VisionSlotPicker
            daysList={payload.daysList}
            slots={payload.slots}
            selectedIsoDate={selectedIsoDate || payload.daysList[0]!}
            onSelectIsoDate={setSelectedIsoDate}
            selectedSlotId={selectedSlotId}
            onSelectSlotId={setSelectedSlotId}
          />
        ) : null}
      </main>

      <footer className="hc-footer">
        <button type="button" className="bottom-continue" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      </footer>
    </div>
  );
}
