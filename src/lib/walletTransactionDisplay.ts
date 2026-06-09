import { categoryKeyFromLabel } from "@/api/patientInvoices";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";

export function walletRefTypeCategoryKey(refType: string): string {
  return categoryKeyFromLabel(refType.trim());
}

export function walletTransactionOrderDetailPath(args: {
  refType: string;
  invoiceId: string | null;
}): string | null {
  const invoiceId = args.invoiceId?.trim();
  if (!invoiceId) return null;
  const categoryKey = walletRefTypeCategoryKey(args.refType);
  if (categoryKey === "other") return null;
  return pathToOrderDetail(categoryKey, invoiceId);
}

export function formatWalletRefIdDisplay(refId: string | null): string | null {
  const id = refId?.trim();
  if (!id) return null;
  return id.startsWith("#") ? id : `#${id}`;
}
