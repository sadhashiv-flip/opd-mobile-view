import { ROUTES } from "@/constants";
import { generatePath, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "./DevLabOrderDetailEntryPage.css";

/**
 * Testing entry for the lab invoice detail branch of {@link OrderDetailsPage} only.
 * Navigate with `?invoiceId=` to pre-fill.
 */
export function DevLabOrderDetailEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = searchParams.get("invoiceId")?.trim() ?? "";

  const [invoiceId, setInvoiceId] = useState(q);

  useEffect(() => {
    if (q) setInvoiceId(q);
  }, [q]);

  const openLabDetail = () => {
    const id = invoiceId.trim();
    if (!id) return;
    void navigate(
      generatePath(ROUTES.ordersDetail, {
        orderKind: "lab",
        invoiceId: id,
      }),
    );
  };

  return (
    <main className="page dev-lab-order-entry">
      <div className="dev-lab-order-entry__card">
        <p className="dev-lab-order-entry__badge" role="note">
          Testing only — lab order detail
        </p>
        <h1 className="dev-lab-order-entry__title">Open lab order detail</h1>
        <p className="dev-lab-order-entry__body">
          Loads the same screen as{" "}
          <code className="dev-lab-order-entry__code">/order/lab/:invoiceId</code> (invoice API).
        </p>
        <label className="dev-lab-order-entry__label" htmlFor="dev-lab-invoice-id">
          Invoice ID
        </label>
        <input
          id="dev-lab-invoice-id"
          className="dev-lab-order-entry__input"
          type="text"
          autoComplete="off"
          placeholder="Paste invoice id"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
        />
        <button
          type="button"
          className="dev-lab-order-entry__btn dev-lab-order-entry__btn--primary"
          onClick={openLabDetail}
          disabled={!invoiceId.trim()}
        >
          Open lab detail
        </button>
        <button
          type="button"
          className="dev-lab-order-entry__btn"
          onClick={() => navigate(ROUTES.orders)}
        >
          Back to orders
        </button>
      </div>
    </main>
  );
}
