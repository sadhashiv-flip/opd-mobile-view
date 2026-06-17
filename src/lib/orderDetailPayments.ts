import type { InvoicePaymentRow } from "@/api/patientInvoices";

export type InvoicePaymentGroup = Readonly<{
  /** Primary payment row, or a standalone refund when no parent is listed. */
  payment: InvoicePaymentRow;
  /** Refund rows linked to {@link payment}. */
  refunds: readonly InvoicePaymentRow[];
  /** Payment row carries nested `refunded` / `amount_refunded` from API. */
  hasEmbeddedRefund: boolean;
  anchorId: string;
  /** Group is only a refund entry with no paired payment in the list. */
  isRefundOnly: boolean;
}>;

function isRefundPaymentRow(p: InvoicePaymentRow): boolean {
  return p.isRefundEntry;
}

function paymentAnchorId(p: InvoicePaymentRow, fallback: string): string {
  return p.paymentId?.trim() || fallback;
}

function refundAnchorId(p: InvoicePaymentRow, fallback: string): string {
  return p.refundId?.trim() || p.paymentId?.trim() || fallback;
}

/** Stable DOM id for payment anchor links on order detail. */
export function orderDetailPaymentDomId(anchorId: string): string {
  return `od-pay-${anchorId}`;
}

/** Stable DOM id for refund anchor links on order detail. */
export function orderDetailRefundDomId(anchorId: string): string {
  return `od-refund-${anchorId}`;
}

type MutableGroup = {
  payment: InvoicePaymentRow;
  refunds: InvoicePaymentRow[];
  hasEmbeddedRefund: boolean;
  anchorId: string;
  isRefundOnly: boolean;
};

/**
 * Groups invoice `payments` so refund rows render under their parent payment
 * with connector UI. Handles separate refund entries and embedded refunds.
 */
export function groupInvoicePayments(
  payments: readonly InvoicePaymentRow[],
): readonly InvoicePaymentGroup[] {
  const groups: MutableGroup[] = [];
  const byPaymentId = new Map<string, MutableGroup>();

  const attachRefund = (refund: InvoicePaymentRow, index: number) => {
    const linked = refund.linkedPaymentId?.trim();
    if (linked) {
      const parent = byPaymentId.get(linked);
      if (parent) {
        parent.refunds.push(refund);
        return;
      }
    }
    if (groups.length > 0 && !groups.at(-1)!.isRefundOnly) {
      groups.at(-1)!.refunds.push(refund);
      return;
    }
    groups.push({
      payment: refund,
      refunds: [],
      hasEmbeddedRefund: false,
      anchorId: refundAnchorId(refund, `refund-${index}`),
      isRefundOnly: true,
    });
  };

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    if (isRefundPaymentRow(p)) {
      attachRefund(p, i);
      continue;
    }

    const anchorId = paymentAnchorId(p, `idx-${i}`);
    const group: MutableGroup = {
      payment: p,
      refunds: [],
      hasEmbeddedRefund:
        p.amountRefunded > 0 &&
        (p.refundAmountFormatted != null || p.refundLines.length > 0),
      anchorId,
      isRefundOnly: false,
    };
    groups.push(group);
    if (p.paymentId?.trim()) {
      byPaymentId.set(p.paymentId.trim(), group);
    }
  }

  // Merge standalone refund-only groups into their parent when the link resolves.
  for (const g of groups) {
    if (!g.isRefundOnly) continue;
    const linked = g.payment.linkedPaymentId?.trim();
    const parent = linked ? byPaymentId.get(linked) : undefined;
    if (parent) {
      parent.refunds.push(g.payment);
    }
  }

  return groups
    .filter((g) => {
      if (!g.isRefundOnly) return true;
      const linked = g.payment.linkedPaymentId?.trim();
      if (!linked) return true;
      return !byPaymentId.has(linked);
    })
    .map(finalizePaymentGroup);
}

/** Embedded `amount_refunded` is omitted when a separate refund row is already shown. */
function finalizePaymentGroup(g: MutableGroup): InvoicePaymentGroup {
  const hasEmbeddedRefund =
    g.refunds.length === 0 &&
    g.hasEmbeddedRefund &&
    !g.isRefundOnly;
  return {
    payment: g.payment,
    refunds: g.refunds,
    hasEmbeddedRefund,
    anchorId: g.anchorId,
    isRefundOnly: g.isRefundOnly,
  };
}

export function firstRefundAnchorId(group: InvoicePaymentGroup): string | null {
  if (group.refunds.length > 0) {
    const r = group.refunds[0];
    return refundAnchorId(r, `${group.anchorId}-ref-0`);
  }
  if (group.hasEmbeddedRefund) {
    return `${group.anchorId}-embedded`;
  }
  return null;
}

export function refundAnchorIdForRow(
  refund: InvoicePaymentRow,
  groupAnchorId: string,
  index: number,
): string {
  return refundAnchorId(refund, `${groupAnchorId}-ref-${index}`);
}
