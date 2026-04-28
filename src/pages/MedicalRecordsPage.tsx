import { ConsultationRecordsList } from "@/components/medicalRecords/ConsultationRecordsList";
import { fetchMedicalHistoryByType } from "@/api/patientMedicalHistory";
import {
  MEDICAL_RECORD_CATEGORIES,
  medicalRecordCategoryFromSlug,
  type MedicalRecordCategoryDef,
} from "@/constants/medicalRecordsCategories";
import { ROUTES, WELLNESS_SESSION_KIND } from "@/constants";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generatePath, Link, useNavigate, useParams } from "react-router-dom";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { MobileFilterChip, MobileFilterSheet } from "@/components/mobileFilter/MobileFilterSheet";
import { medicalRecordSlugIconSrc } from "@/components/mobileFilter/medicalRecordFilterIcons";
import familyAccountsSvg from "@/assets/icons/AccountManagement/FamilyAccounts.svg";
import profileSvg from "@/assets/icons/AccountManagement/Profile.svg";
import "./MedicalRecordsPage.css";

const MR_USER_FILTER_KEY = "opd-mobile-view.medical-records.userFilter";

function readStoredUserFilter(): string {
  try {
    return sessionStorage.getItem(MR_USER_FILTER_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean") {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "";
}

function recordTitle(category: MedicalRecordCategoryDef, row: Record<string, unknown>): string {
  switch (category.slug) {
    case "consultations": {
      const doc = asRecord(row.doctor);
      return pickStr(doc?.name) || "Consultation";
    }
    case "lab-tests":
      return pickStr(row.title, row.name) || "Lab test";
    case "prescriptions": {
      const doc = asRecord(row.appointment);
      const inner = doc ? asRecord(doc.doctor) : null;
      return pickStr(inner?.name) || "Prescription";
    }
    case "conditions":
      return pickStr(row.condition) || "Condition";
    case "mental-wellness":
    case "nutrition":
      return pickStr(row.service_name, row.serviceName) || category.label;
    default:
      return pickStr(row.title, row.value, row.type, row.name) || category.label;
  }
}

function recordSubtitle(category: MedicalRecordCategoryDef, row: Record<string, unknown>): string {
  switch (category.slug) {
    case "consultations":
      return pickStr(row.date, row.time) || pickStr(row.statusText);
    case "lab-tests":
      return pickStr(row.statusText, row.date) || "";
    case "prescriptions":
      return pickStr(row.createdAtDate, row.created_at) || "";
    default:
      return pickStr(row.datetime, row.date, row.booking_time, row.bookingTime) || "";
  }
}

export function MedicalRecordsPage() {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const navigate = useNavigate();
  const category = useMemo(() => medicalRecordCategoryFromSlug(categorySlug), [categorySlug]);

  const emptyBookNowPath = useMemo(() => {
    if (!category) return null;
    switch (category.slug) {
      case "lab-tests":
        return generatePath(ROUTES.diagnosticsType, { type: "lab-tests" });
      case "mental-wellness":
        return generatePath(ROUTES.servicesWellness, { wellnessKind: WELLNESS_SESSION_KIND.mentalWellness });
      case "nutrition":
        return generatePath(ROUTES.servicesWellness, { wellnessKind: WELLNESS_SESSION_KIND.nutrition });
      default:
        return null;
    }
  }, [category]);

  const [rows, setRows] = useState<readonly Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [members, setMembers] = useState<readonly MemberDisplay[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [userFilterId, setUserFilterId] = useState(readStoredUserFilter);

  /** Dot when a family member is selected or category is not the default (Consultations). */
  const showFilterDot =
    userFilterId.trim().length > 0 ||
    (category != null && category.slug !== MEDICAL_RECORD_CATEGORIES[0]?.slug);

  const load = useCallback(
    async (c: MedicalRecordCategoryDef) => {
      setLoading(true);
      setError(null);
      try {
        const uid = userFilterId.trim();
        const raw = await fetchMedicalHistoryByType(c.apiSegment, {
          userId: uid.length > 0 ? uid : null,
        });
        const list = raw.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
        setRows(list);
      } catch (e) {
        setRows([]);
        setError(e instanceof Error ? e.message : "Could not load records");
      } finally {
        setLoading(false);
      }
    },
    [userFilterId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMembersLoading(true);
      try {
        const m = await fetchAllPatientMembers();
        if (!cancelled) setMembers(m);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!category) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    void load(category);
  }, [category, load]);

  useEffect(() => {
    setSelected(null);
  }, [categorySlug]);

  const persistUserFilter = (id: string) => {
    const v = id.trim();
    setUserFilterId(v);
    try {
      sessionStorage.setItem(MR_USER_FILTER_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const reportUrl = selected ? pickStr(selected.reportUrl, selected.report_url) : "";
  const invoiceId = selected ? pickStr(selected.invoice_id, selected.invoiceId) : "";
  const labOrderDetailId = selected
    ? pickStr(
        asRecord(selected.info)?.id,
        selected.consultation_info_id,
        selected.consultationInfoId,
        selected.service_id,
        selected.serviceId,
        selected.invoice_id,
        selected.invoiceId,
      )
    : "";

  const emptyLine =
    category && rows.length === 0 && !loading && !error
      ? `No ${category.label.toLowerCase()} found.`
      : "No records found.";

  return (
    <div className="page medical-records-page">
      <header className="mr-header">
        <Link to={ROUTES.servicesMedicalRecordsTab} className="mr-back" aria-label="Back to services">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="mr-title">{category ? category.label : "Medical records"}</h1>
        <button
          type="button"
          className="mr-filter-btn"
          aria-label="Filter medical records"
          title="Filter medical records"
          onClick={() => setSheetOpen(true)}
        >
          <span className="mr-filter-btn__icon-wrap">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 6h4.5M10 6h10M14 18h6M4 18h7M9 12h11M4 12h3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="9" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
              <circle cx="15" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
              <circle cx="7" cy="6" r="2" stroke="currentColor" strokeWidth="2" />
            </svg>
            {showFilterDot ? <span className="mr-filter-btn__dot" aria-hidden /> : null}
          </span>
        </button>
      </header>

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter medical records"
        subtitle="Choose a record type and optionally a family member"
      >
        <div className="mobile-filter-sheet__divider" />
        <div className="mobile-filter-sheet__section">
          <div className="mobile-filter-sheet__wrap">
            {MEDICAL_RECORD_CATEGORIES.map((c) => (
              <MobileFilterChip
                key={c.slug}
                label={c.label}
                icon={<img src={medicalRecordSlugIconSrc(c.slug)} alt="" width={18} height={18} />}
                selected={category?.slug === c.slug}
                onClick={() => {
                  setSheetOpen(false);
                  void navigate(generatePath(ROUTES.medicalRecordsCategory, { categorySlug: c.slug }));
                }}
              />
            ))}
          </div>
        </div>
        <div className="mobile-filter-sheet__divider" />
        <div className="mobile-filter-sheet__section-label">Family member</div>
        <div className="mobile-filter-sheet__section">
          {membersLoading ? (
            <div className="mobile-filter-sheet__members-loading">
              <p className="mr-status">Loading…</p>
            </div>
          ) : (
            <div className="mobile-filter-sheet__wrap">
              <MobileFilterChip
                label="All members"
                icon={<img src={familyAccountsSvg} alt="" width={18} height={18} />}
                selected={userFilterId.trim().length === 0}
                onClick={() => {
                  persistUserFilter("");
                  setSheetOpen(false);
                }}
              />
              {members.map((m) => (
                <MobileFilterChip
                  key={m.id}
                  label={m.name.trim().length > 0 ? m.name : m.id}
                  icon={<img src={profileSvg} alt="" width={18} height={18} />}
                  selected={userFilterId === m.id}
                  onClick={() => {
                    persistUserFilter(m.id);
                    setSheetOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </MobileFilterSheet>

      {!category ? (
        <main className="mr-main">
          <p className="mr-lead">Choose a category to view your history.</p>
          <ul className="mr-cat-grid">
            {MEDICAL_RECORD_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link className="mr-cat-card" to={generatePath(ROUTES.medicalRecordsCategory, { categorySlug: c.slug })}>
                  <span className="mr-cat-card__name">{c.label}</span>
                  <span className="mr-cat-card__desc">{c.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      ) : (
        <main className="mr-main">
          <Link className="mr-all-cats" to={ROUTES.medicalRecords}>
            All categories
          </Link>
          {loading ? <p className="mr-status">Loading…</p> : null}
          {error ? (
            <p className="mr-status mr-status--error" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <div className="mr-empty-cta">
              <p className="mr-status">{emptyLine}</p>
              {emptyBookNowPath ? (
                <Link className="mr-book-now" to={emptyBookNowPath}>
                  Book now
                </Link>
              ) : null}
            </div>
          ) : null}
          {category.slug === "consultations" && rows.length > 0 ? (
            <ConsultationRecordsList rows={rows} />
          ) : category.slug !== "consultations" ? (
            <ul className="mr-list">
              {rows.map((row, i) => {
                const key = pickStr(row.id, row.appointment_id) || `row-${i}`;
                return (
                  <li key={key}>
                    <button type="button" className="mr-row" onClick={() => setSelected(row)}>
                      <span className="mr-row__title">{recordTitle(category, row)}</span>
                      <span className="mr-row__sub">{recordSubtitle(category, row)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </main>
      )}

      {selected && category ? (
        <div className="mr-overlay" role="presentation" onClick={() => setSelected(null)}>
          <article
            className="mr-overlay__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mr-detail-title"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <header className="mr-dialog__head">
              <h2 id="mr-detail-title">{recordTitle(category, selected)}</h2>
              <button type="button" className="mr-dialog__close" aria-label="Close" onClick={() => setSelected(null)}>
                ×
              </button>
            </header>
            <div className="mr-dialog__body">
              {category.slug === "consultations" && invoiceId ? (
                <p className="mr-dialog__actions">
                  <Link
                    className="mr-link"
                    to={pathToOrderDetail("consultation", invoiceId)}
                    onClick={() => setSelected(null)}
                  >
                    View order / invoice
                  </Link>
                </p>
              ) : null}
              {category.slug === "lab-tests" && labOrderDetailId ? (
                <p className="mr-dialog__actions">
                  <Link
                    className="mr-link"
                    to={pathToOrderDetail("lab", labOrderDetailId)}
                    onClick={() => setSelected(null)}
                  >
                    View lab order
                  </Link>
                </p>
              ) : null}
              {category.slug === "lab-tests" && reportUrl ? (
                <p className="mr-dialog__actions">
                  <a className="mr-link" href={reportUrl} target="_blank" rel="noopener noreferrer">
                    Open report
                  </a>
                </p>
              ) : null}
              <dl className="mr-kv">
                {Object.entries(selected)
                  .filter(([k]) => !["password", "token"].includes(k.toLowerCase()))
                  .map(([k, v]) => (
                    <div key={k} className="mr-kv__row">
                      <dt>{k}</dt>
                      <dd>{formatDetailValue(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

function formatDetailValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "—";
    }
  }
  return String(v);
}
