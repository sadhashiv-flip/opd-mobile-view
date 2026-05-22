import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { DIAG_SELECTED_PERSON_KEY } from "@/constants/diagnosticsSelectedMemberStorage";
import {
  readVisionSelectedClinic,
  writeVisionSelectedSlot,
} from "@/constants/visionBookingStorage";
import type { VisionNetworkService } from "@/api/networkList";
import { VisionSlotPicker } from "@/components/vision/VisionSlotPicker";
import { useVisionSlotsLoader } from "@/hooks/useVisionSlotsLoader";
import { findVisionSlotInPayload } from "@/lib/visionSlotSelection";
import { VISION_NO_SLOTS_AVAILABLE_COPY } from "@/api/visionServiceSlots";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
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

export function VisionSlotsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim() ?? "";
  const apiService = visionTypeToService(visionType);

  const [networkId, setNetworkId] = useState<string | null>(null);
  const guardsDone = useRef(false);

  useEffect(() => {
    if (visionType !== VISION_ROUTE_TYPE.eyeCheckup && visionType !== VISION_ROUTE_TYPE.glassesLens) {
      return;
    }
    if (!apiService || guardsDone.current) return;

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

    guardsDone.current = true;
    setNetworkId(clinic.networkEntityId.trim());
  }, [visionType, apiService, navigate, toast]);

  const slots = useVisionSlotsLoader({
    service: apiService,
    networkId,
    enabled: networkId != null && apiService != null,
  });

  const canContinue = useMemo(
    () =>
      Boolean(
        slots.selectedSlotId &&
          slots.payload &&
          findVisionSlotInPayload(slots.payload, slots.selectedSlotId),
      ),
    [slots.selectedSlotId, slots.payload],
  );

  const onContinue = () => {
    if (!slots.payload || !slots.selectedSlotId) return;
    const row = findVisionSlotInPayload(slots.payload, slots.selectedSlotId);
    if (!row) return;
    writeVisionSelectedSlot(row);
    if (visionType === VISION_ROUTE_TYPE.eyeCheckup) {
      void navigate(generatePath(ROUTES.visionOverview, { visionType }));
      return;
    }
    void navigate(generatePath(ROUTES.visionAddPrescription, { visionType }));
  };

  if (visionType !== VISION_ROUTE_TYPE.eyeCheckup && visionType !== VISION_ROUTE_TYPE.glassesLens) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (!apiService) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const showPicker =
    slots.phase === "ready" && slots.payload != null && slots.payload.daysList.length > 0;

  const activeIsoDate =
    showPicker && slots.payload
      ? slots.selectedIsoDate && slots.payload.daysList.includes(slots.selectedIsoDate)
        ? slots.selectedIsoDate
        : (slots.payload.daysList[0] ?? "")
      : "";

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
        {slots.isFullScreenLoading ? (
          <p className="hc-member-loading" aria-busy="true">
            Loading slots…
          </p>
        ) : null}

        {slots.phase === "error" && slots.errorMsg ? (
          <p className="hc-member-error__text" role="alert">
            {slots.errorMsg}
          </p>
        ) : null}

        {slots.phase === "ready" && slots.payload && slots.payload.daysList.length === 0 ? (
          <p className="vac-slot-pick__empty" role="status">
            {VISION_NO_SLOTS_AVAILABLE_COPY}
          </p>
        ) : null}

        {showPicker ? (
          <VisionSlotPicker
            daysList={slots.payload.daysList}
            slots={slots.payload.slots}
            monthYearLabel={slots.monthYearLabel}
            selectedIsoDate={activeIsoDate}
            onSelectIsoDate={slots.onSelectIsoDate}
            selectedSlotId={slots.selectedSlotId}
            onSelectSlotId={slots.onSelectSlotId}
            hideForLoading={slots.isFullScreenLoading}
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
