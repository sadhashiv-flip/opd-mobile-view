import { ROUTES } from "@/constants";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import {
  clearVaccinationFlowState,
  readVaccinationFlowState,
  writeVaccinationFlowState,
  type VaccinationFlowState,
} from "@/constants/vaccinationFlowStorage";
import { postVaccineServiceRequest } from "@/api/vaccineService";
import { buildServiceBookingSuccessState } from "@/constants/bookingSuccessNavigation";
import { parseServiceBookingResponse } from "@/lib/serviceBookingResponse";
import { fetchPatientProfile } from "@/api/patientProfile";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { VaccinationServiceIcon } from "@/components/vaccination/VaccinationServiceIcon";
import { VaccinationSlotBottomSheet } from "@/components/vaccination/VaccinationSlotBottomSheet";
import { formatVaccineSlotDisplay } from "@/components/vaccination/VaccinationSlotPicker";
import { getAccessToken } from "@/lib/authStorage";
import { useToast } from "@/hooks/useToast";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import "./HealthCheckupsOverviewPage.css";
import "./VaccinationOverviewPage.css";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function VaccinationOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [flow, setFlow] = useState<VaccinationFlowState | null>(() => readVaccinationFlowState());
  const [altPhone, setAltPhone] = useState("");
  const [conditions, setConditions] = useState("");
  const [note, setNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(null);

  useEffect(() => {
    const s = readVaccinationFlowState();
    setFlow(s);
    if (!s?.memberId || !Number.isFinite(s.userId)) {
      void navigate(ROUTES.vaccinationSelectPeople, { replace: true });
      return;
    }
    if (!s.selectedServices?.length) {
      void navigate(ROUTES.vaccinationChooseType, { replace: true });
      return;
    }
    if (!s.preferredDateTime?.trim()) {
      void navigate(ROUTES.vaccinationSlots, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    void (async () => {
      try {
        const p = await fetchPatientProfile();
        setPrimaryPhone(p.phone);
      } catch {
        setPrimaryPhone(null);
      }
    })();
  }, []);

  const onConfirmPay = useCallback(async () => {
    const addr = readSelectedAddress();
    if (!addr?.id) {
      toast.error("Choose a delivery address.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    const cur = readVaccinationFlowState();
    if (!cur?.preferredDateTime) return;
    if (!Number.isFinite(cur.userId)) {
      toast.error("Missing member for booking. Go back and select a family member again.");
      return;
    }

    setBusy(true);
    try {
      const response = await postVaccineServiceRequest({
        address_id: addr.id,
        preferred_date_time: cur.preferredDateTime,
        request: cur.selectedServices.map((s) => s.id),
        alternate_phone: digitsOnly(altPhone) || digitsOnly(primaryPhone ?? "") || "",
        conditions: (conditions ?? "").trim() || "No conditions",
        note: (note ?? "").trim() || "Notes here",
        user_id: cur.userId,
        language: "English",
      });
      const { invoiceId, orderId, message } = parseServiceBookingResponse(response);
      const vaccineLabel =
        cur.selectedServices
          .map((s) => s.name.trim())
          .filter((n) => n.length > 0)
          .join(", ") || "Vaccination";
      const successState = buildServiceBookingSuccessState({
        kind: "vaccine",
        memberName: cur.memberName,
        bookingTypeLabel: vaccineLabel,
        locationLabel: "Address",
        locationValue: addr.displayLine?.trim() || "—",
        schedule: formatVaccineSlotDisplay(cur.preferredDateTime),
        invoiceId: invoiceId || undefined,
        orderId: orderId || undefined,
        message: message || undefined,
      });
      clearVaccinationFlowState();
      void navigate(ROUTES.bookingSuccess, { replace: true, state: successState });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit booking");
    } finally {
      setBusy(false);
    }
  }, [altPhone, conditions, note, primaryPhone, toast, navigate]);

  const displayPhone = primaryPhone ?? "—";

  if (!flow?.preferredDateTime) {
    return null;
  }

  return (
    <div className="hco-page vac-overview">
      <header className="hco-top">
        <Link to={ROUTES.vaccinationSlots} className="hco-back" aria-label="Back">
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
        <h1 className="hco-title">Vaccine Overview</h1>
        <span className="hco-top__balance" aria-hidden />
      </header>

      <main className="hco-main">
        <VaccinationAddressBar />

        <div className="hco-main__content">
          <div className="hco-subhead">
            <span className="hco-subhead__title">
              Vaccine Types ({flow.selectedServices.length})
            </span>
          </div>

          <ul className="vac-overview__vlist">
            {flow.selectedServices.map((s) => (
              <li key={s.id} className="vac-overview__vrow">
                <span className="vac-overview__vic" aria-hidden>
                  <VaccinationServiceIcon accent size={20} />
                </span>
                <span>{s.name}</span>
              </li>
            ))}
          </ul>

          <p className="vac-overview__for">For {flow.memberName}</p>

          <section className="hco-block">
            <div className="hco-label">Phone number: {displayPhone}</div>
            <div className="hco-help">Booking related updates will be sent on this number</div>
          </section>

          <section className="hco-block">
            <div className="hco-label">Alternate Phone number</div>
            <div className="hco-alt">
              <span className="hco-alt__cc">+91</span>
              <input
                className="hco-alt__input"
                placeholder="Enter your alternate number here"
                inputMode="numeric"
                autoComplete="tel"
                value={altPhone}
                onChange={(e) => setAltPhone(e.target.value)}
              />
            </div>
          </section>

          <section className="hco-block">
            <div className="hco-label">Date and time</div>
            <div className="hco-dt">
              <span className="hco-dt__value">{formatVaccineSlotDisplay(flow.preferredDateTime)}</span>
              <button
                type="button"
                className="hco-dt__edit"
                aria-label="Edit date and time"
                onClick={() => setSheetOpen(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

          <section className="hco-block">
            <div className="hco-label">Conditions</div>
            <textarea
              className="vac-overview__textarea"
              placeholder="Enter your conditions here"
              rows={2}
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
            />
          </section>

          <section className="hco-block">
            <div className="hco-label">Notes</div>
            <textarea
              className="vac-overview__textarea"
              rows={2}
              placeholder="Enter your notes here"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </section>

          <section className="hco-totals">
            <div className="hco-totals__row">
              <span className="hco-totals__k">Total MRP</span>
              <span className="hco-totals__v">₹ 0</span>
            </div>
            <div className="hco-totals__row hco-totals__muted">
              <span className="hco-totals__k">From Wallet</span>
              <span className="hco-totals__v">₹ 0</span>
            </div>
            <div className="hco-totals__row hco-totals__strong">
              <span className="hco-totals__k">Net Pay</span>
              <span className="hco-totals__v">₹ 0</span>
            </div>
          </section>

          <div className="hco-remarks vac-overview__remarks">
            <div className="hco-remarks__k">Remarks</div>
            <div className="hco-remarks__v">Order cannot be cancelled once confirmed</div>
          </div>
        </div>

        <footer className="vac-overview__foot">
          <button
            type="button"
            className="vac-overview__pay"
            disabled={busy}
            onClick={() => void onConfirmPay()}
          >
            {busy ? "Submitting…" : "Confirm and pay"}
          </button>
        </footer>
      </main>

      <VaccinationSlotBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        preferredDateTime={flow.preferredDateTime}
        onApplied={(next) => {
          const cur = readVaccinationFlowState();
          if (!cur) return;
          const merged = { ...cur, preferredDateTime: next };
          writeVaccinationFlowState(merged);
          setFlow(merged);
        }}
      />
    </div>
  );
}
