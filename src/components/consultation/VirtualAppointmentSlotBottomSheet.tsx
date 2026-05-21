import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAllAvailableSlots,
  formatLocalYmd,
  type AvailableSlot,
  type VirtualSpecialtySlotsState,
} from "@/api/consultationVirtual";
import { VirtualConsultationSlotSelector } from "@/components/consultation/VirtualConsultationSlotSelector";
import {
  readVirtualFollowUpAppointmentId,
  VIRTUAL_CONSULT_LANGUAGE_KEY,
} from "@/constants/virtualConsultationSessionStorage";
import {
  maxIsoDate,
  parseSlotDateYmd,
  todayYmd,
} from "@/utils/consultationVirtualSlotRules";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/ConsultationVirtualSlotsPage.css";
import "@/components/consultation/VirtualAppointmentSlotBottomSheet.css";

const STORAGE_PREFIX = "opd-mobile-view.virtualSlots.";

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
          : readPreferredConsultLanguage();
      return { parent: p.parent, spid: p.spid, issueTitle: p.issueTitle, language: lang };
    }
  } catch {
    // ignore
  }
  return null;
}

export type VirtualAppointmentSlotBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  issueId: string;
  slotDate: string;
  slotKey: string;
  onApplied: (next: Readonly<{ slotDate: string; slotKey: string }>) => void;
}>;

function readPreferredConsultLanguage(): string {
  try {
    const v = sessionStorage.getItem(VIRTUAL_CONSULT_LANGUAGE_KEY)?.trim();
    if (v) return v;
  } catch {
    // ignore
  }
  return "English";
}

export function VirtualAppointmentSlotBottomSheet({
  open,
  onClose,
  issueId,
  slotDate: slotDateProp,
  slotKey: slotKeyProp,
  onApplied,
}: VirtualAppointmentSlotBottomSheetProps) {
  const meta = useMemo(() => (open && issueId ? readStoredMeta(issueId) : null), [open, issueId]);

  const [slotDate, setSlotDate] = useState("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [slots, setSlots] = useState<readonly AvailableSlot[]>([]);
  const [slotsLoad, setSlotsLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [slotsErr, setSlotsErr] = useState<string | null>(null);

  const followUpAppointmentId = readVirtualFollowUpAppointmentId();

  useEffect(() => {
    if (!open) return;
    const today = todayYmd();
    const initial = maxIsoDate(slotDateProp.trim() || today, today);
    setSlotDate(initial);
    setSelectedSlotKey(slotKeyProp);
  }, [open, issueId, slotDateProp, slotKeyProp]);

  const selectedDay = useMemo(() => {
    return parseSlotDateYmd(slotDate) ?? new Date();
  }, [slotDate]);

  const loadSlots = useCallback(async () => {
    if (!meta || !slotDate.trim()) return;
    setSlotsLoad("loading");
    setSlotsErr(null);
    setSelectedSlotKey("");
    try {
      const list = await fetchAllAvailableSlots({
        date: slotDate,
        spid: meta.spid,
        language: meta.language,
        appointmentId: followUpAppointmentId,
      });
      setSlots(list);
      setSlotsLoad("ok");
    } catch (e: unknown) {
      setSlotsLoad("error");
      setSlotsErr(e instanceof Error ? e.message : "Could not load slots");
      setSlots([]);
    }
  }, [meta, slotDate, followUpAppointmentId]);

  useEffect(() => {
    if (!open || !meta || !slotDate) return;
    void loadSlots();
  }, [open, meta, slotDate, loadSlots]);

  useEffect(() => {
    if (slotsLoad !== "ok" || slots.length === 0) return;
    const key = slotKeyProp.trim();
    if (!key) return;
    const ok = slots.some((s) => `${s.date}|${s.time}` === key);
    if (ok) setSelectedSlotKey(key);
  }, [slotsLoad, slots, slotKeyProp]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const apply = useCallback(() => {
    if (!selectedSlotKey || !slotDate) return;
    try {
      sessionStorage.setItem("opd-mobile-view.virtualBooking.selectedSlotKey", selectedSlotKey);
      sessionStorage.setItem("opd-mobile-view.virtualBooking.slotDate", slotDate);
    } catch {
      // ignore
    }
    onApplied({ slotDate, slotKey: selectedSlotKey });
    onClose();
  }, [selectedSlotKey, slotDate, onApplied, onClose]);

  const canContinue = Boolean(selectedSlotKey);

  if (!open) return null;

  const sheetTitle = meta ? meta.issueTitle : "Select slot";

  return (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="vas-cvsl-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="vas-cvsl-sheet">
        <div className="cvsl-page vas-cvsl-sheet__inner">
          <header className="cvsl-top vas-cvsl-top">
            <h1 id="vas-cvsl-title" className="cvsl-title">
              {sheetTitle}
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

          <main className="cvsl-main">
            {meta ? (
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
            ) : (
              <p className="cvsl-msg cvsl-msg--err">Select a specialty again to continue.</p>
            )}
          </main>

          {meta ? (
            <footer className="cvsl-footer">
              <button
                type="button"
                className="cvsl-footer__book"
                disabled={!canContinue}
                onClick={apply}
              >
                {canContinue ? "Confirm" : "Select Slot"}
              </button>
            </footer>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
