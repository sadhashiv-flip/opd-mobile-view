import { ROUTES } from "@/constants";
import { Navigate, generatePath, useParams } from "react-router-dom";

/** Old detail URLs used `/orders/...`; canonical paths are `/order/...`. */
export function LegacyOrdersDetailTwoSegmentRedirect() {
  const { orderKind, invoiceId } = useParams<{ orderKind: string; invoiceId: string }>();
  if (!orderKind?.trim() || !invoiceId?.trim()) {
    return <Navigate to={ROUTES.orders} replace />;
  }
  return (
    <Navigate
      to={generatePath(ROUTES.ordersDetail, { orderKind: orderKind.trim(), invoiceId: invoiceId.trim() })}
      replace
    />
  );
}

export function LegacyOrdersDetailOneSegmentRedirect() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  if (!invoiceId?.trim()) {
    return <Navigate to={ROUTES.orders} replace />;
  }
  return (
    <Navigate
      to={generatePath(ROUTES.ordersDetailLegacy, { invoiceId: invoiceId.trim() })}
      replace
    />
  );
}
