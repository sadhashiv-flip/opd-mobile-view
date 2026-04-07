import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { networkBookAppointment } from "@/api/appointmentNetworkBook";
import { ROUTES } from "@/constants";
import {
  readPrimaryConsultSelectedMemberSnapshot,
  readConsultSelectedPersonIdNumber,
} from "@/constants/consultationSelectedMemberStorage";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import { useToast } from "@/hooks/useToast";
import { useMemo, useState } from "react";
import "./ConsultationAppointmentOverviewPage.css";

export function ConsultationAppointmentOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";
  const networkId = typeof params.networkId === "string" ? params.networkId : "";
  const doctorId = typeof params.doctorId === "string" ? params.doctorId : "";

  const [submitting, setSubmitting] = useState(false);

  const doctorName = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.doctorName") ?? "Doctor";
    } catch {
      return "Doctor";
    }
  }, []);

  const patientLabel = useMemo(() => {
    return readPrimaryConsultSelectedMemberSnapshot()?.name?.trim() || "Patient";
  }, []);

  const slotLabel = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.slotLabel") ?? "";
    } catch {
      return "";
    }
  }, []);

  const dateLabel = useMemo(() => {
    try {
      return (
        localStorage.getItem("opd-mobile-view.consultation.dayLabel") ??
        localStorage.getItem("opd-mobile-view.consultation.dateLabel") ??
        ""
      );
    } catch {
      return "";
    }
  }, []);

  const timeSlotApi = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.consultation.timeSlot")?.trim() ?? "";
    } catch {
      return "";
    }
  }, []);

  const addressLine = useMemo(() => readSelectedAddress()?.displayLine ?? "", []);

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
      await networkBookAppointment({
        doctor_id: String(doctorId),
        network_id: networkId.trim(),
        time_slot: timeSlotApi,
        speciality_id: specialityNum,
        address_id: addr.id.trim(),
        patient_id: patientId,
      });
      navigate(ROUTES.consultationHospitalBookingSuccess);
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
        <h1 className="cao-title">Book Appointment</h1>
      </header>

      <main className="cao-main">
        <section className="cao-doc">
          <div className="cao-doc__top">
            <div className="cao-doc__avatar" aria-hidden="true" />
            <div className="cao-doc__meta">
              <div className="cao-doc__name">{doctorName}</div>
              <div className="cao-doc__sub">MBBS, MD</div>
            </div>
            <div className="cao-chip">Cashless Available</div>
          </div>
          <div className="cao-tags">
            <span className="cao-tag">10+ years exp</span>
            <span className="cao-tag cao-tag--pill">Yashoda Hospital</span>
          </div>
        </section>

        <section className="cao-fees">
          <div className="cao-fees__row">
            <span>Doctor&apos;s Fee</span>
            <strong>₹ 600</strong>
          </div>
          <div className="cao-fees__row cao-fees__row--total">
            <span>Total Amount</span>
            <strong>₹ 600</strong>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Patient</div>
          <div className="cao-field__row">
            <div className="cao-field__value">{patientLabel}</div>
            <button type="button" className="cao-edit" aria-label="Edit patient">
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
            <div className="cao-field__value">
              {dateLabel || "—"} | {slotLabel || "—"}
            </div>
            <button type="button" className="cao-edit" aria-label="Edit date and time">
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

        {addressLine ? (
          <section className="cao-field">
            <div className="cao-field__label">Address</div>
            <div className="cao-field__value cao-field__value--multiline">{addressLine}</div>
          </section>
        ) : null}

        <section className="cao-disc">
          <div className="cao-disc__title">Disclaimer</div>
          <ol className="cao-disc__list">
            <li>
              The Fees and Timings are tentative and may subject to change at the time of consultation
            </li>
            <li>
              Registration fee charged by Clinic or Hospital are not covered under OPD insurance and has to be borne by the insured
            </li>
          </ol>
        </section>
      </main>

      <footer className="cao-footer">
        <button
          type="button"
          className="cao-confirm"
          disabled={submitting}
          onClick={() => void onConfirm()}
        >
          {submitting ? "Booking…" : "Confirm"}
        </button>
      </footer>
    </div>
  );
}
