import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
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
import "./ConsultationVirtualSlotsPage.css";

const STORAGE_PREFIX = "opd-mobile-view.virtualSlots.";

/** Later of two `YYYY-MM-DD` strings (valid ISO dates). */
function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export type VirtualSpecialtySlotsState = Readonly<{
  parent: number;
  issueTitle: string;
  spid: number;
}>;

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
      return { parent: p.parent, spid: p.spid, issueTitle: p.issueTitle };
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

  const meta = useMemo(() => {
    const fromState = location.state as VirtualSpecialtySlotsState | null;
    if (
      fromState &&
      typeof fromState.parent === "number" &&
      typeof fromState.spid === "number" &&
      typeof fromState.issueTitle === "string"
    ) {
      return fromState;
    }
    return readStoredMeta(issueId);
  }, [location.state, issueId]);

  useEffect(() => {
    if (!meta || !issueId) return;
    sessionStorage.setItem(`${STORAGE_PREFIX}${issueId}`, JSON.stringify(meta));
  }, [meta, issueId]);

  const [doctors, setDoctors] = useState<readonly SpecialityDoctor[]>([]);
  const [doctorsLoad, setDoctorsLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [doctorsErr, setDoctorsErr] = useState<string | null>(null);

  const [slotDate, setSlotDate] = useState(() => formatLocalYmd(new Date()));
  const [slots, setSlots] = useState<readonly AvailableSlot[]>([]);
  const [slotsLoad, setSlotsLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [slotsErr, setSlotsErr] = useState<string | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string>("");
  const language = "English";
  const navigate = useNavigate();

  const canContinue = Boolean(selectedSlotKey);

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
    if (!meta) return;
    setSlotsLoad("loading");
    setSlotsErr(null);
    try {
      const list = await fetchAllAvailableSlots({
        date: slotDate,
        spid: meta.spid,
        language,
      });
      setSlots(list);
      setSlotsLoad("ok");
      setSelectedSlotKey("");
    } catch (e: unknown) {
      setSlotsLoad("error");
      setSlotsErr(e instanceof Error ? e.message : "Could not load slots");
    }
  }, [meta, slotDate, language]);

  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  /** Keep selected date on or after today (local calendar). */
  useEffect(() => {
    const today = formatLocalYmd(new Date());
    setSlotDate((prev) => maxIsoDate(prev, today));
  }, []);

  const minSelectableDate = formatLocalYmd(new Date());

  const backToSpecialties = generatePath(ROUTES.consultationSpecialties, { type: "virtual" });

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

  if (!meta) {
    return (
      <div className="cvsl-page">
        <header className="cvsl-top">
          <Link to={backToSpecialties} className="cvsl-back" aria-label="Back">
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
          <h1 className="cvsl-title">Slots</h1>
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
        <Link to={backToSpecialties} className="cvsl-back" aria-label="Back">
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
        <h1 className="cvsl-title">{meta.issueTitle}</h1>
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
              onChange={(e) => setSlotDate(e.target.value)}
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
          onClick={() => {
            if (!selectedSlotKey) return;
            try {
              sessionStorage.setItem(
                "opd-mobile-view.virtualBooking.selectedSlotKey",
                selectedSlotKey,
              );
              sessionStorage.setItem(
                "opd-mobile-view.virtualBooking.slotDate",
                slotDate,
              );
            } catch {
              // ignore
            }
            navigate(generatePath(ROUTES.consultationVirtualOverview, { issueId }));
          }}
        >
          Book Appointment
        </button>
      </footer>
    </div>
  );
}
