import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { readSelectedAddress } from "@/constants/selectedAddressStorage";
import {
  readVisionGlassesPrescriptions,
  readVisionSelectedClinic,
  readVisionSelectedSlot,
  type VisionGlassesPrescriptionStored,
} from "@/constants/visionBookingStorage";
import { readDiagnosticsSelectedMembersSnapshots } from "@/constants/diagnosticsSelectedMemberStorage";
import { postVisionServiceRequest } from "@/api/visionServiceBooking";
import type { VisionServiceSlotRow } from "@/api/visionServiceSlots";
import {
  formatPreferredApiDateTime,
  formatVaccineSlotDisplay,
} from "@/components/vaccination/VaccinationSlotPicker";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { fetchPatientProfile, resolveProfileImageUrl } from "@/api/patientProfile";
import { getAccessToken } from "@/lib/authStorage";
import { useToast } from "@/hooks/useToast";
import { generatePath, Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./VaccinationOverviewPage.css";
import "./DentalOverviewPage.css";
import "./VisionAddPrescriptionPage.css";

/** Shown in “Added items” for the eye-checkup overview (vision.clinic). */
const EYE_CHECKUP_SERVICE_NAME = "Eye Checkup";
const GLASSES_LENS_SERVICE_NAME = "Glasses / Lens";

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

function formatGlassesRxUploadedAt(iso: string): string {
  if (!iso.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Same rules as add-prescription: `path` + `type` + title extension → preview URL and kind. */
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

function OverviewRxThumb(props: Readonly<{ rx: VisionGlassesPrescriptionStored }>) {
  const role = rxPreviewRole(props.rx);
  if (role?.kind === "image") {
    return <img src={role.src} alt="" className="dental-overview__rx-thumb-img" />;
  }
  if (role?.kind === "pdf") {
    return <span className="dental-overview__rx-thumb-pdf">PDF</span>;
  }
  if (role?.kind === "file") {
    return <span className="dental-overview__rx-thumb-file">FILE</span>;
  }
  return (
    <span className="dental-overview__rx-thumb-placeholder" aria-hidden>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 12h6m-6 4h3m5-11V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2v-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 8l3-3m0 0v4m0-4h-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
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
  const params = useParams<{ visionType: string }>();
  const visionType = params.visionType?.trim() ?? "";
  const location = useLocation();

  const [altPhone, setAltPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(null);
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);

  const clinic = useMemo(() => readVisionSelectedClinic(), []);
  const slotRow = useMemo(() => readVisionSelectedSlot(), []);
  const member = useMemo(() => readDiagnosticsSelectedMembersSnapshots()[0] ?? null, []);

  const slotDisplay = useMemo(() => (slotRow ? displayVisionSlot(slotRow) : ""), [slotRow]);

  const isEye = visionType === VISION_ROUTE_TYPE.eyeCheckup;
  const isGlasses = visionType === VISION_ROUTE_TYPE.glassesLens;

  const glassesPrescriptions = useMemo(
    () => (isGlasses ? readVisionGlassesPrescriptions() : []),
    [isGlasses, location.key, location.pathname],
  );
  const serviceLabel = isGlasses ? GLASSES_LENS_SERVICE_NAME : EYE_CHECKUP_SERVICE_NAME;
  const backTo = isGlasses
    ? generatePath(ROUTES.visionAddPrescription, { visionType })
    : generatePath(ROUTES.visionSlots, { visionType });

  useEffect(() => {
    if (!isEye && !isGlasses) {
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
      return;
    }
    if (isGlasses && readVisionGlassesPrescriptions().length === 0) {
      void navigate(generatePath(ROUTES.visionAddPrescription, { visionType }), { replace: true });
    }
  }, [clinic, isEye, isGlasses, member, slotRow, visionType, navigate, toast]);

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

  const displayPhone = primaryPhone ?? "—";
  const patientLine = member?.name?.trim() ? `For ${member.name.trim()}` : "For —";

  const previewRx = previewAttachmentId
    ? glassesPrescriptions.find((r) => r.attachmentId === previewAttachmentId) ?? null
    : null;
  const previewTitle = previewRx?.title.trim() || previewRx?.attachmentId || "";

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
        slot_id: slotRow.slot_id,
        slot_date: slotRow.slot_date,
        start_time: slotRow.start_time,
        end_time: slotRow.end_time,
      };

      await postVisionServiceRequest(
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
      void navigate(generatePath(ROUTES.visionBookingSuccess, { visionType }), { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete booking");
    } finally {
      setBusy(false);
    }
  }, [clinic, isGlasses, member, navigate, slotRow, toast, visionType]);

  if (!isEye && !isGlasses) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (!clinic || !slotRow || !member) {
    return null;
  }

  return (
    <div className="hco-page dental-overview">
      <header className="hco-top">
        <Link
          to={backTo}
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
          <p className="dental-overview__service">{serviceLabel}</p>
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

          {isGlasses && glassesPrescriptions.length > 0 ? (
            <section className="hco-block dental-overview__rx" aria-labelledby="vision-overview-rx-heading">
              <div className="hco-label" id="vision-overview-rx-heading">
                Uploaded Prescriptions
              </div>
              <ul className="dental-overview__rx-list">
                {glassesPrescriptions.map((rx) => {
                  const title = rx.title.trim() || rx.attachmentId;
                  const short = title.length > 42 ? `${title.slice(0, 40)}…` : title;
                  const canPreview = Boolean(rxPreviewRole(rx));
                  return (
                    <li key={rx.attachmentId} className="dental-overview__rx-item">
                      <div className="dental-overview__rx-item-inner">
                        <div className="dental-overview__rx-thumb">
                          <OverviewRxThumb rx={rx} />
                        </div>
                        <div className="dental-overview__rx-text">
                          <span className="dental-overview__rx-name" title={title}>
                            {short}
                          </span>
                          <span className="dental-overview__rx-time">
                            {formatGlassesRxUploadedAt(rx.uploadedAt)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="dental-overview__rx-preview-btn"
                          aria-label={`Preview ${title}`}
                          disabled={!canPreview}
                          onClick={() => canPreview && setPreviewAttachmentId(rx.attachmentId)}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7z"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

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
