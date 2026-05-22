import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import {
  readVisionGlassesPrescriptions,
  readVisionSelectedClinic,
  readVisionSelectedSlot,
  writeVisionSelectedSlot,
  type VisionGlassesPrescriptionStored,
} from "@/constants/visionBookingStorage";
import {
  VISION_CONFIRM_DIALOG,
  VISION_OVERVIEW_IMPORTANT_NOTES_BASE,
  VISION_OVERVIEW_NOTE_CARRY_PRESCRIPTION,
  VISION_OVERVIEW_TITLE,
  VISION_SERVICE_EYE_CHECKUP,
  VISION_SERVICE_GLASSES_LENS,
  VISION_SLOT_SHEET_TITLE,
  VISION_VENDOR_TITLE_EYE,
  VISION_VENDOR_TITLE_GLASSES,
} from "@/constants/visionOverviewCopy";
import { readDiagnosticsSelectedMembersSnapshots } from "@/constants/diagnosticsSelectedMemberStorage";
import { postVisionServiceRequest } from "@/api/visionServiceBooking";
import { buildServiceBookingSuccessState } from "@/constants/bookingSuccessNavigation";
import { parseServiceBookingResponse } from "@/lib/serviceBookingResponse";
import type { VisionNetworkService } from "@/api/networkList";
import type { DentalNetworkClinicRow } from "@/api/networkList";
import { VISION_NO_SLOTS_AVAILABLE_COPY, type VisionServiceSlotRow } from "@/api/visionServiceSlots";
import { VisionSlotPicker } from "@/components/vision/VisionSlotPicker";
import { useVisionSlotsLoader } from "@/hooks/useVisionSlotsLoader";
import {
  findVisionSlotInPayload,
  formatVisionSlotScheduleDisplay,
  visionMonthYearLabelFromDaysList,
} from "@/lib/visionSlotSelection";
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
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { getAccessToken } from "@/lib/authStorage";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/components/address/AddressBottomSheet.css";
import "@/components/consultation/VirtualAppointmentSlotBottomSheet.css";
import "@/components/overview/OverviewSectionCard.css";
import "./HealthCheckupsPage.css";
import "./DentalSlotsPage.css";
import "./DentalOverviewPage.css";
import "./VisionOverviewPage.css";
import "./VisionAddPrescriptionPage.css";

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

function clinicAddressLine(clinic: DentalNetworkClinicRow): string {
  return [clinic.practiceaddress, clinic.city]
    .map((s) => s?.trim())
    .filter((s) => s && s.length > 0)
    .join(", ");
}

function rxPreviewRole(
  rx: VisionGlassesPrescriptionStored,
): Readonly<{ kind: "image" | "pdf" | "file"; src: string }> | null {
  const path = rx.path?.trim();
  if (!path) return null;
  const absolute = resolveProfileImageUrl(path);
  if (!absolute) return null;
  const apiType = rx.type?.trim().toUpperCase() ?? "";
  const nameSrc = rx.title.trim() || "";
  if (apiType === "IMG" || apiType === "IMAGE" || apiType.startsWith("IMAGE/")) {
    return { kind: "image", src: absolute };
  }
  if (apiType === "PDF" || apiType === "APPLICATION/PDF") {
    return { kind: "pdf", src: absolute };
  }
  const lower = nameSrc.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(lower)) {
    return { kind: "image", src: absolute };
  }
  if (lower.endsWith(".pdf")) return { kind: "pdf", src: absolute };
  return { kind: "file", src: absolute };
}

function RxThumbButton(props: Readonly<{ rx: VisionGlassesPrescriptionStored; onPreview: () => void }>) {
  const role = rxPreviewRole(props.rx);
  const title = props.rx.title.trim() || props.rx.attachmentId;
  return (
    <button
      type="button"
      className="vision-overview-page__rx-thumb-btn"
      aria-label={`Preview ${title}`}
      disabled={!role}
      onClick={() => role && props.onPreview()}
    >
      {role?.kind === "image" ? (
        <img src={role.src} alt="" />
      ) : role?.kind === "pdf" ? (
        <span className="vision-overview-page__rx-thumb-pdf">PDF</span>
      ) : role?.kind === "file" ? (
        <span className="vision-overview-page__rx-thumb-file">FILE</span>
      ) : (
        <span className="vision-overview-page__rx-thumb-file">—</span>
      )}
    </button>
  );
}

function OverviewRxPreviewBody(props: Readonly<{ rx: VisionGlassesPrescriptionStored }>) {
  const title = props.rx.title.trim() || props.rx.attachmentId;
  const role = rxPreviewRole(props.rx);
  if (!role) {
    return (
      <div className="vap-preview__file-fallback">
        <p className="vap-preview__file-msg">Preview isn’t available (missing file path).</p>
      </div>
    );
  }
  if (role.kind === "image") {
    return <img src={role.src} alt={title} className="vap-preview__img" />;
  }
  if (role.kind === "pdf") {
    return <iframe title={title} src={role.src} className="vap-preview__iframe" />;
  }
  return (
    <div className="vap-preview__file-fallback">
      <p className="vap-preview__file-msg">Preview isn’t available for this file type.</p>
      <a href={role.src} target="_blank" rel="noopener noreferrer" className="vap-preview__open-link">
        Open in browser
      </a>
    </div>
  );
}

export function VisionOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useAppConfirm();
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim() ?? "";
  const location = useLocation();

  const [altPhone, setAltPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);

  const [selectedSlotRow, setSelectedSlotRow] = useState<VisionServiceSlotRow | null>(() =>
    readVisionSelectedSlot(),
  );

  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const slotSnapshotRef = useRef<VisionServiceSlotRow | null>(null);

  const isEye = visionType === VISION_ROUTE_TYPE.eyeCheckup;
  const isGlasses = visionType === VISION_ROUTE_TYPE.glassesLens;

  const clinic = useMemo(() => readVisionSelectedClinic(), []);
  const member = useMemo(() => readDiagnosticsSelectedMembersSnapshots()[0] ?? null, []);

  const apiService: VisionNetworkService | null = isGlasses ? "vision.store" : isEye ? "vision.clinic" : null;

  const slotSheetRestore = useMemo(
    () =>
      selectedSlotRow
        ? { slotDate: selectedSlotRow.slot_date, slotId: selectedSlotRow.slot_id }
        : null,
    [selectedSlotRow],
  );

  const slotSheetLoader = useVisionSlotsLoader({
    service: apiService,
    networkId: clinic?.networkEntityId?.trim() ?? null,
    enabled: slotSheetOpen && apiService != null && Boolean(clinic?.networkEntityId?.trim()),
    restoreSelection: slotSheetRestore,
  });

  const overviewMonthLabel = useMemo(
    () => visionMonthYearLabelFromDaysList(selectedSlotRow ? [selectedSlotRow.slot_date] : []),
    [selectedSlotRow],
  );

  const scheduleDisplay = useMemo(() => {
    if (!selectedSlotRow) return "Select date and time";
    return formatVisionSlotScheduleDisplay(
      selectedSlotRow.slot_date,
      selectedSlotRow.start_time,
      overviewMonthLabel,
    );
  }, [selectedSlotRow, overviewMonthLabel]);

  const glassesPrescriptions = useMemo(
    () => (isGlasses ? readVisionGlassesPrescriptions() : []),
    [isGlasses, location.key, location.pathname],
  );

  const importantNotes = useMemo(() => {
    const notes: string[] = [...VISION_OVERVIEW_IMPORTANT_NOTES_BASE];
    if (isGlasses) notes.push(VISION_OVERVIEW_NOTE_CARRY_PRESCRIPTION);
    return notes;
  }, [isGlasses]);

  const backTo = isGlasses
    ? generatePath(ROUTES.visionAddPrescription, { visionType })
    : generatePath(ROUTES.visionSlots, { visionType });

  const vendorTitle = isEye ? VISION_VENDOR_TITLE_EYE : VISION_VENDOR_TITLE_GLASSES;
  const serviceLabel = isEye ? VISION_SERVICE_EYE_CHECKUP : VISION_SERVICE_GLASSES_LENS;
  const clinicAddr = clinic ? clinicAddressLine(clinic) : "";
  const displayPhone = formatMemberPhoneDisplay(member?.phone);
  const patientLine = member?.name?.trim() ? `For ${member.name.trim()}` : "For —";

  useEffect(() => {
    if (!isEye && !isGlasses) return;
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
    if (!selectedSlotRow) {
      void navigate(generatePath(ROUTES.visionSlots, { visionType }), { replace: true });
      return;
    }
    if (isGlasses && readVisionGlassesPrescriptions().length === 0) {
      void navigate(generatePath(ROUTES.visionAddPrescription, { visionType }), { replace: true });
    }
  }, [clinic, isEye, isGlasses, member, selectedSlotRow, visionType, navigate, toast]);

  useEffect(() => {
    if (!previewAttachmentId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewAttachmentId(null);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [previewAttachmentId]);

  const openSlotSheet = useCallback(() => {
    slotSnapshotRef.current = selectedSlotRow;
    setSlotSheetOpen(true);
  }, [selectedSlotRow]);

  const closeSlotSheet = useCallback((revert: boolean) => {
    if (revert && slotSnapshotRef.current) {
      setSelectedSlotRow(slotSnapshotRef.current);
      writeVisionSelectedSlot(slotSnapshotRef.current);
    }
    setSlotSheetOpen(false);
  }, []);

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

  const sheetCanApply = useMemo(() => {
    if (!slotSheetLoader.payload || !slotSheetLoader.selectedSlotId) return false;
    return Boolean(
      findVisionSlotInPayload(slotSheetLoader.payload, slotSheetLoader.selectedSlotId),
    );
  }, [slotSheetLoader.payload, slotSheetLoader.selectedSlotId]);

  const sheetActiveIsoDate = useMemo(() => {
    const days = slotSheetLoader.payload?.daysList ?? [];
    if (days.length === 0) return "";
    if (
      slotSheetLoader.selectedIsoDate &&
      days.includes(slotSheetLoader.selectedIsoDate)
    ) {
      return slotSheetLoader.selectedIsoDate;
    }
    return days[0] ?? "";
  }, [slotSheetLoader.payload, slotSheetLoader.selectedIsoDate]);

  const applySlotSheet = useCallback(() => {
    if (!slotSheetLoader.payload || !slotSheetLoader.selectedSlotId || !sheetCanApply) return;
    const row = findVisionSlotInPayload(
      slotSheetLoader.payload,
      slotSheetLoader.selectedSlotId,
    );
    if (!row) return;
    writeVisionSelectedSlot(row);
    setSelectedSlotRow(row);
    closeSlotSheet(false);
  }, [slotSheetLoader.payload, slotSheetLoader.selectedSlotId, sheetCanApply, closeSlotSheet]);

  const previewRx = previewAttachmentId
    ? glassesPrescriptions.find((r) => r.attachmentId === previewAttachmentId) ?? null
    : null;
  const previewTitle = previewRx?.title.trim() || previewRx?.attachmentId || "";

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
    const netId = clinic?.networkEntityId?.trim() ?? "";
    if (!netId) {
      toast.error("Missing network location. Go back and choose a clinic again.");
      return;
    }
    if (!selectedSlotRow) return;

    const rxStored = readVisionGlassesPrescriptions();
    if (isGlasses) {
      const withIds = rxStored.filter((r) => r.attachmentId.trim());
      if (withIds.length === 0) {
        toast.error("Add at least one prescription first.");
        void navigate(generatePath(ROUTES.visionAddPrescription, { visionType }), { replace: true });
        return;
      }
    }

    setBusy(true);
    try {
      const slotPayload = {
        slot_id: selectedSlotRow.slot_id,
        slot_date: selectedSlotRow.slot_date,
        start_time: selectedSlotRow.start_time,
        end_time: selectedSlotRow.end_time,
      };

      const response = await postVisionServiceRequest(
        isGlasses
          ? {
              booking_type: "store",
              user_id: uid,
              network_id: netId,
              address_id: addr.id.trim(),
              slot: slotPayload,
              prescription: rxStored
                .filter((r) => r.attachmentId.trim())
                .map((r) => ({ id: r.attachmentId.trim() })),
            }
          : {
              booking_type: "clinic",
              user_id: uid,
              network_id: netId,
              address_id: addr.id.trim(),
              slot: slotPayload,
            },
      );
      const { invoiceId, orderId, message } = parseServiceBookingResponse(response);
      const successState = buildServiceBookingSuccessState({
        kind: "vision",
        memberName: member?.name,
        bookingTypeLabel: isGlasses ? "Glasses / lens" : "Eye checkup",
        locationValue: clinic!.name.trim(),
        schedule: formatVisionSlotScheduleDisplay(
          selectedSlotRow.slot_date,
          selectedSlotRow.start_time,
          overviewMonthLabel,
        ),
        invoiceId: invoiceId || undefined,
        orderId: orderId || undefined,
        message: message || undefined,
      });
      void navigate(generatePath(ROUTES.visionBookingSuccess, { visionType }), {
        replace: true,
        state: successState,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete booking");
    } finally {
      setBusy(false);
    }
  }, [clinic, isGlasses, member, navigate, overviewMonthLabel, selectedSlotRow, toast, visionType]);

  const onConfirm = useCallback(async () => {
    const ok = await confirmDialog({
      title: VISION_CONFIRM_DIALOG.title,
      message: VISION_CONFIRM_DIALOG.message,
      confirmLabel: VISION_CONFIRM_DIALOG.confirmLabel,
      cancelLabel: VISION_CONFIRM_DIALOG.cancelLabel,
    });
    if (ok) void submitBooking();
  }, [confirmDialog, submitBooking]);

  if (!isEye && !isGlasses) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (!clinic || !selectedSlotRow || !member) {
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
        <Link to={backTo} className="dental-overview-page__back" aria-label="Back">
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
        <h1 className="dental-overview-page__title">{VISION_OVERVIEW_TITLE}</h1>
        <span className="dental-overview-page__top-spacer" aria-hidden />
      </header>

      <main className="dental-overview-page__main">
        <div className="dental-overview-page__scroll">
          <VaccinationAddressBar />

          <OverviewSectionCard title={vendorTitle} icon={<DentalOverviewIconClinic />}>
            <p className="dental-overview-page__clinic-name">{clinic.name}</p>
            {clinicAddr ? (
              <p className="dental-overview-page__clinic-addr">
                <DentalOverviewIconLocationPin />
                {clinicAddr}
              </p>
            ) : null}
          </OverviewSectionCard>

          <OverviewSectionCard title="Added Items" icon={<DentalOverviewIconMedical />} trailing="(1)">
            <p className="dental-overview-page__service">{serviceLabel}</p>
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
            <label className="dental-overview-page__alt-label" htmlFor="vision-alt-phone">
              Alternate Phone number
            </label>
            <div className="dental-overview-page__alt">
              <span className="dental-overview-page__alt-cc">+91</span>
              <input
                id="vision-alt-phone"
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

          {isGlasses && glassesPrescriptions.length > 0 ? (
            <OverviewSectionCard
              title="Uploaded Prescriptions"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M9 12h6m-6 4h3m5-11V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2v-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              trailing={`(${glassesPrescriptions.length})`}
            >
              <div className="vision-overview-page__rx-wrap">
                {glassesPrescriptions.map((rx) => (
                  <RxThumbButton
                    key={rx.attachmentId}
                    rx={rx}
                    onPreview={() => setPreviewAttachmentId(rx.attachmentId)}
                  />
                ))}
              </div>
            </OverviewSectionCard>
          ) : null}

          <section className="dental-overview-page__notes" aria-label="Important Notes">
            <header className="dental-overview-page__notes-head">
              <DentalOverviewIconInfo />
              <h2 className="dental-overview-page__notes-title">Important Notes</h2>
            </header>
            <ul className="dental-overview-page__notes-list">
              {importantNotes.map((note) => (
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
          aria-labelledby="vision-overview-slot-sheet-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSlotSheet(true);
          }}
        >
          <div className="vas-cvsl-sheet">
            <div className="cvsl-page vas-cvsl-sheet__inner">
              <header className="cvsl-top vas-cvsl-top">
                <h1 id="vision-overview-slot-sheet-title" className="cvsl-title">
                  {VISION_SLOT_SHEET_TITLE}
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
                {slotSheetLoader.isFullScreenLoading ? (
                  <div className="cvsl-msg" aria-busy="true">
                    Loading slots…
                  </div>
                ) : null}
                {slotSheetLoader.phase === "error" && slotSheetLoader.errorMsg ? (
                  <div className="cvsl-msg cvsl-msg--err" role="alert">
                    {slotSheetLoader.errorMsg}
                  </div>
                ) : null}
                {slotSheetLoader.phase === "ready" &&
                slotSheetLoader.payload &&
                slotSheetLoader.payload.daysList.length === 0 ? (
                  <div className="cvsl-msg" role="status">
                    {VISION_NO_SLOTS_AVAILABLE_COPY}
                  </div>
                ) : null}
                {slotSheetLoader.phase === "ready" &&
                slotSheetLoader.payload &&
                slotSheetLoader.payload.daysList.length > 0 ? (
                  <VisionSlotPicker
                    daysList={slotSheetLoader.payload.daysList}
                    slots={slotSheetLoader.payload.slots}
                    monthYearLabel={slotSheetLoader.monthYearLabel}
                    selectedIsoDate={sheetActiveIsoDate}
                    onSelectIsoDate={slotSheetLoader.onSelectIsoDate}
                    selectedSlotId={slotSheetLoader.selectedSlotId}
                    onSelectSlotId={slotSheetLoader.onSelectSlotId}
                    hideForLoading={slotSheetLoader.isFullScreenLoading}
                  />
                ) : null}
              </main>

              <footer className="cvsl-footer">
                <button
                  type="button"
                  className="cvsl-footer__book"
                  disabled={!sheetCanApply}
                  onClick={applySlotSheet}
                >
                  Confirm
                </button>
              </footer>
            </div>
          </div>
        </dialog>
      ) : null}

      {previewRx ? (
        <div
          className="vap-preview-overlay"
          role="presentation"
          onClick={() => setPreviewAttachmentId(null)}
        >
          <div
            className="vap-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vision-overview-rx-preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vap-preview-head">
              <h2 id="vision-overview-rx-preview-title" className="vap-preview-title">
                {previewTitle.length > 48 ? `${previewTitle.slice(0, 46)}…` : previewTitle}
              </h2>
              <button
                type="button"
                className="vap-preview-close"
                aria-label="Close preview"
                onClick={() => setPreviewAttachmentId(null)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="vap-preview-body">
              <OverviewRxPreviewBody rx={previewRx} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
