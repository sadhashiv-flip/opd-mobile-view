import { fetchMedicalHistoryByType } from "@/api/patientMedicalHistory";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  MedicalRecordsFilterSheet,
  type MedicalRecordsFilterApply,
} from "@/components/medicalRecords/MedicalRecordsFilterSheet";
import { MedicalRecordsList } from "@/components/medicalRecords/MedicalRecordsList";
import { SymptomDetailSheet } from "@/components/medicalRecords/SymptomDetailSheet";
import { MedicalRecordSlugIcon } from "@/components/medicalRecords/MedicalRecordsIcons";
import { ROUTES, WELLNESS_SESSION_KIND } from "@/constants";
import {
  activeMedicalRecordFilterLabel,
  DEFAULT_MEDICAL_RECORD_SLUG,
  HEALTH_LOG_GROUP_LABEL,
  isDefaultMedicalRecordCategory,
  isHealthLogMedicalRecordSlug,
  medicalRecordCategoryFromSlug,
  type MedicalRecordCategoryDef,
} from "@/constants/medicalRecordsCategories";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { DIAG_SUB_LAB_TESTS } from "@/lib/subscriptionDashboardModules";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatePath, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import "./MedicalRecordsPage.css";
import "@/components/medicalRecords/MedicalRecordsCards.css";

const MR_USER_FILTER_KEY = "opd-mobile-view.medical-records.userFilter";

function readStoredUserFilter(): string {
  try {
    return sessionStorage.getItem(MR_USER_FILTER_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function emptyMessage(category: MedicalRecordCategoryDef): string {
  return `No ${category.label.toLowerCase()} records found`;
}

export function MedicalRecordsPage() {
  const { categorySlug } = useParams<{ categorySlug?: string }>();

  if (!categorySlug?.trim()) {
    return (
      <Navigate
        to={generatePath(ROUTES.medicalRecordsCategory, { categorySlug: DEFAULT_MEDICAL_RECORD_SLUG })}
        replace
      />
    );
  }

  const category = medicalRecordCategoryFromSlug(categorySlug);
  if (!category) {
    return (
      <Navigate
        to={generatePath(ROUTES.medicalRecordsCategory, { categorySlug: DEFAULT_MEDICAL_RECORD_SLUG })}
        replace
      />
    );
  }

  return <MedicalRecordsPageContent category={category} />;
}

function MedicalRecordsPageContent({ category }: Readonly<{ category: MedicalRecordCategoryDef }>) {
  const navigate = useNavigate();
  const mod = useProfileModuleGates();

  const [rows, setRows] = useState<readonly Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [symptomRow, setSymptomRow] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<readonly MemberDisplay[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [userFilterId, setUserFilterId] = useState(readStoredUserFilter);
  const pullStartY = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  const showFilterDot =
    userFilterId.trim().length > 0 || !isDefaultMedicalRecordCategory(category);

  const emptyBookNowPath = useMemo(() => {
    switch (category.slug) {
      case "lab-tests":
        if (!mod.loaded || !mod.gateOk || mod.diagnosticsHiddenSubSlugs.has(DIAG_SUB_LAB_TESTS)) return null;
        return generatePath(ROUTES.diagnosticsType, { type: "lab-tests" });
      case "mental-wellness":
        return generatePath(ROUTES.servicesWellness, { wellnessKind: WELLNESS_SESSION_KIND.mentalWellness });
      case "nutrition":
        return generatePath(ROUTES.servicesWellness, { wellnessKind: WELLNESS_SESSION_KIND.nutrition });
      default:
        return null;
    }
  }, [category.slug, mod.diagnosticsHiddenSubSlugs, mod.gateOk, mod.loaded]);

  const load = useCallback(async (c: MedicalRecordCategoryDef) => {
    setLoading(true);
    setError(null);
    try {
      const uid = userFilterId.trim();
      const raw = await fetchMedicalHistoryByType(c.apiSegment, {
        userId: uid.length > 0 ? uid : null,
      });
      const list = raw.filter(
        (x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x),
      );
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Could not load records");
    } finally {
      setLoading(false);
    }
  }, [userFilterId]);

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
    void load(category);
  }, [category, load]);

  const persistUserFilter = (id: string) => {
    const v = id.trim();
    setUserFilterId(v);
    try {
      sessionStorage.setItem(MR_USER_FILTER_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const applyFilters = useCallback(
    ({ categorySlug, userFilterId: uid }: MedicalRecordsFilterApply) => {
      setSheetOpen(false);
      const nextUserId = uid.trim();
      if (nextUserId !== userFilterId.trim()) {
        persistUserFilter(nextUserId);
      }
      if (categorySlug !== category.slug) {
        void navigate(generatePath(ROUTES.medicalRecordsCategory, { categorySlug }));
      }
    },
    [category.slug, navigate, userFilterId],
  );

  const handlePullRefresh = () => {
    void load(category);
  };

  return (
    <div className="page medical-records-page medical-records-page--tab">
      <header className="mr-header mr-header--tab">
        <h1 className="mr-title">My Records</h1>
        <button
          type="button"
          className="mr-filter-btn"
          aria-label="Filter records"
          title="Filter records"
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

      <button
        type="button"
        className="mr-active-category"
        onClick={() => setSheetOpen(true)}
        aria-label="Change record category"
      >
        <MedicalRecordSlugIcon slug={category.slug} size={18} className="mr-active-category__icon" />
        <span className="mr-active-category__text">
          <span className="mr-active-category__label">Showing</span>
          <span className="mr-active-category__value">{activeMedicalRecordFilterLabel(category)}</span>
        </span>
        {isHealthLogMedicalRecordSlug(category.slug) ? (
          <span className="mr-active-category__pill">{HEALTH_LOG_GROUP_LABEL}</span>
        ) : null}
        <span className="mr-active-category__chevron" aria-hidden>
          ▾
        </span>
      </button>

      <MedicalRecordsFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        category={category}
        userFilterId={userFilterId}
        members={members}
        membersLoading={membersLoading}
        onApply={applyFilters}
      />

      <SymptomDetailSheet
        open={symptomRow != null}
        row={symptomRow}
        onClose={() => setSymptomRow(null)}
      />

      <main
        ref={mainRef}
        className="mr-main mr-main--scroll"
        onTouchStart={(e) => {
          if (mainRef.current && mainRef.current.scrollTop <= 0) {
            pullStartY.current = e.touches[0]?.clientY ?? 0;
          }
        }}
        onTouchEnd={(e) => {
          const el = mainRef.current;
          if (!el || el.scrollTop > 0) return;
          const endY = e.changedTouches[0]?.clientY ?? 0;
          if (endY - pullStartY.current > 72) handlePullRefresh();
        }}
      >
        {loading ? (
          <div className="mr-loading" role="status" aria-live="polite">
            <span className="mr-loading__spinner" aria-hidden />
            <span>Loading…</span>
          </div>
        ) : null}
        {error ? (
          <p className="mr-status mr-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <div className="mr-empty">
            <span className="mr-empty__icon" aria-hidden>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 8h-2V6a3 3 0 00-6 0v2H9a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V10a2 2 0 00-2-2zM11 6a1 1 0 012 0v2h-2V6zM12 14v2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="mr-empty__message">{emptyMessage(category)}</p>
            <p className="mr-empty__hint">Pull down to refresh</p>
            {emptyBookNowPath ? (
              <Link className="mr-book-now" to={emptyBookNowPath}>
                Book now
              </Link>
            ) : null}
          </div>
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <MedicalRecordsList
            category={category}
            rows={rows}
            onSymptomOpen={(row) => setSymptomRow(row)}
          />
        ) : null}
      </main>

      <button
        type="button"
        className="mr-refresh-fab"
        aria-label="Refresh records"
        onClick={() => void load(category)}
      >
        ↻
      </button>

      <HomeBottomNav />
    </div>
  );
}
