import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { asRecord, pickNum, pickStr } from "@/lib/medicalRecordRow";

/** Same as Flutter `InvoicePdfHelper` — only when `info.status === 1` (completed). */
export function canDownloadInvoicePdf(infoStatus: number | null | undefined): boolean {
  return infoStatus === 1;
}

type InvoiceLineItem = Readonly<{
  name: string;
  qty: string;
  unitPrice: number;
  amount: number;
}>;

type InvoiceTotals = Readonly<{
  subtotal: number;
  discount: number;
  extraCharges: number;
  netAmount: number;
}>;

function parseNum(v: unknown): number | null {
  return pickNum(v);
}

function rupee(value: number): string {
  if (value % 1 === 0) return `INR ${Math.trunc(value)}`;
  return `INR ${value.toFixed(2)}`;
}

function invoiceId(inv: Record<string, unknown>): string {
  const info = asRecord(inv.info);
  const candidates = [inv.invoice_id, inv.id, info?.invoice_id, info?.id];
  for (const c of candidates) {
    const s = pickStr(c);
    if (s) return s;
  }
  return String(Date.now());
}

function companyName(inv: Record<string, unknown>, fallback?: string | null): string {
  const info = asRecord(inv.info);
  const details = info ? asRecord(info.details) : null;
  const center = details ? asRecord(details.center) : null;
  const candidates = [
    info?.company_name,
    details?.company_name,
    center?.name,
    info?.vendor_name,
    info?.hospital_name,
    inv.company_name,
    fallback,
    "Flip Health",
  ];
  for (const c of candidates) {
    const s = pickStr(c);
    if (s) return s;
  }
  return "Flip Health";
}

function billedTo(inv: Record<string, unknown>): string {
  const user = asRecord(inv.user);
  const member = asRecord(inv.member);
  const info = asRecord(inv.info);
  const details = info ? asRecord(info.details) : null;
  const contact = details ? asRecord(details.contact_details) : null;
  const nameCandidates = [user?.name, member?.name, info?.name, info?.patient_name, contact?.name];
  let name = "Customer";
  for (const c of nameCandidates) {
    const s = pickStr(c);
    if (s) {
      name = s;
      break;
    }
  }
  const phone = pickStr(user?.phone, member?.phone, info?.phone, contact?.phone);
  return phone ? `${name} (${phone})` : name;
}

function formatInvoiceDate(inv: Record<string, unknown>): string {
  const info = asRecord(inv.info);
  const raw = pickStr(info?.createdAt, inv.createdAt, inv.invoice_date);
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function parseQty(v: unknown): string {
  const n = parseNum(v);
  if (n == null) return "1";
  if (n % 1 === 0) return String(Math.trunc(n));
  return String(n);
}

function parseLineName(m: Record<string, unknown>): string {
  const nested = asRecord(m.name);
  const candidates = [m.product_name, m.title, m.name, nested?.title, nested?.name];
  for (const c of candidates) {
    const s = pickStr(c);
    if (s) return s;
  }
  return "Item";
}

function lineItems(lines: readonly unknown[]): readonly InvoiceLineItem[] {
  const out: InvoiceLineItem[] = [];
  for (const row of lines) {
    const m = asRecord(row);
    if (!m) continue;
    const qtyRaw = parseNum(m.qty) ?? 1;
    const price = parseNum(m.offer_price) ?? parseNum(m.price) ?? 0;
    const qty = qtyRaw < 0 ? 0 : qtyRaw;
    out.push({
      name: parseLineName(m),
      qty: parseQty(qty),
      unitPrice: price,
      amount: qty * price,
    });
  }
  if (out.length > 0) return out;
  return [{ name: "Service charge", qty: "1", unitPrice: 0, amount: 0 }];
}

function totals(invoice: Record<string, unknown>, items: readonly InvoiceLineItem[]): InvoiceTotals {
  const subtotal = items.reduce((sum, e) => sum + e.amount, 0);
  const discount = parseNum(invoice.discount) ?? 0;
  const net = parseNum(invoice.net_amount) ?? subtotal - discount;
  const extra = net - subtotal + discount;
  return {
    subtotal,
    discount: discount < 0 ? 0 : discount,
    extraCharges: extra < 0 ? 0 : extra,
    netAmount: net < 0 ? 0 : net,
  };
}

function formatGeneratedAt(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Builds the same TAX INVOICE PDF as patient-app `InvoicePdfHelper.downloadInvoicePdf`.
 * Returns a blob URL — caller must revoke after use.
 */
export function buildInvoicePdfBlobUrl(args: Readonly<{
  invoice: Record<string, unknown>;
  lines: readonly unknown[];
  companyNameFallback?: string | null;
}>): string {
  const inv = args.invoice;
  const id = invoiceId(inv);
  const generatedAt = new Date();
  const billed = billedTo(inv);
  const fromCompany = companyName(inv, args.companyNameFallback);
  const createdAt = formatInvoiceDate(inv);
  const items = lineItems(args.lines);
  const t = totals(inv, items);

  const doc = new jsPDF({ format: "a4", unit: "pt" });
  const margin = 24;
  let y = margin + 8;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", margin, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const rightX = doc.internal.pageSize.getWidth() - margin;
  doc.text(fromCompany, rightX, y, { align: "right" });
  y += 22;
  doc.setFontSize(10);
  doc.text(`Invoice ID: ${id}`, margin, y);
  doc.text(`Generated: ${formatGeneratedAt(generatedAt)}`, rightX, y, { align: "right" });
  y += 14;
  doc.text(`Invoice date: ${createdAt}`, margin, y);
  y += 20;

  doc.setDrawColor(180);
  doc.rect(margin, y, doc.internal.pageSize.getWidth() - margin * 2, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To", margin + 10, y + 14);
  doc.setFont("helvetica", "normal");
  const billLines = doc.splitTextToSize(billed, doc.internal.pageSize.getWidth() - margin * 2 - 20);
  doc.text(billLines, margin + 10, y + 26);
  y += 50;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Product", "Qty", "Unit price", "Amount"]],
    body: items.map((e) => [e.name, e.qty, rupee(e.unitPrice), rupee(e.amount)]),
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
    theme: "grid",
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  let ty = finalY + 18;
  const summaryX = doc.internal.pageSize.getWidth() - margin - 220;

  const drawTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(11);
    doc.text(label, summaryX, ty);
    doc.text(value, doc.internal.pageSize.getWidth() - margin, ty, { align: "right" });
    ty += 16;
  };

  drawTotalRow("Subtotal", rupee(t.subtotal));
  drawTotalRow("Discount", `- ${rupee(t.discount)}`);
  drawTotalRow("Extra charges", t.extraCharges <= 0 ? rupee(0) : rupee(t.extraCharges));
  doc.setDrawColor(120);
  doc.line(summaryX, ty, doc.internal.pageSize.getWidth() - margin, ty);
  ty += 10;
  drawTotalRow("Net amount", rupee(t.netAmount), true);

  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

export async function downloadInvoicePdf(args: Readonly<{
  invoice: Record<string, unknown>;
  lines: readonly unknown[];
  companyNameFallback?: string | null;
}>): Promise<string> {
  return buildInvoicePdfBlobUrl(args);
}
