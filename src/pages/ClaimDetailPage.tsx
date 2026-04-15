import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  fetchReimbursementAttachmentBlobUrl,
  fetchReimbursementById,
  fetchReimbursementServiceTypes,
  fetchReimbursementSteps,
  parseReimbursementDetailResponse,
  parseReimbursementStepsResponse,
  type ReimbursementAttachmentRow,
  type ReimbursementBillDetail,
  type ReimbursementClaimSummary,
  type ReimbursementDetail,
  type ReimbursementHistoryStep,
  type ReimbursementServiceType,
} from "@/api/patientReimbursement";
import { AttachmentFilePreview } from "@/components/attachments/AttachmentFilePreview";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { useAttachmentFilePreviewGallery } from "@/hooks/useAttachmentFilePreviewGallery";
import { useToast } from "@/hooks/useToast";
import "./ClaimsPages.css";

const GENERIC_SERVICE_TYPE = /^reimbursement_service$/i;

type ClaimDetailLocationState = Readonly<{
  returnPath?: string;
  summary?: ReimbursementClaimSummary;
}>;

type DetailTab = "history" | "bank" | "documents";

function formatInr(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function formatClaimDate(iso: string | null): string {
  if (!iso?.trim()) return "—";
  const t = iso.trim();
  if (t.length >= 10 && t[4] === "-" && t[7] === "-") return t.slice(0, 10);
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return t.slice(0, 10);
}

function formatDetailDate(iso: string | null): string {
  if (!iso?.trim()) return "—";
  return iso.trim();
}

function formatHistorySecondary(iso: string | null): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return iso.trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function avatarInitial(name: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  const first = t[0];
  return first ? first.toUpperCase() : "?";
}

type BadgeVariant = "submitted" | "review" | "approved" | "rejected" | "muted";

function statusBadge(
  statusCode: number | null,
  statusLabel: string | null,
): { text: string; variant: BadgeVariant } {
  const c = statusCode;
  if (c === 0) return { text: "Submitted", variant: "submitted" };
  if (c === 1) return { text: "In review", variant: "review" };
  if (c === 2) return { text: "Approved", variant: "approved" };
  if (c === 3) return { text: "Rejected", variant: "rejected" };
  if (c != null) return { text: `Status ${c}`, variant: "muted" };
  const lbl = statusLabel?.trim();
  if (lbl) return { text: lbl, variant: "muted" };
  return { text: "Submitted", variant: "submitted" };
}

function formatApprovedDisplay(approvedAmount: number | null, statusCode: number | null): string {
  if (statusCode !== 2 && (approvedAmount == null || approvedAmount === 0)) return "—";
  if (approvedAmount == null) return "—";
  return formatInr(approvedAmount);
}

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="claim-detail-doc__clip" aria-hidden>
      <path
        d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l9.19-9.19a3.5 3.5 0 014.95 4.95l-8.49 8.49a2 2 0 01-2.83-2.83l7.78-7.78"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BillCard({
  bill,
  billServiceLine,
  onOpen,
}: Readonly<{
  bill: ReimbursementBillDetail;
  billServiceLine: string | null;
  onOpen: (row: ReimbursementAttachmentRow, siblings: readonly ReimbursementAttachmentRow[]) => void;
}>) {
  const metaBits = [bill.clinicName?.trim() || null, bill.billDate ? formatClaimDate(bill.billDate) : null].filter(
    Boolean,
  ) as string[];
  const meta = metaBits.join(" • ") || "—";

  return (
    <div className="claim-detail-doc-card">
      <div className="claim-detail-doc-card__main">
        <p className="claim-detail-doc-card__title">Bill Number: {bill.billNumber}</p>
        <p className="claim-detail-doc-card__meta">{meta}</p>
        {billServiceLine ? (
          <p className="claim-detail-doc-card__meta">Service Type: {billServiceLine}</p>
        ) : null}
        {bill.files.length === 0 ? (
          <p className="claim-detail-doc-card__meta">—</p>
        ) : (
          <ul className="claim-detail-doc-card__files">
            {bill.files.map((f) => (
              <li key={f.id} className="claim-detail-doc-card__file-row">
                <PaperclipIcon />
                <span className="claim-detail-doc-card__fname">{f.label}</span>
                <button type="button" className="claim-detail-doc-card__open" onClick={() => onOpen(f, bill.files)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReportRow({
  file,
  serviceTypeLine,
  sectionFiles,
  onOpen,
}: Readonly<{
  file: ReimbursementAttachmentRow;
  serviceTypeLine: string | null;
  sectionFiles: readonly ReimbursementAttachmentRow[];
  onOpen: (row: ReimbursementAttachmentRow, siblings: readonly ReimbursementAttachmentRow[]) => void;
}>) {
  return (
    <div className="claim-detail-doc-card claim-detail-doc-card--row">
      <div className="claim-detail-doc-card__main claim-detail-doc-card__main--grow">
        <p className="claim-detail-doc-card__fname claim-detail-doc-card__fname--bold">{file.label}</p>
        {serviceTypeLine ? (
          <p className="claim-detail-doc-card__meta">Service Type: {serviceTypeLine}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="claim-detail-doc-card__open claim-detail-doc-card__open--side"
        onClick={() => onOpen(file, sectionFiles)}
      >
        Open
      </button>
    </div>
  );
}

function DocSection({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="claim-detail-doc-section">
      <h3 className="claim-detail-doc-section__title">{title}</h3>
      {children}
    </section>
  );
}

export function ClaimDetailPage() {
  const { claimId = "" } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = (location.state ?? null) as ClaimDetailLocationState | null;
  const returnPath = state?.returnPath?.trim() || ROUTES.claims;
  const summary = state?.summary ?? null;

  const [tab, setTab] = useState<DetailTab>("history");
  const [detail, setDetail] = useState<ReimbursementDetail | null>(null);
  const [steps, setSteps] = useState<readonly ReimbursementHistoryStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [serviceTypesCatalog, setServiceTypesCatalog] = useState<readonly ReimbursementServiceType[] | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const {
    viewer: fileViewer,
    openPreview,
    closePreview,
    onGalleryNavigate,
  } = useAttachmentFilePreviewGallery();

  useEffect(() => {
    let cancelled = false;
    void fetchReimbursementServiceTypes()
      .then((rows) => {
        if (!cancelled) setServiceTypesCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) setServiceTypesCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const u of blobUrlsRef.current) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      }
      blobUrlsRef.current = [];
    };
  }, []);

  const onBack = useCallback(() => {
    navigate(returnPath);
  }, [navigate, returnPath]);

  const openClaimAttachment = useCallback(
    async (row: ReimbursementAttachmentRow, siblings: readonly ReimbursementAttachmentRow[]) => {
      const resolveUrl = async (r: ReimbursementAttachmentRow): Promise<string | null> => {
        const direct = r.openUrl?.trim();
        if (direct) return direct;
        try {
          const blobUrl = await fetchReimbursementAttachmentBlobUrl(r.id);
          blobUrlsRef.current.push(blobUrl);
          return blobUrl;
        } catch {
          return null;
        }
      };

      const primary = await resolveUrl(row);
      if (!primary) {
        toast.error("Could not open this attachment.");
        return;
      }

      const pool = siblings.filter((s) => Boolean(s.openUrl?.trim()) || s.id === row.id);
      const items: { url: string; name: string | null }[] = [];
      for (const s of pool) {
        let url = s.openUrl?.trim() ?? "";
        if (!url && s.id === row.id) url = primary;
        if (!url) continue;
        items.push({ url, name: s.label });
      }
      if (!items.some((x) => x.url === primary)) {
        items.push({ url: primary, name: row.label });
      }
      openPreview(items, primary);
    },
    [openPreview, toast],
  );

  useEffect(() => {
    const id = claimId.trim();
    if (!id) {
      setLoading(false);
      setError("Missing claim id");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rawDetail, rawSteps] = await Promise.all([
          fetchReimbursementById(id),
          fetchReimbursementSteps(id).catch(() => null),
        ]);
        if (cancelled) return;
        const parsed = parseReimbursementDetailResponse(rawDetail);
        if (!parsed) {
          setDetail(null);
          setError("Could not read claim details");
        } else {
          setDetail(parsed);
        }
        setSteps(rawSteps != null ? parseReimbursementStepsResponse(rawSteps) : []);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setError(e instanceof Error ? e.message : "Could not load claim");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimId, reloadKey]);

  const display = useMemo(() => {
    if (detail) return detail;
    if (!summary) return null;
    const synthetic: ReimbursementDetail = {
      id: summary.id,
      claimAmount: summary.claimAmount,
      approvedAmount: summary.approvedAmount,
      statusCode: summary.statusCode,
      statusLabel: summary.statusLabel,
      createdAt: summary.createdAt,
      patientName: summary.patientName,
      phone: null,
      serviceTypeLine: null,
      serviceTypeKeys: [],
      bank: null,
      bills: [],
      paymentReceiptFiles: [],
      reportFiles: [],
      otherFiles: [],
    };
    return synthetic;
  }, [detail, summary]);

  const badge = useMemo(() => {
    if (!display) return { text: "…", variant: "muted" as const };
    return statusBadge(display.statusCode, display.statusLabel);
  }, [display]);

  const historyRows = useMemo(() => {
    if (!display) return [];
    if (steps.length > 0) return [...steps];
    const b = statusBadge(display.statusCode, display.statusLabel);
    return [{ title: b.text, at: display.createdAt }];
  }, [display, steps]);

  const displayServiceLine = useMemo(() => {
    if (!display) return null;
    const raw = display.serviceTypeLine?.trim() ?? "";
    if (raw && !GENERIC_SERVICE_TYPE.test(raw)) return raw;
    const cat = serviceTypesCatalog;
    if (cat && cat.length > 0 && display.serviceTypeKeys.length > 0) {
      const map = new Map(cat.map((t) => [t.key.trim(), t.value.trim()]));
      const labels = display.serviceTypeKeys
        .map((k) => map.get(k.trim()) || k.trim())
        .filter((x) => x.length > 0 && !GENERIC_SERVICE_TYPE.test(x));
      const uniq = [...new Set(labels)];
      if (uniq.length) return uniq.join(", ");
    }
    return raw && !GENERIC_SERVICE_TYPE.test(raw) ? raw : null;
  }, [display, serviceTypesCatalog]);

  const billServiceLines = useMemo(() => {
    const m = new Map<string, string | null>();
    if (!display) return m;
    const cat = serviceTypesCatalog;
    const map = cat && cat.length ? new Map(cat.map((t) => [t.key.trim(), t.value.trim()])) : null;
    for (const b of display.bills) {
      const doc = b.documentName?.trim();
      if (doc && !GENERIC_SERVICE_TYPE.test(doc)) {
        m.set(b.billId, doc);
        continue;
      }
      if (map && b.serviceKeys.length) {
        const labels = b.serviceKeys
          .map((k) => map.get(k.trim()) || k.trim())
          .filter((x) => x.length > 0 && !GENERIC_SERVICE_TYPE.test(x));
        const uniq = [...new Set(labels)];
        if (uniq.length) {
          m.set(b.billId, uniq.join(", "));
          continue;
        }
      }
      m.set(b.billId, doc || null);
    }
    return m;
  }, [display, serviceTypesCatalog]);

  const title = `My Claims (#${claimId.trim() || "…"})`;

  return (
    <div className="claim-detail-page">
      <header className="claim-detail-hero">
        <div className="claim-detail-hero__toolbar">
          <button type="button" className="claim-detail-hero__back" aria-label="Back" onClick={onBack}>
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
          <h1 className="claim-detail-hero__title">{title}</h1>
        </div>

        {loading && !display ? <p className="claim-detail-hero__loading">Loading…</p> : null}
        {error && !display ? (
          <div className="claim-detail-hero__err">
            <p>{error}</p>
            <button type="button" className="claim-detail-hero__retry" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {display ? (
          <>
            <div className="claim-detail-hero__user">
              <div className="claim-detail-hero__avatar" aria-hidden>
                {avatarInitial(display.patientName)}
              </div>
              <div className="claim-detail-hero__who">
                <p className="claim-detail-hero__name">{display.patientName?.trim() || "Member"}</p>
                <p className="claim-detail-hero__phone">Phone number: {display.phone?.trim() || "—"}</p>
              </div>
              <div className={`claim-detail-hero__badge claim-detail-hero__badge--${badge.variant}`}>
                {badge.text}
              </div>
            </div>

            <div className="claim-detail-hero__stats">
              <div className="claim-detail-hero__stat">
                <span className="claim-detail-hero__stat-label">Claimed</span>
                <span className="claim-detail-hero__stat-value">{formatInr(display.claimAmount)}</span>
              </div>
              <div className="claim-detail-hero__stat">
                <span className="claim-detail-hero__stat-label">Approved</span>
                <span className="claim-detail-hero__stat-value">
                  {formatApprovedDisplay(display.approvedAmount, display.statusCode)}
                </span>
              </div>
              <div className="claim-detail-hero__stat claim-detail-hero__stat--right">
                <span className="claim-detail-hero__stat-label">Date</span>
                <span className="claim-detail-hero__stat-value claim-detail-hero__stat-value--wrap">
                  {formatDetailDate(display.createdAt)}
                </span>
              </div>
            </div>

            {displayServiceLine ? (
              <p className="claim-detail-hero__services">Service Type: {displayServiceLine}</p>
            ) : null}
          </>
        ) : null}
      </header>

      {display ? (
        <>
          <nav className="claim-detail-tabs" aria-label="Claim sections">
            {(
              [
                ["history", "History"],
                ["bank", "Bank"],
                ["documents", "Documents"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`claim-detail-tabs__btn${tab === id ? " claim-detail-tabs__btn--on" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <main className="claim-detail-main">
            {tab === "history" ? (
              <div className="claim-detail-panel">
                <ul className="claim-detail-history">
                  {historyRows.map((row, i) => (
                    <li key={`${row.title}-${row.at ?? i}`} className="claim-detail-history__item">
                      <span className="claim-detail-history__dot" aria-hidden />
                      <div>
                        <p className="claim-detail-history__title">{row.title}</p>
                        <p className="claim-detail-history__time">{formatHistorySecondary(row.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tab === "bank" ? (
              <div className="claim-detail-panel claim-detail-panel--pad">
                <div className="claim-detail-bank-card">
                  <h2 className="claim-detail-bank-card__head">Bank Details</h2>
                  <hr className="claim-detail-bank-card__rule" />
                  {display.bank ? (
                    <dl className="claim-detail-bank-card__rows">
                      <div className="claim-detail-bank-card__row">
                        <dt>Account Holder Name</dt>
                        <dd>{display.bank.accountHolderName?.trim() || "—"}</dd>
                      </div>
                      <div className="claim-detail-bank-card__row">
                        <dt>Bank Name</dt>
                        <dd>{display.bank.bankName?.trim() || "—"}</dd>
                      </div>
                      <div className="claim-detail-bank-card__row">
                        <dt>Account Number</dt>
                        <dd>{display.bank.accountNumber?.trim() || "—"}</dd>
                      </div>
                      <div className="claim-detail-bank-card__row">
                        <dt>Branch</dt>
                        <dd>{display.bank.branch?.trim() || "—"}</dd>
                      </div>
                      <div className="claim-detail-bank-card__row">
                        <dt>IFSC Code</dt>
                        <dd>{display.bank.ifscCode?.trim() || "—"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="claim-detail-empty">No bank details on this claim.</p>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "documents" ? (
              <div className="claim-detail-panel claim-detail-panel--docs">
                <DocSection title="Bills">
                  {display.bills.length === 0 ? (
                    <p className="claim-detail-dash">—</p>
                  ) : (
                    <div className="claim-detail-doc-stack">
                      {display.bills.map((b) => (
                        <BillCard
                          key={b.billId}
                          bill={b}
                          billServiceLine={billServiceLines.get(b.billId) ?? null}
                          onOpen={openClaimAttachment}
                        />
                      ))}
                    </div>
                  )}
                </DocSection>

                <DocSection title="Payment Receipts">
                  {display.paymentReceiptFiles.length === 0 ? (
                    <p className="claim-detail-dash">—</p>
                  ) : (
                    <div className="claim-detail-doc-stack">
                      {display.paymentReceiptFiles.map((f) => (
                        <ReportRow
                          key={f.id}
                          file={f}
                          serviceTypeLine={displayServiceLine}
                          sectionFiles={display.paymentReceiptFiles}
                          onOpen={openClaimAttachment}
                        />
                      ))}
                    </div>
                  )}
                </DocSection>

                <DocSection title="Medical Reports">
                  {display.reportFiles.length === 0 ? (
                    <p className="claim-detail-dash">—</p>
                  ) : (
                    <div className="claim-detail-doc-stack">
                      {display.reportFiles.map((f) => (
                        <ReportRow
                          key={f.id}
                          file={f}
                          serviceTypeLine={displayServiceLine}
                          sectionFiles={display.reportFiles}
                          onOpen={openClaimAttachment}
                        />
                      ))}
                    </div>
                  )}
                </DocSection>

                <DocSection title="Other Documents">
                  {display.otherFiles.length === 0 ? (
                    <p className="claim-detail-dash">—</p>
                  ) : (
                    <div className="claim-detail-doc-stack">
                      {display.otherFiles.map((f) => (
                        <ReportRow
                          key={f.id}
                          file={f}
                          serviceTypeLine={displayServiceLine}
                          sectionFiles={display.otherFiles}
                          onOpen={openClaimAttachment}
                        />
                      ))}
                    </div>
                  )}
                </DocSection>
              </div>
            ) : null}
          </main>
        </>
      ) : null}

      <HomeBottomNav />

      <AttachmentFilePreview
        viewer={fileViewer}
        onClose={closePreview}
        onGalleryNavigate={onGalleryNavigate}
      />
    </div>
  );
}
