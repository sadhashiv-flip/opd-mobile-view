import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import { SelectPeopleBottomSheet } from "@/components/select-people/SelectPeopleBottomSheet";
import { VirtualAppointmentSlotBottomSheet } from "@/components/consultation/VirtualAppointmentSlotBottomSheet";
import { VirtualOnlineBookingPaymentSheet } from "@/components/consultation/VirtualOnlineBookingPaymentSheet";
import { ROUTES } from "@/constants";
import {
  clearVirtualConsultPurposeOnly,
  clearVirtualFollowUpAppointmentId,
  readVirtualFollowUpAppointmentId,
  VIRTUAL_CONSULT_LANGUAGE_KEY,
  VIRTUAL_CONSULT_PURPOSE_KEY,
} from "@/constants/virtualConsultationSessionStorage";
import {
  CONSULTATION_LANGUAGES,
  isConsultationLanguageValue,
} from "@/constants/consultationLanguages";
import {
  readConsultSelectedPersonIdNumber,
  readPrimaryConsultSelectedMemberSnapshot,
} from "@/constants/consultationSelectedMemberStorage";
import {
  bookAppointment,
  bookAppointmentConfirm,
  isAppointmentPaymentRequired,
  readAppointmentInfoOrderId,
  readAppointmentInvoiceIdForOrderDetail,
  readAppointmentResponseMessage,
  readRazorpayPayloadFromAppointmentResponse,
  type BookAppointmentPayload,
} from "@/api/appointmentBook";
import { mapOnlineBookPreviewToPaymentSheet } from "@/api/virtualOnlineBookingPayment";
import { buildVirtualConsultationBookingSuccessState } from "@/lib/bookingSuccessFromInvoice";
import type { ConsultationPaymentVerifySuccess } from "@/hooks/useConsultationPaymentVerify";
import { PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import { useConsultationPaymentVerify } from "@/hooks/useConsultationPaymentVerify";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import { useToast } from "@/hooks/useToast";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./ConsultationAppointmentOverviewPage.css";

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

function parseVirtualSlotDisplay(
  slotDate: string,
  slotKey: string,
): Readonly<{ dateLine: string; timeLine: string; combined: string }> {
  const timeLabel = slotKey.includes("|") ? slotKey.slice(slotKey.indexOf("|") + 1).trim() : "";
  if (!slotDate?.trim()) {
    return { dateLine: "—", timeLine: timeLabel || "—", combined: timeLabel || "—" };
  }
  const d = new Date(`${slotDate.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const combined = timeLabel ? `${slotDate} | ${timeLabel}` : slotDate;
    return { dateLine: slotDate, timeLine: timeLabel || "—", combined };
  }
  const dateLine = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLine = timeLabel || "—";
  return { dateLine, timeLine, combined: `${dateLine}, ${timeLine}` };
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

const VIRTUAL_SLOTS_META_PREFIX = "opd-mobile-view.virtualSlots.";

function readVirtualIssueTitle(issueId: string): string {
  if (!issueId.trim()) return "";
  try {
    const raw = sessionStorage.getItem(`${VIRTUAL_SLOTS_META_PREFIX}${issueId}`);
    if (!raw) return "";
    const p = JSON.parse(raw) as Partial<{ issueTitle: string }>;
    return typeof p.issueTitle === "string" ? p.issueTitle.trim() : "";
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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentPreviewLoading, setPaymentPreviewLoading] = useState(false);

  const patientLabel = useMemo(
    () => readPrimaryConsultSelectedMemberSnapshot()?.name?.trim() || "Patient",
    [patientBump],
  );

  const slotDisplay = useMemo(
    () => parseVirtualSlotDisplay(virtualSlotDate, virtualSlotKey),
    [virtualSlotDate, virtualSlotKey],
  );

  const navigate = useNavigate();
  const toast = useToast();
  const [purpose, setPurpose] = useState("");
  const [language, setLanguage] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const isFollowUp = Boolean(readVirtualFollowUpAppointmentId());
  const followUpAppointmentId = readVirtualFollowUpAppointmentId();

  const lastVirtualBookingApiResponseRef = useRef<unknown>(null);
  const [paymentSheetModel, setPaymentSheetModel] = useState(
    null as ReturnType<typeof mapOnlineBookPreviewToPaymentSheet>,
  );

  const onPaymentVerifiedRef = useRef<(result?: ConsultationPaymentVerifySuccess) => void>(() => {});
  const onPaymentVerifyErrorRef = useRef<(message: string) => void>(() => {});
  const setBookingBusyRef = useRef<(busy: boolean) => void>(() => {});

  const issueTitle = useMemo(() => readVirtualIssueTitle(issueId), [issueId]);
  const languageLabel = useMemo(
    () =>
      language
        ? (CONSULTATION_LANGUAGES.find((x) => x.value === language)?.label ?? language)
        : "",
    [language],
  );

  const doctorName = isFollowUp ? issueTitle || "Doctor" : "Doctor will be assigned";
  const doctorQualification = isFollowUp ? "" : "";
  const specialityDisplay = isFollowUp ? "" : issueTitle || "Virtual consultation";

  const scheduleForSuccess = useMemo(() => {
    const parsed = parseVirtualBookingSlot(virtualSlotKey);
    if (parsed) return `${parsed.date}, ${parsed.time}`;
    return slotDisplay.combined;
  }, [virtualSlotKey, slotDisplay.combined]);

  const navigateToVirtualBookingSuccess = useMemo(() => {
    return (args: {
      readonly apiRes: unknown;
      readonly paymentRef?: string | null;
      readonly gatewayOrderId?: string | null;
    }) => {
      const infoId = readAppointmentInfoOrderId(args.apiRes, "online");
      const invId = readAppointmentInvoiceIdForOrderDetail(args.apiRes);
      navigate(ROUTES.bookingSuccess, {
        replace: true,
        state: buildVirtualConsultationBookingSuccessState({
          infoOrderId: infoId,
          invoiceIdForOrderDetail: invId,
          bookedForName: patientLabel,
          specialty: issueTitle || "General Physician",
          scheduleDisplay: scheduleForSuccess,
          paymentRef: args.paymentRef,
          gatewayOrderId: args.gatewayOrderId,
        }),
      });
    };
  }, [navigate, patientLabel, issueTitle, scheduleForSuccess]);

  useEffect(() => {
    setBookingBusyRef.current = setBookingLoading;
    onPaymentVerifiedRef.current = (result) => {
      const msg = result?.message?.trim() || "Payment successfully received.";
      toast.success(msg);
      setBookingLoading(false);
      clearVirtualFollowUpAppointmentId();
      const apiRes = lastVirtualBookingApiResponseRef.current;
      lastVirtualBookingApiResponseRef.current = null;
      navigateToVirtualBookingSuccess({
        apiRes,
        paymentRef: result?.paymentId,
        gatewayOrderId: result?.gatewayOrderId,
      });
    };
    onPaymentVerifyErrorRef.current = (message: string) => {
      toast.error(message);
      setBookingLoading(false);
    };
  }, [toast, navigateToVirtualBookingSuccess]);

  useConsultationPaymentVerify({
    onSuccessRef: onPaymentVerifiedRef,
    onErrorRef: onPaymentVerifyErrorRef,
    setBusyRef: setBookingBusyRef,
  });

  useLayoutEffect(() => {
    if (!readVirtualFollowUpAppointmentId()) {
      clearVirtualConsultPurposeOnly();
      setPurpose("");
      try {
        const lang = sessionStorage.getItem(VIRTUAL_CONSULT_LANGUAGE_KEY);
        if (lang && isConsultationLanguageValue(lang)) {
          setLanguage(lang);
        } else {
          setLanguage("");
        }
      } catch {
        setLanguage("");
      }
      return;
    }
    try {
      const p = sessionStorage.getItem(VIRTUAL_CONSULT_PURPOSE_KEY);
      if (p) setPurpose(p);
      const lang = sessionStorage.getItem(VIRTUAL_CONSULT_LANGUAGE_KEY);
      if (lang && isConsultationLanguageValue(lang)) {
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

  useEffect(() => {
    if (!confirmDialogOpen && !paymentSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmDialogOpen, paymentSheetOpen]);

  const patientId = useMemo(() => readConsultSelectedPersonIdNumber(), [patientBump]);
  const slotParsed = useMemo(() => parseVirtualBookingSlot(virtualSlotKey), [virtualSlotKey]);

  const issueIdNum = useMemo(() => {
    const n = Number(issueId);
    return Number.isFinite(n) ? n : Number.NaN;
  }, [issueId]);

  const bookingPayload = useMemo((): BookAppointmentPayload | null => {
    if (!slotParsed || patientId == null || !Number.isFinite(issueIdNum) || !language) return null;
    return {
      date: slotParsed.date,
      time: slotParsed.time,
      language,
      patient_id: patientId,
      issue_id: issueIdNum,
      purpose: purpose.trim(),
      ...(followUpAppointmentId ? { appointment_id: followUpAppointmentId } : {}),
    };
  }, [
    slotParsed,
    patientId,
    issueIdNum,
    language,
    purpose,
    followUpAppointmentId,
  ]);

  const canBookNow = bookingPayload != null;

  const navigateToSuccess = (confirmRes: unknown, bookRes?: unknown) => {
    const messageToShow =
      readAppointmentResponseMessage(confirmRes) ?? readAppointmentResponseMessage(bookRes);
    if (messageToShow) toast.success(messageToShow);
    clearVirtualFollowUpAppointmentId();
    navigateToVirtualBookingSuccess({ apiRes: confirmRes });
  };

  const runBookingPreview = async () => {
    if (!bookingPayload) return;
    setPaymentPreviewLoading(true);
    setPaymentSheetModel(null);
    try {
      const bookRes = await bookAppointment(bookingPayload);
      const model = mapOnlineBookPreviewToPaymentSheet(bookRes);
      if (!model) {
        toast.error("Could not load booking details. Please try again.");
        return;
      }
      setPaymentSheetModel(model);
      setPaymentSheetOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load booking details");
    } finally {
      setPaymentPreviewLoading(false);
    }
  };

  const runBookingConfirm = async () => {
    if (!bookingPayload) return;
    setBookingLoading(true);
    try {
      const confirmRes = await bookAppointmentConfirm(bookingPayload);
      lastVirtualBookingApiResponseRef.current = confirmRes;

      if (!isAppointmentPaymentRequired(confirmRes)) {
        navigateToSuccess(confirmRes);
        return;
      }

      const rzpPayload = readRazorpayPayloadFromAppointmentResponse(confirmRes);
      if (!rzpPayload || Object.keys(rzpPayload).length === 0) {
        toast.error(
          readAppointmentResponseMessage(confirmRes) ?? "Could not start payment",
        );
        return;
      }

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
      toast.error(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  const backToSlots = generatePath(ROUTES.consultationVirtualSlots, { issueId });

  if (!canBookNow && !virtualSlotKey) {
    return (
      <div className="cao-page">
        <header className="cao-top">
          <FlowScreenBack fallbackTo={backToSlots} className="cao-back" />
          <h1 className="cao-title">Confirm Booking</h1>
        </header>
        <main className="cao-main">
          <p className="cao-msg cao-msg--err">Select a slot to continue.</p>
          <button type="button" className="cao-linkback" onClick={() => navigate(-1)}>
            Back to slots
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="cao-page">
      <header className="cao-top">
        <FlowScreenBack fallbackTo={backToSlots} className="cao-back" />
        <h1 className="cao-title">Confirm Booking</h1>
      </header>

      <main className="cao-main">
        <section className="cao-summary" aria-labelledby="vcao-summary-heading">
          <h2 id="vcao-summary-heading" className="cao-summary__title">
            Booking Summary
          </h2>
          <div className="cao-summary__doc">
            <div className="cao-summary__ic cao-summary__ic--virtual" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v9A3.5 3.5 0 0 1 16.5 20h-9A3.5 3.5 0 0 1 4 16.5v-9Z"
                  stroke="#FF541E"
                  strokeWidth="1.75"
                />
                <path
                  d="M9 10.5l2.2 1.5L15 9.5"
                  stroke="#FF541E"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="cao-summary__docmeta">
              <div className="cao-summary__name">{doctorName}</div>
              {doctorQualification ? (
                <div className="cao-summary__deg">{doctorQualification}</div>
              ) : null}
              {specialityDisplay ? (
                <div className="cao-summary__spec">{specialityDisplay}</div>
              ) : null}
              {languageLabel ? (
                <div className="cao-summary__lang">Language: {languageLabel}</div>
              ) : null}
            </div>
          </div>
          <div className="cao-summary__appt">
            <div className="cao-summary__appt-row">
              <span className="cao-summary__appt-pair">
                <span className="cao-summary__meta-ic" aria-hidden="true">
                  <CalendarIcon />
                </span>
                <span>{slotDisplay.dateLine}</span>
              </span>
              <span className="cao-summary__appt-pair">
                <span className="cao-summary__meta-ic" aria-hidden="true">
                  <ClockIcon />
                </span>
                <span>{slotDisplay.timeLine}</span>
              </span>
            </div>
          </div>
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
              <PersonEditIcon />
            </button>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Date and time</div>
          <div className="cao-field__row">
            <div className="cao-field__value">{slotDisplay.combined}</div>
            <button
              type="button"
              className="cao-edit cao-edit--calendar"
              aria-label="Edit date and time"
              onClick={() => setSlotSheetOpen(true)}
            >
              <CalendarEditIcon />
            </button>
          </div>
        </section>

        <section className="cao-purpose" aria-labelledby="vcao-purpose-label">
          <div id="vcao-purpose-label" className="cao-purpose__title">
            Purpose
          </div>
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

        <section className="cao-disc cao-disc--online">
          <div className="cao-disc__head">
            <div className="cao-disc__title">Disclaimer</div>
          </div>
          <ol className="cao-disc__list">
            <li>
              Please double check the details before raising the appointment.
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

      <VirtualOnlineBookingPaymentSheet
        open={paymentSheetOpen}
        onClose={() => {
          if (!bookingLoading) setPaymentSheetOpen(false);
        }}
        model={paymentSheetModel}
        previewLoading={paymentPreviewLoading}
        busy={bookingLoading}
        onProceed={() => {
          setPaymentSheetOpen(false);
          void runBookingConfirm();
        }}
      />

      {confirmDialogOpen ? (
        <div
          className="cao-booking-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="vcao-confirm-title"
          aria-describedby="vcao-confirm-desc"
        >
          <button
            type="button"
            className="cao-booking-confirm__backdrop"
            aria-label="Close"
            onClick={() => setConfirmDialogOpen(false)}
          />
          <div className="cao-booking-confirm__panel">
            <div className="cao-booking-confirm__header">
              <span className="cao-booking-confirm__info" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#FF541E" strokeWidth="2" />
                  <path d="M12 8v5" stroke="#FF541E" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="7" r="1" fill="#FF541E" />
                </svg>
              </span>
              <h2 id="vcao-confirm-title" className="cao-booking-confirm__title">
                Confirm Booking
              </h2>
            </div>
            <div className="cao-booking-confirm__body">
              <p id="vcao-confirm-desc" className="cao-booking-confirm__message">
                Are you sure you want to book this appointment?
              </p>
            </div>
            <div className="cao-booking-confirm__actions">
              <button
                type="button"
                className="cao-booking-confirm__btn cao-booking-confirm__btn--no"
                onClick={() => setConfirmDialogOpen(false)}
              >
                Go Back
              </button>
              <button
                type="button"
                className="cao-booking-confirm__btn cao-booking-confirm__btn--yes"
                disabled={bookingLoading || paymentPreviewLoading}
                onClick={() => {
                  setConfirmDialogOpen(false);
                  void runBookingPreview();
                }}
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="cao-footer">
        <button
          type="button"
          className="cao-confirm"
          disabled={!canBookNow || bookingLoading || paymentPreviewLoading}
          onClick={() => {
            if (!canBookNow || bookingLoading) return;
            setConfirmDialogOpen(true);
          }}
        >
          {bookingLoading || paymentPreviewLoading ? "Please wait…" : "Confirm Booking"}
        </button>
      </footer>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <rect x="3" y="6" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 11h18" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function PersonEditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="#ff541e" strokeWidth="1.75" />
      <path
        d="M6 19.5c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="#ff541e"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarEditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="#ff541e" strokeWidth="1.75" />
      <path d="M12 8v5l3 2" stroke="#ff541e" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
