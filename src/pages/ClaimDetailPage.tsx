import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  canPatientEditClaimBillDetails,
  type ClaimChecklistSectionKey,
  fetchReimbursementAttachmentBlobUrl,
  fetchReimbursementById,
  fetchReimbursementServiceTypes,
  fetchReimbursementSteps,
  parseReimbursementDetailResponse,
  parseReimbursementStepsResponse,
  parseStatusStepsFromReimbursementDetailBody,
  patchReimbursementClaimStatus,
  type ReimbursementAttachmentRow,
  type ReimbursementBillDetail,
  type ReimbursementClaimSummary,
  type ReimbursementDetail,
  type ReimbursementHistoryStep,
  type ReimbursementServiceType,
} from "@/api/patientReimbursement";
import { uploadReimbursementChecklistDocumentId } from "@/api/patientUpload";
import {
  CLAIM_STATUS,
  claimHeroGradientCss,
  claimShouldShowApprovedAmount,
  claimStatusBadge,
  claimStatusTimelineColor,
} from "@/constants/claimStatus";
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

/** Readable date for hero summary (e.g. `22 Apr 2026`). */
function formatReadableClaimDate(iso: string | null): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return iso.trim();
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return iso.trim();
  }
}

/** Readable date & time for claim history timeline. */
function formatReadableClaimDateTime(iso: string | null): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return iso.trim();
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return iso.trim();
  }
}

function avatarInitial(name: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  const first = t[0];
  return first ? first.toUpperCase() : "?";
}

/** Same steps + detail parsing as initial load — used after checklist PATCH (Flutter `reloadCurrentClaimDetail`). */
async function fetchClaimDetailBundleForId(claimId: string): Promise<{
  stepRows: readonly ReimbursementHistoryStep[];
  parsed: ReimbursementDetail | null;
}> {
  const id = claimId.trim();
  const rawDetail = await fetchReimbursementById(id);
  let stepRows = parseStatusStepsFromReimbursementDetailBody(rawDetail);
  if (stepRows.length === 0) {
    const rawSteps = await fetchReimbursementSteps(id).catch(() => null);
    if (rawSteps != null) stepRows = [...parseReimbursementStepsResponse(rawSteps)];
  }
  const parsed = parseReimbursementDetailResponse(rawDetail);
  return { stepRows, parsed };
}

function formatApprovedDisplay(approvedAmount: number | null, statusCode: number | null): string {
  if (!claimShouldShowApprovedAmount(statusCode)) return "—";
  if (approvedAmount == null) return "—";
  return formatInr(approvedAmount);
}

function bankNeedsAttention(d: ReimbursementDetail | null): boolean {
  return d?.bank?.verifyStatus === 2;
}

function documentsNeedAttention(d: ReimbursementDetail | null): boolean {
  if (!d) return false;
  const st = d.statusCode ?? -1;
  const anyRowMissing = (list: readonly ReimbursementAttachmentRow[] | undefined) =>
    list?.some((r) => r.rowStatus === 0) ?? false;
  for (const b of d.bills) {
    if (st === CLAIM_STATUS.ACTION_REQUIRED && b.billDocumentStatus === 0) return true;
    if (b.billVerifyStatus === 3 && b.billDocumentStatus === 1) return true;
  }
  if (
    st === CLAIM_STATUS.ACTION_REQUIRED &&
    (anyRowMissing(d.paymentReceiptFiles) || anyRowMissing(d.reportFiles) || anyRowMissing(d.otherFiles))
  ) {
    return true;
  }
  return false;
}

function TabAttentionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="claim-detail-tabs__info" aria-hidden>
      <path
        d="M12 16v-4M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type DocFileKind = "pdf" | "image" | "sheet" | "doc" | "file";

function docFileKindFromAttachment(row: ReimbursementAttachmentRow): DocFileKind {
  const ft = (row.fileType || "").toUpperCase();
  if (ft.includes("PDF")) return "pdf";
  if (ft.includes("XLS") || ft.includes("CSV")) return "sheet";
  if (ft.includes("DOC")) return "doc";
  if (ft.includes("IMG") || ft.includes("PNG") || ft.includes("JPEG") || ft.includes("JPG")) return "image";
  const name = row.label.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(name)) return "image";
  if (/\.(xlsx?|csv)$/i.test(name)) return "sheet";
  if (/\.(docx?|rtf)$/i.test(name)) return "doc";
  return "file";
}

function docFileKindShortLabel(kind: DocFileKind): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    case "sheet":
      return "Spreadsheet";
    case "doc":
      return "Document";
    default:
      return "File";
  }
}

function ClaimDocKindIcon({ kind }: Readonly<{ kind: DocFileKind }>) {
  const cls = "claim-detail-doc-card__kind-svg";
  switch (kind) {
    case "pdf":
      return (
        <span className="claim-detail-doc-card__kind-icon claim-detail-doc-card__kind-icon--pdf" aria-hidden>
          <svg className={cls} width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
              stroke="currentColor"
              strokeWidth="1.45"
              strokeLinejoin="round"
            />
            <path d="M14 2v6h6M10 13h4m-4 4h7" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
          </svg>
        </span>
      );
    case "image":
      return (
        <span className="claim-detail-doc-card__kind-icon claim-detail-doc-card__kind-icon--image" aria-hidden>
          <svg className={cls} width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
              stroke="currentColor"
              strokeWidth="1.45"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.45" />
            <circle cx="8.5" cy="9" r="1.25" fill="currentColor" />
          </svg>
        </span>
      );
    case "sheet":
      return (
        <span className="claim-detail-doc-card__kind-icon claim-detail-doc-card__kind-icon--sheet" aria-hidden>
          <svg className={cls} width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.45" />
            <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.45" />
          </svg>
        </span>
      );
    case "doc":
      return (
        <span className="claim-detail-doc-card__kind-icon claim-detail-doc-card__kind-icon--doc" aria-hidden>
          <svg className={cls} width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
              stroke="currentColor"
              strokeWidth="1.45"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    default:
      return (
        <span className="claim-detail-doc-card__kind-icon claim-detail-doc-card__kind-icon--file" aria-hidden>
          <svg className={cls} width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
              stroke="currentColor"
              strokeWidth="1.45"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
  }
}

function BillCard({
  bill,
  billServiceLine,
  onOpen,
  onEdit,
  missing,
  invalid,
}: Readonly<{
  bill: ReimbursementBillDetail;
  billServiceLine: string | null;
  onOpen: (row: ReimbursementAttachmentRow, siblings: readonly ReimbursementAttachmentRow[]) => void;
  onEdit?: () => void;
  missing?: boolean;
  invalid?: boolean;
}>) {
  const amt =
    bill.billAmount != null && Number.isFinite(bill.billAmount)
      ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(bill.billAmount)
      : null;
  const metaBits = [amt ? `₹${amt}` : null, bill.clinicName?.trim() || null, bill.billDate ? formatClaimDate(bill.billDate) : null].filter(
    Boolean,
  ) as string[];
  const meta = metaBits.join(" • ") || "—";

  const cardClass =
    `claim-detail-doc-card${missing ? " claim-detail-doc-card--missing" : ""}${invalid ? " claim-detail-doc-card--invalid" : ""}`;

  return (
    <div className={cardClass}>
      <div className="claim-detail-doc-card__main">
        <div className="claim-detail-doc-card__title-row">
          <p className="claim-detail-doc-card__title">Bill Number: {bill.billNumber}</p>
          {missing ? (
            <span className="claim-detail-doc-card__badge claim-detail-doc-card__badge--bad">Missing</span>
          ) : null}
          {invalid ? (
            <span className="claim-detail-doc-card__badge claim-detail-doc-card__badge--warn">Invalid bill</span>
          ) : null}
          {onEdit ? (
            <button type="button" className="claim-detail-doc-card__edit" onClick={onEdit}>
              Edit
            </button>
          ) : null}
        </div>
        <p className="claim-detail-doc-card__meta">{meta}</p>
        {billServiceLine ? (
          <p className="claim-detail-doc-card__meta">Service Type: {billServiceLine}</p>
        ) : null}
        {bill.files.length === 0 ? (
          <p className="claim-detail-doc-card__meta">—</p>
        ) : (
          <ul className="claim-detail-doc-card__files">
            {bill.files.map((f) => {
              const k = docFileKindFromAttachment(f);
              return (
                <li key={f.id} className="claim-detail-doc-card__file-row">
                  <ClaimDocKindIcon kind={k} />
                  <span className="claim-detail-doc-card__fname claim-detail-doc-card__fname--kind">
                    {docFileKindShortLabel(k)}
                  </span>
                  <span className="visually-hidden">{f.label}</span>
                  <button type="button" className="claim-detail-doc-card__open" onClick={() => onOpen(f, bill.files)}>
                    Open
                  </button>
                </li>
              );
            })}
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
  missing,
  showUpload,
  uploadBusy,
  onUpload,
}: Readonly<{
  file: ReimbursementAttachmentRow;
  serviceTypeLine: string | null;
  sectionFiles: readonly ReimbursementAttachmentRow[];
  onOpen: (row: ReimbursementAttachmentRow, siblings: readonly ReimbursementAttachmentRow[]) => void;
  missing?: boolean;
  showUpload?: boolean;
  uploadBusy?: boolean;
  onUpload?: (file: File) => void;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const kind = docFileKindFromAttachment(file);
  const rs = file.rowStatus ?? 1;
  const canOpen = rs !== 0;

  const onPick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list?.length || !onUpload) return;
      onUpload(list[0]);
      e.target.value = "";
    },
    [onUpload],
  );

  return (
    <div
      className={`claim-detail-doc-card claim-detail-doc-card--row${missing ? " claim-detail-doc-card--missing" : ""}`}
    >
      <div className="claim-detail-doc-card__main claim-detail-doc-card__main--grow">
        <div className="claim-detail-doc-card__title-row claim-detail-doc-card__title-row--doc-kind">
          <ClaimDocKindIcon kind={kind} />
          <p className="claim-detail-doc-card__fname claim-detail-doc-card__fname--bold claim-detail-doc-card__fname--kind-title">
            {docFileKindShortLabel(kind)}
          </p>
          <span className="visually-hidden">{file.label}</span>
          {missing ? (
            <span className="claim-detail-doc-card__badge claim-detail-doc-card__badge--bad">Missing</span>
          ) : null}
        </div>
        {missing && file.label.trim() ? (
          <p className="claim-detail-doc-card__meta">{file.label}</p>
        ) : null}
        {serviceTypeLine ? (
          <p className="claim-detail-doc-card__meta">Service Type: {serviceTypeLine}</p>
        ) : null}
      </div>
      <div className="claim-detail-doc-card__side-actions">
        {showUpload ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="claim-detail-doc-card__upload-input"
              accept="image/*,.pdf,application/pdf"
              onChange={onPick}
            />
            <button
              type="button"
              className="claim-detail-doc-card__upload-btn"
              disabled={Boolean(uploadBusy)}
              onClick={() => inputRef.current?.click()}
            >
              {uploadBusy ? "…" : "Upload"}
            </button>
          </>
        ) : null}
        {canOpen ? (
          <button
            type="button"
            className="claim-detail-doc-card__open claim-detail-doc-card__open--side"
            onClick={() => onOpen(file, sectionFiles)}
          >
            Open
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DocSection({
  title,
  count,
  empty,
  children,
}: Readonly<{
  title: string;
  /** Shown next to title when provided (e.g. row count). */
  count?: number;
  /** True when there are no rows — styles the empty placeholder. */
  empty?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <section className={`claim-detail-doc-section${empty ? " claim-detail-doc-section--empty" : ""}`}>
      <header className="claim-detail-doc-section__head">
        <h3 className="claim-detail-doc-section__title">{title}</h3>
        {count !== undefined ? (
          <span className="claim-detail-doc-section__chip" aria-label={`${count} ${count === 1 ? "item" : "items"}`}>
            {count}
          </span>
        ) : null}
      </header>
      <div className="claim-detail-doc-section__body">{children}</div>
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
  const [checklistUploadKey, setChecklistUploadKey] = useState<string | null>(null);
  const [serviceTypesCatalog, setServiceTypesCatalog] = useState<readonly ReimbursementServiceType[] | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);
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

  /** After bank edit save, reload detail so `verify_status` / reason stay in sync. */
  useEffect(() => {
    const st = location.state as { refreshReimbursementDetail?: boolean } | null;
    if (!st?.refreshReimbursementDetail) return;
    setReloadKey((k) => k + 1);
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate]);

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
        const { stepRows, parsed } = await fetchClaimDetailBundleForId(id);
        if (cancelled) return;

        setSteps(stepRows);

        if (!parsed) {
          setDetail(null);
          setError("Could not read claim details");
        } else {
          setDetail(parsed);
        }
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
      canDispute: false,
    };
    return synthetic;
  }, [detail, summary]);

  const canEditBills = useMemo(
    () => detail != null && canPatientEditClaimBillDetails(detail.statusCode),
    [detail],
  );

  const badge = useMemo(() => {
    if (!display) return { text: "…", variant: "muted" as const };
    return claimStatusBadge(display.statusCode, display.statusLabel);
  }, [display]);

  const bankBanner = useMemo(() => bankNeedsAttention(detail), [detail]);
  const docsBanner = useMemo(() => documentsNeedAttention(detail), [detail]);

  const showDisputeCta = useMemo(() => {
    if (!detail) return false;
    return detail.statusCode === CLAIM_STATUS.DENIED && Boolean(detail.canDispute);
  }, [detail]);

  const heroGradient = useMemo(() => claimHeroGradientCss(display?.statusCode ?? null), [display?.statusCode]);

  const submitDispute = useCallback(async () => {
    const id = claimId.trim();
    const reason = disputeReason.trim();
    if (!id || !reason) {
      toast.error("Please enter a reason for dispute.");
      return;
    }
    setDisputeBusy(true);
    try {
      await patchReimbursementClaimStatus(id, { status: CLAIM_STATUS.DISPUTED, reason });
      toast.success("Claim status updated.");
      setDisputeOpen(false);
      setDisputeReason("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit dispute");
    } finally {
      setDisputeBusy(false);
    }
  }, [claimId, disputeReason, toast]);

  const openBankEditor = useCallback(() => {
    const bid = detail?.bank?.id?.trim();
    if (!bid) {
      toast.error("Bank record not available.");
      return;
    }
    navigate(generatePath(ROUTES.profileBankEdit, { bankId: bid }), {
      state: { returnPath: `${location.pathname}${location.search}` },
    });
  }, [detail?.bank?.id, navigate, location.pathname, location.search, toast]);

  const historyRows = useMemo((): ReimbursementHistoryStep[] => {
    if (!display) return [];
    let rows: ReimbursementHistoryStep[];
    if (steps.length > 0) {
      rows = [...steps];
    } else {
      const badge = claimStatusBadge(display.statusCode, display.statusLabel);
      const reason = display.statusLabel?.trim() ?? "";
      rows = [
        {
          title: badge.text,
          at: display.createdAt,
          statusCode: display.statusCode,
          note: reason && reason !== badge.text ? reason : null,
        },
      ];
    }
    return rows.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : NaN;
      const tb = b.at ? new Date(b.at).getTime() : NaN;
      if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
      return ta - tb;
    });
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

  const reimbursementSt = display?.statusCode ?? null;

  const handleChecklistUpload = useCallback(
    async (section: ClaimChecklistSectionKey, rowId: string, file: File) => {
      const cid = claimId.trim();
      if (!cid || !detail) return;
      const billNo = detail.bills[0]?.billNumber?.trim();
      if (!billNo || billNo === "—") {
        toast.error("Bill details are required before uploading these documents.");
        return;
      }
      const rows =
        section === "payment"
          ? detail.paymentReceiptFiles
          : section === "report"
            ? detail.reportFiles
            : detail.otherFiles;
      const rowExists = rows.some((r) => String(r.id).trim() === String(rowId).trim());
      if (!rowExists) {
        toast.error("Document slot not found. Refresh the page and try again.");
        return;
      }
      const uploadSlotKind =
        section === "payment" ? "payment" : section === "report" ? "report" : "support";
      setChecklistUploadKey(`${section}:${rowId}`);
      try {
        await uploadReimbursementChecklistDocumentId(file, billNo, uploadSlotKind, "", rowId);
        const { stepRows, parsed } = await fetchClaimDetailBundleForId(cid);
        setSteps(stepRows);
        if (!parsed) {
          toast.error("Could not refresh claim details after upload.");
          setReloadKey((k) => k + 1);
        } else {
          setDetail(parsed);
          toast.success("Document uploaded");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setChecklistUploadKey(null);
      }
    },
    [claimId, detail, toast],
  );

  const title = `My Claims (#${claimId.trim() || "…"})`;

  return (
    <div className="claim-detail-page">
      <header className="claim-detail-hero" style={{ background: heroGradient }}>
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
                  {formatReadableClaimDate(display.createdAt)}
                </span>
              </div>
            </div>

            {displayServiceLine ? (
              <p className="claim-detail-hero__services">Service Type: {displayServiceLine}</p>
            ) : null}

            {detail?.statusLabel?.trim() ? (
              <p className="claim-detail-hero__reason">Note: {detail.statusLabel.trim()}</p>
            ) : null}

            {showDisputeCta ? (
              <button type="button" className="claim-detail-hero__dispute" onClick={() => setDisputeOpen(true)}>
                Dispute claim
              </button>
            ) : null}
          </>
        ) : null}
      </header>

      {disputeOpen ? (
        <div className="claim-dispute-backdrop" role="presentation" onClick={() => !disputeBusy && setDisputeOpen(false)}>
          <div
            className="claim-dispute-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-dispute-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="claim-dispute-title" className="claim-dispute-sheet__title">
              Dispute this claim
            </h2>
            <p className="claim-dispute-sheet__hint">Please describe why you are disputing this decision.</p>
            <textarea
              className="claim-dispute-sheet__input"
              rows={4}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Reason for dispute"
              disabled={disputeBusy}
            />
            <div className="claim-dispute-sheet__actions">
              <button
                type="button"
                className="claim-dispute-sheet__btn claim-dispute-sheet__btn--ghost"
                disabled={disputeBusy}
                onClick={() => setDisputeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="claim-dispute-sheet__btn claim-dispute-sheet__btn--primary"
                disabled={disputeBusy || !disputeReason.trim()}
                onClick={() => void submitDispute()}
              >
                {disputeBusy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {display ? (
        <>
          <nav className="claim-detail-tabs" aria-label="Claim sections">
            {(
              [
                ["history", "Claim history", false],
                ["bank", "Bank details", bankBanner],
                ["documents", "Documents", docsBanner],
              ] as const
            ).map(([id, label, warn]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`claim-detail-tabs__btn${tab === id ? " claim-detail-tabs__btn--on" : ""}`}
                onClick={() => setTab(id)}
              >
                <span className="claim-detail-tabs__inner">
                  {label}
                  {warn ? <TabAttentionIcon /> : null}
                </span>
              </button>
            ))}
          </nav>

          <main className="claim-detail-main">
            {tab === "history" ? (
              <div className="claim-detail-panel">
                <ul className="claim-detail-timeline" aria-label="Claim status timeline">
                  {historyRows.map((row, i) => {
                    const dotColor = claimStatusTimelineColor(
                      row.statusCode ?? display?.statusCode ?? null,
                    );
                    return (
                      <li
                        key={`${row.title}-${row.at ?? ""}-${i}`}
                        className="claim-detail-timeline__item"
                      >
                        <div className="claim-detail-timeline__rail">
                          <span
                            className="claim-detail-timeline__dot"
                            style={{
                              background: dotColor,
                              boxShadow: "0 0 0 3px rgba(0, 0, 0, 0.08)",
                            }}
                            aria-hidden
                          />
                        </div>
                        <div className="claim-detail-timeline__body">
                          <p className="claim-detail-timeline__title">{row.title}</p>
                          {row.note?.trim() ? (
                            <p className="claim-detail-timeline__note">{row.note.trim()}</p>
                          ) : null}
                          <time
                            className="claim-detail-timeline__when"
                            dateTime={row.at ?? undefined}
                          >
                            {formatReadableClaimDateTime(row.at)}
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {tab === "bank" ? (
              <div className="claim-detail-panel claim-detail-panel--pad">
                {bankBanner ? (
                  <div className="claim-detail-bank-alert" role="status">
                    <span className="claim-detail-bank-alert__icon" aria-hidden>
                      !
                    </span>
                    <div className="claim-detail-bank-alert__body">
                      {display.bank?.verifyStatus === 2 &&
                      display.bank.verifyReason != null &&
                      display.bank.verifyReason.trim() !== "" ? (
                        <p className="claim-detail-bank-alert__text claim-detail-bank-alert__text--reason">
                          {display.bank.verifyReason.trim()}
                        </p>
                      ) : (
                        <p className="claim-detail-bank-alert__text">
                          Your bank details need to be updated. Please correct them so we can process disbursement.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
                {bankBanner && display.bank?.id ? (
                  <button type="button" className="claim-detail-bank-update" onClick={openBankEditor}>
                    Update bank account
                  </button>
                ) : null}
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
                <p className="claim-detail-docs-intro">
                  Bills and checklist files for this claim. Use <strong>Open</strong> to preview; upload missing items when
                  required.
                </p>
                <DocSection title="Bills" count={display.bills.length} empty={display.bills.length === 0}>
                  {display.bills.length === 0 ? (
                    <p className="claim-detail-docs-placeholder">No bills linked yet.</p>
                  ) : (
                    <div className="claim-detail-doc-stack claim-detail-doc-stack--bills">
                      {display.bills.map((b) => {
                        const missing =
                          reimbursementSt === CLAIM_STATUS.ACTION_REQUIRED && b.billDocumentStatus === 0;
                        const invalid = b.billVerifyStatus === 3 && b.billDocumentStatus === 1;
                        return (
                          <BillCard
                            key={b.billId}
                            bill={b}
                            billServiceLine={billServiceLines.get(b.billId) ?? null}
                            onOpen={openClaimAttachment}
                            missing={missing}
                            invalid={invalid}
                            onEdit={
                              canEditBills && b.billDocumentStatus === 0
                                ? () =>
                                    navigate(
                                      generatePath(ROUTES.claimsBillEdit, {
                                        claimId: display.id,
                                        billId: b.billId,
                                      }),
                                    )
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </DocSection>

                <DocSection
                  title="Payment receipts"
                  count={display.paymentReceiptFiles.length}
                  empty={display.paymentReceiptFiles.length === 0}
                >
                  {display.paymentReceiptFiles.length === 0 ? (
                    <p className="claim-detail-docs-placeholder">None listed for this claim.</p>
                  ) : (
                    <div className="claim-detail-doc-stack claim-detail-doc-stack--dual">
                      {display.paymentReceiptFiles.map((f) => (
                        <ReportRow
                          key={f.id}
                          file={f}
                          serviceTypeLine={displayServiceLine}
                          sectionFiles={display.paymentReceiptFiles}
                          onOpen={openClaimAttachment}
                          missing={
                            reimbursementSt === CLAIM_STATUS.ACTION_REQUIRED && f.rowStatus === 0
                          }
                          showUpload={
                            Boolean(
                              canEditBills &&
                              reimbursementSt === CLAIM_STATUS.ACTION_REQUIRED &&
                              f.rowStatus === 0,
                            )
                          }
                          uploadBusy={checklistUploadKey === `payment:${f.id}`}
                          onUpload={(file) => void handleChecklistUpload("payment", f.id, file)}
                        />
                      ))}
                    </div>
                  )}
                </DocSection>

                <DocSection
                  title="Medical reports"
                  count={display.reportFiles.length}
                  empty={display.reportFiles.length === 0}
                >
                  {display.reportFiles.length === 0 ? (
                    <p className="claim-detail-docs-placeholder">None listed for this claim.</p>
                  ) : (
                    <div className="claim-detail-doc-stack claim-detail-doc-stack--dual">
                      {display.reportFiles.map((f) => (
                        <ReportRow
                          key={f.id}
                          file={f}
                          serviceTypeLine={displayServiceLine}
                          sectionFiles={display.reportFiles}
                          onOpen={openClaimAttachment}
                          missing={
                            reimbursementSt === CLAIM_STATUS.ACTION_REQUIRED && f.rowStatus === 0
                          }
                          showUpload={
                            Boolean(
                              canEditBills &&
                              reimbursementSt === CLAIM_STATUS.ACTION_REQUIRED &&
                              f.rowStatus === 0,
                            )
                          }
                          uploadBusy={checklistUploadKey === `report:${f.id}`}
                          onUpload={(file) => void handleChecklistUpload("report", f.id, file)}
                        />
                      ))}
                    </div>
                  )}
                </DocSection>

                <DocSection
                  title="Other documents"
                  count={display.otherFiles.length}
                  empty={display.otherFiles.length === 0}
                >
                  {display.otherFiles.length === 0 ? (
                    <p className="claim-detail-docs-placeholder">None listed for this claim.</p>
                  ) : (
                    <div className="claim-detail-doc-stack claim-detail-doc-stack--dual">
                      {display.otherFiles.map((f) => (
                        <ReportRow
                          key={f.id}
                          file={f}
                          serviceTypeLine={displayServiceLine}
                          sectionFiles={display.otherFiles}
                          onOpen={openClaimAttachment}
                          missing={
                            reimbursementSt === CLAIM_STATUS.ACTION_REQUIRED && f.rowStatus === 0
                          }
                          showUpload={
                            Boolean(
                              canEditBills &&
                              reimbursementSt === CLAIM_STATUS.ACTION_REQUIRED &&
                              f.rowStatus === 0,
                            )
                          }
                          uploadBusy={checklistUploadKey === `other:${f.id}`}
                          onUpload={(file) => void handleChecklistUpload("other", f.id, file)}
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
