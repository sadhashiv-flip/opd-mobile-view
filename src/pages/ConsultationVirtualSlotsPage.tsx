import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import {
  readVirtualBookingSlotDraft,
  writeVirtualBookingSlotDraft,
} from "@/constants/consultationBookingStorage";
import { readVirtualFollowUpAppointmentId } from "@/constants/virtualConsultationSessionStorage";
import { VirtualConsultationSlotSelector } from "@/components/consultation/VirtualConsultationSlotSelector";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAllAvailableSlots,
  formatLocalYmd,
  type AvailableSlot,
  type VirtualSpecialtySlotsState,
} from "@/api/consultationVirtual";
import {
  maxIsoDate,
  parseSlotDateYmd,
  partitionVirtualSlots,
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

  const initialDraft = useMemo(() => readVirtualBookingSlotDraft(), []);
  const [slotDate, setSlotDate] = useState(() => {
    const stored = initialDraft?.slotDate?.trim();
    return stored ? maxIsoDate(stored, todayYmd()) : todayYmd();
  });
  const [slots, setSlots] = useState<readonly AvailableSlot[]>([]);
  const [slotsLoad, setSlotsLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [slotsErr, setSlotsErr] = useState<string | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState(
    () => initialDraft?.selectedSlotKey?.trim() ?? "",
  );
  const navigate = useNavigate();
  const pendingSlotRestoreRef = useRef(initialDraft?.selectedSlotKey?.trim() ?? "");

  const isFollowUp = Boolean(readVirtualFollowUpAppointmentId());
  const followUpAppointmentId = readVirtualFollowUpAppointmentId();
  const slotsLanguage = meta?.language ?? "English";

  const selectedDay = useMemo(() => {
    return parseSlotDateYmd(slotDate) ?? new Date();
  }, [slotDate]);

  const canContinue = Boolean(selectedSlotKey);

  const persistSlotDraft = useCallback(
    (date: string, slotKey: string) => {
      writeVirtualBookingSlotDraft(date, slotKey);
    },
    [],
  );

  const loadSlots = useCallback(async () => {
    if (!meta) return;
    setSlotsLoad("loading");
    setSlotsErr(null);
    try {
      const list = await fetchAllAvailableSlots({
        date: slotDate,
        spid: meta.spid,
        language: slotsLanguage,
        appointmentId: followUpAppointmentId,
      });
      setSlots(list);
      setSlotsLoad("ok");

      const restoreKey = pendingSlotRestoreRef.current.trim();
      pendingSlotRestoreRef.current = "";
      if (!restoreKey) {
        setSelectedSlotKey("");
        return;
      }
      const parts = partitionVirtualSlots(list);
      const chips = [...parts.morning, ...parts.afternoon, ...parts.evening];
      const match = chips.find((c) => c.key === restoreKey && !c.disabled);
      setSelectedSlotKey(match ? restoreKey : "");
    } catch (e: unknown) {
      setSlotsLoad("error");
      setSlotsErr(e instanceof Error ? e.message : "Could not load slots");
      setSlots([]);
      setSelectedSlotKey("");
    }
  }, [meta, slotDate, slotsLanguage, followUpAppointmentId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    setSlotDate((prev) => maxIsoDate(prev, todayYmd()));
  }, []);

  const backToSpecialties = generatePath(ROUTES.consultationSpecialties, { type: "virtual" });

  const onSelectDay = useCallback(
    (d: Date) => {
      const ymd = formatLocalYmd(d);
      pendingSlotRestoreRef.current = "";
      setSlotDate(ymd);
      setSelectedSlotKey("");
      persistSlotDraft(ymd, "");
    },
    [persistSlotDraft],
  );

  const onSelectSlotKey = useCallback(
    (key: string) => {
      setSelectedSlotKey(key);
      persistSlotDraft(slotDate, key);
    },
    [persistSlotDraft, slotDate],
  );

  const onBeforeBack = useCallback(() => {
    persistSlotDraft(slotDate, selectedSlotKey);
  }, [persistSlotDraft, slotDate, selectedSlotKey]);

  const pageTitle = meta
    ? isFollowUp
      ? `Appointment - ${meta.issueTitle}`
      : "Select slot"
    : "Select slot";

  if (!meta) {
    return (
      <div className="cvsl-page">
        <header className="cvsl-top">
          <FlowScreenBack fallbackTo={backToSpecialties} className="app-back-btn cvsl-back" />
          <h1 className="cvsl-title">Select slot</h1>
        </header>
        <main className="cvsl-main">
          <p className="cvsl-msg cvsl-msg--err">Select a specialty again to continue.</p>
          <button type="button" className="cvsl-linkback" onClick={() => navigate(-1)}>
            Back to specialties
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="cvsl-page">
      <header className="cvsl-top">
        <FlowScreenBack
          fallbackTo={backToSpecialties}
          className="app-back-btn cvsl-back"
          onBeforeBack={onBeforeBack}
        />
        <h1 className="cvsl-title">{pageTitle}</h1>
      </header>

      <main className="cvsl-main cvsl-main--with-sticky-footer">
        <VirtualConsultationSlotSelector
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
          selectedSlotKey={selectedSlotKey}
          onSelectSlotKey={onSelectSlotKey}
          slots={slots}
          slotsLoading={slotsLoad === "loading" || slotsLoad === "idle"}
          slotsError={slotsLoad === "error" ? slotsErr : null}
        />
      </main>

      <footer className="cvsl-footer cvsl-footer--sticky">
        <button
          type="button"
          className="cvsl-footer__book"
          disabled={!canContinue}
          onClick={() => {
            if (!selectedSlotKey) return;
            persistSlotDraft(slotDate, selectedSlotKey);
            navigate(generatePath(ROUTES.consultationVirtualOverview, { issueId }));
          }}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
