import type {
  ConsultationOrderPatientUi,
  InvoiceDetailLineItem,
  InvoiceDetailModel,
} from "@/api/patientInvoices";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";

export const ORDER_DETAIL_LINE_ITEMS_PREVIEW = 5;

function InvoiceLineProductCell({ line }: Readonly<{ line: InvoiceDetailLineItem }>) {
  return (
    <td className="od-table__product">
      <div className="od-table__product-cell">
        <span className="od-table__product-name">{line.productName}</span>
        {line.paymentRequired ? (
          <span className="od-table__payment-required-hint">Payment required for this item</span>
        ) : null}
      </div>
    </td>
  );
}

export type OrderDetailPatientSectionProps = Readonly<{
  patientName: string;
  consultationPatient: ConsultationOrderPatientUi | null;
  /** From invoice `info.details.alternate_phone` when set. */
  alternatePhone?: string | null;
}>;

export function OrderDetailPatientSection({
  patientName,
  consultationPatient,
  alternatePhone,
}: OrderDetailPatientSectionProps) {
  const alt = alternatePhone?.trim() ?? "";
  return (
    <section className="od-card od-card--patient" aria-label="Patient details">
      <h3 className="od-card__title">Patient Details</h3>
      {patientName.trim().length > 0 ? (
        <div className="od-row">
          <span className="od-row__label">Patient Name</span>
          <span className="od-row__value od-row__value--other">{patientName}</span>
        </div>
      ) : null}
      {consultationPatient?.phone ? (
        <div className="od-row">
          <span className="od-row__label">Phone</span>
          <span className="od-row__value od-row__value--other">{consultationPatient.phone}</span>
        </div>
      ) : null}
      {alt ? (
        <div className="od-row">
          <span className="od-row__label">Alternate phone</span>
          <span className="od-row__value od-row__value--other">{alt}</span>
        </div>
      ) : null}
      {consultationPatient?.email ? (
        <div className="od-row">
          <span className="od-row__label">Email</span>
          <span className="od-row__value od-row__value--other">{consultationPatient.email}</span>
        </div>
      ) : null}
      {consultationPatient?.ageGenderLine ? (
        <div className="od-row">
          <span className="od-row__label">Age / Gender</span>
          <span className="od-row__value od-row__value--other">{consultationPatient.ageGenderLine}</span>
        </div>
      ) : null}
    </section>
  );
}

export type OrderDetailServiceMetaCardProps = Readonly<{
  orderReferenceLabel: string;
  orderReferenceValue: string;
  visitTypeLabel: string | null;
  categoryKey: string;
  orderDateTimeDisplay: string;
  vendorName: string;
  placeTag: InvoiceDetailModel["consultationPlaceTag"];
  /** Shown only when {@link cancelAppointmentVisible} is true. */
  onCancelAppointment?: () => void;
  cancelAppointmentVisible: boolean;
}>;

/** Order id, service, dates — replaces the old “Order & user” block; patient lives in {@link OrderDetailPatientSection}. */
export function OrderDetailServiceMetaCard({
  orderReferenceLabel,
  orderReferenceValue,
  visitTypeLabel,
  categoryKey,
  orderDateTimeDisplay,
  vendorName,
  placeTag,
  onCancelAppointment,
  cancelAppointmentVisible,
}: OrderDetailServiceMetaCardProps) {
  return (
    <section className="od-card od-card--order-patient">
      <div className="od-card__head od-card__head--order-user">
        <h3 className="od-card__title">Order details</h3>
        {placeTag ? (
          <span className={`od-place-tag od-place-tag--${placeTag}`}>
            {placeTag === "virtual" ? "Virtual" : "In-person"}
          </span>
        ) : null}
      </div>
      {orderReferenceValue !== "—" ? (
        <div className="od-row">
          <span className="od-row__label">{orderReferenceLabel}</span>
          <span className="od-row__value od-row__value--other">{orderReferenceValue}</span>
        </div>
      ) : null}
      <div className="od-row od-service-row">
        <span className="od-row__label">Visit type</span>
        <div className="od-row__value-row">
          <span className="od-row__value od-row__value--other">{visitTypeLabel ?? "—"}</span>
          <OrderCategoryIcon categoryKey={categoryKey} width={22} height={22} className="od-row__svc-icon" />
        </div>
      </div>
      <div className="od-row">
        <span className="od-row__label">Created At</span>
        <span className="od-row__value od-row__value--other">{orderDateTimeDisplay}</span>
      </div>
      {vendorName === "—" ? null : (
        <div className="od-row">
          <span className="od-row__label">Vendor</span>
          <span className="od-row__value od-row__value--other">{vendorName}</span>
        </div>
      )}
      {cancelAppointmentVisible && onCancelAppointment ? (
        <div className="od-order-cancel-wrap">
          <button type="button" className="od-btn-cancel-appt" onClick={onCancelAppointment}>
            Cancel order
          </button>
        </div>
      ) : null}
    </section>
  );
}

export type OrderDetailInvoiceSectionProps = Readonly<{
  detail: InvoiceDetailModel;
  lineItemsSlice: {
    visible: readonly InvoiceDetailLineItem[];
    hasMore: boolean;
    total: number;
  };
  linesExpanded: boolean;
  onToggleLinesExpanded: () => void;
  /** Consultation-style table (MRP / Price / Qty / Amount) + net summary inside the card. */
  consultationStyleInvoice: boolean;
}>;

export function OrderDetailInvoiceSection({
  detail,
  lineItemsSlice,
  linesExpanded,
  onToggleLinesExpanded,
  consultationStyleInvoice,
}: OrderDetailInvoiceSectionProps) {
  return (
    <section className={`od-card${consultationStyleInvoice ? " od-card--invoice-consult" : ""}`}>
      <div className="od-card__head">
        <h3 className="od-card__title">Invoice details</h3>
        {lineItemsSlice.total > ORDER_DETAIL_LINE_ITEMS_PREVIEW ? (
          <span className="od-card__count">{lineItemsSlice.total} items</span>
        ) : null}
      </div>
      {detail.lineItems.length > 0 ? (
        <>
          <div
            className={`od-table-wrap${lineItemsSlice.hasMore && linesExpanded ? " od-table-wrap--lines-scroll" : ""}`}
          >
            <table
              className={`od-table od-table--compact${consultationStyleInvoice ? " od-table--invoice5" : ""}`}
            >
              <thead>
                <tr>
                  <th scope="col">{consultationStyleInvoice ? "Description" : "Product"}</th>
                  {consultationStyleInvoice ? (
                    <th scope="col" className="od-table__num">
                      MRP
                    </th>
                  ) : null}
                  <th scope="col" className="od-table__num">
                    {consultationStyleInvoice ? "Price" : "Qty"}
                  </th>
                  <th scope="col" className="od-table__num">
                    {consultationStyleInvoice ? "Qty" : "Price"}
                  </th>
                  <th scope="col" className="od-table__num">
                    {consultationStyleInvoice ? "Amount" : "Amt"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItemsSlice.visible.map((line, i) =>
                  consultationStyleInvoice ? (
                    <tr key={`${line.productName}-${i}`}>
                      <InvoiceLineProductCell line={line} />
                      <td className="od-table__num">{line.mrpFormatted ?? "—"}</td>
                      <td className="od-table__num">{line.unitPriceFormatted}</td>
                      <td className="od-table__num">{line.qty}</td>
                      <td className="od-table__num od-table__strong">{line.lineTotalFormatted}</td>
                    </tr>
                  ) : (
                    <tr key={`${line.productName}-${i}`}>
                      <InvoiceLineProductCell line={line} />
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
            <button type="button" className="od-lines-toggle" onClick={onToggleLinesExpanded}>
              {linesExpanded ? `Show less` : `Show all ${lineItemsSlice.total} items`}
            </button>
          ) : null}
          {consultationStyleInvoice ? (
            <div className="od-inv-foot">
              <div className="od-inv-summary">
                <div className="od-pay-row od-pay-row--invoice-total">
                  <span className="od-pay-row__label">Total</span>
                  <span className="od-pay-row__value">{detail.subTotalFormatted}</span>
                </div>
                {detail.collectionFeeFormatted ? (
                  <div className="od-pay-row">
                    <span className="od-pay-row__label">Convenience charges</span>
                    <span className="od-pay-row__value od-pay-row__value--add">{detail.collectionFeeFormatted}</span>
                  </div>
                ) : null}
                {detail.processingFeeFormatted ? (
                  <div className="od-pay-row">
                    <span className="od-pay-row__label">Processing fee</span>
                    <span className="od-pay-row__value od-pay-row__value--add">{detail.processingFeeFormatted}</span>
                  </div>
                ) : null}
                {detail.deliveryChargesFormatted ? (
                  <div className="od-pay-row">
                    <span className="od-pay-row__label">Delivery charges</span>
                    <span className="od-pay-row__value od-pay-row__value--add">
                      {detail.deliveryChargesFormatted}
                    </span>
                  </div>
                ) : null}
                {detail.discountFormatted ? (
                  <div className="od-pay-row">
                    <span className="od-pay-row__label">Saved</span>
                    <span className="od-pay-row__value od-pay-row__value--deduct">{detail.discountFormatted}</span>
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
                    <span className="od-pay-row__value od-pay-row__value--wallet">{detail.walletDebitFormatted}</span>
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
  );
}

export type OrderDetailPaymentSummaryFallbackProps = Readonly<{
  detail: InvoiceDetailModel;
  discountRowLabel: string;
  collectionFeeRowLabel: string;
}>;

/** Shown when there are no line items but amounts should still be visible (edge case). */
export function OrderDetailPaymentSummaryFallback({
  detail,
  discountRowLabel,
  collectionFeeRowLabel,
}: OrderDetailPaymentSummaryFallbackProps) {
  return (
    <section className="od-card">
      <h3 className="od-card__title">Payment Summary</h3>
      <div className="od-pay-row">
        <span className="od-pay-row__label">Sub Total</span>
        <span className="od-pay-row__value">{detail.subTotalFormatted}</span>
      </div>
      {detail.discountFormatted ? (
        <div className="od-pay-row">
          <span className="od-pay-row__label">{discountRowLabel}</span>
          <span className="od-pay-row__value od-pay-row__value--deduct">{detail.discountFormatted}</span>
        </div>
      ) : null}
      {detail.collectionFeeFormatted ? (
        <div className="od-pay-row">
          <span className="od-pay-row__label">{collectionFeeRowLabel}</span>
          <span className="od-pay-row__value od-pay-row__value--add">{detail.collectionFeeFormatted}</span>
        </div>
      ) : null}
      {detail.processingFeeFormatted ? (
        <div className="od-pay-row">
          <span className="od-pay-row__label">Processing fee</span>
          <span className="od-pay-row__value od-pay-row__value--add">{detail.processingFeeFormatted}</span>
        </div>
      ) : null}
      {detail.deliveryChargesFormatted ? (
        <div className="od-pay-row">
          <span className="od-pay-row__label">Delivery charges</span>
          <span className="od-pay-row__value od-pay-row__value--add">{detail.deliveryChargesFormatted}</span>
        </div>
      ) : null}
      {detail.walletDebitFormatted ? (
        <div className="od-pay-row">
          <span className="od-pay-row__label">From Wallet</span>
          <span className="od-pay-row__value od-pay-row__value--wallet">{detail.walletDebitFormatted}</span>
        </div>
      ) : null}
      <div className="od-pay-total">
        <span className="od-pay-total__label">Net Pay</span>
        <span className="od-pay-total__value">{detail.netPayFormatted}</span>
      </div>
    </section>
  );
}
