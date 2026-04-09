import { ROUTES } from "@/constants";
import {
  readDentalPreferredDateTime,
  readDentalSelectedClinicRaw,
} from "@/constants/dentalBookingStorage";
import { readDiagnosticsSelectedMembersSnapshots } from "@/constants/diagnosticsSelectedMemberStorage";
import type { DentalNetworkClinicRow } from "@/api/networkList";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { formatVaccineSlotDisplay } from "@/components/vaccination/VaccinationSlotPicker";
import { fetchPatientProfile } from "@/api/patientProfile";
import { useToast } from "@/hooks/useToast";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./VaccinationOverviewPage.css";
import "./DentalOverviewPage.css";

const DENTAL_SERVICE_NAME = "Dental Comprehensive Checkup";

function parseDentalClinic(raw: string | null): DentalNetworkClinicRow | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as DentalNetworkClinicRow;
  } catch {
    return null;
  }
}

export function DentalOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [altPhone, setAltPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(null);

  const clinic = useMemo(() => parseDentalClinic(readDentalSelectedClinicRaw()), []);
  const preferredDateTime = useMemo(() => readDentalPreferredDateTime(), []);
  const member = useMemo(() => readDiagnosticsSelectedMembersSnapshots()[0] ?? null, []);

  useEffect(() => {
    if (!member) {
      toast.error("Select a member first.");
      void navigate(ROUTES.dentalSelectPeople, { replace: true });
      return;
    }
    if (!clinic) {
      toast.error("Select a clinic first.");
      void navigate(ROUTES.dentalNetworkList, { replace: true });
      return;
    }
    if (!preferredDateTime?.trim()) {
      void navigate(ROUTES.dentalSlots, { replace: true });
    }
  }, [clinic, member, preferredDateTime, navigate, toast]);

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

  const displayPhone = primaryPhone ?? "—";
  const patientLine = member?.name?.trim() ? `For ${member.name.trim()}` : "For —";

  const onConfirm = useCallback(() => {
    setBusy(true);
    try {
      // TODO: POST dental booking when API is available
      void navigate(ROUTES.dentalBookingSuccess, { replace: true });
    } finally {
      setBusy(false);
    }
  }, [navigate]);

  if (!clinic || !preferredDateTime?.trim() || !member) {
    return null;
  }

  return (
    <div className="hco-page dental-overview">
      <header className="hco-top">
        <Link to={ROUTES.dentalSlots} className="hco-back" aria-label="Back">
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
        <h1 className="hco-title">Dental Overview</h1>
        <span className="hco-top__balance" aria-hidden />
      </header>

      <main className="hco-main dental-overview__main">
        <div className="hco-main__content dental-overview__scroll">
          <VaccinationAddressBar />

          <section className="dental-overview__clinic">
            <h2 className="dental-overview__clinic-name">{clinic.name}</h2>
            <p className="dental-overview__clinic-addr">{clinic.practiceaddress}</p>
          </section>

          <div className="hco-subhead">
            <span className="hco-subhead__title">Added Items (1)</span>
          </div>
          <p className="dental-overview__service">{DENTAL_SERVICE_NAME}</p>
          <p className="dental-overview__for">{patientLine}</p>

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
              <span className="hco-dt__value">{formatVaccineSlotDisplay(preferredDateTime)}</span>
              <button
                type="button"
                className="hco-dt__edit"
                aria-label="Edit date and time"
                onClick={() => void navigate(ROUTES.dentalSlots)}
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

          <section className="hco-totals">
            <div className="hco-totals__row">
              <span className="hco-totals__k">Total MRP</span>
              <span className="hco-totals__v">₹ 0</span>
            </div>
            <div className="hco-totals__row hco-totals__muted dental-overview__wallet-row">
              <span className="hco-totals__k">From Wallet</span>
              <span className="hco-totals__v">₹ 0</span>
            </div>
            <div className="hco-totals__row hco-totals__strong">
              <span className="hco-totals__k">Net Pay</span>
              <span className="hco-totals__v">₹ 0</span>
            </div>
          </section>

          <div className="hco-remarks dental-overview__remarks">
            <div className="hco-remarks__k">Remarks :</div>
            <div className="hco-remarks__v">Order cannot be cancelled once confirmed</div>
          </div>
        </div>
      </main>

      <footer className="hc-footer dental-overview__footer">
        <button type="button" className="bottom-continue" disabled={busy} onClick={onConfirm}>
          {busy ? "Submitting…" : "Confirm"}
        </button>
      </footer>
    </div>
  );
}
