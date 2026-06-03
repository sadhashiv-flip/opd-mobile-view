import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { clearHospitalConsultationOverviewStep } from "@/lib/bookingFlowStackCleanup";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import {
  isVendorNetworkBookPayload,
  networkBookAppointmentConfirm,
  networkBookAppointmentPreview,
  type NetworkBookAppointmentPayload,
} from "@/api/appointmentNetworkBook";
import { mapNetworkBookPreviewToPaymentSheet } from "@/api/networkOfflineBookingPayment";
import {
  isAppointmentPaymentRequired,
  readAppointmentInfoOrderId,
  readAppointmentInvoiceIdForOrderDetail,
  readAppointmentResponseMessage,
  readRazorpayPayloadFromAppointmentResponse,
} from "@/api/appointmentBook";
import { VirtualOnlineBookingPaymentSheet } from "@/components/consultation/VirtualOnlineBookingPaymentSheet";
import type { VirtualOnlinePaymentSheetModel } from "@/api/virtualOnlineBookingPayment";
import {
  clearHospitalVendorBookingContext,
  readHospitalVendorBookingContext,
} from "@/constants/consultationBookingStorage";
import { buildInlineConsultationBookingSuccessState } from "@/lib/bookingSuccessFromInvoice";
import type { ConsultationPaymentVerifySuccess } from "@/hooks/useConsultationPaymentVerify";
import { useConsultationPaymentVerify } from "@/hooks/useConsultationPaymentVerify";
import { PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import { SelectPeopleBottomSheet } from "@/components/select-people/SelectPeopleBottomSheet";
import { HospitalAppointmentSlotBottomSheet } from "@/components/consultation/HospitalAppointmentSlotBottomSheet";
import { ROUTES } from "@/constants";
import {
  readPrimaryConsultSelectedMemberSnapshot,
  readConsultSelectedPersonIdNumber,
} from "@/constants/consultationSelectedMemberStorage";
import { readHospitalSpecialtyName } from "@/constants/hospitalConsultationStorage";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import { readHospitalConsultationSummaryDisplay } from "@/lib/hospitalConsultationSummary";
import { useToast } from "@/hooks/useToast";
import { useEffect, useMemo, useRef, useState } from "react";
import consultationAtHospitalSvg from "@/assets/icons/common/ConsultationAtHospital.svg";
import "./ConsultationAppointmentOverviewPage.css";

function parseTimeSlotDisplay(
  timeSlotApi: string,
  slotLabelFallback: string,
): { dateLine: string; timeLine: string; combined: string } {
  const t = timeSlotApi.trim();
  const re = /^(\d{4})-(\d{2})-(\d{2})[\s,]+(.+)$/;
  const m = re.exec(t);
  if (!m) {
    const fb = slotLabelFallback.trim();
    return {
      dateLine: "—",
      timeLine: fb || "—",
      combined: fb || "—",
    };
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  const dateLine = dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLine = m[4].trim();
  return {
    dateLine,
    timeLine,
    combined: `${dateLine}, ${timeLine}`,
  };
}

export function ConsultationAppointmentOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";
  const networkId = typeof params.networkId === "string" ? params.networkId : "";
  const doctorId = typeof params.doctorId === "string" ? params.doctorId : "";

  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentPreviewLoading, setPaymentPreviewLoading] = useState(false);
  const [patientBump, setPatientBump] = useState(0);
  const [hospitalSlotBump, setHospitalSlotBump] = useState(0);
  const [patientSheetOpen, setPatientSheetOpen] = useState(false);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentSheetModel, setPaymentSheetModel] = useState(
    null as VirtualOnlinePaymentSheetModel | null,
  );

  const pendingBookPayloadRef = useRef<NetworkBookAppointmentPayload | null>(null);
  const pendingSuccessContextRef = useRef<{
    addrDisplayLine: string;
    addrTag: string;
  } | null>(null);
  const lastHospitalBookingApiResponseRef = useRef<unknown>(null);

  const onPaymentVerifiedRef = useRef<(result?: ConsultationPaymentVerifySuccess) => void>(() => {});
  const onPaymentVerifyErrorRef = useRef<(message: string) => void>(() => {});
  const setBookingBusyRef = useRef<(busy: boolean) => void>(() => {});

  const { doctorName, doctorQualification, networkName } = useMemo(
    () => readHospitalConsultationSummaryDisplay(),
    [hospitalSlotBump],
  );

  const patientLabel = useMemo(
    () => readPrimaryConsultSelectedMemberSnapshot()?.name?.trim() || "Patient",
    [patientBump],
  );

  const slotLabel = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.slotLabel") ?? "";
    } catch {
      return "";
    }
  }, [hospitalSlotBump]);

  const timeSlotApi = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.timeSlot")?.trim() ?? "";
    } catch {
      return "";
    }
  }, [hospitalSlotBump]);

  const slotDisplay = useMemo(
    () => parseTimeSlotDisplay(timeSlotApi, slotLabel),
    [timeSlotApi, slotLabel],
  );

  const specialtyLabel = useMemo(() => {
    const fromSession = readHospitalSpecialtyName(specialtyId);
    if (fromSession) return fromSession;
    const map: Record<string, string> = {
      gp: "General Physician",
      diet: "Dietician",
      derm: "Dermatologist",
      pulm: "Pulmonologist",
      card: "Cardiologist",
      dent: "Dentist",
    };
    return map[specialtyId] ?? "Speciality";
  }, [specialtyId]);

  const navigateToHospitalBookingSuccess = useMemo(() => {
    return (apiRes: unknown) => {
      const ctx = pendingSuccessContextRef.current;
      const infoId = readAppointmentInfoOrderId(apiRes, "offline");
      const invId = readAppointmentInvoiceIdForOrderDetail(apiRes);
      const tag = ctx?.addrTag?.trim() || "Home";
      const head =
        networkName.trim() && doctorName.trim()
          ? `${doctorName.trim()} · ${networkName.trim()}`
          : doctorName.trim() || networkName.trim();
      const locationLines = [head, `${tag}\n${ctx?.addrDisplayLine ?? ""}`]
        .filter((s) => s.trim().length > 0)
        .join("\n");
      navigate(ROUTES.consultationHospitalBookingSuccess, {
        replace: true,
        state: buildInlineConsultationBookingSuccessState({
          infoOrderId: infoId,
          invoiceIdForOrderDetail: invId,
          bookedForName: patientLabel,
          serviceLine: specialtyLabel,
          locationValue: locationLines.length > 0 ? locationLines : "—",
          scheduleDisplay: slotDisplay.combined,
        }),
      });
    };
  }, [navigate, patientLabel, specialtyLabel, slotDisplay.combined, networkName, doctorName]);

  useEffect(() => {
    setBookingBusyRef.current = setBookingLoading;
    onPaymentVerifiedRef.current = (result) => {
      const msg = result?.message?.trim() || "Payment successfully received.";
      toast.success(msg);
      setBookingLoading(false);
      const apiRes = lastHospitalBookingApiResponseRef.current;
      const payload = pendingBookPayloadRef.current;
      lastHospitalBookingApiResponseRef.current = null;
      pendingBookPayloadRef.current = null;
      if (payload && isVendorNetworkBookPayload(payload)) {
        clearHospitalVendorBookingContext();
      }
      if (apiRes) navigateToHospitalBookingSuccess(apiRes);
    };
    onPaymentVerifyErrorRef.current = (message: string) => {
      toast.error(message);
      setBookingLoading(false);
    };
  }, [toast, navigateToHospitalBookingSuccess]);

  useConsultationPaymentVerify({
    onSuccessRef: onPaymentVerifiedRef,
    onErrorRef: onPaymentVerifyErrorRef,
    setBusyRef: setBookingBusyRef,
  });

  useEffect(() => {
    if (!confirmDialogOpen && !paymentSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmDialogOpen, paymentSheetOpen]);

  const buildBookPayload = (): NetworkBookAppointmentPayload | null => {
    const addr = readSelectedAddress();
    const patientId = readConsultSelectedPersonIdNumber();
    const specialityNum = Number(specialtyId);

    if (!networkId.trim() || !doctorId.trim()) {
      toast.error("Missing network or doctor.");
      return null;
    }
    if (!addr?.id?.trim()) {
      toast.error("Please choose a home address from the location picker.");
      return null;
    }
    if (patientId == null) {
      toast.error("Please select a patient from the consultation flow.");
      return null;
    }
    if (!timeSlotApi) {
      toast.error("Missing appointment time. Go back and pick a slot again.");
      return null;
    }
    if (!Number.isFinite(specialityNum)) {
      toast.error("Invalid specialty.");
      return null;
    }

    let isVendorOffline = false;
    try {
      isVendorOffline = localStorage.getItem("opd-mobile-view.consultation.isVendorOffline") === "1";
    } catch {
      // ignore
    }
    const vendorCtx = isVendorOffline ? readHospitalVendorBookingContext() : null;
    let vendorSlotId = "";
    try {
      vendorSlotId =
        localStorage.getItem("opd-mobile-view.consultation.vendorSlotId")?.trim() ??
        localStorage.getItem("opd-mobile-view.consultation.slotId")?.trim() ??
        "";
    } catch {
      // ignore
    }

    if (isVendorOffline) {
      if (!vendorCtx) {
        toast.error("Vendor booking details expired. Please pick the doctor again.");
        return null;
      }
      if (!vendorSlotId) {
        toast.error("Please select a slot again.");
        return null;
      }
    }

    pendingSuccessContextRef.current = {
      addrDisplayLine: addr.displayLine,
      addrTag: addr.tag?.trim() || "Home",
    };

    let bookPayload: NetworkBookAppointmentPayload;
    if (isVendorOffline && vendorCtx) {
        const practiceId = vendorCtx.practiceId || networkId.trim();
        const resolvedNetworkId = networkId.trim() || practiceId;
        const addrParsed = Number(addr.id.trim());
        bookPayload = {
          patient_id: patientId,
          speciality_id: specialityNum,
          address_id: Number.isFinite(addrParsed) ? addrParsed : addr.id.trim(),
          time_slot: timeSlotApi,
          vendor_code: vendorCtx.vendorMeta.source,
          network_id: resolvedNetworkId,
          doctor_id: String(doctorId),
          slot_id: vendorSlotId,
          vendor_meta: {
            source: vendorCtx.vendorMeta.source,
            practice_id: practiceId,
            doctor_id: String(doctorId),
            consultation_price: vendorCtx.vendorMeta.price,
            network: {
              name: vendorCtx.network.name,
              display_address: vendorCtx.network.displayAddress,
              coordinates: vendorCtx.network.coordinates,
            },
            doctor: {
              name: vendorCtx.doctor.name,
              gender: vendorCtx.doctor.gender,
              qualification: vendorCtx.doctor.qualification,
            },
          },
        };
    } else {
      bookPayload = {
        doctor_id: String(doctorId),
        network_id: networkId.trim(),
        time_slot: timeSlotApi,
        speciality_id: specialityNum,
        address_id: addr.id.trim(),
        patient_id: patientId,
      };
    }

    return bookPayload;
  };

  /** patient_app `previewOfflineBooking` — `network_book` without confirm. */
  const runHospitalBookingPreview = async () => {
    const bookPayload = buildBookPayload();
    if (!bookPayload) return;
    setPaymentPreviewLoading(true);
    setPaymentSheetModel(null);
    pendingBookPayloadRef.current = bookPayload;
    try {
      const previewRes = await networkBookAppointmentPreview(bookPayload);
      const model = mapNetworkBookPreviewToPaymentSheet(previewRes);
      if (!model) {
        pendingBookPayloadRef.current = null;
        toast.error("Could not load booking details. Please try again.");
        return;
      }
      setPaymentSheetModel(model);
      setPaymentSheetOpen(true);
    } catch (e: unknown) {
      pendingBookPayloadRef.current = null;
      toast.error(e instanceof Error ? e.message : "Could not load booking details");
    } finally {
      setPaymentPreviewLoading(false);
    }
  };

  /** patient_app `confirmOfflineBookingPayment` — `network_book?status=confirm`. */
  const runHospitalBookingConfirm = async () => {
    const bookPayload = pendingBookPayloadRef.current;
    if (!bookPayload) {
      toast.error("Booking session expired. Please try again.");
      return;
    }
    setBookingLoading(true);
    try {
      const confirmRes = await networkBookAppointmentConfirm(bookPayload);
      lastHospitalBookingApiResponseRef.current = confirmRes;

      const messageToShow = readAppointmentResponseMessage(confirmRes);
      if (messageToShow) toast.success(messageToShow);

      if (!isAppointmentPaymentRequired(confirmRes)) {
        if (isVendorNetworkBookPayload(bookPayload)) {
          clearHospitalVendorBookingContext();
        }
        pendingBookPayloadRef.current = null;
        navigateToHospitalBookingSuccess(confirmRes);
        return;
      }

      const rzpPayload = readRazorpayPayloadFromAppointmentResponse(confirmRes);
      if (!rzpPayload || Object.keys(rzpPayload).length === 0) {
        toast.error(messageToShow ?? "Could not start payment");
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="cao-page">
      <header className="cao-top">
        <FlowScreenBack
          fallbackTo={generatePath(ROUTES.consultationHospitalSlots, {
            specialtyId,
            networkId,
            doctorId,
          })}
          className="app-back-btn cao-back"
          onBeforeBack={clearHospitalConsultationOverviewStep}
        />
        <h1 className="cao-title">Confirm Booking</h1>
      </header>

      <main className="cao-main">
        <section className="cao-summary" aria-labelledby="cao-summary-heading">
          <h2 id="cao-summary-heading" className="cao-summary__title">
            Booking Summary
          </h2>
          <div className="cao-summary__doc">
            <div className="cao-summary__ic" aria-hidden="true">
              <img
                src={consultationAtHospitalSvg}
                alt=""
                width={24}
                height={24}
                className="cao-summary__ic-img"
                draggable={false}
              />
            </div>
            <div className="cao-summary__docmeta">
              <div className="cao-summary__name">{doctorName}</div>
              {doctorQualification ? (
                <div className="cao-summary__deg">{doctorQualification}</div>
              ) : null}
              <div className="cao-summary__spec">{specialtyLabel}</div>
            </div>
          </div>
          <div className="cao-summary__appt">
            <div className="cao-summary__appt-row">
              <span className="cao-summary__appt-pair">
                <span className="cao-summary__meta-ic" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 3v3M16 3v3"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                    <rect
                      x="3"
                      y="6"
                      width="18"
                      height="15"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    />
                    <path d="M3 11h18" stroke="currentColor" strokeWidth="1.75" />
                  </svg>
                </span>
                <span>{slotDisplay.dateLine}</span>
              </span>
              <span className="cao-summary__appt-pair">
                <span className="cao-summary__meta-ic" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </span>
                <span>{slotDisplay.timeLine}</span>
              </span>
            </div>
            {networkName ? (
              <div className="cao-summary__appt-row cao-summary__appt-row--hosp">
                <span className="cao-summary__hosp-ic" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="4" width="16" height="16" rx="3" fill="#757575" />
                    <path
                      d="M12 8v8M8 12h8"
                      stroke="#ffffff"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="cao-summary__hosp-name">{networkName}</span>
              </div>
            ) : null}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="9" r="3.5" stroke="#ff541e" strokeWidth="1.75" />
                <path
                  d="M6 19.5c0-3.3 2.7-6 6-6s6 2.7 6 6"
                  stroke="#ff541e"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Date and time</div>
          <div className="cao-field__row">
            <div className="cao-field__value">{slotDisplay.combined}</div>
            <button
              type="button"
              className="cao-edit"
              aria-label="Edit date and time"
              onClick={() => setSlotSheetOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="8" stroke="#ff541e" strokeWidth="1.75" />
                <path d="M12 8v5l3 2" stroke="#ff541e" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </section>

        <section className="cao-purpose" aria-labelledby="cao-purpose-label">
          <div id="cao-purpose-label" className="cao-purpose__title">
            Purpose (Optional)
          </div>
          <textarea
            className="cao-textarea"
            placeholder="Briefly describe the reason for your visit"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={4}
            maxLength={500}
          />
        </section>

        <section className="cao-disc">
          <div className="cao-disc__head">
            <div className="cao-disc__title">Disclaimer</div>
            <ol className="cao-disc__list">
            <li>
              The Fees and Timings are tentative and may subject to change at the time of consultation
            </li>
            <li>
              Registration fee charged by Clinic or Hospital are not covered under OPD Service/Wallet and has to be borne by the user
            </li>
            </ol>
          </div>
        </section>
      </main>

      <SelectPeopleBottomSheet
        open={patientSheetOpen}
        onClose={() => setPatientSheetOpen(false)}
        onApplied={() => setPatientBump((n) => n + 1)}
      />
      <HospitalAppointmentSlotBottomSheet
        open={slotSheetOpen}
        onClose={() => setSlotSheetOpen(false)}
        networkId={networkId}
        doctorId={doctorId}
        onApplied={() => setHospitalSlotBump((n) => n + 1)}
      />

      {confirmDialogOpen ? (
        <div
          className="cao-booking-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="hcao-confirm-title"
          aria-describedby="hcao-confirm-desc"
        >
          <button
            type="button"
            className="cao-booking-confirm__backdrop"
            aria-label="Cancel"
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
              <h2 id="hcao-confirm-title" className="cao-booking-confirm__title">
                Confirm booking
              </h2>
            </div>
            <div className="cao-booking-confirm__body">
              <p id="hcao-confirm-desc" className="cao-booking-confirm__message">
                Are you sure you want to confirm this appointment? Fees and timings shown are tentative
                and may change at the clinic.
              </p>
            </div>
            <div className="cao-booking-confirm__actions">
              <button
                type="button"
                className="cao-booking-confirm__btn cao-booking-confirm__btn--no"
                onClick={() => setConfirmDialogOpen(false)}
              >
                Go back
              </button>
              <button
                type="button"
                className="cao-booking-confirm__btn cao-booking-confirm__btn--yes"
                disabled={paymentPreviewLoading || bookingLoading}
                onClick={() => {
                  setConfirmDialogOpen(false);
                  void runHospitalBookingPreview();
                }}
              >
                {paymentPreviewLoading ? "Loading…" : "Book now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <VirtualOnlineBookingPaymentSheet
        open={paymentSheetOpen}
        onClose={() => {
          if (!bookingLoading) {
            setPaymentSheetOpen(false);
            setPaymentSheetModel(null);
          }
        }}
        model={paymentSheetModel}
        previewLoading={paymentPreviewLoading}
        busy={bookingLoading}
        onProceed={() => {
          setPaymentSheetOpen(false);
          void runHospitalBookingConfirm();
        }}
      />

      <footer className="cao-footer">
        <button
          type="button"
          className="cao-confirm"
          disabled={bookingLoading || paymentPreviewLoading}
          onClick={() => {
            if (bookingLoading || paymentPreviewLoading) return;
            setConfirmDialogOpen(true);
          }}
        >
          {bookingLoading || paymentPreviewLoading ? "Please wait…" : "Confirm Booking"}
        </button>
      </footer>
    </div>
  );
}
