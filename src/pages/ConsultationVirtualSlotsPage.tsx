import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { readVirtualFollowUpAppointmentId } from "@/constants/virtualConsultationSessionStorage";
import { VirtualConsultationSlotSelector } from "@/components/consultation/VirtualConsultationSlotSelector";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAllAvailableSlots,
  formatLocalYmd,
  type AvailableSlot,
  type VirtualSpecialtySlotsState,
} from "@/api/consultationVirtual";
import {
  maxIsoDate,
  parseSlotDateYmd,
  todayYmd,
} from "@/utils/consultationVirtualSlotRules";
import "./ConsultationVirtualSlotsPage.css";

const STORAGE_PREFIX = "opd-mobile-view.virtualSlots.";

export type { VirtualSpecialtySlotsState } from "@/api/consultationVirtual";

function readStoredMeta(issueId: string): VirtualSpecialtySlotsState | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${issueId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<VirtualSpecialtySlotsState>;
    if (
      typeof p.parent === "number" &&
      Number.isFinite(p.parent) &&
      typeof p.spid === "number" &&
      Number.isFinite(p.spid) &&
      typeof p.issueTitle === "string"
    ) {
      const lang =
        typeof p.language === "string" && p.language.trim()
          ? p.language.trim()
          : "English";
      return { parent: p.parent, spid: p.spid, issueTitle: p.issueTitle, language: lang };
    }
  } catch {
    // ignore
  }
  return null;
}

export function ConsultationVirtualSlotsPage() {
  const params = useParams();
  const location = useLocation();
  const issueId = typeof params.issueId === "string" ? params.issueId : "";

  const meta = useMemo((): VirtualSpecialtySlotsState | null => {
    const fromState = location.state as VirtualSpecialtySlotsState | null;
    let raw: VirtualSpecialtySlotsState | null = null;
    if (
      fromState &&
      typeof fromState.parent === "number" &&
      typeof fromState.spid === "number" &&
      typeof fromState.issueTitle === "string"
    ) {
      raw = fromState;
    } else {
      raw = readStoredMeta(issueId);
    }
    if (!raw) return null;
    const lang =
      typeof raw.language === "string" && raw.language.trim()
        ? raw.language.trim()
        : "English";
    return { ...raw, language: lang };
  }, [location.state, issueId]);

  useEffect(() => {
    if (!meta || !issueId) return;
    sessionStorage.setItem(`${STORAGE_PREFIX}${issueId}`, JSON.stringify(meta));
  }, [meta, issueId]);

  const [slotDate, setSlotDate] = useState(() => todayYmd());
  const [slots, setSlots] = useState<readonly AvailableSlot[]>([]);
  const [slotsLoad, setSlotsLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [slotsErr, setSlotsErr] = useState<string | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string>("");
  const navigate = useNavigate();

  const isFollowUp = Boolean(readVirtualFollowUpAppointmentId());
  const followUpAppointmentId = readVirtualFollowUpAppointmentId();
  const slotsLanguage = meta?.language ?? "English";

  const selectedDay = useMemo(() => {
    return parseSlotDateYmd(slotDate) ?? new Date();
  }, [slotDate]);

  const canContinue = Boolean(selectedSlotKey);

  const loadSlots = useCallback(async () => {
    if (!meta) return;
    setSlotsLoad("loading");
    setSlotsErr(null);
    setSelectedSlotKey("");
    try {
      const list = await fetchAllAvailableSlots({
        date: slotDate,
        spid: meta.spid,
        language: slotsLanguage,
        appointmentId: followUpAppointmentId,
      });
      setSlots(list);
      setSlotsLoad("ok");
    } catch (e: unknown) {
      setSlotsLoad("error");
      setSlotsErr(e instanceof Error ? e.message : "Could not load slots");
      setSlots([]);
    }
  }, [meta, slotDate, slotsLanguage, followUpAppointmentId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    setSlotDate((prev) => maxIsoDate(prev, todayYmd()));
  }, []);

  const backToSpecialties = generatePath(ROUTES.consultationSpecialties, { type: "virtual" });

  const pageTitle = meta
    ? isFollowUp
      ? `Appointment - ${meta.issueTitle}`
      : "Select slot"
    : "Select slot";

  if (!meta) {
    return (
      <div className="cvsl-page">
        <header className="cvsl-top">
          <Link to={backToSpecialties} className="cvsl-back" aria-label="Back">
            <BackIcon />
          </Link>
          <h1 className="cvsl-title">Select slot</h1>
        </header>
        <main className="cvsl-main">
          <p className="cvsl-msg cvsl-msg--err">Select a specialty again to continue.</p>
          <Link to={backToSpecialties} className="cvsl-linkback">
            Back to specialties
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="cvsl-page">
      <header className="cvsl-top">
        {isFollowUp ? (
          <button
            type="button"
            className="cvsl-back"
            aria-label="Back"
            onClick={() => navigate(-1)}
          >
            <BackIcon />
          </button>
        ) : (
          <Link to={backToSpecialties} className="cvsl-back" aria-label="Back">
            <BackIcon />
          </Link>
        )}
        <h1 className="cvsl-title">{pageTitle}</h1>
      </header>

      <main className="cvsl-main">
        <VirtualConsultationSlotSelector
          selectedDay={selectedDay}
          onSelectDay={(d) => {
            setSlotDate(formatLocalYmd(d));
          }}
          selectedSlotKey={selectedSlotKey}
          onSelectSlotKey={setSelectedSlotKey}
          slots={slots}
          slotsLoading={slotsLoad === "loading" || slotsLoad === "idle"}
          slotsError={slotsLoad === "error" ? slotsErr : null}
        />
      </main>

      <footer className="cvsl-footer">
        <button
          type="button"
          className="cvsl-footer__book"
          disabled={!canContinue}
          onClick={() => {
            if (!selectedSlotKey) return;
            try {
              sessionStorage.setItem(
                "opd-mobile-view.virtualBooking.selectedSlotKey",
                selectedSlotKey,
              );
              sessionStorage.setItem("opd-mobile-view.virtualBooking.slotDate", slotDate);
            } catch {
              // ignore
            }
            navigate(generatePath(ROUTES.consultationVirtualOverview, { issueId }));
          }}
        >
          {canContinue ? "Confirm" : "Select Slot"}
        </button>
      </footer>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
