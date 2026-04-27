/** Navigation state for `/pharmacy/order-success` — mirrors Flutter `PharmacyOrderRequestSuccessScreen` arguments. */

export type PharmacyOrderKindNav = "OTC" | "UPLOAD" | "FLIPHEALTH";

export type PharmacyOrderSuccessLocationState = Readonly<{
  returnPath?: string;
  orderKind: PharmacyOrderKindNav;
  /** API `message` or empty */
  message?: string;
  orderId?: string;
  invoiceId?: string;
  patientName?: string;
  addressLine?: string;
  itemCount?: number;
}>;

export type PharmacySuccessRow = Readonly<{ label: string; value: string; smallValue?: boolean }>;

export type PharmacyKindUi = Readonly<{
  title: string;
  summaryHeading: string;
  itemLabel: string;
  itemSingular: string;
  itemPlural: string;
}>;

export function pharmacyKindUi(kind: PharmacyOrderKindNav): PharmacyKindUi {
  switch (kind) {
    case "OTC":
      return {
        title: "OTC Order Placed",
        summaryHeading: "OTC Product Request",
        itemLabel: "Items",
        itemSingular: "item",
        itemPlural: "items",
      };
    case "UPLOAD":
      return {
        title: "Prescription Submitted",
        summaryHeading: "Uploaded Prescription Order",
        itemLabel: "Prescriptions",
        itemSingular: "file",
        itemPlural: "files",
      };
    case "FLIPHEALTH":
      return {
        title: "Order Placed Successfully",
        summaryHeading: "Fliphealth Prescription Order",
        itemLabel: "Prescriptions",
        itemSingular: "prescription",
        itemPlural: "prescriptions",
      };
  }
}

const DEFAULT_SUBTITLE =
  "Our pharmacy partner will process your order and contact you shortly to confirm the details.";

export function pharmacySuccessSubtitle(serverMessage: string | undefined): string {
  const t = serverMessage?.trim();
  return t && t.length > 0 ? t : DEFAULT_SUBTITLE;
}

export function pharmacySuccessSummaryRows(args: {
  readonly kind: PharmacyOrderKindNav;
  readonly orderId: string;
  readonly patientName: string;
  readonly addressLine: string;
  readonly itemCount: number | undefined;
}): readonly PharmacySuccessRow[] {
  const ui = pharmacyKindUi(args.kind);
  const rows: PharmacySuccessRow[] = [];

  if (args.orderId.trim()) {
    rows.push({ label: "Order ID", value: `#${args.orderId.trim()}` });
  }
  if (args.patientName.trim()) {
    rows.push({ label: "Ordered for", value: args.patientName.trim() });
  }
  if (args.addressLine.trim()) {
    rows.push({ label: "Delivery to", value: args.addressLine.trim(), smallValue: true });
  }
  const n = args.itemCount;
  if (n != null && n > 0 && args.kind !== "OTC") {
    const unit = n === 1 ? ui.itemSingular : ui.itemPlural;
    rows.push({
      label: ui.itemLabel,
      value: n === 1 ? `1 ${unit}` : `${n} ${unit}`,
    });
  }
  rows.push({ label: "Expected delivery", value: "24 – 48 hrs" });
  return rows;
}
