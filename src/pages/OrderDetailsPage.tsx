import {
  uploadConsultationRefDocumentFile,
  type ConsultationUploadRefType,
} from "@/api/patientUpload";
import { patchCancelServiceRequest } from "@/api/serviceRequest";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import {
  downloadConsultationPrescriptionPdf,
  fetchInvoiceOrderPageData,
  type ConsultationAttachmentRow,
  type InvoiceConsultationCompletedView,
  type InvoiceDetailModel,
} from "@/api/patientInvoices";
import {
  mapOfflinePaymentPreviewToSheetModel,
  patchOfflineAppointmentPaymentConfirm,
  patchOfflineAppointmentPaymentPreview,
  type OfflineBookingPaymentSheetModel,
} from "@/api/patientOfflineAppointmentPayment";
import { BookingConfirmationBottomSheet } from "@/components/orders/BookingConfirmationBottomSheet";
import { PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import { useConsultationPaymentVerify } from "@/hooks/useConsultationPaymentVerify";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import {
  AttachmentFilePreview,
  attachmentPreviewKindFromUrl,
  type AttachmentFilePreviewViewer,
} from "@/components/attachments/AttachmentFilePreview";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";
import { ROUTES } from "@/constants";
import {
  VIRTUAL_CONSULT_LANGUAGE_KEY,
  VIRTUAL_CONSULT_PURPOSE_KEY,
  writeVirtualFollowUpAppointmentId,
} from "@/constants/virtualConsultationSessionStorage";
import {
  writeConsultSelectedMembersSnapshots,
  writeConsultSelectedPersonIds,
} from "@/constants/consultationSelectedMemberStorage";
import { useToast } from "@/hooks/useToast";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import "./OrderDetailsPage.css";

const LINE_ITEMS_PREVIEW = 5;

function BannerIcon({
  tone,
  paymentPending,
}: Readonly<{ tone: InvoiceDetailModel["bannerTone"]; paymentPending?: boolean }>) {
  if (paymentPending) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M6 15h4M14 15h4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (tone === "completed") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 12l4 4 8-8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === "cancelled") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 8l8 8M16 8l-8 8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type PaymentRowProps = Readonly<{
  p: InvoiceDetailModel["payments"][number];
}>;

/** Maps / “directions” affordance (navigation pointer, not a generic pin). */
function NavMapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v12m0 0l4-4m-4 4l-4-4M6 20h12"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrescriptionListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h6"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ConsultationAttachIconKind = "image" | "pdf" | "file";

function consultationAttachmentIconKind(url: string | null, label: string): ConsultationAttachIconKind {
  const raw = `${url ?? ""} ${label}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(raw)) return "image";
  if (/\.pdf(\?|#|$)/i.test(raw)) return "pdf";
  return "file";
}

function AttachmentKindIcon({ kind }: Readonly<{ kind: ConsultationAttachIconKind }>) {
  if (kind === "image") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
        <path
          d="M21 15l-5-5-4 4-3-3-6 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "pdf") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M14 3v5h5M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function formatTxnIdDisplay(raw: string | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.startsWith("#") ? t : `#${t}`;
}

function paymentAmountModifier(statusLabel: string | null): "success" | "refunded" | "neutral" {
  const s = statusLabel?.trim().toLowerCase() ?? "";
  if (s === "refunded" || s.includes("refund")) return "refunded";
  if (s === "success" || s === "paid" || s === "completed") return "success";
  return "neutral";
}

function paymentAmountClassName(statusLabel: string | null): string {
  const mod = paymentAmountModifier(statusLabel);
  if (mod === "refunded") return "od-pay-card__amount od-pay-card__amount--refunded";
  if (mod === "success") return "od-pay-card__amount od-pay-card__amount--success";
  return "od-pay-card__amount";
}

function PaymentRow({ p }: PaymentRowProps) {
  const method = p.title.trim() || "—";
  const source = p.paymentSrc?.trim() || "—";
  const txnDisplay = formatTxnIdDisplay(p.paymentId);
  const statusText = p.statusLabel?.trim() ?? "";
  const amountClass = paymentAmountClassName(p.statusLabel);

  const noteFromApi = p.paymentNote?.trim();

  return (
    <li className="od-pay-card">
      {txnDisplay ? (
        <p className="od-pay-card__txn" title={p.paymentId ?? undefined}>
          {txnDisplay}
        </p>
      ) : null}
      <div className="od-pay-card__body">
        <div className="od-pay-card__cols">
          <dl className="od-pay-card__kv">
            <div className="od-pay-card__kv-row">
              <dt>Method</dt>
              <dd>{method}</dd>
            </div>
            <div className="od-pay-card__kv-row">
              <dt>Source</dt>
              <dd>{source}</dd>
            </div>
          </dl>
          <div className="od-pay-card__right">
            <span className={amountClass}>{p.amountFormatted}</span>
            {statusText ? <span className="od-pay-card__status">{statusText}</span> : null}
          </div>
        </div>
        {noteFromApi ? <p className="od-pay-card__note">Note: {noteFromApi}</p> : null}
      </div>
    </li>
  );
}

function doctorInitial(name: string): string {
  const t = name.trim();
  return t.length ? t.charAt(0).toUpperCase() : "?";
}

type ConsultationManagedFilesTabsProps = Readonly<{
  attachments: readonly ConsultationAttachmentRow[];
  reports: readonly ConsultationAttachmentRow[];
  refId: string | null;
  onPreview: (rows: readonly ConsultationAttachmentRow[], url: string | null, name: string) => void;
  attachmentFileInputRef: RefObject<HTMLInputElement | null>;
  reportFileInputRef: RefObject<HTMLInputElement | null>;
  attachmentAddBusy: boolean;
  reportUploadBusy: boolean;
  onPickAttachments: () => void;
  onPickReports: () => void;
  onAttachmentFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onReportFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}>;

function ConsultationManagedFilesTabs({
  attachments,
  reports,
  refId,
  onPreview,
  attachmentFileInputRef,
  reportFileInputRef,
  attachmentAddBusy,
  reportUploadBusy,
  onPickAttachments,
  onPickReports,
  onAttachmentFileChange,
  onReportFileChange,
}: ConsultationManagedFilesTabsProps) {
  const [tab, setTab] = useState<ConsultationUploadRefType>("ATTACHMENT");
  const [listKind, setListKind] = useState<ConsultationUploadRefType | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (listKind != null) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [listKind]);

  const items = tab === "ATTACHMENT" ? attachments : reports;
  const listItems = listKind === "REPORT" ? reports : attachments;
  const listHeading = listKind === "REPORT" ? "Reports" : "Attachments";
  const uploadBusy = tab === "ATTACHMENT" ? attachmentAddBusy : reportUploadBusy;
  const addDisabled = !refId?.trim() || uploadBusy;
  const rowKeyPrefix = tab === "ATTACHMENT" ? "att" : "rep";

  return (
    <>
      <section className="od-card od-card--attach od-card--attach-managed od-card--attach-tabs" aria-label="Files">
        <div className="od-attach-tabs" role="tablist" aria-label="Attachments or reports">
          <button
            type="button"
            role="tab"
            className="od-attach-tabs__tab"
            aria-selected={tab === "ATTACHMENT"}
            onClick={() => setTab("ATTACHMENT")}
          >
            Attachments
            {attachments.length > 0 ? (
              <span className="od-attach-tabs__count">{attachments.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            className="od-attach-tabs__tab"
            aria-selected={tab === "REPORT"}
            onClick={() => setTab("REPORT")}
          >
            Reports
            {reports.length > 0 ? <span className="od-attach-tabs__count">{reports.length}</span> : null}
          </button>
        </div>
        <div className="od-attach-tabs__panel" role="tabpanel">
          <div className="od-attach-tabs__toolbar">
            <button
              type="button"
              className="od-attach-add-btn"
              disabled={addDisabled}
              onClick={() => (tab === "ATTACHMENT" ? onPickAttachments() : onPickReports())}
            >
              {uploadBusy ? "Adding…" : "Add"}
            </button>
          </div>
          <input
            ref={attachmentFileInputRef}
            type="file"
            className="od-attach-file-input"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            multiple
            aria-label="Add consultation attachment"
            onChange={(e) => void onAttachmentFileChange(e)}
          />
          <input
            ref={reportFileInputRef}
            type="file"
            className="od-attach-file-input"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            multiple
            aria-label="Add consultation report"
            onChange={(e) => void onReportFileChange(e)}
          />
          <div className="od-attach-strip">
            <div className="od-attach-strip__icons">
              {items.length === 0 ? (
                <span className="od-attach-strip__empty">
                  No files yet — use Add or open the list
                </span>
              ) : (
                items.slice(0, 8).map((a, i) => {
                  const k = consultationAttachmentIconKind(a.url, a.label);
                  const hasUrl = Boolean(a.url?.trim());
                  const rows = tab === "ATTACHMENT" ? attachments : reports;
                  return (
                    <button
                      key={`${rowKeyPrefix}-${a.label}-${i}`}
                      type="button"
                      className="od-attach-strip__chip"
                      data-attach-kind={k}
                      title={a.label}
                      disabled={!hasUrl}
                      onClick={() => onPreview(rows, a.url, a.label)}
                    >
                      <AttachmentKindIcon kind={k} />
                    </button>
                  );
                })
              )}
            </div>
            <button type="button" className="od-attach-strip__cta" onClick={() => setListKind(tab)}>
              {items.length > 0 ? `View list (${items.length})` : "Open list"}
            </button>
          </div>
        </div>
      </section>
      <dialog
        ref={dialogRef}
        className="od-attach-dialog"
        aria-labelledby={dialogTitleId}
        onClose={() => setListKind(null)}
        onCancel={(e) => {
          e.preventDefault();
          setListKind(null);
        }}
      >
        <div className="od-attach-dialog__panel">
          <h2 id={dialogTitleId} className="od-attach-dialog__title">
            {listHeading}
          </h2>
          {listItems.length === 0 ? (
            <p className="od-attach-dialog__empty">Nothing uploaded yet.</p>
          ) : (
            <ul className="od-attach-dialog__list">
              {listItems.map((a, i) => {
                const k = consultationAttachmentIconKind(a.url, a.label);
                const dlgPrefix = listKind === "REPORT" ? "rep" : "att";
                return (
                  <li key={`${dlgPrefix}-dlg-${a.label}-${i}`} className="od-attach-dialog__item">
                    <span className="od-attach-dialog__item-kind" data-attach-kind={k}>
                      <AttachmentKindIcon kind={k} />
                    </span>
                    <div className="od-attach-dialog__item-main">
                      <span className="od-attach-dialog__item-label">{a.label}</span>
                      {a.url ? (
                        <button
                          type="button"
                          className="od-attach-dialog__link od-attach-dialog__link--btn"
                          onClick={() => {
                            onPreview(listItems, a.url, a.label);
                            setListKind(null);
                          }}
                        >
                          View
                        </button>
                      ) : (
                        <span className="od-attach-dialog__muted">No link</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <footer className="od-attach-dialog__footer">
            <button type="button" className="od-attach-dialog__btn" onClick={() => setListKind(null)}>
              Done
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}

type ConsultationAttachReportsReadOnlyTabsProps = Readonly<{
  attachments: readonly ConsultationAttachmentRow[];
  reports: readonly ConsultationAttachmentRow[];
  onPreview: (rows: readonly ConsultationAttachmentRow[], url: string | null, name: string) => void;
}>;

function ConsultationAttachReportsReadOnlyTabs({
  attachments,
  reports,
  onPreview,
}: ConsultationAttachReportsReadOnlyTabsProps) {
  const [tab, setTab] = useState<ConsultationUploadRefType>("ATTACHMENT");
  const hasAtt = attachments.length > 0;
  const hasRep = reports.length > 0;

  if (!hasAtt && !hasRep) {
    return (
      <section className="od-card od-card--attach" aria-label="Attachments">
        <h3 className="od-card__title">Attachments</h3>
        <p className="od-attach-empty">No attachments</p>
      </section>
    );
  }

  if (!hasRep) {
    return (
      <section className="od-card od-card--attach" aria-label="Attachments">
        <h3 className="od-card__title">Attachments</h3>
        <ul className="od-attach-list">
          {attachments.map((a, i) => (
            <li key={`${a.label}-${i}`} className="od-attach-item">
              {a.url ? (
                <button
                  type="button"
                  className="od-attach-item__link od-attach-item__link--btn"
                  onClick={() => onPreview(attachments, a.url, a.label)}
                >
                  {a.label}
                </button>
              ) : (
                <span className="od-attach-item__text">{a.label}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!hasAtt) {
    return (
      <section className="od-card od-card--attach" aria-label="Reports">
        <h3 className="od-card__title">Reports</h3>
        <ul className="od-attach-list">
          {reports.map((a, i) => (
            <li key={`rep-${a.label}-${i}`} className="od-attach-item">
              {a.url ? (
                <button
                  type="button"
                  className="od-attach-item__link od-attach-item__link--btn"
                  onClick={() => onPreview(reports, a.url, a.label)}
                >
                  {a.label}
                </button>
              ) : (
                <span className="od-attach-item__text">{a.label}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const items = tab === "ATTACHMENT" ? attachments : reports;
  const emptyMsg = tab === "ATTACHMENT" ? "No attachments" : "No reports";

  return (
    <section className="od-card od-card--attach od-card--attach-tabs" aria-label="Attachments and reports">
      <div className="od-attach-tabs" role="tablist" aria-label="Attachments or reports">
        <button
          type="button"
          role="tab"
          className="od-attach-tabs__tab"
          aria-selected={tab === "ATTACHMENT"}
          onClick={() => setTab("ATTACHMENT")}
        >
          Attachments
          <span className="od-attach-tabs__count">{attachments.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className="od-attach-tabs__tab"
          aria-selected={tab === "REPORT"}
          onClick={() => setTab("REPORT")}
        >
          Reports
          <span className="od-attach-tabs__count">{reports.length}</span>
        </button>
      </div>
      <div className="od-attach-tabs__panel od-attach-tabs__panel--readonly" role="tabpanel">
        {items.length === 0 ? (
          <p className="od-attach-empty od-attach-empty--tab">{emptyMsg}</p>
        ) : (
          <ul className="od-attach-list od-attach-list--tab">
            {items.map((a, i) => (
              <li key={`${tab}-${a.label}-${i}`} className="od-attach-item">
                {a.url ? (
                  <button
                    type="button"
                    className="od-attach-item__link od-attach-item__link--btn"
                    onClick={() => onPreview(items, a.url, a.label)}
                  >
                    {a.label}
                  </button>
                ) : (
                  <span className="od-attach-item__text">{a.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function OrderDetailsPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<InvoiceDetailModel | null>(null);
  const [consultationCompleted, setConsultationCompleted] =
    useState<InvoiceConsultationCompletedView | null>(null);
  const [appointmentIdForOrderCard, setAppointmentIdForOrderCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linesExpanded, setLinesExpanded] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [prescriptionDownloadBusyId, setPrescriptionDownloadBusyId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [offlinePaymentPreview, setOfflinePaymentPreview] = useState<OfflineBookingPaymentSheetModel | null>(
    null,
  );
  const [bookingPreviewLoading, setBookingPreviewLoading] = useState(false);
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingProceedBusy, setBookingProceedBusy] = useState(false);
  const [attachmentAddBusy, setAttachmentAddBusy] = useState(false);
  const [reportUploadBusy, setReportUploadBusy] = useState(false);
  const [consultationFilePreview, setConsultationFilePreview] = useState<AttachmentFilePreviewViewer>(null);
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const reportFileInputRef = useRef<HTMLInputElement>(null);
  const cancelDialogTitleId = useId();
  const cancelReasonFieldId = useId();
  const load = useCallback(async () => {
    if (!invoiceId) {
      setError("Missing order id");
      setDetail(null);
      setConsultationCompleted(null);
      setAppointmentIdForOrderCard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { detail: d, consultationCompleted: cc, appointmentIdForOrderCard: apptId } =
        await fetchInvoiceOrderPageData(invoiceId);
      setDetail(d);
      setConsultationCompleted(cc);
      setAppointmentIdForOrderCard(apptId);
      setLinesExpanded(d.lineItems.length <= LINE_ITEMS_PREVIEW);
      setPrescriptionOpen(cc != null && cc.prescriptions.length <= 1);
    } catch (e) {
      setDetail(null);
      setConsultationCompleted(null);
      setAppointmentIdForOrderCard(null);
      setError(e instanceof Error ? e.message : "Could not load order");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  const onBookFollowUp = useCallback(() => {
    if (!detail || consultationCompleted?.followUp == null) return;
    const fu = consultationCompleted.followUp;
    if (fu.patientId != null) {
      writeConsultSelectedPersonIds([String(fu.patientId)]);
      writeConsultSelectedMembersSnapshots([
        {
          id: String(fu.patientId),
          name: detail.patientName.trim() || "Member",
          phone: "",
          email: "",
          gender: "",
          dob: "",
        },
      ]);
    }
    try {
      sessionStorage.setItem(VIRTUAL_CONSULT_PURPOSE_KEY, "Follow-up consultation");
      if (fu.language) {
        sessionStorage.setItem(VIRTUAL_CONSULT_LANGUAGE_KEY, fu.language);
      }
    } catch {
      // ignore
    }
    writeVirtualFollowUpAppointmentId(fu.priorAppointmentId);
    navigate(generatePath(ROUTES.consultationVirtualSlots, { issueId: String(fu.issueId) }), {
      state: fu.slotsMeta,
    });
  }, [consultationCompleted?.followUp, detail, navigate]);

  const onDownloadPrescription = useCallback(
    async (prescriptionId: string) => {
      setPrescriptionDownloadBusyId(prescriptionId);
      try {
        await downloadConsultationPrescriptionPdf(prescriptionId);
        toast.success("Download started");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not download prescription";
        toast.info(msg);
      } finally {
        setPrescriptionDownloadBusyId(null);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const canCancelConsultation = useMemo(() => {
    if (detail?.consultationPlaceTag == null) return false;
    const serviceId = detail.consultationInfoId?.trim();
    if (!serviceId) return false;
    const st = detail.consultationInfoStatus;
    if (st === null) return false;
    return st !== 1 && st !== 2;
  }, [detail]);

  useEffect(() => {
    if (!canCancelConsultation) setCancelDialogOpen(false);
  }, [canCancelConsultation]);

  useEffect(() => {
    const d = cancelDialogRef.current;
    if (!d) return;
    if (cancelDialogOpen) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [cancelDialogOpen]);

  useEffect(() => {
    if (!cancelDialogOpen) {
      setCancelReason("");
      setCancelBusy(false);
    }
  }, [cancelDialogOpen]);

  const onPickConsultationAttachments = useCallback(() => {
    attachmentFileInputRef.current?.click();
  }, []);

  const onPickConsultationReports = useCallback(() => {
    reportFileInputRef.current?.click();
  }, []);

  const onConsultationRefUploadFiles = useCallback(
    async (e: ChangeEvent<HTMLInputElement>, refType: ConsultationUploadRefType) => {
      const input = e.target;
      /** `FileList` is live — snapshot before clearing the input or length becomes 0 and upload is skipped. */
      const files = input.files?.length ? Array.from(input.files) : [];
      const rid = detail?.consultationUploadRefId?.trim();
      input.value = "";
      if (files.length === 0) return;
      if (!rid) {
        toast.error("Missing appointment id for upload.");
        return;
      }
      const setBusy = refType === "ATTACHMENT" ? setAttachmentAddBusy : setReportUploadBusy;
      setBusy(true);
      try {
        for (const file of files) {
          await uploadConsultationRefDocumentFile(file, rid, refType);
        }
        toast.success(
          files.length === 1
            ? refType === "ATTACHMENT"
              ? "Attachment added"
              : "Report added"
            : refType === "ATTACHMENT"
              ? "Attachments added"
              : "Reports added",
        );
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [detail?.consultationUploadRefId, load, toast],
  );

  const openConsultationFilePreview = useCallback(
    (rows: readonly ConsultationAttachmentRow[], url: string | null, name: string) => {
      const u = url?.trim();
      if (!u) return;
      const items = rows
        .map((a) => ({ url: a.url?.trim() ?? "", name: a.label }))
        .filter((x) => x.url.length > 0);
      const idx = items.findIndex((x) => x.url === u);
      const kind = attachmentPreviewKindFromUrl(u);
      const label = name.trim() || null;
      if (items.length > 1 && idx >= 0) {
        setConsultationFilePreview({
          kind,
          url: u,
          name: label,
          gallery: { items, index: idx },
        });
      } else {
        setConsultationFilePreview({ kind, url: u, name: label });
      }
    },
    [],
  );

  const onConsultationGalleryNavigate = useCallback((delta: -1 | 1) => {
    setConsultationFilePreview((v) => {
      if (!v?.gallery) return v;
      const { items, index } = v.gallery;
      const ni = index + delta;
      if (ni < 0 || ni >= items.length) return v;
      const item = items[ni];
      return {
        kind: attachmentPreviewKindFromUrl(item.url),
        url: item.url,
        name: item.name?.trim() ? item.name.trim() : null,
        gallery: { items, index: ni },
      };
    });
  }, []);

  const onConfirmCancelConsultation = useCallback(async () => {
    const serviceId = detail?.consultationInfoId?.trim();
    if (!serviceId) return;
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason.");
      return;
    }
    setCancelBusy(true);
    try {
      await patchCancelServiceRequest(serviceId, cancelReason.trim());
      toast.success("Appointment cancelled");
      setCancelDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel appointment");
    } finally {
      setCancelBusy(false);
    }
  }, [cancelReason, detail?.consultationInfoId, load, toast]);

  const useWalletForOfflinePayment = false;

  const onPayConfirmBooking = useCallback(() => {
    const id = invoiceId?.trim();
    if (!id) return;
    setBookingSheetOpen(true);
    setOfflinePaymentPreview(null);
    setBookingPreviewLoading(true);
    void (async () => {
      try {
        const raw = await patchOfflineAppointmentPaymentPreview(id, useWalletForOfflinePayment);
        setOfflinePaymentPreview(mapOfflinePaymentPreviewToSheetModel(raw));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load payment details");
        setBookingSheetOpen(false);
      } finally {
        setBookingPreviewLoading(false);
      }
    })();
  }, [invoiceId, toast]);

  const consultationBookingSuccessRoute = useMemo(() => {
    return detail?.consultationPlaceTag === "virtual"
      ? ROUTES.consultationVirtualBookingSuccess
      : ROUTES.consultationHospitalBookingSuccess;
  }, [detail?.consultationPlaceTag]);

  const onPaymentVerifiedRef = useRef<() => void>(() => {});
  const onPaymentVerifyErrorRef = useRef<(message: string) => void>(() => {});
  const setBookingProceedBusyRef = useRef<(busy: boolean) => void>(() => {});

  useEffect(() => {
    setBookingProceedBusyRef.current = setBookingProceedBusy;
    onPaymentVerifiedRef.current = () => {
      setBookingSheetOpen(false);
      setOfflinePaymentPreview(null);
      setBookingProceedBusy(false);
      navigate(consultationBookingSuccessRoute, { replace: true });
    };
    onPaymentVerifyErrorRef.current = (message: string) => {
      toast.error(message);
      setBookingProceedBusy(false);
    };
  }, [consultationBookingSuccessRoute, navigate, toast]);

  useConsultationPaymentVerify({
    onSuccessRef: onPaymentVerifiedRef,
    onErrorRef: onPaymentVerifyErrorRef,
    setBusyRef: setBookingProceedBusyRef,
  });

  const onBookingSheetProceed = useCallback(async () => {
    const id = invoiceId?.trim();
    if (!id) return;
    setBookingProceedBusy(true);
    try {
      const res = await patchOfflineAppointmentPaymentConfirm(id, useWalletForOfflinePayment);
      const rzp = res.razorpayPayload;
      if (rzp != null && Object.keys(rzp).length > 0) {
        await loadRazorpayScript();
        if (!window.Razorpay) {
          toast.error("Razorpay Checkout could not load. Check your network or ad blocker.");
          setBookingProceedBusy(false);
          return;
        }
        openRazorpayCheckoutWithEvent(rzp, PAYMENT_DONE_EVENT, (failMsg) => {
          if (!isPaymentCancelledMessage(failMsg)) {
            toast.error(failMsg);
          }
          setBookingProceedBusy(false);
        });
        return;
      }
      if (!res.paymentRequired) {
        setBookingSheetOpen(false);
        setOfflinePaymentPreview(null);
        setBookingProceedBusy(false);
        navigate(consultationBookingSuccessRoute, { replace: true });
        return;
      }
      toast.error(res.message ?? "Payment could not be started");
      setBookingProceedBusy(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not proceed");
      setBookingProceedBusy(false);
    }
  }, [consultationBookingSuccessRoute, invoiceId, navigate, toast]);

  useEffect(() => {
    if (!bookingSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [bookingSheetOpen]);

  const lineItemsSlice = useMemo(() => {
    if (!detail) return { visible: [], hasMore: false, total: 0 };
    const total = detail.lineItems.length;
    const hasMore = total > LINE_ITEMS_PREVIEW;
    const visible =
      !hasMore || linesExpanded ? detail.lineItems : detail.lineItems.slice(0, LINE_ITEMS_PREVIEW);
    return { visible, hasMore, total };
  }, [detail, linesExpanded]);

  const cc = consultationCompleted;
  const showClinicalCard =
    cc != null &&
    (cc.symptoms != null ||
      cc.diagnosis != null ||
      cc.recommendation != null ||
      cc.history != null);
  const showInvoiceDetailsCard = detail != null && detail.lineItems.length > 0;
  const orderReferenceLabel = appointmentIdForOrderCard ? "Appointment ID" : "Order ID";
  const orderReferenceRaw = appointmentIdForOrderCard ?? detail?.orderIdDisplay ?? "—";
  const orderReferenceValue =
    appointmentIdForOrderCard &&
    detail?.consultationPlaceTag &&
    orderReferenceRaw !== "—" &&
    !orderReferenceRaw.startsWith("#")
      ? `#${orderReferenceRaw}`
      : orderReferenceRaw;
  const discountRowLabel = cc != null ? "Saved (Discount)" : "Discount";
  const collectionFeeRowLabel = cc != null ? "Convenience fee" : "Collection fee";
  const showFollowUpFooter = !loading && !error && detail != null && cc?.followUp != null;

  const goBack = () => {
    if (globalThis.history.length > 1) {
      navigate(-1);
    } else {
      navigate(ROUTES.orders);
    }
  };

  const headerTitle = loading ? "Loading…" : "Order Details";

  const isConsultationLayout = Boolean(detail?.isConsultationOrder);
  const showPayConfirmBooking = useMemo(() => {
    if (!detail?.isConsultationOrder) return false;
    return (
      detail.netPayAmount > 0 &&
      detail.consultationInfoStatus === 4 &&
      detail.consultationPaymentRequired === true
    );
  }, [detail]);

  const isPaymentPendingBanner = useMemo(() => {
    if (!detail?.isConsultationOrder) return false;
    return detail.consultationInfoStatus === 4 && detail.consultationPaymentRequired === true;
  }, [detail]);

  const visitCardVisible = useMemo(() => {
    if (detail?.consultationPlaceTag === "virtual") return false;
    const b = detail?.consultationBooking;
    if (!b) return false;
    return [
      b.scheduleDisplay,
      b.clinicName,
      b.doctorName,
      b.specialty,
      b.qualification,
      b.experienceLabel,
      b.addressLine,
    ].some((x) => x != null && String(x).trim().length > 0);
  }, [detail?.consultationBooking, detail?.consultationPlaceTag]);

  const showConsultationAttachmentManager = useMemo(() => {
    return Boolean(detail?.isConsultationOrder) && detail?.consultationInfoStatus === 1;
  }, [detail?.consultationInfoStatus, detail?.isConsultationOrder]);

  const patientDetailsVisible = useMemo(() => {
    if (!detail?.isConsultationOrder) return false;
    if (detail.patientName.trim().length > 0) return true;
    const p = detail.consultationPatient;
    return Boolean(p?.phone || p?.email || p?.ageGenderLine);
  }, [detail]);

  const showConsultationFooter =
    isConsultationLayout && (canCancelConsultation || showPayConfirmBooking);

  return (
    <div className="od-detail-page">
      <header className="od-top">
        <button type="button" onClick={goBack} className="od-back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="od-title" title={headerTitle}>
          {headerTitle}
        </h1>
        <span className="od-top__spacer" aria-hidden />
      </header>

      <main
        className={`od-main${showFollowUpFooter ? " od-main--follow" : ""}${showConsultationFooter ? " od-main--consult-footer" : ""}`}
      >
        {loading ? (
          <>
            <div className="od-skeleton" aria-busy="true" />
            <div className="od-skeleton" />
            <div className="od-skeleton" />
          </>
        ) : null}

        {!loading && error ? (
          <div className="od-error">
            <p>{error}</p>
            <button type="button" className="od-retry" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && detail ? (
          <>
            <section
              className={`od-banner od-banner--${detail.bannerTone}${isPaymentPendingBanner ? " od-banner--paymentPending" : ""}`}
            >
              <div className="od-banner__icon-row">
                <div
                  className={`od-banner__check${isPaymentPendingBanner ? " od-banner__check--paymentPending" : ""}`}
                  aria-hidden
                >
                  <BannerIcon tone={detail.bannerTone} paymentPending={isPaymentPendingBanner} />
                </div>
                <h2 className="od-banner__title">
                  {isPaymentPendingBanner ? "Status: Payment pending" : detail.bannerTitle}
                </h2>
              </div>
              <p className="od-banner__sub">{detail.bannerSubtitle}</p>
            </section>

            {cc != null && cc.doctor && !(isConsultationLayout && visitCardVisible) ? (
              <section className="od-card od-card--doctor" aria-label="Doctor">
                <h3 className="od-card__title">Doctor</h3>
                <div className="od-doc">
                  <div className="od-doc__avatar-wrap">
                    {cc.doctor.imageUrl ? (
                      <img
                        className="od-doc__avatar"
                        src={cc.doctor.imageUrl}
                        alt=""
                        width={56}
                        height={56}
                      />
                    ) : (
                      <div className="od-doc__avatar od-doc__avatar--placeholder" aria-hidden>
                        {doctorInitial(cc.doctor.name)}
                      </div>
                    )}
                  </div>
                  <div className="od-doc__meta">
                    <p className="od-doc__name">{cc.doctor.name}</p>
                    <p className="od-doc__spec">{cc.doctor.speciality}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {isConsultationLayout ? (
              <>
                <section className="od-card od-card--consult-appt" aria-label="Appointment">
                  <div className="od-card__head od-card__head--order-user">
                    <h3 className="od-card__title">Appointment</h3>
                    {detail.consultationPlaceTag ? (
                      <span
                        className={`od-place-tag od-place-tag--${detail.consultationPlaceTag}`}
                      >
                        {detail.consultationPlaceTag === "virtual" ? "Virtual" : "In-person"}
                      </span>
                    ) : null}
                  </div>
                  {orderReferenceValue !== "—" ? (
                    <div className="od-row">
                      <span className="od-row__label">{orderReferenceLabel}</span>
                      <span className="od-row__value od-row__value--other">{orderReferenceValue}</span>
                    </div>
                  ) : null}
                  {detail.consultationBooking?.scheduleDisplay ? (
                    <div className="od-row">
                      <span className="od-row__label">Schedule</span>
                      <span className="od-row__value od-row__value--other">
                        {detail.consultationBooking.scheduleDisplay}
                      </span>
                    </div>
                  ) : null}
                </section>

                {patientDetailsVisible ? (
                  <section className="od-card od-card--patient" aria-label="Patient details">
                    <h3 className="od-card__title">Patient Details</h3>
                    {detail.patientName.trim().length > 0 ? (
                      <div className="od-row">
                        <span className="od-row__label">Patient Name</span>
                        <span className="od-row__value od-row__value--other">{detail.patientName}</span>
                      </div>
                    ) : null}
                    {detail.consultationPatient?.phone ? (
                      <div className="od-row">
                        <span className="od-row__label">Phone</span>
                        <span className="od-row__value od-row__value--other">
                          {detail.consultationPatient.phone}
                        </span>
                      </div>
                    ) : null}
                    {detail.consultationPatient?.email ? (
                      <div className="od-row">
                        <span className="od-row__label">Email</span>
                        <span className="od-row__value od-row__value--other">
                          {detail.consultationPatient.email}
                        </span>
                      </div>
                    ) : null}
                    {detail.consultationPatient?.ageGenderLine ? (
                      <div className="od-row">
                        <span className="od-row__label">Age / Gender</span>
                        <span className="od-row__value od-row__value--other">
                          {detail.consultationPatient.ageGenderLine}
                        </span>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {detail.consultationPlaceTag === "virtual" &&
                detail.consultationOrderDoctor &&
                consultationCompleted == null ? (
                  <section className="od-card od-card--doctor" aria-label="Doctor details">
                    <h3 className="od-card__title">Doctor details</h3>
                    <div className="od-doc">
                      <div className="od-doc__avatar-wrap">
                        {detail.consultationOrderDoctor.imageUrl ? (
                          <img
                            className="od-doc__avatar"
                            src={detail.consultationOrderDoctor.imageUrl}
                            alt=""
                            width={56}
                            height={56}
                          />
                        ) : (
                          <div className="od-doc__avatar od-doc__avatar--placeholder" aria-hidden>
                            {doctorInitial(detail.consultationOrderDoctor.name)}
                          </div>
                        )}
                      </div>
                      <div className="od-doc__meta">
                        <p className="od-doc__name">{detail.consultationOrderDoctor.name}</p>
                        <p className="od-doc__spec">{detail.consultationOrderDoctor.speciality}</p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {visitCardVisible && detail.consultationBooking ? (
                  <section className="od-card od-card--visit" aria-label="Visit details">
                    <h3 className="od-card__title">Visit details</h3>
                    {detail.consultationBooking.clinicName ? (
                      <p className="od-visit__facility">{detail.consultationBooking.clinicName}</p>
                    ) : null}
                    {detail.consultationBooking.doctorName ? (
                      <p className="od-visit__doctor">{detail.consultationBooking.doctorName}</p>
                    ) : null}
                    {detail.consultationBooking.specialty ? (
                      <p className="od-visit__spec">{detail.consultationBooking.specialty}</p>
                    ) : null}
                    {detail.consultationBooking.qualification ? (
                      <p className="od-visit__qual">{detail.consultationBooking.qualification}</p>
                    ) : null}
                    {detail.consultationBooking.experienceLabel ? (
                      <p className="od-visit__exp">{detail.consultationBooking.experienceLabel}</p>
                    ) : null}
                    {detail.consultationBooking.addressLine || detail.consultationBooking.mapsUrl ? (
                      <div className="od-visit__addr-row">
                        {detail.consultationBooking.addressLine ? (
                          <p className="od-visit__addr">{detail.consultationBooking.addressLine}</p>
                        ) : null}
                        {detail.consultationBooking.mapsUrl ? (
                          <a
                            className="od-visit__map-btn"
                            href={detail.consultationBooking.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open directions in maps"
                          >
                            <NavMapIcon />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : (
              <section className="od-card od-card--order-patient">
                <div className="od-card__head od-card__head--order-user">
                  <h3 className="od-card__title">Order &amp; user</h3>
                  {detail.consultationPlaceTag ? (
                    <span
                      className={`od-place-tag od-place-tag--${detail.consultationPlaceTag}`}
                    >
                      {detail.consultationPlaceTag === "virtual" ? "Virtual" : "In-person"}
                    </span>
                  ) : null}
                </div>
                <div className="od-row">
                  <span className="od-row__label">{orderReferenceLabel}</span>
                  <span className="od-row__value od-row__value--other">{orderReferenceValue}</span>
                </div>
                <div className="od-row od-service-row">
                  <span className="od-row__label">Service Type</span>
                  <div className="od-row__value-row">
                    <span className="od-row__value od-row__value--other">{detail.serviceTypeLabel}</span>
                    <OrderCategoryIcon
                      categoryKey={detail.categoryKey}
                      width={22}
                      height={22}
                      className="od-row__svc-icon"
                    />
                  </div>
                </div>
                <div className="od-row">
                  <span className="od-row__label">Order Date</span>
                  <span className="od-row__value od-row__value--other">{detail.orderDateTimeDisplay}</span>
                </div>
                <div className="od-row">
                  <span className="od-row__label">User</span>
                  <span className="od-row__value od-row__value--other">{detail.patientName}</span>
                </div>
                {detail.vendorName === "—" ? null : (
                  <div className="od-row">
                    <span className="od-row__label">Vendor</span>
                    <span className="od-row__value od-row__value--other">{detail.vendorName}</span>
                  </div>
                )}
                {canCancelConsultation && !showConsultationFooter ? (
                  <div className="od-order-cancel-wrap">
                    <button
                      type="button"
                      className="od-btn-cancel-appt"
                      onClick={() => {
                        setCancelReason("");
                        setCancelDialogOpen(true);
                      }}
                    >
                      Cancel appointment
                    </button>
                  </div>
                ) : null}
              </section>
            )}

            {showClinicalCard && cc ? (
              <section className="od-card od-card--clinical" aria-label="Consultation summary">
                <h3 className="od-card__title">Consultation summary</h3>
                {cc.symptoms ? (
                  <div className="od-clinical">
                    <span className="od-clinical__label">Symptoms</span>
                    <p className="od-clinical__text">{cc.symptoms}</p>
                  </div>
                ) : null}
                {cc.diagnosis ? (
                  <div className="od-clinical">
                    <span className="od-clinical__label">Diagnosis</span>
                    <p className="od-clinical__text">{cc.diagnosis}</p>
                  </div>
                ) : null}
                {cc.recommendation ? (
                  <div className="od-clinical">
                    <span className="od-clinical__label">Recommendations</span>
                    <p className="od-clinical__text">{cc.recommendation}</p>
                  </div>
                ) : null}
                {cc.history ? (
                  <div className="od-clinical">
                    <span className="od-clinical__label">History</span>
                    <p className="od-clinical__text">{cc.history}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {cc != null && cc.prescriptions.length > 0 ? (
              <section className="od-card od-card--rx" aria-label="Prescription">
                <h3 className="od-card__title">Prescription</h3>
                <div className="od-rx-row">
                  <div className="od-rx-row__icon" aria-hidden>
                    <PrescriptionListIcon />
                  </div>
                  <div className="od-rx-row__mid">
                    <span className="od-rx-row__title">Prescription</span>
                    <button
                      type="button"
                      className="od-rx-row__link"
                      onClick={() => setPrescriptionOpen((o) => !o)}
                    >
                      Click here to view
                      {cc.prescriptions.length > 1 ? ` (${cc.prescriptions.length})` : ""}
                    </button>
                  </div>
                  {cc.prescriptions.length === 1 ? (
                    <button
                      type="button"
                      className="od-rx-row__dl"
                      aria-label="Download prescription"
                      disabled={prescriptionDownloadBusyId === cc.prescriptions[0].id}
                      onClick={() => void onDownloadPrescription(cc.prescriptions[0].id)}
                    >
                      <DownloadIcon />
                    </button>
                  ) : null}
                </div>
                {prescriptionOpen ? (
                  <ul className="od-rx-list">
                    {cc.prescriptions.map((rx) => (
                      <li key={rx.id} className="od-rx-item">
                        <div className="od-rx-item__head">
                          <span className="od-rx-item__meta">
                            {rx.createdAtLabel ? `${rx.createdAtLabel} · ` : ""}
                            {rx.medicineNames.length} medicine{rx.medicineNames.length === 1 ? "" : "s"}
                          </span>
                          <button
                            type="button"
                            className="od-rx-item__dl"
                            aria-label="Download this prescription"
                            disabled={prescriptionDownloadBusyId === rx.id}
                            onClick={() => void onDownloadPrescription(rx.id)}
                          >
                            <DownloadIcon />
                          </button>
                        </div>
                        {rx.medicineNames.length > 0 ? (
                          <p className="od-rx-item__meds">{rx.medicineNames.join(", ")}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {isConsultationLayout && showConsultationAttachmentManager ? (
              <ConsultationManagedFilesTabs
                attachments={detail.consultationAttachments}
                reports={detail.consultationReports}
                refId={detail.consultationUploadRefId}
                onPreview={openConsultationFilePreview}
                attachmentFileInputRef={attachmentFileInputRef}
                reportFileInputRef={reportFileInputRef}
                attachmentAddBusy={attachmentAddBusy}
                reportUploadBusy={reportUploadBusy}
                onPickAttachments={onPickConsultationAttachments}
                onPickReports={onPickConsultationReports}
                onAttachmentFileChange={(e) => void onConsultationRefUploadFiles(e, "ATTACHMENT")}
                onReportFileChange={(e) => void onConsultationRefUploadFiles(e, "REPORT")}
              />
            ) : isConsultationLayout ? (
              <ConsultationAttachReportsReadOnlyTabs
                attachments={detail.consultationAttachments}
                reports={detail.consultationReports}
                onPreview={openConsultationFilePreview}
              />
            ) : cc != null && cc.attachments.length > 0 ? (
              <section className="od-card od-card--attach" aria-label="Attachments">
                <h3 className="od-card__title">Attachments</h3>
                <ul className="od-attach-list">
                  {cc.attachments.map((a, i) => (
                    <li key={`${a.label}-${i}`} className="od-attach-item">
                      {a.url ? (
                        <button
                          type="button"
                          className="od-attach-item__link od-attach-item__link--btn"
                          onClick={() => openConsultationFilePreview(cc.attachments, a.url, a.label)}
                        >
                          {a.label}
                        </button>
                      ) : (
                        <span className="od-attach-item__text">{a.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {showInvoiceDetailsCard ? (
              <section className={`od-card${isConsultationLayout ? " od-card--invoice-consult" : ""}`}>
                <div className="od-card__head">
                  <h3 className="od-card__title">
                    {isConsultationLayout || cc != null ? "Invoice details" : "Service Details"}
                  </h3>
                  {lineItemsSlice.total > LINE_ITEMS_PREVIEW ? (
                    <span className="od-card__count">{lineItemsSlice.total} items</span>
                  ) : null}
                </div>
                {detail.lineItems.length > 0 ? (
                  <>
                    <div
                      className={`od-table-wrap${lineItemsSlice.hasMore && linesExpanded ? " od-table-wrap--lines-scroll" : ""}`}
                    >
                      <table
                        className={`od-table od-table--compact${isConsultationLayout ? " od-table--invoice5" : ""}`}
                      >
                        <thead>
                          <tr>
                            <th scope="col">{isConsultationLayout ? "Description" : "Product"}</th>
                            {isConsultationLayout ? (
                              <th scope="col" className="od-table__num">
                                MRP
                              </th>
                            ) : null}
                            <th scope="col" className="od-table__num">
                              {isConsultationLayout ? "Price" : "Qty"}
                            </th>
                            <th scope="col" className="od-table__num">
                              {isConsultationLayout ? "Qty" : "Price"}
                            </th>
                            <th scope="col" className="od-table__num">
                              {isConsultationLayout ? "Amount" : "Amt"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItemsSlice.visible.map((line, i) =>
                            isConsultationLayout ? (
                              <tr key={`${line.productName}-${i}`}>
                                <td className="od-table__product">{line.productName}</td>
                                <td className="od-table__num">{line.mrpFormatted ?? "—"}</td>
                                <td className="od-table__num">{line.unitPriceFormatted}</td>
                                <td className="od-table__num">{line.qty}</td>
                                <td className="od-table__num od-table__strong">{line.lineTotalFormatted}</td>
                              </tr>
                            ) : (
                              <tr key={`${line.productName}-${i}`}>
                                <td className="od-table__product">{line.productName}</td>
                                <td className="od-table__num">{line.qty}</td>
                                <td className="od-table__num">{line.unitPriceFormatted}</td>
                                <td className="od-table__num od-table__strong">{line.lineTotalFormatted}</td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                    {lineItemsSlice.hasMore ? (
                      <button
                        type="button"
                        className="od-lines-toggle"
                        onClick={() => setLinesExpanded((x) => !x)}
                      >
                        {linesExpanded
                          ? `Show less`
                          : `Show all ${lineItemsSlice.total} items`}
                      </button>
                    ) : null}
                    {isConsultationLayout ? (
                      <div className="od-inv-foot">
                        <div className="od-inv-summary">
                          <div className="od-pay-row od-pay-row--invoice-total">
                            <span className="od-pay-row__label">Total</span>
                            <span className="od-pay-row__value">{detail.subTotalFormatted}</span>
                          </div>
                          {detail.collectionFeeFormatted ? (
                            <div className="od-pay-row">
                              <span className="od-pay-row__label">Convenience charges</span>
                              <span className="od-pay-row__value od-pay-row__value--add">
                                {detail.collectionFeeFormatted}
                              </span>
                            </div>
                          ) : null}
                          {detail.discountFormatted ? (
                            <div className="od-pay-row">
                              <span className="od-pay-row__label">Saved</span>
                              <span className="od-pay-row__value od-pay-row__value--deduct">
                                {detail.discountFormatted}
                              </span>
                            </div>
                          ) : (
                            <div className="od-pay-row">
                              <span className="od-pay-row__label">Saved</span>
                              <span className="od-pay-row__value">- ₹0</span>
                            </div>
                          )}
                          {detail.walletDebitFormatted ? (
                            <div className="od-pay-row">
                              <span className="od-pay-row__label">From Wallet</span>
                              <span className="od-pay-row__value od-pay-row__value--wallet">
                                {detail.walletDebitFormatted}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="od-inv-net">
                          <span className="od-inv-net__label">Net amount</span>
                          <span className="od-inv-net__value">{detail.netPayFormatted}</span>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </section>
            ) : null}

            {!isConsultationLayout ? (
              <section className="od-card">
                <h3 className="od-card__title">Payment Summary</h3>
                <div className="od-pay-row">
                  <span className="od-pay-row__label">Sub Total</span>
                  <span className="od-pay-row__value">{detail.subTotalFormatted}</span>
                </div>
                {detail.discountFormatted ? (
                  <div className="od-pay-row">
                    <span className="od-pay-row__label">{discountRowLabel}</span>
                    <span className="od-pay-row__value od-pay-row__value--deduct">
                      {detail.discountFormatted}
                    </span>
                  </div>
                ) : null}
                {detail.collectionFeeFormatted ? (
                  <div className="od-pay-row">
                    <span className="od-pay-row__label">{collectionFeeRowLabel}</span>
                    <span className="od-pay-row__value od-pay-row__value--add">
                      {detail.collectionFeeFormatted}
                    </span>
                  </div>
                ) : null}
                {detail.walletDebitFormatted ? (
                  <div className="od-pay-row">
                    <span className="od-pay-row__label">From Wallet</span>
                    <span className="od-pay-row__value od-pay-row__value--wallet">
                      {detail.walletDebitFormatted}
                    </span>
                  </div>
                ) : null}
                <div className="od-pay-total">
                  <span className="od-pay-total__label">Net Pay</span>
                  <span className="od-pay-total__value">{detail.netPayFormatted}</span>
                </div>
              </section>
            ) : null}

            {detail.payments.length > 0 ? (
              <section className="od-card od-card--payments" aria-label="Payment details">
                <h3 className="od-payment-details__title">Payment Details</h3>
                <ul className="od-payment-details__list">
                  {detail.payments.map((p, i) => (
                    <PaymentRow key={p.paymentId ?? `${p.title}-${i}`} p={p} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      {bookingSheetOpen ? (
        <BookingConfirmationBottomSheet
          open
          model={offlinePaymentPreview}
          previewLoading={bookingPreviewLoading}
          busy={bookingProceedBusy}
          onClose={() => {
            if (!bookingProceedBusy) {
              setBookingSheetOpen(false);
              setOfflinePaymentPreview(null);
              setBookingPreviewLoading(false);
            }
          }}
          onProceed={onBookingSheetProceed}
        />
      ) : null}

      {showConsultationFooter ? (
        <footer className="od-consult-footer">
          {canCancelConsultation ? (
            <button
              type="button"
              className="od-consult-footer__btn od-consult-footer__btn--cancel"
              onClick={() => {
                setCancelReason("");
                setCancelDialogOpen(true);
              }}
            >
              Cancel
            </button>
          ) : null}
          {showPayConfirmBooking ? (
            <button
              type="button"
              className="od-consult-footer__btn od-consult-footer__btn--pay"
              onClick={onPayConfirmBooking}
            >
              Pay / confirm
            </button>
          ) : null}
        </footer>
      ) : null}

      {showFollowUpFooter ? (
        <footer className="od-follow-footer">
          <button type="button" className="od-follow-footer__btn" onClick={() => onBookFollowUp()}>
            Book a follow-up
          </button>
        </footer>
      ) : null}

      {canCancelConsultation ? (
        <dialog
          ref={cancelDialogRef}
          className="od-cancel-dialog"
          aria-labelledby={cancelDialogTitleId}
          aria-describedby={`${cancelDialogTitleId}-desc`}
          onClose={() => setCancelDialogOpen(false)}
          onCancel={(e) => {
            e.preventDefault();
            setCancelDialogOpen(false);
          }}
        >
          <div className="od-cancel-dialog__panel">
            <h2 id={cancelDialogTitleId} className="od-cancel-dialog__title">
              Cancel appointment?
            </h2>
            <p id={`${cancelDialogTitleId}-desc`} className="od-cancel-dialog__desc">
              Please tell us why you are cancelling. This helps us improve the service.
            </p>
            <label className="od-cancel-dialog__label" htmlFor={cancelReasonFieldId}>
              Reason for cancellation
            </label>
            <textarea
              id={cancelReasonFieldId}
              className="od-cancel-dialog__textarea"
              rows={4}
              maxLength={2000}
              placeholder="Enter your reason…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              aria-required="true"
            />
            <footer className="od-cancel-dialog__footer">
              <button
                type="button"
                className="od-cancel-dialog__btn od-cancel-dialog__btn--secondary"
                disabled={cancelBusy}
                onClick={() => setCancelDialogOpen(false)}
              >
                Keep appointment
              </button>
              <button
                type="button"
                className="od-cancel-dialog__btn od-cancel-dialog__btn--danger"
                disabled={cancelBusy || !cancelReason.trim()}
                onClick={() => void onConfirmCancelConsultation()}
              >
                {cancelBusy ? "Cancelling…" : "Confirm cancel"}
              </button>
            </footer>
          </div>
        </dialog>
      ) : null}

      <AttachmentFilePreview
        viewer={consultationFilePreview}
        onClose={() => setConsultationFilePreview(null)}
        onGalleryNavigate={onConsultationGalleryNavigate}
      />
    </div>
  );
}
