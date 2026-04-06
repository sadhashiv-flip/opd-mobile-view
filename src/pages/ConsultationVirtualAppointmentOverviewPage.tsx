import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { readConsultSelectedPersonIdNumber } from "@/constants/consultationSelectedMemberStorage";
import { bookAppointment } from "@/api/appointmentBook";
import { useToast } from "@/hooks/useToast";
import { useEffect, useMemo, useState } from "react";
import "./ConsultationAppointmentOverviewPage.css";

const VIRTUAL_PURPOSE_KEY = "opd-mobile-view.virtualBooking.purpose";
const VIRTUAL_LANGUAGE_KEY = "opd-mobile-view.virtualBooking.language";

/** English first, then major Indian languages (ISO-style labels for display). */
const CONSULTATION_LANGUAGES: readonly { value: string; label: string }[] = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi (हिन्दी)" },
  { value: "Bengali", label: "Bengali (বাংলা)" },
  { value: "Telugu", label: "Telugu (తెలుగు)" },
  { value: "Marathi", label: "Marathi (मराठी)" },
  { value: "Tamil", label: "Tamil (தமிழ்)" },
  { value: "Gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "Kannada", label: "Kannada (ಕನ್ನಡ)" },
  { value: "Malayalam", label: "Malayalam (മലയാളം)" },
  { value: "Punjabi", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { value: "Odia", label: "Odia (ଓଡ଼ିଆ)" },
  { value: "Assamese", label: "Assamese (অসমীয়া)" },
  { value: "Urdu", label: "Urdu (اردو)" },
] as const;

const STORAGE_PREFIX = "opd-mobile-view.virtualSlots.";

type VirtualSpecialtySlotsState = Readonly<{
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

/** Slot key from slots screen: `YYYY-MM-DD|time` (time normalized to `HH:mm:ss` for the API). */
function parseVirtualBookingSlot(slotKey: string): { date: string; time: string } | null {
  if (!slotKey) return null;
  const i = slotKey.indexOf("|");
  if (i <= 0) return null;
  const date = slotKey.slice(0, i).trim();
  const timeRaw = slotKey.slice(i + 1).trim();
  if (!date || !timeRaw) return null;
  return { date, time: normalizeTimeForApi(timeRaw) };
}

function normalizeTimeForApi(raw: string): string {
  const t = raw.trim();
  const colons = (t.match(/:/g) ?? []).length;
  if (colons === 1) return `${t}:00`;
  return t;
}

export function ConsultationVirtualAppointmentOverviewPage() {
  const params = useParams();
  const issueId = typeof params.issueId === "string" ? params.issueId : "";

  const issueTitle = useMemo(() => readStoredMeta(issueId)?.issueTitle ?? "Appointment Overview", [issueId]);

  const slotDate = useMemo(() => {
    try {
      return sessionStorage.getItem("opd-mobile-view.virtualBooking.slotDate") ?? "";
    } catch {
      return "";
    }
  }, []);

  const slotKey = useMemo(() => {
    try {
      return sessionStorage.getItem("opd-mobile-view.virtualBooking.selectedSlotKey") ?? "";
    } catch {
      return "";
    }
  }, []);

  const timeLabel = useMemo(() => {
    if (!slotKey) return "";
    const parts = slotKey.split("|");
    return parts.length >= 2 ? parts.slice(1).join("|") : "";
  }, [slotKey]);

  const navigate = useNavigate();
  const toast = useToast();
  const [purpose, setPurpose] = useState("");
  /** Empty until user picks a language (placeholder option). */
  const [language, setLanguage] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    try {
      const p = sessionStorage.getItem(VIRTUAL_PURPOSE_KEY);
      if (p) setPurpose(p);
      const lang = sessionStorage.getItem(VIRTUAL_LANGUAGE_KEY);
      if (lang && CONSULTATION_LANGUAGES.some((x) => x.value === lang)) {
        setLanguage(lang);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIRTUAL_PURPOSE_KEY, purpose);
    } catch {
      // ignore
    }
  }, [purpose]);

  useEffect(() => {
    try {
      if (language) {
        sessionStorage.setItem(VIRTUAL_LANGUAGE_KEY, language);
      } else {
        sessionStorage.removeItem(VIRTUAL_LANGUAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [language]);

  const patientId = readConsultSelectedPersonIdNumber();

  const slotParsed = useMemo(() => parseVirtualBookingSlot(slotKey), [slotKey]);

  const issueIdNum = useMemo(() => {
    const n = Number(issueId);
    return Number.isFinite(n) ? n : Number.NaN;
  }, [issueId]);

  const canBookNow =
    purpose.trim().length > 0 &&
    language.length > 0 &&
    patientId != null &&
    slotParsed != null &&
    Number.isFinite(issueIdNum);

  return (
    <div className="cao-page">
      <header className="cao-top">
        <Link
          to={generatePath(ROUTES.consultationVirtualSlots, { issueId })}
          className="cao-back"
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
        <h1 className="cao-title">Appointment Overview</h1>
      </header>

      <main className="cao-main">
        <section className="cao-doc">
          <div className="cao-doc__top">
            <div className="cao-doc__avatar" aria-hidden="true" />
            <div className="cao-doc__meta">
              <div className="cao-doc__name">{issueTitle}</div>
              <div className="cao-doc__sub">Virtual consultation</div>
            </div>
            <div className="cao-chip">Cashless Available</div>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Purpose of consultation</div>
          <textarea
            className="cao-textarea"
            name="purpose"
            rows={4}
            maxLength={2000}
            placeholder="Briefly describe why you need this consultation"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            aria-label="Purpose of consultation"
          />
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Language</div>
          <div className="cao-field__row cao-field__row--select">
            <select
              id="virtual-consult-language"
              className="cao-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Preferred language"
            >
              <option value="" disabled>
                Select language
              </option>
              {CONSULTATION_LANGUAGES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="cao-fees">
          <div className="cao-fees__row">
            <span>Doctor&apos;s Fee</span>
            <strong>₹ 0</strong>
          </div>
          <div className="cao-fees__row cao-fees__row--total">
            <span>Total Amount</span>
            <strong>₹ 0</strong>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Date and time</div>
          <div className="cao-field__row">
            <div className="cao-field__value">
              {slotDate || "—"} {timeLabel ? `| ${timeLabel}` : ""}
            </div>
          </div>
        </section>
      </main>

      <footer className="cao-footer">
        <button
          type="button"
          className="cao-confirm"
          disabled={!canBookNow || bookingLoading}
          onClick={() => {
            if (!canBookNow || bookingLoading || !slotParsed || patientId == null) return;
            void (async () => {
              setBookingLoading(true);
              try {
                await bookAppointment({
                  date: slotParsed.date,
                  time: slotParsed.time,
                  language,
                  patient_id: patientId,
                  issue_id: issueIdNum,
                  purpose: purpose.trim(),
                });
                navigate(generatePath(ROUTES.diagnosticsBookingSuccess, { type: "health-checkups" }));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not book appointment");
              } finally {
                setBookingLoading(false);
              }
            })();
          }}
        >
          {bookingLoading ? "Booking…" : "Book Now"}
        </button>
      </footer>
    </div>
  );
}

