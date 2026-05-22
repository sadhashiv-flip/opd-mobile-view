import { useCallback, useEffect, useRef, useState } from "react";
import type { VisionNetworkService } from "@/api/networkList";
import { resolveSelectedAddressLocation } from "@/api/networkList";
import { fetchVisionServiceSlots, type VisionServiceSlotsData } from "@/api/visionServiceSlots";
import { visionMonthYearLabelFromDaysList } from "@/lib/visionSlotSelection";
import { useToast } from "@/hooks/useToast";

export type VisionSlotsLoadPhase = "idle" | "initial-loading" | "date-loading" | "ready" | "error";

export type UseVisionSlotsLoaderParams = Readonly<{
  service: VisionNetworkService | null;
  networkId: string | null;
  enabled: boolean;
  restoreSelection?: Readonly<{
    slotDate: string;
    slotId: string;
  }> | null;
}>;

export type UseVisionSlotsLoaderResult = Readonly<{
  payload: VisionServiceSlotsData | null;
  phase: VisionSlotsLoadPhase;
  errorMsg: string | null;
  selectedIsoDate: string;
  selectedSlotId: string | null;
  monthYearLabel: string;
  isFullScreenLoading: boolean;
  onSelectIsoDate: (iso: string) => void;
  onSelectSlotId: (id: string | null) => void;
  reload: () => void;
}>;

/** patient_app `VisionController._loadSlots` / `selectDate` / `_applySlotsResult`. */
export function useVisionSlotsLoader({
  service,
  networkId,
  enabled,
  restoreSelection = null,
}: UseVisionSlotsLoaderParams): UseVisionSlotsLoaderResult {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const restoreRef = useRef(restoreSelection);
  restoreRef.current = restoreSelection;

  const [payload, setPayload] = useState<VisionServiceSlotsData | null>(null);
  const [phase, setPhase] = useState<VisionSlotsLoadPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedIsoDate, setSelectedIsoDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  /** Ignore stale responses when the user taps another date before the prior fetch finishes. */
  const requestSeqRef = useRef(0);

  const loadSlots = useCallback(
    async (opts: Readonly<{ date?: string; isDateChange?: boolean }>) => {
      if (!enabled || !service || !networkId?.trim()) return;

      const requestId = ++requestSeqRef.current;

      if (opts.isDateChange) {
        setPhase("date-loading");
      } else {
        setPhase("initial-loading");
        setErrorMsg(null);
        setPayload(null);
      }

      try {
        const loc = await resolveSelectedAddressLocation();
        const data = await fetchVisionServiceSlots({
          location: loc,
          service,
          networkId: networkId.trim(),
          date: opts.date,
        });

        if (requestId !== requestSeqRef.current) return;

        setPayload(data);

        if (opts.isDateChange) {
          setSelectedIsoDate(opts.date ?? "");
          setSelectedSlotId(null);
        } else {
          const firstDay = data.daysList[0] ?? "";
          const restore = restoreRef.current;
          if (
            restore &&
            data.daysList.includes(restore.slotDate) &&
            restore.slotId
          ) {
            setSelectedIsoDate(restore.slotDate);
            setSelectedSlotId(restore.slotId);
          } else {
            setSelectedIsoDate(firstDay);
            setSelectedSlotId(null);
          }
        }

        setPhase("ready");
      } catch (e) {
        if (requestId !== requestSeqRef.current) return;

        const msg = e instanceof Error ? e.message : "Could not load slots";
        if (opts.isDateChange) {
          toastRef.current.error(msg);
          setPhase("ready");
        } else {
          setPayload(null);
          setPhase("error");
          setErrorMsg(msg);
          toastRef.current.error(msg);
        }
      }
    },
    [enabled, service, networkId],
  );

  const loadSlotsRef = useRef(loadSlots);
  loadSlotsRef.current = loadSlots;

  /** Initial load only — must not re-run when `toast` / `restoreSelection` identity changes. */
  useEffect(() => {
    if (!enabled || !service || !networkId?.trim()) {
      setPhase("idle");
      return;
    }
    void loadSlotsRef.current({});
  }, [enabled, service, networkId]);

  const onSelectIsoDate = useCallback(
    (iso: string) => {
      if (!iso || iso === selectedIsoDate) return;
      setSelectedIsoDate(iso);
      setSelectedSlotId(null);
      void loadSlots({ date: iso, isDateChange: true });
    },
    [selectedIsoDate, loadSlots],
  );

  const monthYearLabel = visionMonthYearLabelFromDaysList(payload?.daysList ?? []);

  return {
    payload,
    phase,
    errorMsg,
    selectedIsoDate,
    selectedSlotId,
    monthYearLabel,
    isFullScreenLoading: phase === "initial-loading" || phase === "date-loading",
    onSelectIsoDate,
    onSelectSlotId: setSelectedSlotId,
    reload: () => {
      void loadSlots({});
    },
  };
}
