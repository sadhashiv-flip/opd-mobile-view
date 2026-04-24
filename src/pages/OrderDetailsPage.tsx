import {
  uploadConsultationRefDocumentFile,
  type ConsultationUploadRefType,
} from "@/api/patientUpload";
import {
  patchCancelServiceRequest,
  patchServiceRequestOrderCancel,
  patchServiceRequestOrderConfirm,
} from "@/api/serviceRequest";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { fetchConsultationReportPdfObjectUrl } from "@/api/patientConsultationReport";
import {
  downloadConsultationPrescriptionPdf,
  fetchInvoiceOrderPageData,
  isPartnerOrderPayFlowCategory,
  type ConsultationAttachmentRow,
  type InvoiceConsultationCompletedView,
  type InvoiceDetailModel,
  type LabSubOrderDetailRow,
} from "@/api/patientInvoices";
import { patchJumpingMindOrderCancel } from "@/api/patientJumpingMindOrder";
import { patchLabOrderConfirm } from "@/api/patientLabOrderConfirm";
import {
  patchLabOrderPaymentConfirm,
  patchLabOrderPaymentPreview,
  verifyLabOrderPayment,
} from "@/api/patientLabOrderPayment";
import { patchMedicineOrderConfirm } from "@/api/patientMedicineOrderConfirm";
import {
  patchPharmacyOrderPaymentConfirm,
  patchPharmacyOrderPaymentPreview,
  verifyPharmacyOrderPayment,
  type PharmacyOrderPaymentVerifyBody,
} from "@/api/patientPharmacyOrderPayment";
import {
  patchServiceRequestOrderPaymentConfirm,
  patchServiceRequestOrderPaymentPreview,
  verifyServiceRequestOrderPayment,
} from "@/api/patientServiceRequestOrderPayment";
import {
  mapGymInvoiceDetailToBookingSheetModel,
  mapOfflinePaymentPreviewToSheetModel,
  patchOfflineAppointmentPaymentConfirm,
  patchOfflineAppointmentPaymentPreview,
  type OfflineBookingPaymentSheetModel,
} from "@/api/patientOfflineAppointmentPayment";
import { patchGymPaymentConfirm } from "@/api/patientGymPayment";
import { BookingConfirmationBottomSheet } from "@/components/orders/BookingConfirmationBottomSheet";
import { LabOrderRescheduleBottomSheet } from "@/components/orders/LabOrderRescheduleBottomSheet";
import {
  DIAGNOSTICS_PAYMENT_DONE_EVENT,
  GYM_PAYMENT_DONE_EVENT,
  PAYMENT_DONE_EVENT,
  PHARMACY_PAYMENT_DONE_EVENT,
} from "@/constants/windowPaymentEvents";
import { useConsultationPaymentVerify } from "@/hooks/useConsultationPaymentVerify";
import { useDiagnosticsRazorpayConfirm } from "@/hooks/useDiagnosticsRazorpayConfirm";
import { useGymPaymentVerify } from "@/hooks/useGymPaymentVerify";
import { usePharmacyOrderPaymentVerify } from "@/hooks/usePharmacyOrderPaymentVerify";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
  normalizeRazorpayCheckoutPayload,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import { AttachmentFilePreview, type AttachmentFilePreviewViewer } from "@/components/attachments/AttachmentFilePreview";
import {
  ConsultationAttachReportsReadOnlyTabs,
  ConsultationManagedFilesTabs,
} from "@/components/orders/OrderDetailConsultationAttachments";
import {
  ORDER_DETAIL_LINE_ITEMS_PREVIEW,
  OrderDetailInvoiceSection,
  OrderDetailPatientSection,
  OrderDetailPaymentSummaryFallback,
  OrderDetailServiceMetaCard,
} from "@/components/orders/OrderDetailSharedSections";
import { ROUTES, VISION_ROUTE_TYPE } from "@/constants";
import { DEFAULT_CONSULT_SUCCESS_TITLE } from "@/constants/bookingSuccessNavigation";
import {
  VIRTUAL_CONSULT_LANGUAGE_KEY,
  VIRTUAL_CONSULT_PURPOSE_KEY,
  writeVirtualFollowUpAppointmentId,
} from "@/constants/virtualConsultationSessionStorage";
import {
  writeConsultSelectedMembersSnapshots,
  writeConsultSelectedPersonIds,
} from "@/constants/consultationSelectedMemberStorage";
import { useAttachmentFilePreviewGallery } from "@/hooks/useAttachmentFilePreviewGallery";
import { useToast } from "@/hooks/useToast";
import { orderDetailKindInUrlFromCategoryKey } from "@/lib/orderDetailRoutes";
import { generatePath, useNavigate, useParams, type NavigateFunction } from "react-router-dom";
import "./OrderDetailsPage.css";

function inferVisionBookingSuccessType(
  detail: Pick<InvoiceDetailModel, "serviceTypeLabel" | "lineItems">,
): string {
  const label = detail.serviceTypeLabel?.toLowerCase() ?? "";
  if (label.includes("glass") || label.includes("lens")) return VISION_ROUTE_TYPE.glassesLens;
  for (const line of detail.lineItems) {
    const n = line.productName.toLowerCase();
    if (n.includes("glass") || n.includes("lens")) return VISION_ROUTE_TYPE.glassesLens;
  }
  return VISION_ROUTE_TYPE.eyeCheckup;
}

/** After partner pay (no Razorpay or post-verify): pharmacy card vs consult-style success for vision/dental/vaccine. */
function navigatePartnerOrderPaymentSuccess(
  navigate: NavigateFunction,
  detail: Pick<InvoiceDetailModel, "categoryKey" | "serviceTypeLabel" | "lineItems">,
  pharmacyPayReturnPath: string,
): void {
  switch (detail.categoryKey) {
    case "pharmacy":
      navigate(ROUTES.pharmacyOrderSuccess, {
        replace: true,
        state: { returnPath: pharmacyPayReturnPath },
      });
      return;
    case "lab":
      navigate(ROUTES.bookingSuccess, {
        replace: true,
        state: {
          layout: "consult" as const,
          title: DEFAULT_CONSULT_SUCCESS_TITLE,
          description: "Your lab appointment has been booked successfully.",
        },
      });
      return;
    case "dental":
      navigate(ROUTES.dentalBookingSuccess, { replace: true });
      return;
    case "vision": {
      const visionType = inferVisionBookingSuccessType(detail);
      navigate(generatePath(ROUTES.visionBookingSuccess, { visionType }), { replace: true });
      return;
    }
    default:
      navigate(ROUTES.bookingSuccess, {
        replace: true,
        state: {
          layout: "consult" as const,
          title: DEFAULT_CONSULT_SUCCESS_TITLE,
          description: "Your appointment has been booked successfully.",
        },
      });
  }
}

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

function GymOrderPackageSection({
  gd,
}: Readonly<{
  gd: NonNullable<InvoiceDetailModel["gymOrderDetail"]>;
}>) {
  const pkg = gd.package;
  const validityDisplay =
    pkg &&
    pkg.validityValue != null &&
    (pkg.validityUnits?.trim() ?? "").length > 0
      ? `${pkg.validityValue} ${pkg.validityUnits}`
      : null;

  return (
    <section className="od-card od-card--gym-package" aria-label="Membership package">
      <h3 className="od-card__title">Package details</h3>
      {gd.location ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">Location</span>
          <span className="od-row__value od-row__value--other">{gd.location}</span>
        </div>
      ) : null}
      {gd.subscriptionId ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">Subscription</span>
          <span className="od-row__value od-row__value--other">{gd.subscriptionId}</span>
        </div>
      ) : null}
      {pkg?.packageName ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">Package</span>
          <span className="od-row__value od-row__value--other">{pkg.packageName}</span>
        </div>
      ) : null}
      {pkg?.packageCode ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">Package code</span>
          <span className="od-row__value od-row__value--other">{pkg.packageCode}</span>
        </div>
      ) : null}
      {validityDisplay ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">Validity</span>
          <span className="od-row__value od-row__value--other">{validityDisplay}</span>
        </div>
      ) : null}
      {pkg?.mrpFormatted ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">MRP</span>
          <span className="od-row__value od-row__value--other">₹{pkg.mrpFormatted}</span>
        </div>
      ) : null}
      {pkg?.payAmountFormatted ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">Pay amount</span>
          <span className="od-row__value od-row__value--other">₹{pkg.payAmountFormatted}</span>
        </div>
      ) : null}
      {pkg?.enableWallet != null ? (
        <div className="od-row od-row--gym">
          <span className="od-row__label">Wallet applicable</span>
          <span className="od-row__value od-row__value--other">{pkg.enableWallet ? "Yes" : "No"}</span>
        </div>
      ) : null}
      {gd.enrolleeName || gd.enrolleePhone || gd.enrolleeEmail || gd.personalEmail ? (
        <>
          <p className="od-gym-package__subhead">Enrolment contact</p>
          {gd.enrolleeName ? (
            <div className="od-row od-row--gym">
              <span className="od-row__label">Name</span>
              <span className="od-row__value od-row__value--other">{gd.enrolleeName}</span>
            </div>
          ) : null}
          {gd.enrolleePhone ? (
            <div className="od-row od-row--gym">
              <span className="od-row__label">Phone</span>
              <span className="od-row__value od-row__value--other">{gd.enrolleePhone}</span>
            </div>
          ) : null}
          {gd.enrolleeEmail ? (
            <div className="od-row od-row--gym">
              <span className="od-row__label">Email</span>
              <span className="od-row__value od-row__value--other">{gd.enrolleeEmail}</span>
            </div>
          ) : null}
          {gd.personalEmail ? (
            <div className="od-row od-row--gym">
              <span className="od-row__label">Personal email</span>
              <span className="od-row__value od-row__value--other">{gd.personalEmail}</span>
            </div>
          ) : null}
        </>
      ) : null}
      {pkg?.tncHtml ? (
        <details className="od-gym-tnc">
          <summary className="od-gym-tnc__summary">Terms &amp; conditions</summary>
          <div className="od-gym-tnc__body" dangerouslySetInnerHTML={{ __html: pkg.tncHtml }} />
        </details>
      ) : null}
    </section>
  );
}

export function OrderDetailsPage() {
  const { orderKind: orderKindFromUrl, invoiceId } = useParams<{
    orderKind?: string;
    invoiceId: string;
  }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<InvoiceDetailModel | null>(null);
  const [consultationCompleted, setConsultationCompleted] =
    useState<InvoiceConsultationCompletedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linesExpanded, setLinesExpanded] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [prescriptionPdfBusy, setPrescriptionPdfBusy] = useState(false);
  const [prescriptionPdfViewer, setPrescriptionPdfViewer] = useState<AttachmentFilePreviewViewer>(null);
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
  const {
    viewer: consultationFilePreview,
    openPreview: openAttachmentGalleryPreview,
    closePreview: closeConsultationFilePreview,
    onGalleryNavigate: onConsultationGalleryNavigate,
  } = useAttachmentFilePreviewGallery();
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const confirmMedicineOrderDialogRef = useRef<HTMLDialogElement>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const reportFileInputRef = useRef<HTMLInputElement>(null);
  const cancelDialogTitleId = useId();
  const cancelReasonFieldId = useId();
  const confirmMedicineOrderTitleId = useId();
  const [confirmMedicineOrderDialogOpen, setConfirmMedicineOrderDialogOpen] = useState(false);
  const [confirmMedicineOrderBusy, setConfirmMedicineOrderBusy] = useState(false);
  const [labRescheduleRow, setLabRescheduleRow] = useState<LabSubOrderDetailRow | null>(null);
  /** `order_id` for payment verify when returned on confirm; else Razorpay order id. */
  const pharmacyVerifyOrderIdRef = useRef<string | null>(null);
  /**
   * Lab: `invoice_id` for `POST diagnostics/order/confirm` — from `PATCH lab/order/payment/.../confirm` response
   * when present, else route `invoiceId`. Cleared when not a lab order detail.
   */
  const labDiagnosticsPostInvoiceIdRef = useRef<string | null>(null);
  /** `invoice_id` for `POST gym/payment_verify` after Razorpay on order detail. */
  const gymPaymentVerifyInvoiceIdRef = useRef<string | null>(null);
  const gymPaymentVerifySuccessRef = useRef<() => void>(() => {});
  const gymPaymentVerifyErrorRef = useRef<(message: string) => void>(() => {});
  const diagnosticsConfirmSuccessRef = useRef<() => void>(() => {});
  const diagnosticsConfirmErrorRef = useRef<(message: string) => void>(() => {});
  const partnerPaymentVerifyRef = useRef<(body: PharmacyOrderPaymentVerifyBody) => Promise<void>>(
    verifyPharmacyOrderPayment,
  );

  useEffect(() => {
    if (detail?.categoryKey !== "lab") {
      labDiagnosticsPostInvoiceIdRef.current = null;
    } else {
      labDiagnosticsPostInvoiceIdRef.current = invoiceId?.trim() ?? null;
    }
  }, [detail?.categoryKey, invoiceId]);

  useEffect(() => {
    if (detail?.categoryKey === "lab") {
      partnerPaymentVerifyRef.current = verifyLabOrderPayment;
    } else if (
      detail != null &&
      isPartnerOrderPayFlowCategory(detail.categoryKey) &&
      detail.categoryKey !== "pharmacy"
    ) {
      partnerPaymentVerifyRef.current = verifyServiceRequestOrderPayment;
    } else {
      partnerPaymentVerifyRef.current = verifyPharmacyOrderPayment;
    }
  }, [detail?.categoryKey]);
  const load = useCallback(async () => {
    if (!invoiceId) {
      setError("Missing order id");
      setDetail(null);
      setConsultationCompleted(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { detail: d, consultationCompleted: cc } = await fetchInvoiceOrderPageData(invoiceId);
      setDetail(d);
      setConsultationCompleted(cc);
      setLinesExpanded(d.lineItems.length <= ORDER_DETAIL_LINE_ITEMS_PREVIEW);
      setPrescriptionOpen(cc != null && cc.prescriptions.length <= 1);
    } catch (e) {
      setDetail(null);
      setConsultationCompleted(null);
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

  const prescriptionPdfAppointmentId = useMemo(() => {
    const fromCompleted = consultationCompleted?.appointmentId?.trim();
    if (fromCompleted) return fromCompleted;
    const uploadRef = detail?.consultationUploadRefId?.trim();
    if (uploadRef) return uploadRef;
    return detail?.consultationInfoId?.trim() ?? null;
  }, [
    consultationCompleted?.appointmentId,
    detail?.consultationInfoId,
    detail?.consultationUploadRefId,
  ]);

  const closePrescriptionPdfViewer = useCallback(() => {
    setPrescriptionPdfViewer((prev) => {
      if (prev?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });
  }, []);

  const openPrescriptionPdfViewer = useCallback(async () => {
    const aid = prescriptionPdfAppointmentId;
    if (!aid) {
      toast.error("Prescription is not available for this order.");
      return;
    }
    setPrescriptionPdfBusy(true);
    try {
      const url = await fetchConsultationReportPdfObjectUrl(aid);
      setPrescriptionPdfViewer((prev) => {
        if (prev?.url?.startsWith("blob:")) {
          URL.revokeObjectURL(prev.url);
        }
        return { kind: "pdf", url, name: "Prescription.pdf" };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load prescription";
      toast.error(msg);
    } finally {
      setPrescriptionPdfBusy(false);
    }
  }, [prescriptionPdfAppointmentId, toast]);

  const onDownloadPrescription = useCallback(async () => {
    const aid = prescriptionPdfAppointmentId;
    if (!aid) {
      toast.error("Prescription is not available for this order.");
      return;
    }
    setPrescriptionPdfBusy(true);
    try {
      await downloadConsultationPrescriptionPdf(aid);
      toast.success("Download started");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not download prescription";
      toast.error(msg);
    } finally {
      setPrescriptionPdfBusy(false);
    }
  }, [prescriptionPdfAppointmentId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    closePrescriptionPdfViewer();
  }, [invoiceId, closePrescriptionPdfViewer]);

  useEffect(() => {
    if (!detail || !invoiceId) return;
    const canonical = orderDetailKindInUrlFromCategoryKey(detail.categoryKey);
    if (orderKindFromUrl !== canonical) {
      navigate(generatePath(ROUTES.ordersDetail, { orderKind: canonical, invoiceId }), { replace: true });
    }
  }, [detail, invoiceId, navigate, orderKindFromUrl]);

  const canCancelOrder = useMemo(() => {
    if (!detail) return false;
    if (detail.categoryKey === "mental_wellness" || detail.categoryKey === "nutrition") {
      return false;
    }
    const serviceId = detail.consultationInfoId?.trim();
    if (!serviceId) return false;
    if (detail.isConsultationOrder) {
      if (detail.consultationPlaceTag == null) return false;
      const st = detail.consultationInfoStatus;
      if (st === null) return false;
      return st !== 1 && st !== 2;
    }
    const st = detail.serviceInfoStatus;
    if (st === null) return false;
    return st !== 1 && st !== 2;
  }, [detail]);

  const canCancelWellnessSession = detail?.wellnessSessionCancelAllowed === true;

  useEffect(() => {
    if (!canCancelOrder && !canCancelWellnessSession) setCancelDialogOpen(false);
  }, [canCancelOrder, canCancelWellnessSession]);

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

  useEffect(() => {
    const d = confirmMedicineOrderDialogRef.current;
    if (!d) return;
    if (confirmMedicineOrderDialogOpen) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [confirmMedicineOrderDialogOpen]);

  useEffect(() => {
    if (!detail?.pharmacyAwaitingDetailConfirmation) {
      setConfirmMedicineOrderDialogOpen(false);
      setConfirmMedicineOrderBusy(false);
    }
  }, [detail?.pharmacyAwaitingDetailConfirmation]);

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
    (rows: readonly ConsultationAttachmentRow[], url: string | null, _name: string) => {
      closePrescriptionPdfViewer();
      const u = url?.trim();
      if (!u) return;
      const items = rows
        .map((a) => ({ url: a.url?.trim() ?? "", name: a.label ?? null }))
        .filter((x) => x.url.length > 0);
      openAttachmentGalleryPreview(items, u);
    },
    [closePrescriptionPdfViewer, openAttachmentGalleryPreview],
  );

  const onConfirmCancelConsultation = useCallback(async () => {
    const serviceId = detail?.consultationInfoId?.trim();
    if (!serviceId) return;
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason.");
      return;
    }
    setCancelBusy(true);
    try {
      const isWellness =
        detail?.categoryKey === "mental_wellness" || detail?.categoryKey === "nutrition";
      if (isWellness && detail.wellnessSessionCancelAllowed) {
        await patchJumpingMindOrderCancel({
          service_id: serviceId,
          cancellation_reason: cancelReason.trim(),
        });
        toast.success("Session cancelled");
      } else {
        const useServiceRequestCancel =
          detail?.categoryKey === "vision" ||
          detail?.categoryKey === "dental" ||
          detail?.categoryKey === "vaccine";
        if (useServiceRequestCancel) {
          await patchServiceRequestOrderCancel(serviceId, cancelReason.trim());
        } else {
          await patchCancelServiceRequest(serviceId, cancelReason.trim());
        }
        toast.success(detail?.isConsultationOrder ? "Appointment cancelled" : "Order cancelled");
      }
      setCancelDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel appointment");
    } finally {
      setCancelBusy(false);
    }
  }, [
    cancelReason,
    detail?.categoryKey,
    detail?.consultationInfoId,
    detail?.isConsultationOrder,
    detail?.wellnessSessionCancelAllowed,
    load,
    toast,
  ]);

  const useWalletForOfflinePayment = false;

  /** Gym `PATCH gym/payment` — ask server to apply OPD wallet when package allows it (`package_details.enable_wallet`). */
  const gymPaymentUseWallet = useMemo(
    () =>
      Boolean(
        detail?.categoryKey === "gym" && detail.gymOrderDetail?.package?.enableWallet === true,
      ),
    [detail?.categoryKey, detail?.gymOrderDetail?.package?.enableWallet],
  );

  const onPayConfirmBooking = useCallback(() => {
    const id = invoiceId?.trim();
    if (!id) return;
    setBookingSheetOpen(true);
    setOfflinePaymentPreview(null);
    pharmacyVerifyOrderIdRef.current = null;
    setBookingPreviewLoading(true);
    void (async () => {
      try {
        if (detail != null && detail.categoryKey === "gym") {
          setOfflinePaymentPreview(mapGymInvoiceDetailToBookingSheetModel(detail));
          return;
        }
        const partnerPayId = detail?.consultationInfoId?.trim();
        const raw =
          detail != null &&
          partnerPayId &&
          (isPartnerOrderPayFlowCategory(detail.categoryKey) || detail.categoryKey === "lab")
            ? detail.categoryKey === "pharmacy"
              ? await patchPharmacyOrderPaymentPreview(partnerPayId, useWalletForOfflinePayment)
              : detail.categoryKey === "lab"
                ? await patchLabOrderPaymentPreview(partnerPayId, useWalletForOfflinePayment)
                : await patchServiceRequestOrderPaymentPreview(partnerPayId, useWalletForOfflinePayment)
            : await patchOfflineAppointmentPaymentPreview(id, useWalletForOfflinePayment);
        setOfflinePaymentPreview(mapOfflinePaymentPreviewToSheetModel(raw));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load payment details");
        setBookingSheetOpen(false);
      } finally {
        setBookingPreviewLoading(false);
      }
    })();
  }, [detail, detail?.categoryKey, detail?.consultationInfoId, invoiceId, toast]);

  const onPaymentVerifiedRef = useRef<() => void>(() => {});
  const onPaymentVerifyErrorRef = useRef<(message: string) => void>(() => {});
  const setBookingProceedBusyRef = useRef<(busy: boolean) => void>(() => {});

  const pharmacyPayReturnPath = useMemo(() => {
    if (!invoiceId) return ROUTES.orders;
    const kind = orderDetailKindInUrlFromCategoryKey(detail?.categoryKey ?? "pharmacy");
    return generatePath(ROUTES.ordersDetail, { orderKind: kind, invoiceId });
  }, [invoiceId, detail?.categoryKey]);

  useEffect(() => {
    setBookingProceedBusyRef.current = setBookingProceedBusy;
    onPaymentVerifiedRef.current = () => {
      setBookingSheetOpen(false);
      setOfflinePaymentPreview(null);
      setBookingProceedBusy(false);
      pharmacyVerifyOrderIdRef.current = null;
      labDiagnosticsPostInvoiceIdRef.current = null;
      if (detail?.isConsultationOrder) {
        navigate(
          detail.consultationPlaceTag === "virtual"
            ? ROUTES.consultationVirtualBookingSuccess
            : ROUTES.consultationHospitalBookingSuccess,
          { replace: true },
        );
      } else if (
        detail &&
        (isPartnerOrderPayFlowCategory(detail.categoryKey) || detail.categoryKey === "lab")
      ) {
        navigatePartnerOrderPaymentSuccess(navigate, detail, pharmacyPayReturnPath);
      } else {
        toast.success("Payment successful");
        void load();
      }
    };
    onPaymentVerifyErrorRef.current = (message: string) => {
      toast.error(message);
      setBookingProceedBusy(false);
    };
    diagnosticsConfirmSuccessRef.current = () => {
      setBookingSheetOpen(false);
      setOfflinePaymentPreview(null);
      setBookingProceedBusy(false);
      labDiagnosticsPostInvoiceIdRef.current = null;
      toast.success("Payment successful");
      void load();
    };
    diagnosticsConfirmErrorRef.current = (message: string) => {
      toast.error(message);
      setBookingProceedBusy(false);
    };
    gymPaymentVerifySuccessRef.current = () => {
      setBookingSheetOpen(false);
      setOfflinePaymentPreview(null);
      setBookingProceedBusy(false);
      gymPaymentVerifyInvoiceIdRef.current = null;
      toast.success("Payment successful");
      void load();
    };
    gymPaymentVerifyErrorRef.current = (message: string) => {
      toast.error(message);
      setBookingProceedBusy(false);
    };
  }, [
    detail,
    load,
    navigate,
    pharmacyPayReturnPath,
    toast,
  ]);

  useGymPaymentVerify({
    invoiceIdRef: gymPaymentVerifyInvoiceIdRef,
    onSuccessRef: gymPaymentVerifySuccessRef,
    onErrorRef: gymPaymentVerifyErrorRef,
    setPayBusyRef: setBookingProceedBusyRef,
  });

  useConsultationPaymentVerify({
    onSuccessRef: onPaymentVerifiedRef,
    onErrorRef: onPaymentVerifyErrorRef,
    setBusyRef: setBookingProceedBusyRef,
  });

  usePharmacyOrderPaymentVerify({
    verifyOrderIdRef: pharmacyVerifyOrderIdRef,
    onSuccessRef: onPaymentVerifiedRef,
    onErrorRef: onPaymentVerifyErrorRef,
    setBusyRef: setBookingProceedBusyRef,
    verifyPaymentRef: partnerPaymentVerifyRef,
    paymentVerifyInvoiceIdRef: labDiagnosticsPostInvoiceIdRef,
  });

  useDiagnosticsRazorpayConfirm({
    invoiceIdRef: labDiagnosticsPostInvoiceIdRef,
    onSuccessRef: diagnosticsConfirmSuccessRef,
    onErrorRef: diagnosticsConfirmErrorRef,
  });

  const onBookingSheetProceed = useCallback(async () => {
    const id = invoiceId?.trim();
    if (!id) return;
    setBookingProceedBusy(true);
    try {
      if (detail?.categoryKey === "gym") {
        const res = await patchGymPaymentConfirm(id, gymPaymentUseWallet);
        const payInvoice = (res.invoice_id ?? id).trim();
        gymPaymentVerifyInvoiceIdRef.current = payInvoice;
        const rzp = res.razorpay_payload;
        if (rzp != null && Object.keys(rzp).length > 0) {
          await loadRazorpayScript();
          if (!window.Razorpay) {
            toast.error("Razorpay Checkout could not load. Check your network or ad blocker.");
            setBookingProceedBusy(false);
            gymPaymentVerifyInvoiceIdRef.current = null;
            return;
          }
          openRazorpayCheckoutWithEvent(
            normalizeRazorpayCheckoutPayload({ ...rzp }),
            GYM_PAYMENT_DONE_EVENT,
            (failMsg) => {
              if (!isPaymentCancelledMessage(failMsg)) {
                toast.error(failMsg);
              }
              setBookingProceedBusy(false);
              gymPaymentVerifyInvoiceIdRef.current = null;
            },
          );
          return;
        }
        if (!res.payment_required) {
          setBookingSheetOpen(false);
          setOfflinePaymentPreview(null);
          setBookingProceedBusy(false);
          gymPaymentVerifyInvoiceIdRef.current = null;
          toast.success("Payment successful");
          void load();
          return;
        }
        toast.error("Payment could not be started");
        setBookingProceedBusy(false);
        gymPaymentVerifyInvoiceIdRef.current = null;
        return;
      }

      const partnerOrderId = detail?.consultationInfoId?.trim();
      if (
        detail != null &&
        partnerOrderId &&
        (isPartnerOrderPayFlowCategory(detail.categoryKey) || detail.categoryKey === "lab")
      ) {
        const res =
          detail.categoryKey === "pharmacy"
            ? await patchPharmacyOrderPaymentConfirm(partnerOrderId, useWalletForOfflinePayment)
            : detail.categoryKey === "lab"
              ? await patchLabOrderPaymentConfirm(partnerOrderId, useWalletForOfflinePayment)
              : await patchServiceRequestOrderPaymentConfirm(partnerOrderId, useWalletForOfflinePayment);
        pharmacyVerifyOrderIdRef.current = res.verifyOrderId ?? partnerOrderId;
        if (detail.categoryKey === "lab") {
          labDiagnosticsPostInvoiceIdRef.current =
            res.invoiceIdForDiagnosticsConfirm?.trim() ?? id ?? null;
        }
        const rzp = res.razorpayPayload;
        if (rzp != null && Object.keys(rzp).length > 0) {
          await loadRazorpayScript();
          if (!window.Razorpay) {
            toast.error("Razorpay Checkout could not load. Check your network or ad blocker.");
            setBookingProceedBusy(false);
            return;
          }
          openRazorpayCheckoutWithEvent(rzp, PHARMACY_PAYMENT_DONE_EVENT, (failMsg) => {
            if (!isPaymentCancelledMessage(failMsg)) {
              toast.error(failMsg);
            }
            if (detail.categoryKey === "lab") {
              labDiagnosticsPostInvoiceIdRef.current = id;
            }
            setBookingProceedBusy(false);
          });
          return;
        }
        if (!res.paymentRequired) {
          setBookingSheetOpen(false);
          setOfflinePaymentPreview(null);
          setBookingProceedBusy(false);
          pharmacyVerifyOrderIdRef.current = null;
          labDiagnosticsPostInvoiceIdRef.current = null;
          navigatePartnerOrderPaymentSuccess(navigate, detail, pharmacyPayReturnPath);
          return;
        }
        toast.error(res.message ?? "Payment could not be started");
        setBookingProceedBusy(false);
        return;
      }

      const isLabDiagnosticsOrder = detail?.categoryKey === "lab";
      const res = await patchOfflineAppointmentPaymentConfirm(id, useWalletForOfflinePayment);
      const rzp = res.razorpayPayload;
      if (rzp != null && Object.keys(rzp).length > 0) {
        await loadRazorpayScript();
        if (!window.Razorpay) {
          toast.error("Razorpay Checkout could not load. Check your network or ad blocker.");
          setBookingProceedBusy(false);
          return;
        }
        if (isLabDiagnosticsOrder) {
          openRazorpayCheckoutWithEvent(rzp, DIAGNOSTICS_PAYMENT_DONE_EVENT, (failMsg) => {
            if (!isPaymentCancelledMessage(failMsg)) {
              toast.error(failMsg);
            }
            setBookingProceedBusy(false);
          });
        } else {
          openRazorpayCheckoutWithEvent(rzp, PAYMENT_DONE_EVENT, (failMsg) => {
            if (!isPaymentCancelledMessage(failMsg)) {
              toast.error(failMsg);
            }
            setBookingProceedBusy(false);
          });
        }
        return;
      }
      if (!res.paymentRequired) {
        setBookingSheetOpen(false);
        setOfflinePaymentPreview(null);
        setBookingProceedBusy(false);
        if (detail?.isConsultationOrder) {
          navigate(
            detail.consultationPlaceTag === "virtual"
              ? ROUTES.consultationVirtualBookingSuccess
              : ROUTES.consultationHospitalBookingSuccess,
            { replace: true },
          );
        } else {
          toast.success("Payment successful");
          void load();
        }
        return;
      }
      toast.error(res.message ?? "Payment could not be started");
      setBookingProceedBusy(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not proceed");
      setBookingProceedBusy(false);
    }
  }, [
    detail,
    gymPaymentUseWallet,
    invoiceId,
    load,
    navigate,
    pharmacyPayReturnPath,
    toast,
  ]);

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
    const hasMore = total > ORDER_DETAIL_LINE_ITEMS_PREVIEW;
    const visible =
      !hasMore || linesExpanded
        ? detail.lineItems
        : detail.lineItems.slice(0, ORDER_DETAIL_LINE_ITEMS_PREVIEW);
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
  const orderReferenceLabel = "Order ID";
  const orderReferenceValue = detail?.infoOrderIdFormatted ?? "—";
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

  const headerTitle = useMemo(() => {
    if (loading) return "Loading…";
    if (detail) return `${detail.serviceTypeLabel} details`;
    return "Order details";
  }, [loading, detail]);

  const isConsultationLayout = Boolean(detail?.isConsultationOrder);

  /**
   * Pay footer: `netPayAmount > 0`, **`info.additional_info.payment_required`** present and `true`.
   * Default: **`info.status === 4`** (pending payment).
   * **Gym:** same wallet / net pay gates; status may differ from consultation/lab — do not require `status === 4`.
   * Lab only: also requires non-empty `data.orders` with every row `status === 4` ({@link InvoiceDetailModel.labSubOrdersAllPendingPayment}).
   */
  const showPayConfirmBooking = useMemo(() => {
    if (!detail) return false;
    if (detail.netPayAmount <= 0) return false;
    if (!detail.dataAdditionalInfoPaymentRequiredKeyPresent) return false;
    if (!detail.dataAdditionalInfoPaymentRequired) return false;
    if (detail.categoryKey === "gym") return true;
    if (detail.serviceInfoStatus !== 4) return false;
    if (detail.categoryKey === "lab" && !detail.labSubOrdersAllPendingPayment) return false;
    return true;
  }, [detail]);

  const isPaymentPendingBanner = useMemo(() => showPayConfirmBooking, [showPayConfirmBooking]);

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
    if (!detail) return false;
    if (detail.patientName.trim().length > 0) return true;
    if (detail.infoDetailsAlternatePhone?.trim()) return true;
    const p = detail.consultationPatient;
    if (p?.phone || p?.email || p?.ageGenderLine) return true;
    const loc = detail.pharmacyOrderLocation;
    return Boolean(
      loc &&
        ((loc.headerName?.trim() ?? "").length > 0 ||
          (loc.addressText?.trim() ?? "").length > 0 ||
          (loc.phoneText?.trim() ?? "").length > 0),
    );
  }, [detail]);

  const showPharmacyAwaitingDetailConfirmation = Boolean(detail?.pharmacyAwaitingDetailConfirmation);

  /** Pharmacy, vision/dental/vaccine, and lab: requested items, address, and center; “Confirm details” when `pharmacyAwaitingDetailConfirmation`. */
  const showPartnerOrderDetailSections = useMemo(() => {
    if (!detail) return false;
    if (detail.isConsultationOrder) return false;
    const id = detail.consultationInfoId?.trim() ?? "";
    return (
      (isPartnerOrderPayFlowCategory(detail.categoryKey) || detail.categoryKey === "lab") &&
      id.length > 0
    );
  }, [detail]);

  const pharmacyCenterForConfirmUi = useMemo(() => {
    if (!detail) return null;
    if (!isPartnerOrderPayFlowCategory(detail.categoryKey) && detail.categoryKey !== "lab") return null;
    return detail.pharmacyConfirmCenter;
  }, [detail]);

  const openLabReschedule = useCallback(
    (row: LabSubOrderDetailRow) => {
      if (!detail || detail.categoryKey !== "lab") return;
      const addr = detail.labCollectionAddressId?.trim() ?? "";
      const vendor = detail.labRescheduleVendorCode?.trim() ?? "";
      if (!addr || !vendor) {
        toast.error("Address or lab partner is missing. You cannot reschedule from this screen right now.");
        return;
      }
      setLabRescheduleRow(row);
    },
    [detail, toast],
  );

  const onConfirmMedicineOrderDetails = useCallback(async () => {
    if (!detail) return;
    const serviceOrOrderId = detail.consultationInfoId?.trim();
    if (!serviceOrOrderId) return;
    setConfirmMedicineOrderBusy(true);
    try {
      if (detail.categoryKey === "pharmacy") {
        await patchMedicineOrderConfirm(serviceOrOrderId);
      } else if (isPartnerOrderPayFlowCategory(detail.categoryKey)) {
        await patchServiceRequestOrderConfirm(serviceOrOrderId);
      } else if (detail.categoryKey === "lab") {
        await patchLabOrderConfirm(serviceOrOrderId);
      } else {
        return;
      }
      setConfirmMedicineOrderDialogOpen(false);
      toast.success("Order details confirmed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm order");
    } finally {
      setConfirmMedicineOrderBusy(false);
    }
  }, [detail, load, toast]);

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
        className={`od-main${showFollowUpFooter ? " od-main--follow" : ""}${showPayConfirmBooking ? " od-main--consult-footer" : ""}`}
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
                <h2 className="od-banner__title">{detail.bannerTitle}</h2>
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
                  <OrderDetailPatientSection
                    patientName={detail.patientName}
                    consultationPatient={detail.consultationPatient}
                    alternatePhone={detail.infoDetailsAlternatePhone}
                    userAddress={detail.pharmacyOrderLocation}
                  />
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
              <>
                <OrderDetailServiceMetaCard
                  orderReferenceLabel={orderReferenceLabel}
                  orderReferenceValue={orderReferenceValue}
                  visitTypeLabel={detail.serviceVisitTypeLabel}
                  categoryKey={detail.categoryKey}
                  orderDateTimeDisplay={detail.orderDateTimeDisplay}
                  vendorName={detail.vendorName}
                  placeTag={detail.consultationPlaceTag}
                  cancelAppointmentVisible={false}
                />
                {patientDetailsVisible ? (
                  <OrderDetailPatientSection
                    patientName={detail.patientName}
                    consultationPatient={detail.consultationPatient}
                    alternatePhone={detail.infoDetailsAlternatePhone}
                    userAddress={detail.pharmacyOrderLocation}
                  />
                ) : null}

                {detail.categoryKey === "gym" && detail.gymOrderDetail ? (
                  <GymOrderPackageSection gd={detail.gymOrderDetail} />
                ) : null}

                {showPartnerOrderDetailSections ? (
                  <>
                    <section className="od-card od-card--pharmacy-requested" aria-label="Requested details">
                      <h3 className="od-card__title">Requested details</h3>
                      {detail.lineItems.length > 0 ? (
                        <ul className="od-pharm-req__list">
                          {detail.lineItems.map((line, i) => (
                            <li key={`${line.productName}-${i}`}>{line.productName}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="od-pharm-req__empty">No items listed.</p>
                      )}
                      {detail.categoryKey === "lab" && detail.labBookingRequestedDisplay ? (
                        <div className="od-row od-row--pharm-req">
                          <span className="od-row__label">You requested</span>
                          <span className="od-row__value od-row__value--other">
                            {detail.labBookingRequestedDisplay}
                          </span>
                        </div>
                      ) : null}
                      {detail.pharmacyPreferredSlotDisplay ? (
                        <div className="od-row od-row--pharm-req">
                          <span className="od-row__label">
                            {detail.categoryKey === "lab"
                              ? detail.labBookingRequestedDisplay
                                ? "Updated booking"
                                : "Collection slot"
                              : "Preferred slot"}
                          </span>
                          <span className="od-row__value od-row__value--other">
                            {detail.pharmacyPreferredSlotDisplay}
                          </span>
                        </div>
                      ) : null}
                      {detail.categoryKey === "vaccine" && detail.infoDetailsConditions ? (
                        <div className="od-row od-row--pharm-req od-row--pharm-req-text">
                          <span className="od-row__label">Conditions</span>
                          <span className="od-row__value od-row__value--other">{detail.infoDetailsConditions}</span>
                        </div>
                      ) : null}
                      {detail.categoryKey === "vaccine" && detail.infoDetailsNote ? (
                        <div className="od-row od-row--pharm-req od-row--pharm-req-text">
                          <span className="od-row__label">Note</span>
                          <span className="od-row__value od-row__value--other">{detail.infoDetailsNote}</span>
                        </div>
                      ) : null}
                    </section>

                    {pharmacyCenterForConfirmUi != null ? (
                      <section className="od-card od-card--pharmacy-center-confirm" aria-label="Center details">
                        <h3 className="od-card__title">Center details</h3>
                        <p className="od-pharm-center__name">
                          {pharmacyCenterForConfirmUi.centerName?.trim() || "—"}
                        </p>
                        {pharmacyCenterForConfirmUi.centerAddress ? (
                          <p className="od-visit__addr od-pharm-center__addr-text">
                            {pharmacyCenterForConfirmUi.centerAddress}
                          </p>
                        ) : (
                          <p className="od-pharm-center__muted">Address not available yet.</p>
                        )}
                        {pharmacyCenterForConfirmUi.centerPhone ? (
                          <p className="od-pharmacy__phone">
                            Phone: {pharmacyCenterForConfirmUi.centerPhone}
                          </p>
                        ) : null}
                        <div className="od-pharm-center__actions">
                          {pharmacyCenterForConfirmUi.mapsUrl ? (
                            <a
                              className="od-pharm-center__btn od-pharm-center__btn--outline"
                              href={pharmacyCenterForConfirmUi.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <NavMapIcon />
                              <span>Directions</span>
                            </a>
                          ) : (
                            <span className="od-pharm-center__btn od-pharm-center__btn--outline od-pharm-center__btn--disabled">
                              <span>Directions</span>
                            </span>
                          )}
                          {showPharmacyAwaitingDetailConfirmation ? (
                            <button
                              type="button"
                              className="od-pharm-center__btn od-pharm-center__btn--primary"
                              onClick={() => setConfirmMedicineOrderDialogOpen(true)}
                            >
                              Confirm details
                            </button>
                          ) : null}
                        </div>
                      </section>
                    ) : showPharmacyAwaitingDetailConfirmation ? (
                      <section className="od-card od-card--pharmacy-center-confirm" aria-label="Confirm order details">
                        <div className="od-pharm-center__actions od-pharm-center__actions--solo">
                          <button
                            type="button"
                            className="od-pharm-center__btn od-pharm-center__btn--primary"
                            onClick={() => setConfirmMedicineOrderDialogOpen(true)}
                          >
                            Confirm details
                          </button>
                        </div>
                      </section>
                    ) : null}
                  </>
                ) : null}

                {detail.categoryKey === "lab" && detail.labSubOrders.length > 0 ? (
                  <section className="od-card od-card--lab-suborders" aria-label="Lab collection bookings">
                    <h3 className="od-card__title">Collection bookings</h3>
                    <ul className="od-lab-sub-list">
                      {detail.labSubOrders.map((row) => (
                        <li key={row.id} className="od-lab-sub-card">
                          <div className="od-lab-sub-card__head">
                            <span className="od-lab-sub-card__id">#{row.id}</span>
                            {row.categoryLabel.trim() && row.categoryLabel !== "—" ? (
                              <span className="od-lab-sub-card__pill">{row.categoryLabel}</span>
                            ) : null}
                          </div>
                          {row.visitTypeDisplay ? (
                            <p className="od-lab-sub-card__visit">Visit: {row.visitTypeDisplay}</p>
                          ) : null}
                          <p className="od-lab-sub-card__status">Status: {row.statusLabel}</p>
                          {row.dateSlotLine ? <p className="od-lab-sub-card__slot">{row.dateSlotLine}</p> : null}
                          {row.reschedulePolicyNote ? (
                            <p className="od-lab-sub-card__note">{row.reschedulePolicyNote}</p>
                          ) : null}
                          {row.rescheduleReason != null ||
                          row.rescheduleSlotChangeDisplay != null ||
                          row.rescheduleAtDisplay != null ||
                          row.rescheduleCountDisplay != null ? (
                            <div className="od-lab-sub-card__reschedule-data" aria-label="Reschedule details">
                              <h4 className="od-lab-sub-card__subhead">Reschedule details</h4>
                              {row.rescheduleReason ? (
                                <div className="od-lab-sub-card__kv">
                                  <span className="od-lab-sub-card__k">Reschedule reason</span>
                                  <span className="od-lab-sub-card__v">{row.rescheduleReason}</span>
                                </div>
                              ) : null}
                              {row.rescheduleSlotChangeDisplay ? (
                                <div className="od-lab-sub-card__kv">
                                  <span className="od-lab-sub-card__k">Requested slot</span>
                                  <span className="od-lab-sub-card__v">{row.rescheduleSlotChangeDisplay}</span>
                                </div>
                              ) : null}
                              {row.rescheduleAtDisplay ? (
                                <div className="od-lab-sub-card__kv">
                                  <span className="od-lab-sub-card__k">Reschedule time</span>
                                  <span className="od-lab-sub-card__v">{row.rescheduleAtDisplay}</span>
                                </div>
                              ) : null}
                              {row.rescheduleCountDisplay ? (
                                <div className="od-lab-sub-card__kv">
                                  <span className="od-lab-sub-card__k">Reschedule count</span>
                                  <span className="od-lab-sub-card__v">{row.rescheduleCountDisplay}</span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {row.showRescheduleButton ? (
                            <button
                              type="button"
                              className="od-lab-sub-card__reschedule"
                              onClick={() => openLabReschedule(row)}
                            >
                              Reschedule
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
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
                      disabled={prescriptionPdfBusy || !prescriptionPdfAppointmentId}
                      onClick={() => void openPrescriptionPdfViewer()}
                    >
                      {prescriptionPdfBusy && !prescriptionPdfViewer
                        ? "Opening PDF…"
                        : "View prescription PDF"}
                    </button>
                    <button type="button" className="od-rx-row__link od-rx-row__link--secondary" onClick={() => setPrescriptionOpen((o) => !o)}>
                      {prescriptionOpen ? "Hide" : "Show"} medicine list
                      {cc.prescriptions.length > 1 ? ` (${cc.prescriptions.length})` : ""}
                    </button>
                  </div>
                  {cc.prescriptions.length === 1 ? (
                    <button
                      type="button"
                      className="od-rx-row__dl"
                      aria-label="Download prescription PDF"
                      disabled={prescriptionPdfBusy || !prescriptionPdfAppointmentId}
                      onClick={() => void onDownloadPrescription()}
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
                            aria-label="Download prescription PDF"
                            disabled={prescriptionPdfBusy || !prescriptionPdfAppointmentId}
                            onClick={() => void onDownloadPrescription()}
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
            ) : (
              <ConsultationAttachReportsReadOnlyTabs
                attachments={detail.consultationAttachments}
                reports={isPartnerOrderPayFlowCategory(detail.categoryKey) ? [] : detail.consultationReports}
                onPreview={openConsultationFilePreview}
              />
            )}

            {showInvoiceDetailsCard ? (
              <OrderDetailInvoiceSection
                detail={detail}
                lineItemsSlice={lineItemsSlice}
                linesExpanded={linesExpanded}
                onToggleLinesExpanded={() => setLinesExpanded((x) => !x)}
                consultationStyleInvoice
              />
            ) : !isConsultationLayout ? (
              <OrderDetailPaymentSummaryFallback
                detail={detail}
                discountRowLabel={discountRowLabel}
                collectionFeeRowLabel={collectionFeeRowLabel}
              />
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

            {canCancelOrder || canCancelWellnessSession ? (
              <section
                className="od-order-cancel-end"
                aria-label={
                  canCancelWellnessSession
                    ? "Cancel session"
                    : isConsultationLayout
                      ? "Cancel appointment"
                      : "Cancel order"
                }
              >
                <div className="od-order-cancel-wrap">
                  <button
                    type="button"
                    className="od-btn-cancel-appt"
                    onClick={() => {
                      setCancelReason("");
                      setCancelDialogOpen(true);
                    }}
                  >
                    {canCancelWellnessSession
                      ? "Cancel session"
                      : isConsultationLayout
                        ? "Cancel appointment"
                        : "Cancel order"}
                  </button>
                </div>
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
          serviceWalletNoteContext={
            detail != null
              ? {
                  categoryKey: detail.categoryKey,
                  serviceTypeLabel: detail.serviceTypeLabel,
                  isConsultationOrder: detail.isConsultationOrder,
                }
              : null
          }
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

      {labRescheduleRow != null && detail?.categoryKey === "lab" ? (
        <LabOrderRescheduleBottomSheet
          open
          onClose={() => setLabRescheduleRow(null)}
          subOrderId={labRescheduleRow.id}
          rescheduleCategory={labRescheduleRow.rescheduleCategory}
          addressId={detail.labCollectionAddressId?.trim() ?? ""}
          vendorCode={detail.labRescheduleVendorCode?.trim() ?? ""}
          onCompleted={load}
          priorReschedule={{
            reason: labRescheduleRow.rescheduleReason,
            slotChangeDisplay: labRescheduleRow.rescheduleSlotChangeDisplay,
            atDisplay: labRescheduleRow.rescheduleAtDisplay,
            countDisplay: labRescheduleRow.rescheduleCountDisplay,
          }}
        />
      ) : null}

      {showPayConfirmBooking ? (
        <footer className="od-consult-footer">
          <button
            type="button"
            className="od-consult-footer__btn od-consult-footer__btn--pay"
            onClick={onPayConfirmBooking}
          >
            Pay / confirm
          </button>
        </footer>
      ) : null}

      {showFollowUpFooter ? (
        <footer className="od-follow-footer">
          <button type="button" className="od-follow-footer__btn" onClick={() => onBookFollowUp()}>
            Book a follow-up
          </button>
        </footer>
      ) : null}

      {detail?.pharmacyAwaitingDetailConfirmation ? (
        <dialog
          ref={confirmMedicineOrderDialogRef}
          className="od-cancel-dialog od-confirm-medicine-dialog"
          aria-labelledby={confirmMedicineOrderTitleId}
          aria-describedby={`${confirmMedicineOrderTitleId}-desc`}
          onClose={() => {
            if (!confirmMedicineOrderBusy) setConfirmMedicineOrderDialogOpen(false);
          }}
          onCancel={(e) => {
            e.preventDefault();
            if (!confirmMedicineOrderBusy) setConfirmMedicineOrderDialogOpen(false);
          }}
        >
          <div className="od-cancel-dialog__panel">
            <h2 id={confirmMedicineOrderTitleId} className="od-cancel-dialog__title">
              Confirm these details?
            </h2>
            <p id={`${confirmMedicineOrderTitleId}-desc`} className="od-cancel-dialog__desc">
              Please confirm the address and center shown above are correct. After this, the order will move
              forward (for example to payment when required).
            </p>
            <footer className="od-cancel-dialog__footer">
              <button
                type="button"
                className="od-cancel-dialog__btn od-cancel-dialog__btn--secondary"
                disabled={confirmMedicineOrderBusy}
                onClick={() => setConfirmMedicineOrderDialogOpen(false)}
              >
                No, go back
              </button>
              <button
                type="button"
                className="od-cancel-dialog__btn od-cancel-dialog__btn--primary"
                disabled={confirmMedicineOrderBusy}
                onClick={() => void onConfirmMedicineOrderDetails()}
              >
                {confirmMedicineOrderBusy ? "Confirming…" : "Yes, confirm"}
              </button>
            </footer>
          </div>
        </dialog>
      ) : null}

      {canCancelOrder || canCancelWellnessSession ? (
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
              {canCancelWellnessSession
                ? "Cancel session?"
                : isConsultationLayout
                  ? "Cancel appointment?"
                  : "Cancel this order?"}
            </h2>
            <p id={`${cancelDialogTitleId}-desc`} className="od-cancel-dialog__desc">
              {canCancelWellnessSession
                ? "Cancellations must be at least one hour before the scheduled time. Please share a short reason."
                : isConsultationLayout
                  ? "Please tell us why you are cancelling. This helps us improve the service."
                  : "Please tell us why you want to cancel this order. Our team may contact you if needed."}
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
                {canCancelWellnessSession
                  ? "Keep session"
                  : isConsultationLayout
                    ? "Keep appointment"
                    : "Keep order"}
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
        onClose={closeConsultationFilePreview}
        onGalleryNavigate={onConsultationGalleryNavigate}
      />

      <AttachmentFilePreview viewer={prescriptionPdfViewer} onClose={closePrescriptionPdfViewer} />
    </div>
  );
}
