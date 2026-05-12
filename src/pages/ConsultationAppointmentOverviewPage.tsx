import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { networkBookAppointment } from "@/api/appointmentNetworkBook";
import {
  readAppointmentInfoOrderId,
  readAppointmentInvoiceIdForOrderDetail,
} from "@/api/appointmentBook";
import { buildInlineConsultationBookingSuccessState } from "@/lib/bookingSuccessFromInvoice";
import { SelectPeopleBottomSheet } from "@/components/select-people/SelectPeopleBottomSheet";
import { HospitalAppointmentSlotBottomSheet } from "@/components/consultation/HospitalAppointmentSlotBottomSheet";
import { ROUTES } from "@/constants";
import {
  readPrimaryConsultSelectedMemberSnapshot,
  readConsultSelectedPersonIdNumber,
} from "@/constants/consultationSelectedMemberStorage";
import { readHospitalSpecialtyName } from "@/constants/hospitalConsultationStorage";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import { useToast } from "@/hooks/useToast";
import { useMemo, useState } from "react";
import consultationAtHospitalSvg from "@/assets/icons/common/ConsultationAtHospital.svg";
import "./ConsultationAppointmentOverviewPage.css";

function parseTimeSlotDisplay(
  timeSlotApi: string,
  slotLabelFallback: string,
): { dateLine: string; timeLine: string; combined: string } {
  const t = timeSlotApi.trim();
  const re = /^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/;
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

  const [submitting, setSubmitting] = useState(false);
  const [patientBump, setPatientBump] = useState(0);
  const [hospitalSlotBump, setHospitalSlotBump] = useState(0);
  const [patientSheetOpen, setPatientSheetOpen] = useState(false);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [purpose, setPurpose] = useState("");

  const doctorName = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.doctorName") ?? "Doctor";
    } catch {
      return "Doctor";
    }
  }, [hospitalSlotBump]);

  const networkName = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.networkName")?.trim() ?? "";
    } catch {
      return "";
    }
  }, [hospitalSlotBump]);

  const doctorQualification = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.doctorQualification")?.trim() ?? "";
    } catch {
      return "";
    }
  }, [hospitalSlotBump]);

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

  const onConfirm = async () => {
    const addr = readSelectedAddress();
    const patientId = readConsultSelectedPersonIdNumber();
    const specialityNum = Number(specialtyId);

    if (!networkId.trim() || !doctorId.trim()) {
      toast.error("Missing network or doctor.");
      return;
    }
    if (!addr?.id?.trim()) {
      toast.error("Please choose a home address from the location picker.");
      return;
    }
    if (patientId == null) {
      toast.error("Please select a patient from the consultation flow.");
      return;
    }
    if (!timeSlotApi) {
      toast.error("Missing appointment time. Go back and pick a slot again.");
      return;
    }
    if (!Number.isFinite(specialityNum)) {
      toast.error("Invalid specialty.");
      return;
    }

    setSubmitting(true);
    try {
      const bookRes = await networkBookAppointment({
        doctor_id: String(doctorId),
        network_id: networkId.trim(),
        time_slot: timeSlotApi,
        speciality_id: specialityNum,
        address_id: addr.id.trim(),
        patient_id: patientId,
      });
      const infoId = readAppointmentInfoOrderId(bookRes, "offline");
      const invId = readAppointmentInvoiceIdForOrderDetail(bookRes);
      const tag = addr.tag?.trim() || "Home";
      const head =
        networkName.trim() && doctorName.trim()
          ? `${doctorName.trim()} · ${networkName.trim()}`
          : doctorName.trim() || networkName.trim();
      const locationLines = [head, `${tag}\n${addr.displayLine}`].filter((s) => s.trim().length > 0).join("\n");
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not book appointment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cao-page">
      <header className="cao-top">
        <Link
          to={generatePath(ROUTES.consultationHospitalSlots, {
            specialtyId,
            networkId,
            doctorId,
          })}
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
              <div className="cao-summary__deg">{doctorQualification || "—"}</div>
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

      <footer className="cao-footer">
        <button
          type="button"
          className="cao-confirm"
          disabled={submitting}
          onClick={() => void onConfirm()}
        >
          {submitting ? "Booking…" : "Confirm Booking"}
        </button>
      </footer>
    </div>
  );
}
