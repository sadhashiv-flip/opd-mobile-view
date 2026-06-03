import { ROUTES } from "@/constants";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import {
  VACCINATION_CONFIRM_DIALOG,
  VACCINATION_OVERVIEW_IMPORTANT_NOTES,
} from "@/constants/vaccinationOverviewCopy";
import {
  clearVaccinationFlowState,
  readVaccinationFlowState,
  writeVaccinationFlowState,
  type VaccinationFlowState,
} from "@/constants/vaccinationFlowStorage";
import { buildServiceBookingSuccessState } from "@/constants/bookingSuccessNavigation";
import { postVaccineServiceRequest } from "@/api/vaccineService";
import { parseServiceBookingResponse } from "@/lib/serviceBookingResponse";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchPatientProfile } from "@/api/patientProfile";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { VaccinationServiceIcon } from "@/components/vaccination/VaccinationServiceIcon";
import {
  VaccinationOverviewIconAccessTime,
  VaccinationOverviewIconCheck,
  VaccinationOverviewIconEdit,
  VaccinationOverviewIconInfo,
} from "@/components/vaccination/VaccinationOverviewIcons";
import { VaccinationPrescriptionUpload } from "@/components/vaccination/VaccinationPrescriptionUpload";
import { VaccinationSlotPicker } from "@/components/vaccination/VaccinationSlotPicker";
import {
  formatPreferredApiDateTime,
  formatVaccineSlotDisplay,
  parsePreferredApiDateTime,
} from "@/components/vaccination/vaccinationSlotPickerFormat";
import {
  firstDayWithBookableVaccinationSlots,
  flatVaccinationSlotLabelsForDay,
  formatVaccinationSlotDisplay,
  getVaccinationBookingDays,
  sameCalendarDay,
} from "@/components/vaccination/vaccinationSlotRules";
import { useAppConfirm } from "@/components/dialog/AppConfirmDialog";
import {
  OverviewIconCall,
  OverviewIconEvent,
  OverviewIconMedical,
  OverviewSectionCard,
} from "@/components/overview/OverviewSectionCard";
import { getAccessToken } from "@/lib/authStorage";
import { useToast } from "@/hooks/useToast";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/components/address/AddressBottomSheet.css";
import "@/components/consultation/VirtualAppointmentSlotBottomSheet.css";
import "@/components/overview/OverviewSectionCard.css";
import "@/pages/ConsultationVirtualSlotsPage.css";
import "./VaccinationOverviewPage.css";

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

/** patient_app `VaccineController.needsPrescription` — age <= 5. */
function vaccinationNeedsPrescription(memberAge: number | undefined): boolean {
  if (memberAge == null || !Number.isFinite(memberAge)) return false;
  return memberAge <= 5;
}

export function VaccinationOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useAppConfirm();
  const [flow, setFlow] = useState<VaccinationFlowState | null>(() => readVaccinationFlowState());
  const [altPhone, setAltPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallbackPhone, setFallbackPhone] = useState<string | null>(null);
  const [prescriptionId, setPrescriptionId] = useState(
    () => readVaccinationFlowState()?.prescriptionAttachmentId?.trim() ?? "",
  );

  const [stripNowTick, setStripNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = globalThis.setInterval(() => setStripNowTick(Date.now()), 60_000);
    return () => globalThis.clearInterval(id);
  }, []);
  const stripNow = useMemo(() => new Date(stripNowTick), [stripNowTick]);

  const bookingStrip = useMemo(() => getVaccinationBookingDays(undefined, stripNow), [stripNow]);
  const bookingDates = bookingStrip.dates;

  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<Date>(() => new Date());
  const [sheetSlot, setSheetSlot] = useState<string | null>(null);
  const slotSnapshotRef = useRef<string | null>(null);

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
    setPrescriptionId(s.prescriptionAttachmentId?.trim() ?? "");
  }, [navigate]);

  useEffect(() => {
    void (async () => {
      try {
        const members = await fetchAllPatientMembers();
        const primary = members.find((m) => m.memberKind === "primary");
        const profile = await fetchPatientProfile();
        setFallbackPhone(primary?.phone?.trim() || profile.phone?.trim() || null);
      } catch {
        setFallbackPhone(null);
      }
    })();
  }, []);

  const needsPrescription = vaccinationNeedsPrescription(flow?.memberAge);
  const canConfirmOverview =
    !needsPrescription || (prescriptionId.trim().length > 0 && !busy);

  const displayPhone = useMemo(() => {
    const member = flow?.memberPhone?.trim();
    if (member) return formatMemberPhoneDisplay(member);
    return formatMemberPhoneDisplay(fallbackPhone);
  }, [flow?.memberPhone, fallbackPhone]);

  const scheduleDisplay = useMemo(() => {
    const pdt = flow?.preferredDateTime?.trim();
    if (!pdt) return "Choose date and time";
    const parsed = parsePreferredApiDateTime(pdt);
    if (!parsed) return formatVaccineSlotDisplay(pdt);
    return formatVaccinationSlotDisplay(
      parsed.day,
      parsed.slot12h,
      bookingStrip.monthYearLabel,
    );
  }, [flow?.preferredDateTime, bookingStrip.monthYearLabel]);

  const persistFlow = useCallback((patch: Partial<VaccinationFlowState>) => {
    const cur = readVaccinationFlowState();
    if (!cur) return;
    const merged = { ...cur, ...patch };
    writeVaccinationFlowState(merged);
    setFlow(merged);
  }, []);

  const onPrescriptionChange = useCallback(
    (id: string) => {
      setPrescriptionId(id);
      persistFlow({ prescriptionAttachmentId: id || undefined });
    },
    [persistFlow],
  );

  useEffect(() => {
    if (!needsPrescription && prescriptionId) {
      onPrescriptionChange("");
    }
  }, [needsPrescription, prescriptionId, onPrescriptionChange]);

  const openSlotSheet = useCallback(() => {
    const pdt = flow?.preferredDateTime?.trim() ?? "";
    slotSnapshotRef.current = pdt || null;
    const parsed = parsePreferredApiDateTime(pdt);
    const snapDay = parsed
      ? bookingDates.find((d) => sameCalendarDay(d, parsed.day)) ??
        firstDayWithBookableVaccinationSlots(bookingDates, stripNow)
      : firstDayWithBookableVaccinationSlots(bookingDates, stripNow);
    setSheetDay(snapDay);
    setSheetSlot(parsed?.slot12h ?? null);
    setSlotSheetOpen(true);
  }, [flow?.preferredDateTime, bookingDates, stripNow]);

  const closeSlotSheet = useCallback(
    (revert: boolean) => {
      if (revert && slotSnapshotRef.current != null) {
        persistFlow({ preferredDateTime: slotSnapshotRef.current });
      } else if (revert) {
        const cur = readVaccinationFlowState();
        if (cur && !cur.preferredDateTime?.trim()) {
          void navigate(ROUTES.vaccinationSlots, { replace: true });
        }
      }
      setSlotSheetOpen(false);
    },
    [persistFlow, navigate],
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

  const sheetFlatAvailable = useMemo(
    () => flatVaccinationSlotLabelsForDay(sheetDay, stripNow),
    [sheetDay, stripNow],
  );

  const sheetCanConfirm = Boolean(sheetSlot) && sheetFlatAvailable.length > 0;

  const applySlotSheet = useCallback(() => {
    if (!sheetSlot || sheetFlatAvailable.length === 0) return;
    const iso = formatPreferredApiDateTime(sheetDay, sheetSlot);
    if (!iso) return;
    persistFlow({ preferredDateTime: iso });
    closeSlotSheet(false);
  }, [sheetDay, sheetSlot, sheetFlatAvailable.length, persistFlow, closeSlotSheet]);

  const submitBooking = useCallback(async () => {
    const addr = readSelectedAddress();
    if (!addr?.id) {
      toast.error("Select an address.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    const cur = readVaccinationFlowState();
    if (!cur?.preferredDateTime?.trim()) {
      toast.error("Select date and time.");
      return;
    }
    if (!Number.isFinite(cur.userId)) {
      toast.error("Missing member for booking. Go back and select a family member again.");
      return;
    }
    if (!cur.selectedServices?.length) {
      toast.error("Select at least one vaccine.");
      return;
    }
    if (needsPrescription && !prescriptionId.trim()) {
      toast.error("Please upload a prescription for patients aged 5 years or below");
      return;
    }

    setBusy(true);
    try {
      const attachments = prescriptionId.trim() ? [prescriptionId.trim()] : [];
      const response = await postVaccineServiceRequest({
        address_id: addr.id,
        preferred_date_time: cur.preferredDateTime,
        request: cur.selectedServices.map((s) => s.id),
        alternate_phone: digitsOnly(altPhone) || digitsOnly(cur.memberPhone ?? "") || digitsOnly(fallbackPhone ?? "") || "",
        conditions: "No conditions",
        note: "Notes here",
        user_id: cur.userId,
        language: "English",
        ...(attachments.length > 0
          ? { prescription: attachments.map((id) => ({ id })) }
          : {}),
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
  }, [altPhone, fallbackPhone, needsPrescription, prescriptionId, toast, navigate]);

  const onConfirm = useCallback(async () => {
    if (!canConfirmOverview) return;
    const ok = await confirmDialog({
      title: VACCINATION_CONFIRM_DIALOG.title,
      message: VACCINATION_CONFIRM_DIALOG.message,
      confirmLabel: VACCINATION_CONFIRM_DIALOG.confirmLabel,
      cancelLabel: VACCINATION_CONFIRM_DIALOG.cancelLabel,
    });
    if (ok) void submitBooking();
  }, [confirmDialog, submitBooking, canConfirmOverview]);

  if (!flow?.preferredDateTime?.trim()) {
    return null;
  }

  const memberLine = flow.memberName?.trim() ? `For ${flow.memberName.trim()}` : "For —";
  const highlightRx =
    needsPrescription && prescriptionId.trim().length === 0;

  return (
    <div className="vac-overview-page">
      {busy ? (
        <div className="vac-overview-page__loader" role="status" aria-live="polite" aria-busy="true">
          <span className="vac-overview-page__loader-spin" aria-hidden />
          <span className="vac-overview-page__loader-text">Booking…</span>
        </div>
      ) : null}

      <header className="vac-overview-page__top">
        <FlowScreenBack
          fallbackTo={ROUTES.vaccinationSlots}
          className="app-back-btn vac-overview-page__back"
        />
        <h1 className="vac-overview-page__title">Vaccine Overview</h1>
        <span className="vac-overview-page__top-spacer" aria-hidden />
      </header>

      <main className="vac-overview-page__main">
        <div className="vac-overview-page__scroll">
          <VaccinationAddressBar />

          <OverviewSectionCard
            title="Selected Vaccines"
            icon={<VaccinationServiceIcon accent size={16} />}
            trailing={`(${flow.selectedServices.length})`}
          >
            <ul className="vac-overview-page__vlist">
              {flow.selectedServices.map((s) => (
                <li key={s.id} className="vac-overview-page__vrow">
                  <VaccinationOverviewIconCheck />
                  <span>{s.name}</span>
                </li>
              ))}
            </ul>
            <p className="vac-overview-page__for">{memberLine}</p>
          </OverviewSectionCard>

          <OverviewSectionCard title="Contact Details" icon={<OverviewIconCall />}>
            <p className="vac-overview-page__phone-line">
              <span className="vac-overview-page__phone-k">Phone number: </span>
              <span className="vac-overview-page__phone-v">{displayPhone}</span>
            </p>
            <p className="vac-overview-page__phone-note">
              Booking related updates will be sent on this number
            </p>
            <label className="vac-overview-page__alt-label" htmlFor="vac-alt-phone">
              Alternate Phone number
            </label>
            <div className="vac-overview-page__alt">
              <span className="vac-overview-page__alt-cc">+91</span>
              <input
                id="vac-alt-phone"
                className="vac-overview-page__alt-input"
                placeholder="Enter your alternate number here"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                value={altPhone}
                onChange={(e) => setAltPhone(digitsOnly(e.target.value).slice(0, 10))}
              />
            </div>
          </OverviewSectionCard>

          <OverviewSectionCard title="Date and time" icon={<OverviewIconEvent />}>
            <button
              type="button"
              className="vac-overview-page__dt"
              onClick={openSlotSheet}
              aria-label="Edit date and time"
            >
              <VaccinationOverviewIconAccessTime />
              <span className="vac-overview-page__dt-value">{scheduleDisplay}</span>
              <VaccinationOverviewIconEdit />
            </button>
          </OverviewSectionCard>

          {needsPrescription ? (
            <OverviewSectionCard title="Upload Prescription" icon={<OverviewIconMedical />}>
              <VaccinationPrescriptionUpload
                attachmentId={prescriptionId}
                onAttachmentIdChange={onPrescriptionChange}
                highlight={highlightRx}
              />
            </OverviewSectionCard>
          ) : null}

          <section className="vac-overview-page__notes" aria-label="Important Notes">
            <header className="vac-overview-page__notes-head">
              <VaccinationOverviewIconInfo />
              <h2 className="vac-overview-page__notes-title">Important Notes</h2>
            </header>
            <ul className="vac-overview-page__notes-list">
              {VACCINATION_OVERVIEW_IMPORTANT_NOTES.map((note) => (
                <li key={note} className="vac-overview-page__notes-item">
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <footer className="hc-footer vac-overview-page__footer mobile-frame-fixed-footer">
        <button
          type="button"
          className="bottom-continue"
          disabled={!canConfirmOverview}
          onClick={() => void onConfirm()}
        >
          {busy ? "Submitting…" : "Confirm"}
        </button>
      </footer>

      {slotSheetOpen ? (
        <dialog
          className="addr-sheet-dialog"
          open
          aria-modal="true"
          aria-labelledby="vac-overview-slot-sheet-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSlotSheet(true);
          }}
        >
          <div className="vas-cvsl-sheet">
            <div className="cvsl-page vas-cvsl-sheet__inner">
              <header className="cvsl-top vas-cvsl-top">
                <h1 id="vac-overview-slot-sheet-title" className="cvsl-title">
                  Select Your Vaccine Slots
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
                <VaccinationSlotPicker
                  selectedDay={sheetDay}
                  onSelectDay={setSheetDay}
                  selectedSlot={sheetSlot}
                  onSelectSlot={setSheetSlot}
                  showContinueFooter={false}
                />
              </main>

              <footer className="cvsl-footer">
                <button
                  type="button"
                  className="cvsl-footer__book"
                  disabled={!sheetCanConfirm}
                  onClick={applySlotSheet}
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
