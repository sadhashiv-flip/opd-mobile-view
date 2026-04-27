import { ROUTES } from "@/constants";
import { generatePath, Navigate, useParams } from "react-router-dom";

/**
 * Maps `/dev/lab-order/open/:invoiceId` → `/order/lab/:invoiceId` so testers can deep-link lab
 * detail without the `orderKind` segment from the orders list.
 */
export function DevLabOrderDetailRedirectPage() {
  const { invoiceId } = useParams();
  const trimmed = invoiceId?.trim() ?? "";
  if (!trimmed) {
    return <Navigate to={ROUTES.orders} replace />;
  }
  return (
    <Navigate
      replace
      to={generatePath(ROUTES.ordersDetail, {
        orderKind: "lab",
        invoiceId: trimmed,
      })}
    />
  );
}
