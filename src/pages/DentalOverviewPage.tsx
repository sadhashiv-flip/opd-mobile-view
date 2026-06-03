import { ROUTES } from "@/constants";
import {
  clearDentalBookingFlowState,
  readDentalPreferredDateTime,
  readDentalSelectedClinicRaw,
  writeDentalPreferredDateTime,
} from "@/constants/dentalBookingStorage";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import { readDiagnosticsSelectedMembersSnapshots } from "@/constants/diagnosticsSelectedMemberStorage";
import {
  DENTAL_CONFIRM_DIALOG,
  DENTAL_OVERVIEW_IMPORTANT_NOTES,
} from "@/constants/dentalOverviewCopy";
import { buildServiceBookingSuccessState } from "@/constants/bookingSuccessNavigation";
import type { DentalNetworkClinicRow } from "@/api/networkList";
import {
  parseDentalBookingInvoiceId,
  postDentalServiceRequest,
} from "@/api/dentalServiceBooking";
import { DentalSlotPicker } from "@/components/dental/DentalSlotPicker";
import {
  DentalOverviewIconAccessTime,
  DentalOverviewIconCall,
  DentalOverviewIconClinic,
  DentalOverviewIconEdit,
  DentalOverviewIconEvent,
  DentalOverviewIconInfo,
  DentalOverviewIconLocationPin,
  DentalOverviewIconMedical,
  DentalOverviewIconPerson,
} from "@/components/dental/DentalOverviewIcons";
import { useAppConfirm } from "@/components/dialog/AppConfirmDialog";
import { OverviewSectionCard } from "@/components/overview/OverviewSectionCard";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { parsePreferredApiDateTime } from "@/components/vaccination/VaccinationSlotPicker";
import { getAccessToken } from "@/lib/authStorage";
import {
  DENTAL_BOOKING_DAY_COUNT,
  firstDayWithBookableDentalSlots,
  flatDentalSlotLabelsForDay,
  formatDentalPreferredDateTime,
  formatDentalSlotDisplay,
  getDentalBookingDays,
  sameCalendarDay,
} from "@/utils/dentalSlotRules";
import { useToast } from "@/hooks/useToast";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/components/address/AddressBottomSheet.css";
import "@/components/consultation/VirtualAppointmentSlotBottomSheet.css";
import "@/components/overview/OverviewSectionCard.css";
import "./HealthCheckupsPage.css";
import "./DentalSlotsPage.css";
import "./DentalOverviewPage.css";

const DENTAL_SERVICE_NAME = "Dental Comprehensive Checkup";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatMemberPhoneDisplay(phone: string | null | undefined): string {
  const raw = phone?.trim() ?? "";
  if (!raw) return "—";
  if (raw.startsWith("+")) return raw;
  const d = digitsOnly(raw);
  if (d.length === 10) return `+91 ${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  return raw;
}

function parseDentalClinic(raw: string | null): DentalNetworkClinicRow | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as DentalNetworkClinicRow;
  } catch {
    return null;
  }
}

function clinicAddressLine(clinic: DentalNetworkClinicRow): string {
  return [clinic.practiceaddress, clinic.city]
    .map((s) => s?.trim())
    .filter((s) => s && s.length > 0)
    .join(", ");
}

export function DentalOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useAppConfirm();
  const [altPhone, setAltPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const clinic = useMemo(() => parseDentalClinic(readDentalSelectedClinicRaw()), []);
  const [preferredDateTime, setPreferredDateTime] = useState<string | null>(() =>
    readDentalPreferredDateTime(),
  );
  const member = useMemo(() => readDiagnosticsSelectedMembersSnapshots()[0] ?? null, []);

  const [stripNowTick, setStripNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = globalThis.setInterval(() => setStripNowTick(Date.now()), 15_000);
    return () => globalThis.clearInterval(id);
  }, []);
  const stripNow = useMemo(() => new Date(stripNowTick), [stripNowTick]);

  const bookingStrip = useMemo(
    () => getDentalBookingDays(DENTAL_BOOKING_DAY_COUNT, stripNow),
    [stripNow],
  );
  const bookingDates = bookingStrip.dates;

  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<Date>(() => new Date());
  const [sheetSlot, setSheetSlot] = useState<string | null>(null);
  const [sheetNowTick, setSheetNowTick] = useState(() => Date.now());

  const slotSnapshotRef = useRef<{
    preferred: string | null;
    day: Date;
    slot: string | null;
  } | null>(null);

  useEffect(() => {
    if (!slotSheetOpen) return;
    const id = globalThis.setInterval(() => setSheetNowTick(Date.now()), 15_000);
    return () => globalThis.clearInterval(id);
  }, [slotSheetOpen]);

  const sheetBookingNow = useMemo(() => new Date(sheetNowTick), [sheetNowTick]);

  const openSlotSheet = useCallback(() => {
    const now = new Date();
    const parsed = parsePreferredApiDateTime(preferredDateTime);
    const snapDay = parsed
      ? bookingDates.find((d) => sameCalendarDay(d, parsed.day)) ??
        firstDayWithBookableDentalSlots(bookingDates, now)
      : firstDayWithBookableDentalSlots(bookingDates, now);
    const snapSlot = parsed?.slot12h ?? null;
    slotSnapshotRef.current = {
      preferred: preferredDateTime,
      day: snapDay,
      slot: snapSlot,
    };
    setSheetDay(snapDay);
    setSheetSlot(snapSlot);
    setSheetNowTick(Date.now());
    setSlotSheetOpen(true);
  }, [preferredDateTime, bookingDates]);

  const closeSlotSheet = useCallback(
    (revert: boolean) => {
      if (revert && slotSnapshotRef.current) {
        const snap = slotSnapshotRef.current;
        setPreferredDateTime(snap.preferred);
        if (snap.preferred?.trim()) {
          writeDentalPreferredDateTime(snap.preferred);
        }
        setSheetDay(snap.day);
        setSheetSlot(snap.slot);
      }
      setSlotSheetOpen(false);
    },
    [],
  );

  useEffect(() => {
    if (!slotSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSlotSheet(true);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [slotSheetOpen, closeSlotSheet]);

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

  const sheetFlatAvailable = useMemo(
    () => flatDentalSlotLabelsForDay(sheetDay, sheetBookingNow),
    [sheetDay, sheetBookingNow],
  );

  const sheetCanConfirm = Boolean(sheetSlot) && sheetFlatAvailable.length > 0;

  const applyDentalSlotSheet = useCallback(() => {
    if (!sheetSlot || sheetFlatAvailable.length === 0) return;
    const iso = formatDentalPreferredDateTime(sheetDay, sheetSlot);
    if (!iso) return;
    writeDentalPreferredDateTime(iso);
    setPreferredDateTime(iso);
    closeSlotSheet(false);
  }, [sheetDay, sheetSlot, sheetFlatAvailable.length, closeSlotSheet]);

  const displayPhone = formatMemberPhoneDisplay(member?.phone);
  const patientLine = member?.name?.trim() ? `For ${member.name.trim()}` : "For —";
  const scheduleDisplay = useMemo(() => {
    const pdt = preferredDateTime?.trim();
    if (!pdt) return "Select date and time";
    const parsed = parsePreferredApiDateTime(pdt);
    if (!parsed) return pdt;
    return formatDentalSlotDisplay(parsed.day, parsed.slot12h, bookingStrip.monthYearLabel);
  }, [preferredDateTime, bookingStrip.monthYearLabel]);
  const clinicAddr = clinic ? clinicAddressLine(clinic) : "";

  const submitBooking = useCallback(async () => {
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
      const primaryDigits = digitsOnly(member?.phone ?? "");
      const response = await postDentalServiceRequest({
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
      const invoiceId = parseDentalBookingInvoiceId(response);
      clearDentalBookingFlowState();

      const schedule = (() => {
        const parsed = parsePreferredApiDateTime(pdt);
        return parsed
          ? formatDentalSlotDisplay(parsed.day, parsed.slot12h, bookingStrip.monthYearLabel)
          : pdt;
      })();

      const successState = buildServiceBookingSuccessState({
        kind: "dental",
        memberName: member?.name,
        bookingTypeLabel: "Dental care",
        locationValue: clinic.name.trim(),
        schedule,
        invoiceId: invoiceId || undefined,
      });

      void navigate(ROUTES.dentalBookingSuccess, { replace: true, state: successState });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete booking");
    } finally {
      setBusy(false);
    }
  }, [altPhone, bookingStrip.monthYearLabel, clinic, member, navigate, preferredDateTime, toast]);

  const onConfirm = useCallback(async () => {
    const ok = await confirmDialog({
      title: DENTAL_CONFIRM_DIALOG.title,
      message: DENTAL_CONFIRM_DIALOG.message,
      confirmLabel: DENTAL_CONFIRM_DIALOG.confirmLabel,
      cancelLabel: DENTAL_CONFIRM_DIALOG.cancelLabel,
    });
    if (ok) void submitBooking();
  }, [confirmDialog, submitBooking]);

  if (!clinic || !preferredDateTime?.trim() || !member) {
    return null;
  }

  return (
    <div className="dental-overview-page">
      {busy ? (
        <div className="dental-overview-page__loader" role="status" aria-live="polite" aria-busy="true">
          <span className="dental-overview-page__loader-spin" aria-hidden />
          <span className="dental-overview-page__loader-text">Booking…</span>
        </div>
      ) : null}

      <header className="dental-overview-page__top">
        <FlowScreenBack fallbackTo={ROUTES.dentalSlots} className="app-back-btn dental-overview-page__back" />
        <h1 className="dental-overview-page__title">Dental Overview</h1>
        <span className="dental-overview-page__top-spacer" aria-hidden />
      </header>

      <main className="dental-overview-page__main">
        <div className="dental-overview-page__scroll">
          <VaccinationAddressBar />

          <OverviewSectionCard title="Clinic" icon={<DentalOverviewIconClinic />}>
            <p className="dental-overview-page__clinic-name">{clinic.name}</p>
            {clinicAddr ? (
              <p className="dental-overview-page__clinic-addr">
                <DentalOverviewIconLocationPin />
                {clinicAddr}
              </p>
            ) : null}
          </OverviewSectionCard>

          <OverviewSectionCard title="Added Items" icon={<DentalOverviewIconMedical />} trailing="(1)">
            <p className="dental-overview-page__service">{DENTAL_SERVICE_NAME}</p>
            <p className="dental-overview-page__for">
              <DentalOverviewIconPerson />
              {patientLine}
            </p>
          </OverviewSectionCard>

          <OverviewSectionCard title="Contact Details" icon={<DentalOverviewIconCall />}>
            <p className="dental-overview-page__phone-line">
              <span className="dental-overview-page__phone-k">Phone number: </span>
              <span className="dental-overview-page__phone-v">{displayPhone}</span>
            </p>
            <p className="dental-overview-page__phone-note">
              Booking related updates will be sent on this number
            </p>
            <label className="dental-overview-page__alt-label" htmlFor="dental-alt-phone">
              Alternate Phone number
            </label>
            <div className="dental-overview-page__alt">
              <span className="dental-overview-page__alt-cc">+91</span>
              <input
                id="dental-alt-phone"
                className="dental-overview-page__alt-input"
                placeholder="Enter your alternate number here"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                value={altPhone}
                onChange={(e) => setAltPhone(digitsOnly(e.target.value).slice(0, 10))}
              />
            </div>
          </OverviewSectionCard>

          <OverviewSectionCard title="Date and time" icon={<DentalOverviewIconEvent />}>
            <button
              type="button"
              className="dental-overview-page__dt"
              onClick={openSlotSheet}
              aria-label="Edit date and time"
            >
              <DentalOverviewIconAccessTime />
              <span className="dental-overview-page__dt-value">{scheduleDisplay}</span>
              <DentalOverviewIconEdit />
            </button>
          </OverviewSectionCard>

          <section className="dental-overview-page__notes" aria-label="Important Notes">
            <header className="dental-overview-page__notes-head">
              <DentalOverviewIconInfo />
              <h2 className="dental-overview-page__notes-title">Important Notes</h2>
            </header>
            <ul className="dental-overview-page__notes-list">
              {DENTAL_OVERVIEW_IMPORTANT_NOTES.map((note) => (
                <li key={note} className="dental-overview-page__notes-item">
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <footer className="hc-footer dental-overview-page__footer mobile-frame-fixed-footer">
        <button type="button" className="bottom-continue" disabled={busy} onClick={() => void onConfirm()}>
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
            if (e.target === e.currentTarget) closeSlotSheet(true);
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
                  onClick={() => closeSlotSheet(true)}
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
                  monthYearLabel={bookingStrip.monthYearLabel}
                  selectedDay={sheetDay}
                  onSelectDay={setSheetDay}
                  selectedSlot={sheetSlot}
                  onSelectSlot={setSheetSlot}
                  bookingNow={sheetBookingNow}
                />
              </main>

              <footer className="cvsl-footer">
                <button
                  type="button"
                  className="cvsl-footer__book"
                  disabled={!sheetCanConfirm}
                  onClick={applyDentalSlotSheet}
                >
                  Confirm
                </button>
              </footer>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
