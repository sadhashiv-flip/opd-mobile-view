import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { fetchInvoiceById, type InvoiceDetailModel } from "@/api/patientInvoices";
import { OrderCategoryIcon } from "@/components/orders/OrderCategoryIcon";
import { ROUTES } from "@/constants";
import { useNavigate, useParams } from "react-router-dom";
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

export function OrderDetailsPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<InvoiceDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linesExpanded, setLinesExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) {
      setError("Missing order id");
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await fetchInvoiceById(invoiceId);
      setDetail(d);
      setLinesExpanded(d.lineItems.length <= LINE_ITEMS_PREVIEW);
    } catch (e) {
      setDetail(null);
      setError(e instanceof Error ? e.message : "Could not load order");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lineItemsSlice = useMemo(() => {
    if (!detail) return { visible: [], hasMore: false, total: 0 };
    const total = detail.lineItems.length;
    const hasMore = total > LINE_ITEMS_PREVIEW;
    const visible =
      !hasMore || linesExpanded ? detail.lineItems : detail.lineItems.slice(0, LINE_ITEMS_PREVIEW);
    return { visible, hasMore, total };
  }, [detail, linesExpanded]);

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

      <main className="od-main">
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

            <section className="od-card od-card--order-patient">
              <h3 className="od-card__title">Order &amp; patient</h3>
              <div className="od-row">
                <span className="od-row__label">Order ID</span>
                <span className="od-row__value">{detail.orderIdDisplay}</span>
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
                <span className="od-row__label">Patient</span>
                <span className="od-row__value od-row__value--other">{detail.patientName}</span>
              </div>
              {detail.vendorName === "—" ? null : (
                <div className="od-row">
                  <span className="od-row__label">Vendor</span>
                  <span className="od-row__value od-row__value--other">{detail.vendorName}</span>
                </div>
              )}
            </section>

            {detail.lineItems.length > 0 ? (
              <section className="od-card">
                <div className="od-card__head">
                  <h3 className="od-card__title">Service Details</h3>
                  {lineItemsSlice.total > LINE_ITEMS_PREVIEW ? (
                    <span className="od-card__count">{lineItemsSlice.total} items</span>
                  ) : null}
                </div>
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
                  <span className="od-pay-row__label">Discount</span>
                  <span className="od-pay-row__value od-pay-row__value--deduct">
                    {detail.discountFormatted}
                  </span>
                </div>
              ) : null}
              {detail.collectionFeeFormatted ? (
                <div className="od-pay-row">
                  <span className="od-pay-row__label">Collection fee</span>
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
    </div>
  );
}
