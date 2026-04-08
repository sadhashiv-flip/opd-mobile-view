import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  doctorImageUrl,
  fetchAllAvailableSlots,
  fetchAllSpecialityDoctors,
  formatExperience,
  formatLocalYmd,
  type AvailableSlot,
  type SpecialityDoctor,
} from "@/api/consultationVirtual";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/ConsultationVirtualSlotsPage.css";
import "@/components/consultation/VirtualAppointmentSlotBottomSheet.css";

const STORAGE_PREFIX = "opd-mobile-view.virtualSlots.";

type VirtualMeta = Readonly<{
  parent: number;
  issueTitle: string;
  spid: number;
}>;

function readStoredMeta(issueId: string): VirtualMeta | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${issueId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<VirtualMeta>;
    if (
      typeof p.parent === "number" &&
      Number.isFinite(p.parent) &&
      typeof p.spid === "number" &&
      Number.isFinite(p.spid) &&
      typeof p.issueTitle === "string"
    ) {
      return { parent: p.parent, spid: p.spid, issueTitle: p.issueTitle };
    }
  } catch {
    // ignore
  }
  return null;
}

function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export type VirtualAppointmentSlotBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  issueId: string;
  slotDate: string;
  slotKey: string;
  onApplied: (next: Readonly<{ slotDate: string; slotKey: string }>) => void;
}>;

const LANG = "English";

export function VirtualAppointmentSlotBottomSheet({
  open,
  onClose,
  issueId,
  slotDate: slotDateProp,
  slotKey: slotKeyProp,
  onApplied,
}: VirtualAppointmentSlotBottomSheetProps) {
  const meta = useMemo(() => (open && issueId ? readStoredMeta(issueId) : null), [open, issueId]);

  const [doctors, setDoctors] = useState<readonly SpecialityDoctor[]>([]);
  const [doctorsLoad, setDoctorsLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [doctorsErr, setDoctorsErr] = useState<string | null>(null);

  const [slotDate, setSlotDate] = useState("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [slots, setSlots] = useState<readonly AvailableSlot[]>([]);
  const [slotsLoad, setSlotsLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [slotsErr, setSlotsErr] = useState<string | null>(null);

  const minSelectableDate = formatLocalYmd(new Date());

  useEffect(() => {
    if (!open) return;
    const today = formatLocalYmd(new Date());
    const initial = maxIsoDate(slotDateProp.trim() || today, today);
    setSlotDate(initial);
    setSelectedSlotKey(slotKeyProp);
  }, [open, issueId, slotDateProp, slotKeyProp]);

  const loadDoctors = useCallback(async () => {
    if (!meta) return;
    setDoctorsLoad("loading");
    setDoctorsErr(null);
    try {
      const list = await fetchAllSpecialityDoctors(meta.parent);
      setDoctors(list);
      setDoctorsLoad("ok");
    } catch (e: unknown) {
      setDoctorsLoad("error");
      setDoctorsErr(e instanceof Error ? e.message : "Could not load doctors");
    }
  }, [meta]);

  const loadSlots = useCallback(async () => {
    if (!meta || !slotDate.trim()) return;
    setSlotsLoad("loading");
    setSlotsErr(null);
    try {
      const list = await fetchAllAvailableSlots({
        date: slotDate,
        spid: meta.spid,
        language: LANG,
      });
      setSlots(list);
      setSlotsLoad("ok");
      setSelectedSlotKey("");
    } catch (e: unknown) {
      setSlotsLoad("error");
      setSlotsErr(e instanceof Error ? e.message : "Could not load slots");
      setSlots([]);
    }
  }, [meta, slotDate]);

  useEffect(() => {
    if (!open || !meta) return;
    void loadDoctors();
  }, [open, meta, loadDoctors]);

  useEffect(() => {
    if (!open || !meta || !slotDate) return;
    void loadSlots();
  }, [open, meta, slotDate, loadSlots]);

  /** After load clears selection (same as slots page), restore if current prop still valid for this date. */
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

  let doctorsBlock: ReactNode = null;
  let slotsBlock: ReactNode = null;
  if (meta) {
    if (doctorsLoad === "loading" || doctorsLoad === "idle") {
      doctorsBlock = <div className="cvsl-msg">Loading doctors…</div>;
    } else if (doctorsLoad === "error") {
      doctorsBlock = (
        <div className="cvsl-msg cvsl-msg--err" role="alert">
          {doctorsErr ?? "Could not load doctors"}
        </div>
      );
    } else if (doctors.length === 0) {
      doctorsBlock = <div className="cvsl-msg">No doctors available for this speciality.</div>;
    } else {
      doctorsBlock = (
        <div className="cvsl-slider" aria-label="Doctors">
          {doctors.map((d) => {
            const img = doctorImageUrl(d);
            const exp = formatExperience(d.experience);
            return (
              <div key={d.id} className="cvsl-slide">
                <div className="cvsl-doc">
                  <div className="cvsl-doc__avatar" aria-hidden="true">
                    {img ? (
                      <img src={img} alt="" className="cvsl-doc__img" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="cvsl-doc__meta">
                    <div className="cvsl-doc__name">{d.name}</div>
                    <div className="cvsl-doc__deg">
                      {d.qualification ?? d.speciality?.name ?? ""}
                    </div>
                  </div>
                </div>
                {exp ? <div className="cvsl-doc__tag">{exp}</div> : null}
              </div>
            );
          })}
        </div>
      );
    }

    if (slotsLoad === "loading" || slotsLoad === "idle") {
      slotsBlock = <div className="cvsl-msg">Loading slots…</div>;
    } else if (slotsLoad === "error") {
      slotsBlock = (
        <div className="cvsl-msg cvsl-msg--err" role="alert">
          {slotsErr ?? "Could not load slots"}
        </div>
      );
    } else if (slots.length === 0) {
      slotsBlock = <div className="cvsl-msg">No slots for this date.</div>;
    } else {
      slotsBlock = (
        <div className="cvsl-slots" role="radiogroup" aria-label="Time slots">
          {slots.map((s) => {
            const key = `${s.date}|${s.time}`;
            const disabled = s.available === "0" || s.available === "false";
            const active = selectedSlotKey === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                className={`cvsl-slot${active ? " cvsl-slot--active" : ""}${disabled ? " cvsl-slot--disabled" : ""}`}
                onClick={() => !disabled && setSelectedSlotKey(key)}
              >
                <span className="cvsl-slot__time">{s.displayTime}</span>
                <span className="cvsl-slot__avail">Available: {s.available}</span>
              </button>
            );
          })}
        </div>
      );
    }
  }

  const canContinue = Boolean(selectedSlotKey);

  if (!open) return null;

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
        {meta ? (
          <div className="cvsl-page vas-cvsl-sheet__inner">
            <header className="cvsl-top vas-cvsl-top">
              <h1 id="vas-cvsl-title" className="cvsl-title">
                {meta.issueTitle}
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
              <div className="cvsl-note">
                Note : Flip Health will call and try to schedule your appointment in your preferred slot
                or the next available slot
              </div>

              <section className="cvsl-topdocs" aria-label="Top Doctors">
                <div className="cvsl-topdocs__title">Top Doctors</div>
                {doctorsBlock}
              </section>

              <div className="cvsl-row">
                <div className="cvsl-row__left">
                  <span className="cvsl-row__ic" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
                      <path d="M12 7v6l3 2" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>choose date and time</span>
                </div>
                <label className="cvsl-datewrap">
                  <span className="cvsl-sr">Date</span>
                  <input
                    type="date"
                    className="cvsl-date"
                    min={minSelectableDate}
                    value={slotDate}
                    onChange={(e) => {
                      setSlotDate(maxIsoDate(e.target.value, minSelectableDate));
                    }}
                  />
                </label>
              </div>

              <section className="cvsl-slotssec" aria-label="Available slots">
                <div className="cvsl-slotssec__head">Available slots</div>
                <div className="cvsl-slotssec__box">{slotsBlock}</div>
              </section>
            </main>

            <footer className="cvsl-footer">
              <button
                type="button"
                className="cvsl-footer__book"
                disabled={!canContinue}
                onClick={apply}
              >
                Book Appointment
              </button>
            </footer>
          </div>
        ) : (
          <div className="cvsl-page vas-cvsl-sheet__inner">
            <header className="cvsl-top vas-cvsl-top">
              <h1 id="vas-cvsl-title" className="cvsl-title">
                Slots
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
              <p className="cvsl-msg cvsl-msg--err">Select a specialty again to continue.</p>
            </main>
          </div>
        )}
      </div>
    </dialog>
  );
}
