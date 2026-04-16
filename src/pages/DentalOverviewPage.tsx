import { ROUTES } from "@/constants";
import {
  clearDentalBookingFlowState,
  readDentalPreferredDateTime,
  readDentalSelectedClinicRaw,
  writeDentalPreferredDateTime,
} from "@/constants/dentalBookingStorage";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import { readDiagnosticsSelectedMembersSnapshots } from "@/constants/diagnosticsSelectedMemberStorage";
import type { DentalNetworkClinicRow } from "@/api/networkList";
import { DentalSlotPicker } from "@/components/dental/DentalSlotPicker";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import {
  formatPreferredApiDateTime,
  formatVaccineSlotDisplay,
  parsePreferredApiDateTime,
} from "@/components/vaccination/VaccinationSlotPicker";
import { postDentalServiceRequest } from "@/api/dentalServiceBooking";
import { fetchPatientProfile } from "@/api/patientProfile";
import { getAccessToken } from "@/lib/authStorage";
import {
  DENTAL_BOOKING_DAY_COUNT,
  firstDayWithBookableDentalSlots,
  flatDentalSlotLabelsForDay,
  getDentalBookingDays,
  sameCalendarDay,
} from "@/utils/dentalSlotRules";
import { useToast } from "@/hooks/useToast";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "@/components/address/AddressBottomSheet.css";
import "@/components/consultation/VirtualAppointmentSlotBottomSheet.css";
import "./DentalSlotsPage.css";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./VaccinationOverviewPage.css";
import "./DentalOverviewPage.css";

const DENTAL_SERVICE_NAME = "Dental Comprehensive Checkup";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

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
  const [preferredDateTime, setPreferredDateTime] = useState<string | null>(() =>
    readDentalPreferredDateTime(),
  );
  const member = useMemo(() => readDiagnosticsSelectedMembersSnapshots()[0] ?? null, []);

  const bookingDates = useMemo(
    () => getDentalBookingDays(DENTAL_BOOKING_DAY_COUNT).dates,
    [],
  );

  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<Date>(() => new Date());
  const [sheetSlot, setSheetSlot] = useState<string | null>(null);
  const [sheetNowTick, setSheetNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!slotSheetOpen) return;
    const id = globalThis.setInterval(() => setSheetNowTick(Date.now()), 15_000);
    return () => globalThis.clearInterval(id);
  }, [slotSheetOpen]);

  const sheetBookingNow = useMemo(() => new Date(sheetNowTick), [sheetNowTick]);

  useEffect(() => {
    if (!slotSheetOpen) return;
    setSheetNowTick(Date.now());
    const now = new Date();
    const parsed = parsePreferredApiDateTime(preferredDateTime);
    if (parsed) {
      const inStrip = bookingDates.find((d) => sameCalendarDay(d, parsed.day));
      setSheetDay(inStrip ?? firstDayWithBookableDentalSlots(bookingDates, now));
      setSheetSlot(parsed.slot12h);
    } else {
      setSheetDay(firstDayWithBookableDentalSlots(bookingDates, now));
      setSheetSlot(null);
    }
  }, [slotSheetOpen, preferredDateTime, bookingDates]);

  const sheetFlatAvailable = useMemo(
    () => flatDentalSlotLabelsForDay(sheetDay, sheetBookingNow),
    [sheetDay, sheetBookingNow],
  );

  const sheetCanContinue = Boolean(sheetSlot) && sheetFlatAvailable.length > 0;

  const applyDentalSlotSheet = useCallback(() => {
    if (!sheetSlot || sheetFlatAvailable.length === 0) return;
    const iso = formatPreferredApiDateTime(sheetDay, sheetSlot);
    writeDentalPreferredDateTime(iso);
    setPreferredDateTime(iso);
    setSlotSheetOpen(false);
  }, [sheetDay, sheetSlot, sheetFlatAvailable.length]);

  useEffect(() => {
    if (!slotSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSlotSheetOpen(false);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [slotSheetOpen]);

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
    if (!clinic) {
      toast.error("Select a clinic first.");
      void navigate(ROUTES.dentalNetworkList, { replace: true });
      return;
    }
    const pdt = preferredDateTime?.trim() ?? "";
    if (!parsePreferredApiDateTime(pdt)) {
      toast.error("Invalid slot. Go back and pick a time again.");
      void navigate(ROUTES.dentalSlots, { replace: true });
      return;
    }

    const clinicIdStr = String(clinic.clinicid);
    const providerIdStr =
      clinic.providerid != null && clinic.providerid !== 0
        ? String(clinic.providerid)
        : clinicIdStr;

    setBusy(true);
    try {
      const altDigits = digitsOnly(altPhone);
      const primaryDigits = digitsOnly(primaryPhone ?? "");
      await postDentalServiceRequest({
        address_id: addr.id.trim(),
        preferred_date_time: pdt,
        alternate_phone: altDigits || primaryDigits || "",
        conditions: "No conditions",
        note: "Notes here",
        language: "en",
        provider_id: providerIdStr,
        clinic_id: clinicIdStr,
        user_id: uid,
        center: {
          name: clinic.name.trim(),
          phone: clinic.cell.trim(),
          address: {
            line_1: clinic.practiceaddress.trim(),
            city: clinic.city.trim(),
            pincode: clinic.pin.trim(),
          },
        },
      });
      clearDentalBookingFlowState();
      void navigate(ROUTES.dentalBookingSuccess, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete booking");
    } finally {
      setBusy(false);
    }
  }, [altPhone, clinic, member, navigate, preferredDateTime, primaryPhone, toast]);

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
                onClick={() => setSlotSheetOpen(true)}
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

      {slotSheetOpen ? (
        <dialog
          className="addr-sheet-dialog"
          open
          aria-modal="true"
          aria-labelledby="dental-overview-slot-sheet-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSlotSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSlotSheetOpen(false);
          }}
        >
          <div className="vas-cvsl-sheet">
            <div className="cvsl-page vas-cvsl-sheet__inner">
              <header className="cvsl-top vas-cvsl-top">
                <h1 id="dental-overview-slot-sheet-title" className="cvsl-title">
                  Select Your Dental Slots
                </h1>
                <button
                  type="button"
                  className="addr-sheet__close"
                  aria-label="Close"
                  onClick={() => setSlotSheetOpen(false)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </header>

              <main className="cvsl-main">
                <DentalSlotPicker
                  bookingDates={bookingDates}
                  selectedDay={sheetDay}
                  onSelectDay={setSheetDay}
                  selectedSlot={sheetSlot}
                  onSelectSlot={setSheetSlot}
                />
              </main>

              <footer className="cvsl-footer">
                <button
                  type="button"
                  className="cvsl-footer__book"
                  disabled={!sheetCanContinue}
                  onClick={applyDentalSlotSheet}
                >
                  Continue
                </button>
              </footer>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
