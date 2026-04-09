import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import {
  readVisionSelectedClinic,
  readVisionSelectedSlot,
} from "@/constants/visionBookingStorage";
import { readDiagnosticsSelectedMembersSnapshots } from "@/constants/diagnosticsSelectedMemberStorage";
import { postVisionServiceRequest } from "@/api/visionServiceBooking";
import type { VisionServiceSlotRow } from "@/api/visionServiceSlots";
import {
  formatPreferredApiDateTime,
  formatVaccineSlotDisplay,
} from "@/components/vaccination/VaccinationSlotPicker";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { fetchPatientProfile } from "@/api/patientProfile";
import { getAccessToken } from "@/lib/authStorage";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./VaccinationOverviewPage.css";
import "./DentalOverviewPage.css";

/** Shown in “Added items” for the eye-checkup overview (vision.clinic). */
const EYE_CHECKUP_SERVICE_NAME = "Eye Checkup";

function displayVisionSlot(row: VisionServiceSlotRow): string {
  const parts = row.slot_date.trim().split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (y == null || mo == null || d == null) {
    return `${row.slot_date} | ${row.start_time}`;
  }
  const day = new Date(y, mo - 1, d);
  const api = formatPreferredApiDateTime(day, row.start_time);
  return formatVaccineSlotDisplay(api);
}

export function VisionOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim() ?? "";

  const [altPhone, setAltPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(null);

  const clinic = useMemo(() => readVisionSelectedClinic(), []);
  const slotRow = useMemo(() => readVisionSelectedSlot(), []);
  const member = useMemo(() => readDiagnosticsSelectedMembersSnapshots()[0] ?? null, []);

  const slotDisplay = useMemo(() => (slotRow ? displayVisionSlot(slotRow) : ""), [slotRow]);

  useEffect(() => {
    if (visionType !== VISION_ROUTE_TYPE.eyeCheckup) {
      return;
    }
    if (!member) {
      toast.error("Select a member first.");
      void navigate(generatePath(ROUTES.visionSelectPeople, { visionType }), { replace: true });
      return;
    }
    if (!clinic) {
      toast.error("Select a clinic first.");
      void navigate(generatePath(ROUTES.visionNetworkList, { visionType }), { replace: true });
      return;
    }
    if (!slotRow) {
      void navigate(generatePath(ROUTES.visionSlots, { visionType }), { replace: true });
    }
  }, [clinic, member, slotRow, visionType, navigate, toast]);

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

  const onConfirm = useCallback(async () => {
    const addr = readSelectedAddress();
    if (!addr?.id?.trim()) {
      toast.error("Choose an address.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    const uid = member?.userId;
    if (uid == null || !Number.isFinite(uid)) {
      toast.error("Missing member details. Go back and select a member again.");
      return;
    }
    const netId = clinic?.networkEntityId?.trim() ?? "";
    if (!netId) {
      toast.error("Missing network location. Go back and choose a clinic again.");
      return;
    }
    if (!slotRow) return;

    setBusy(true);
    try {
      await postVisionServiceRequest({
        booking_type: "clinic",
        user_id: uid,
        network_id: netId,
        address_id: addr.id.trim(),
        slot: {
          slot_id: slotRow.slot_id,
          slot_date: slotRow.slot_date,
          start_time: slotRow.start_time,
          end_time: slotRow.end_time,
        },
      });
      void navigate(
        generatePath(ROUTES.visionBookingSuccess, { visionType: VISION_ROUTE_TYPE.eyeCheckup }),
        { replace: true },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete booking");
    } finally {
      setBusy(false);
    }
  }, [clinic, member, navigate, slotRow, toast]);

  if (visionType !== VISION_ROUTE_TYPE.eyeCheckup) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (!clinic || !slotRow || !member) {
    return null;
  }

  return (
    <div className="hco-page dental-overview">
      <header className="hco-top">
        <Link
          to={generatePath(ROUTES.visionSlots, { visionType })}
          className="hco-back"
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
        <h1 className="hco-title">Vision Overview</h1>
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
          <p className="dental-overview__service">{EYE_CHECKUP_SERVICE_NAME}</p>
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
              <span className="hco-dt__value">{slotDisplay}</span>
              <button
                type="button"
                className="hco-dt__edit"
                aria-label="Edit date and time"
                onClick={() => void navigate(generatePath(ROUTES.visionSlots, { visionType }))}
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
