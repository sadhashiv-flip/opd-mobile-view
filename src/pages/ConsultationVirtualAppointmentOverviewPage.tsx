import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { SelectPeopleBottomSheet } from "@/components/select-people/SelectPeopleBottomSheet";
import { VirtualAppointmentSlotBottomSheet } from "@/components/consultation/VirtualAppointmentSlotBottomSheet";
import { ROUTES } from "@/constants";
import {
  clearVirtualConsultPurposeAndLanguage,
  clearVirtualFollowUpAppointmentId,
  readVirtualFollowUpAppointmentId,
  VIRTUAL_CONSULT_LANGUAGE_KEY,
  VIRTUAL_CONSULT_PURPOSE_KEY,
} from "@/constants/virtualConsultationSessionStorage";
import {
  readConsultSelectedPersonIdNumber,
  readPrimaryConsultSelectedMemberSnapshot,
} from "@/constants/consultationSelectedMemberStorage";
import {
  bookAppointment,
  bookAppointmentConfirm,
  isAppointmentPaymentRequired,
  readAppointmentResponseMessage,
  readRazorpayPayloadFromAppointmentResponse,
} from "@/api/appointmentBook";
import { PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import { useConsultationPaymentVerify } from "@/hooks/useConsultationPaymentVerify";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import type { SearchablePickerOption } from "@/components/wellness/SearchablePickerField";
import { SearchablePickerField } from "@/components/wellness/SearchablePickerField";
import { useToast } from "@/hooks/useToast";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./ConsultationAppointmentOverviewPage.css";

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

/** `YYYY-MM-DD` + slot time label → e.g. `September 15, 2025 | 2PM-3PM` */
function formatVirtualDateTimeLine(slotDate: string, timeLabel: string): string {
  if (!slotDate?.trim()) return timeLabel ? `— | ${timeLabel}` : "—";
  const d = new Date(`${slotDate.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return timeLabel ? `${slotDate} | ${timeLabel}` : slotDate;
  }
  const dateStr = d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return timeLabel ? `${dateStr} | ${timeLabel}` : dateStr;
}

function readVirtualSlotDateFromStorage(): string {
  try {
    return sessionStorage.getItem("opd-mobile-view.virtualBooking.slotDate") ?? "";
  } catch {
    return "";
  }
}

function readVirtualSlotKeyFromStorage(): string {
  try {
    return sessionStorage.getItem("opd-mobile-view.virtualBooking.selectedSlotKey") ?? "";
  } catch {
    return "";
  }
}

export function ConsultationVirtualAppointmentOverviewPage() {
  const params = useParams();
  const issueId = typeof params.issueId === "string" ? params.issueId : "";

  const [virtualSlotDate, setVirtualSlotDate] = useState(readVirtualSlotDateFromStorage);
  const [virtualSlotKey, setVirtualSlotKey] = useState(readVirtualSlotKeyFromStorage);
  const [patientBump, setPatientBump] = useState(0);
  const [patientSheetOpen, setPatientSheetOpen] = useState(false);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);

  const timeLabel = useMemo(() => {
    if (!virtualSlotKey) return "";
    const parts = virtualSlotKey.split("|");
    return parts.length >= 2 ? parts.slice(1).join("|") : "";
  }, [virtualSlotKey]);

  const patientLabel = useMemo(
    () => readPrimaryConsultSelectedMemberSnapshot()?.name?.trim() || "Patient",
    [patientBump],
  );

  const dateTimeDisplay = useMemo(
    () => formatVirtualDateTimeLine(virtualSlotDate, timeLabel),
    [virtualSlotDate, timeLabel],
  );

  const navigate = useNavigate();
  const toast = useToast();
  const [purpose, setPurpose] = useState("");
  /** Empty until user picks a language (placeholder option). */
  const [language, setLanguage] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const paymentSuccessToastRef = useRef<string | undefined>(undefined);
  const onPaymentVerifiedRef = useRef<() => void>(() => {});
  const onPaymentVerifyErrorRef = useRef<(message: string) => void>(() => {});
  const setBookingBusyRef = useRef<(busy: boolean) => void>(() => {});

  useEffect(() => {
    setBookingBusyRef.current = setBookingLoading;
    onPaymentVerifiedRef.current = () => {
      const msg = paymentSuccessToastRef.current;
      if (msg) toast.success(msg);
      paymentSuccessToastRef.current = undefined;
      setBookingLoading(false);
      clearVirtualFollowUpAppointmentId();
      navigate(ROUTES.consultationVirtualBookingSuccess, { replace: true });
    };
    onPaymentVerifyErrorRef.current = (message: string) => {
      toast.error(message);
      setBookingLoading(false);
    };
  }, [navigate, toast]);

  useConsultationPaymentVerify({
    onSuccessRef: onPaymentVerifiedRef,
    onErrorRef: onPaymentVerifyErrorRef,
    setBusyRef: setBookingBusyRef,
  });

  /**
   * Follow-up seeds purpose/language from sessionStorage.
   * New flow clears stale values (e.g. after order-details follow-up) before persist effects run.
   */
  useLayoutEffect(() => {
    if (!readVirtualFollowUpAppointmentId()) {
      clearVirtualConsultPurposeAndLanguage();
      setPurpose("");
      setLanguage("");
      return;
    }
    try {
      const p = sessionStorage.getItem(VIRTUAL_CONSULT_PURPOSE_KEY);
      if (p) setPurpose(p);
      const lang = sessionStorage.getItem(VIRTUAL_CONSULT_LANGUAGE_KEY);
      if (lang && CONSULTATION_LANGUAGES.some((x) => x.value === lang)) {
        setLanguage(lang);
      }
    } catch {
      // ignore
    }
  }, [issueId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIRTUAL_CONSULT_PURPOSE_KEY, purpose);
    } catch {
      // ignore
    }
  }, [purpose]);

  useEffect(() => {
    try {
      if (language) {
        sessionStorage.setItem(VIRTUAL_CONSULT_LANGUAGE_KEY, language);
      } else {
        sessionStorage.removeItem(VIRTUAL_CONSULT_LANGUAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [language]);

  const patientId = useMemo(() => readConsultSelectedPersonIdNumber(), [patientBump]);

  const slotParsed = useMemo(() => parseVirtualBookingSlot(virtualSlotKey), [virtualSlotKey]);

  const issueIdNum = useMemo(() => {
    const n = Number(issueId);
    return Number.isFinite(n) ? n : Number.NaN;
  }, [issueId]);

  const languagePickerOptions = useMemo((): readonly SearchablePickerOption[] => {
    return CONSULTATION_LANGUAGES.map((x) => ({ value: x.value, label: x.label }));
  }, []);

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

        <section className="cao-field">
          <div className="cao-field__label">
            Purpose of consultation
            <span className="cao-field__req" aria-hidden="true">
              {" "}
              *
            </span>
          </div>
          <textarea
            className="cao-textarea"
            name="purpose"
            rows={4}
            maxLength={2000}
            placeholder="Briefly describe why you need this consultation"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            aria-label="Purpose of consultation (required)"
            required
          />
        </section>

        <section className="cao-field">
          <SearchablePickerField
            label="Language"
            requiredMark
            placeholder="Select language"
            sheetTitle="Preferred language"
            searchPlaceholder="Search language…"
            options={languagePickerOptions}
            value={language}
            onChange={setLanguage}
            pageSize={12}
            emptySearchMessage="No language matches your search"
            fieldClassName="cao-field__searchable-picker"
          />
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Patient</div>
          <div className="cao-field__row">
            <div className="cao-field__value">{patientLabel}</div>
            <button
              type="button"
              className="cao-edit"
              aria-label="Edit patient"
              onClick={() => setPatientSheetOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
                  stroke="#1A73E8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Date and time</div>
          <div className="cao-field__row">
            <div className="cao-field__value">{dateTimeDisplay}</div>
            <button
              type="button"
              className="cao-edit"
              aria-label="Edit date and time"
              onClick={() => setSlotSheetOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
                  stroke="#1A73E8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <section className="cao-disc">
          <div className="cao-disc__title">Disclaimer</div>
          <ol className="cao-disc__list">
            <li>
              The Fees and Timings are tentative and may subject to change at the time of consultation
            </li>
            <li>
              Registration fee charged by Clinic or Hospital are not covered under OPD insurance and has
              to be borne by the insured
            </li>
          </ol>
        </section>
      </main>

      <SelectPeopleBottomSheet
        open={patientSheetOpen}
        onClose={() => setPatientSheetOpen(false)}
        onApplied={() => setPatientBump((n) => n + 1)}
      />
      <VirtualAppointmentSlotBottomSheet
        open={slotSheetOpen}
        onClose={() => setSlotSheetOpen(false)}
        issueId={issueId}
        slotDate={virtualSlotDate}
        slotKey={virtualSlotKey}
        onApplied={({ slotDate, slotKey }) => {
          setVirtualSlotDate(slotDate);
          setVirtualSlotKey(slotKey);
        }}
      />

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
                const followUpApptId = readVirtualFollowUpAppointmentId();
                const payload = {
                  date: slotParsed.date,
                  time: slotParsed.time,
                  language,
                  patient_id: patientId,
                  issue_id: issueIdNum,
                  purpose: purpose.trim(),
                  ...(followUpApptId ? { appointment_id: followUpApptId } : {}),
                };
                const bookRes = await bookAppointment(payload);

                if (!isAppointmentPaymentRequired(bookRes)) {
                  const confirmRes = await bookAppointmentConfirm(payload);
                  const messageToShow =
                    readAppointmentResponseMessage(confirmRes) ??
                    readAppointmentResponseMessage(bookRes);
                  if (messageToShow) {
                    toast.success(messageToShow);
                  }
                  clearVirtualFollowUpAppointmentId();
                  navigate(ROUTES.consultationVirtualBookingSuccess, { replace: true });
                  return;
                }

                const confirmRes = await bookAppointmentConfirm(payload);
                const rzpPayload = readRazorpayPayloadFromAppointmentResponse(confirmRes);
                if (!rzpPayload || Object.keys(rzpPayload).length === 0) {
                  toast.error(
                    readAppointmentResponseMessage(confirmRes) ??
                      readAppointmentResponseMessage(bookRes) ??
                      "Could not start payment",
                  );
                  return;
                }

                paymentSuccessToastRef.current =
                  readAppointmentResponseMessage(confirmRes) ??
                  readAppointmentResponseMessage(bookRes);

                await loadRazorpayScript();
                if (!window.Razorpay) {
                  toast.error("Razorpay Checkout could not load. Check your network or ad blocker.");
                  return;
                }

                openRazorpayCheckoutWithEvent(rzpPayload, PAYMENT_DONE_EVENT, (failMsg) => {
                  if (!isPaymentCancelledMessage(failMsg)) {
                    toast.error(failMsg);
                  }
                  setBookingLoading(false);
                });
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

