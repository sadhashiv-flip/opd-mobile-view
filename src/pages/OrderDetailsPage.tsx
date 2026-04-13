import { patchCancelServiceRequest } from "@/api/serviceRequest";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  downloadConsultationPrescriptionPdf,
  fetchInvoiceOrderPageData,
  type InvoiceConsultationCompletedView,
  type InvoiceDetailModel,
} from "@/api/patientInvoices";
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

function BannerIcon({ tone }: Readonly<{ tone: InvoiceDetailModel["bannerTone"] }>) {
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

function refundFieldsSuffix(count: number): string {
  if (count <= 0) return "";
  const noun = count === 1 ? "field" : "fields";
  return ` · ${count} ${noun}`;
}

type PaymentRowProps = Readonly<{
  p: InvoiceDetailModel["payments"][number];
}>;

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

function PaymentRow({ p }: PaymentRowProps) {
  const showSrc =
    p.paymentSrc != null &&
    p.paymentSrc.length > 0 &&
    p.paymentSrc.trim().toLowerCase() !== p.title.trim().toLowerCase();
  const metaParts: string[] = [];
  if (showSrc) metaParts.push(p.paymentSrc);
  if (p.paymentType) metaParts.push(p.paymentType);
  if (p.paymentId) metaParts.push(p.paymentId);
  const metaLine = metaParts.length > 0 ? metaParts.join(" · ") : null;
  const refundLinesDisplay = p.refundLines.filter((line) => {
    if (p.statusLabel == null || p.statusLabel.length === 0) return true;
    const lab = line.label.toLowerCase();
    if (lab !== "status" && lab !== "payment status") return true;
    return line.value.trim().toLowerCase() !== p.statusLabel.trim().toLowerCase();
  });
  const refundExtra =
    p.amountRefunded > 0 && refundLinesDisplay.length > 0
      ? refundFieldsSuffix(refundLinesDisplay.length)
      : "";

  return (
    <li className="od-pay-item">
      <div className="od-pay-item__top">
        <div className="od-pay-item__left">
          <span className="od-pay-item__title">{p.title}</span>
          {p.statusLabel ? (
            <span className="od-pay-item__status" title={p.statusLabel}>
              {p.statusLabel}
            </span>
          ) : null}
        </div>
        <span className="od-pay-item__amt">{p.amountFormatted}</span>
      </div>
      {p.subtitle ? <p className="od-pay-item__sub">{p.subtitle}</p> : null}
      {metaLine ? (
        <p className="od-pay-item__meta" title={p.paymentId ?? undefined}>
          {metaLine}
        </p>
      ) : null}
      {p.amountRefunded > 0 ? (
        <details className="od-pay-refund-details">
          <summary className="od-pay-refund-details__summary">
            Refunded <span className="od-pay-refund-details__sum-amt">{p.refundAmountFormatted}</span>
            {refundExtra}
          </summary>
          {refundLinesDisplay.length > 0 ? (
            <dl className="od-pay-refund-details__dl">
              {refundLinesDisplay.map((line, ri) => (
                <Fragment key={`${line.label}-${ri}`}>
                  <dt>{line.label}</dt>
                  <dd>{line.value}</dd>
                </Fragment>
              ))}
            </dl>
          ) : null}
        </details>
      ) : null}
    </li>
  );
}

function doctorInitial(name: string): string {
  const t = name.trim();
  return t.length ? t.charAt(0).toUpperCase() : "?";
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
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
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
  const invoiceDetailsTitle = cc != null ? "Invoice details" : "Service Details";
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
        <h1 className="od-title">Order Details</h1>
        <span className="od-top__spacer" aria-hidden />
      </header>

      <main className={`od-main${showFollowUpFooter ? " od-main--follow" : ""}`}>
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
            <section className={`od-banner od-banner--${detail.bannerTone}`}>
              <div className="od-banner__icon-row">
                <div className="od-banner__check" aria-hidden>
                  <BannerIcon tone={detail.bannerTone} />
                </div>
                <h2 className="od-banner__title">{detail.bannerTitle}</h2>
              </div>
              <p className="od-banner__sub">{detail.bannerSubtitle}</p>
            </section>

            {cc != null && cc.doctor ? (
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
              {canCancelConsultation ? (
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

            {cc != null && cc.attachments.length > 0 ? (
              <section className="od-card od-card--attach" aria-label="Attachments">
                <h3 className="od-card__title">Attachments</h3>
                <ul className="od-attach-list">
                  {cc.attachments.map((a, i) => (
                    <li key={`${a.label}-${i}`} className="od-attach-item">
                      {a.url ? (
                        <a href={a.url} className="od-attach-item__link" target="_blank" rel="noopener noreferrer">
                          {a.label}
                        </a>
                      ) : (
                        <span className="od-attach-item__text">{a.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {showInvoiceDetailsCard ? (
              <section className="od-card">
                <div className="od-card__head">
                  <h3 className="od-card__title">{invoiceDetailsTitle}</h3>
                  {lineItemsSlice.total > LINE_ITEMS_PREVIEW ? (
                    <span className="od-card__count">{lineItemsSlice.total} items</span>
                  ) : null}
                </div>
                {detail.lineItems.length > 0 ? (
                  <>
                    <div
                      className={`od-table-wrap${lineItemsSlice.hasMore && linesExpanded ? " od-table-wrap--lines-scroll" : ""}`}
                    >
                      <table className="od-table od-table--compact">
                        <thead>
                          <tr>
                            <th scope="col">Product</th>
                            <th scope="col" className="od-table__num">
                              Qty
                            </th>
                            <th scope="col" className="od-table__num">
                              Price
                            </th>
                            <th scope="col" className="od-table__num">
                              Amt
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItemsSlice.visible.map((line, i) => (
                            <tr key={`${line.productName}-${i}`}>
                              <td className="od-table__product">{line.productName}</td>
                              <td className="od-table__num">{line.qty}</td>
                              <td className="od-table__num">{line.unitPriceFormatted}</td>
                              <td className="od-table__num od-table__strong">{line.lineTotalFormatted}</td>
                            </tr>
                          ))}
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
                  </>
                ) : null}
              </section>
            ) : null}

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

            {detail.payments.length > 0 ? (
              <section className="od-card od-card--payments">
                <h3 className="od-card__title">Payments</h3>
                <ul className="od-pay-list">
                  {detail.payments.map((p, i) => (
                    <PaymentRow key={p.paymentId ?? `${p.title}-${i}`} p={p} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </main>

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
    </div>
  );
}
