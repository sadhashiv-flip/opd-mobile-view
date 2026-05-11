import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import type { VirtualSpecialtySlotsState } from "@/api/consultationVirtual";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { ROUTES } from "@/constants";
import { isConsultationLanguageValue } from "@/constants/consultationLanguages";
import {
  clearVirtualConsultPurposeOnly,
  clearVirtualFollowUpAppointmentId,
  VIRTUAL_CONSULT_LANGUAGE_KEY,
} from "@/constants/virtualConsultationSessionStorage";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { rememberHospitalSpecialtyName } from "@/constants/hospitalConsultationStorage";
import { fetchHospitalSpecialities, type HospitalSpeciality } from "@/api/hospitalSpecialties";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { DEFAULT_LIST_PAGE_SIZE } from "@/api/listPagination";
import {
  DEFAULT_ISSUES_PARENT,
  fetchPatientIssues,
  type PatientIssue,
} from "@/api/issues";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { useToast } from "@/hooks/useToast";
import consultationAtHospitalSvg from "@/assets/icons/common/ConsultationAtHospital.svg";
import networkDoctorsHospitalSvg from "@/assets/images/Consultation/NetworkDoctorsHospital.svg";
import "./ConsultationSpecialtiesPage.css";

const VIRTUAL_SLOTS_STORAGE = "opd-mobile-view.virtualSlots.";

export function ConsultationSpecialtiesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "virtual";
  const isHospital = type === "at_hospital";
  const [virtualIssues, setVirtualIssues] = useState<readonly PatientIssue[]>([]);
  const [issuesLoad, setIssuesLoad] = useState<"loading" | "error" | "ok">(
    isHospital ? "ok" : "loading",
  );
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const [hospitalSpecs, setHospitalSpecs] = useState<readonly HospitalSpeciality[]>([]);
  const [hospitalLoad, setHospitalLoad] = useState<"loading" | "error" | "ok">(
    isHospital ? "loading" : "ok",
  );
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [loadingMoreHospital, setLoadingMoreHospital] = useState(false);
  const nextHospitalPageRef = useRef(1);
  const hasMoreHospitalRef = useRef(true);
  const loadingMoreHospitalRef = useRef(false);
  const hospitalScrollRef = useRef<HTMLUListElement | null>(null);

  const [loadingMoreVirtual, setLoadingMoreVirtual] = useState(false);
  const nextVirtualPageRef = useRef(1);
  const hasMoreVirtualRef = useRef(true);
  const loadingMoreVirtualRef = useRef(false);

  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const cspLocAddrRaw = useSelectedAddressLine("");
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState("");
  const [virtualSearchQuery, setVirtualSearchQuery] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const filteredHospitalSpecs = useMemo(() => {
    const q = hospitalSearchQuery.trim().toLowerCase();
    if (!q) return hospitalSpecs;
    return hospitalSpecs.filter((s) => s.name.toLowerCase().includes(q));
  }, [hospitalSpecs, hospitalSearchQuery]);

  const filteredVirtualIssues = useMemo(() => {
    const q = virtualSearchQuery.trim().toLowerCase();
    if (!q) return virtualIssues;
    return virtualIssues.filter((i) => i.title.toLowerCase().includes(q));
  }, [virtualIssues, virtualSearchQuery]);

  useEffect(() => {
    if (selectedIssueId && !filteredVirtualIssues.some(i => String(i.id) === selectedIssueId)) {
      setSelectedIssueId(null);
    }
  }, [filteredVirtualIssues, selectedIssueId]);

  useEffect(() => {
    if (!isHospital) return;
    void ensureDefaultSelectedAddressIfNeeded();
  }, [isHospital]);

  useEffect(() => {
    if (isHospital) return;
    clearVirtualConsultPurposeOnly();
  }, [isHospital, location.key]);

  useEffect(() => {
    if (!isHospital) return;
    let cancelled = false;
    setHospitalLoad("loading");
    setHospitalError(null);
    setHospitalSpecs([]);
    nextHospitalPageRef.current = 1;
    hasMoreHospitalRef.current = true;
    loadingMoreHospitalRef.current = false;
    void fetchHospitalSpecialities({ page: 1, limit: DEFAULT_LIST_PAGE_SIZE })
      .then((list) => {
        if (cancelled) return;
        setHospitalSpecs(list);
        if (list.length === 0) {
          hasMoreHospitalRef.current = false;
        } else {
          nextHospitalPageRef.current = 2;
        }
        setHospitalLoad("ok");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setHospitalSpecs([]);
          setHospitalLoad("error");
          const msg = e instanceof Error ? e.message : "Could not load specialties";
          setHospitalError(msg);
          toast.error(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isHospital, toast, location.key]);

  const loadMoreHospital = useCallback(async () => {
    if (!hasMoreHospitalRef.current || hospitalLoad !== "ok") return;
    if (loadingMoreHospitalRef.current) return;
    loadingMoreHospitalRef.current = true;
    setLoadingMoreHospital(true);
    try {
      const page = nextHospitalPageRef.current;
      const list = await fetchHospitalSpecialities({ page, limit: DEFAULT_LIST_PAGE_SIZE });
      if (list.length === 0) {
        hasMoreHospitalRef.current = false;
        return;
      }
      setHospitalSpecs((prev) => {
        const prevIds = new Set(prev.map((s) => s.id));
        const fresh = list.filter((s) => !prevIds.has(s.id));
        if (fresh.length === 0) {
          hasMoreHospitalRef.current = false;
          return prev;
        }
        if (list.length < DEFAULT_LIST_PAGE_SIZE) {
          hasMoreHospitalRef.current = false;
        }
        nextHospitalPageRef.current = page + 1;
        return [...prev, ...fresh];
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load more specialties");
    } finally {
      loadingMoreHospitalRef.current = false;
      setLoadingMoreHospital(false);
    }
  }, [hospitalLoad, toast]);

  const onHospitalScroll = useCallback(
    (e: UIEvent<HTMLUListElement>) => {
      const el = e.currentTarget;
      const thresholdPx = 80;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx) void loadMoreHospital();
    },
    [loadMoreHospital],
  );

  useEffect(() => {
    if (!isHospital || hospitalLoad !== "ok" || hospitalSpecs.length === 0) return;
    if (!hasMoreHospitalRef.current || loadingMoreHospitalRef.current) return;
    const el = hospitalScrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 2) void loadMoreHospital();
  }, [isHospital, hospitalLoad, hospitalSpecs.length, loadMoreHospital]);

  useEffect(() => {
    if (isHospital) return;
    let cancelled = false;
    setIssuesLoad("loading");
    setIssuesError(null);
    setVirtualIssues([]);
    nextVirtualPageRef.current = 1;
    hasMoreVirtualRef.current = true;
    loadingMoreVirtualRef.current = false;
    void fetchPatientIssues({ parent: DEFAULT_ISSUES_PARENT, page: 1, limit: DEFAULT_LIST_PAGE_SIZE })
      .then((list) => {
        if (cancelled) return;
        setVirtualIssues(list);
        if (list.length === 0) {
          hasMoreVirtualRef.current = false;
        } else {
          nextVirtualPageRef.current = 2;
        }
        setIssuesLoad("ok");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setIssuesLoad("error");
          setIssuesError(e instanceof Error ? e.message : "Could not load specialties");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isHospital, location.key]);

  const loadMoreVirtual = useCallback(async () => {
    if (!hasMoreVirtualRef.current || issuesLoad !== "ok") return;
    if (loadingMoreVirtualRef.current) return;
    loadingMoreVirtualRef.current = true;
    setLoadingMoreVirtual(true);
    try {
      const page = nextVirtualPageRef.current;
      const list = await fetchPatientIssues({
        parent: DEFAULT_ISSUES_PARENT,
        page,
        limit: DEFAULT_LIST_PAGE_SIZE,
      });
      if (list.length === 0) {
        hasMoreVirtualRef.current = false;
        return;
      }
      setVirtualIssues((prev) => {
        const prevIds = new Set(prev.map((i) => i.id));
        const fresh = list.filter((i) => !prevIds.has(i.id));
        if (fresh.length === 0) {
          hasMoreVirtualRef.current = false;
          return prev;
        }
        if (list.length < DEFAULT_LIST_PAGE_SIZE) {
          hasMoreVirtualRef.current = false;
        }
        nextVirtualPageRef.current = page + 1;
        return [...prev, ...fresh];
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load more specialties");
    } finally {
      loadingMoreVirtualRef.current = false;
      setLoadingMoreVirtual(false);
    }
  }, [issuesLoad, toast]);

  useEffect(() => {
    if (isHospital) return;
    if (issuesLoad !== "ok" || virtualIssues.length === 0) return;
    if (!hasMoreVirtualRef.current || loadingMoreVirtualRef.current) return;
    const doc = document.documentElement;
    if (doc.scrollHeight <= window.innerHeight + 2) void loadMoreVirtual();
  }, [isHospital, issuesLoad, virtualIssues.length, loadMoreVirtual]);

  useEffect(() => {
    if (isHospital) return;
    if (issuesLoad !== "ok") return;
    const thresholdPx = 120;
    const onScroll = () => {
      if (!hasMoreVirtualRef.current || loadingMoreVirtualRef.current) return;
      const doc = document.documentElement;
      if (
        doc.scrollHeight - window.scrollY - window.innerHeight <
        thresholdPx
      ) {
        void loadMoreVirtual();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHospital, issuesLoad, loadMoreVirtual]);

  const topArea =
    isHospital ? null : (
      <div className="csp-search csp-search--virtual-issues">
        <span className="csp-search__ic" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path
              d="M20 20l-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          type="search"
          className="csp-search__input"
          placeholder="Search Issues"
          aria-label="Search issues"
          value={virtualSearchQuery}
          onChange={(e) => setVirtualSearchQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    );

  let hospitalSpecialtiesBody: ReactNode;
  if (hospitalLoad === "loading") {
    hospitalSpecialtiesBody = <div className="csp-issues-msg">Loading specialties…</div>;
  } else if (hospitalLoad === "error") {
    hospitalSpecialtiesBody = (
      <div className="csp-issues-msg csp-issues-msg--err" role="alert">
        {hospitalError ?? "Could not load specialties"}
      </div>
    );
  } else if (hospitalSpecs.length === 0) {
    hospitalSpecialtiesBody = (
      <div className="csp-issues-msg">No specialties available right now.</div>
    );
  } else if (filteredHospitalSpecs.length === 0) {
    hospitalSpecialtiesBody = (
      <div className="csp-issues-msg">No specialties match your search.</div>
    );
  } else {
    hospitalSpecialtiesBody = (
      <>
        <ul
          ref={hospitalScrollRef}
          className="csp-list"
          aria-label="Common specialties"
          onScroll={onHospitalScroll}
        >
          {filteredHospitalSpecs.map((s) => {
            const idStr = String(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className="csp-item csp-item--hospital"
                  onClick={() => {
                    rememberHospitalSpecialtyName(idStr, s.name);
                    navigate(generatePath(ROUTES.consultationHospitalResults, { specialtyId: idStr }));
                  }}
                >
                  <div className="csp-item__ic csp-item__ic--hospital" aria-hidden="true">
                    <img
                      src={consultationAtHospitalSvg}
                      alt=""
                      className="csp-item__ic-hospital-img"
                      width={22}
                      height={22}
                      draggable={false}
                    />
                  </div>
                  <div className="csp-item__text">
                    <div className="csp-item__label">{s.name}</div>
                    {typeof s.consultation_time === "number" ? (
                      <div className="csp-item__meta">{s.consultation_time} min</div>
                    ) : null}
                  </div>
                  {/* {typeof s.consultation_price === "number" ? (
                    <span className="csp-item__price-pill">
                      ₹{s.consultation_price.toLocaleString("en-IN")}
                    </span>
                  ) : null} */}
                  <span className="csp-item__chev" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 18l6-6-6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {loadingMoreHospital ? (
          <div className="csp-list-more" aria-busy="true">
            Loading more…
          </div>
        ) : null}
      </>
    );
  }

  let virtualSpecialtiesBody: ReactNode;
  if (issuesLoad === "loading") {
    virtualSpecialtiesBody = <div className="csp-issues-msg">Loading specialties…</div>;
  } else if (issuesLoad === "error") {
    virtualSpecialtiesBody = (
      <div className="csp-issues-msg csp-issues-msg--err" role="alert">
        {issuesError ?? "Could not load specialties"}
      </div>
    );
  } else if (virtualIssues.length === 0) {
    virtualSpecialtiesBody = (
      <div className="csp-issues-msg">No specialties available right now.</div>
    );
  } else if (filteredVirtualIssues.length === 0) {
    virtualSpecialtiesBody = (
      <div className="csp-issues-msg">No issues found</div>
    );
  } else {
    virtualSpecialtiesBody = (
      <>
        <ul className="csp-virtual-grid" aria-label="Issues">
          {filteredVirtualIssues.map((issue) => {
            const imgUrl = resolveProfileImageUrl(issue.image);
            return (
              <li key={issue.id} className="csp-virtual-grid__cell">
                <button
                  type="button"
                  className={`csp-virtual-tile${selectedIssueId === String(issue.id) ? ' csp-virtual-tile--selected' : ''}`}
                  onClick={() => setSelectedIssueId(String(issue.id))}
              >
                <div className="csp-virtual-tile__media" aria-hidden="true">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt=""
                      className="csp-virtual-tile__thumb"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="csp-virtual-tile__fallback">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M14 8a2 2 0 10-4 0v2H8a1 1 0 00-1 1v1a1 1 0 001 1h2v2a2 2 0 104 0v-2h2a1 1 0 001-1v-1a1 1 0 00-1-1h-2V8z"
                          fill="currentColor"
                        />
                        <path
                          d="M7 18h10a2 2 0 002-2v-1H5v1a2 2 0 002 2z"
                          fill="currentColor"
                          opacity="0.85"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="csp-virtual-tile__title">{issue.title}</div>
              </button>
              </li>
            );
          })}
        </ul>
        {loadingMoreVirtual ? (
          <div className="csp-list-more" aria-busy="true">
            Loading more…
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="csp-page">
      <header className="csp-top">
        <Link
          to={generatePath(ROUTES.consultation, { type })}
          className="csp-back"
          aria-label="Back"
        >
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
        <h1 className="csp-title">
          {isHospital ? "At Hospital Consultation" : "Doctor Consultation - Virtual"}
        </h1>
      </header>

      {isHospital ? (
        <>
          <button
            type="button"
            className="csp-loc"
            aria-label={cspLocAddrRaw.trim() ? "Choose address" : "Add delivery address"}
            onClick={() => setAddrSheetOpen(true)}
          >
            <span className="csp-loc__pin" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
                  fill="#FF541E"
                />
                <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
              </svg>
            </span>
            <AddressStripLabels
              layout="pipe"
              addrRaw={cspLocAddrRaw}
              titleClassName="csp-loc__title"
              sepClassName="csp-loc__sep"
              addrClassName="csp-loc__addr"
              promptClassName="csp-loc__addr csp-loc__addr--prompt"
            />
            <span className="csp-loc__chev" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
        </>
      ) : null}

      {isHospital ? (
        <div className="csp-banner-container">
          <img
            className="csp-banner__art"
            src={networkDoctorsHospitalSvg}
            alt=""
            width={64}
            height={44}
            draggable={false}
            aria-hidden
          />
          <div className="csp-banner">
            <span className="csp-banner__text">Consult Top Doctors In-Clinic</span>
          </div>
        </div>
      ) : (
        <div className="csp-banner-container csp-banner-container--virtual">
          <img
            className="csp-banner__art csp-banner__art--virtual-overlap"
            src={networkDoctorsHospitalSvg}
            alt=""
            width={60}
            height={60}
            draggable={false}
            aria-hidden
          />
          <div className="csp-banner csp-banner--virtual-strip">
            <span className="csp-banner__text csp-banner__text--virtual">
              Consult Top Doctors <span className="csp-banner__online">Online</span>
            </span>
          </div>
        </div>
      )}

      <main className={`csp-main${isHospital ? "" : " csp-main--virtual"}`}>
        {topArea}

        {isHospital ? (
          <div className="csp-search">
            <span className="csp-search__ic" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M20 20l-3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              type="search"
              className="csp-search__input"
              placeholder="Search specialties"
              aria-label="Search specialties"
              value={hospitalSearchQuery}
              onChange={(e) => setHospitalSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        ) : null}

        <div className={`csp-section${isHospital ? "" : " csp-section--virtual-issues"}`}>
          {isHospital ? (
            <div className="csp-section__title">Common specialties</div>
          ) : null}
          {isHospital ? hospitalSpecialtiesBody : virtualSpecialtiesBody}
        </div>
      </main>

      {!isHospital && (
        <footer className="csp-vrtl-ft">
          <button
            type="button"
            className="csp-vrtl-ft__btn"
            disabled={!selectedIssueId}
            onClick={() => {
              if (!selectedIssueId) return;
              const issue = filteredVirtualIssues.find(i => String(i.id) === selectedIssueId);
              if (!issue) return;
              clearVirtualFollowUpAppointmentId();
              let langRaw = "";
              try {
                langRaw = sessionStorage.getItem(VIRTUAL_CONSULT_LANGUAGE_KEY)?.trim() ?? "";
              } catch {
                langRaw = "";
              }
              const resolvedLang =
                langRaw && isConsultationLanguageValue(langRaw) ? langRaw : "English";
              const slotState: VirtualSpecialtySlotsState = {
                parent: issue.parent,
                issueTitle: issue.title,
                spid: issue.parent,
                language: resolvedLang,
              };
              try {
                sessionStorage.setItem(
                  `${VIRTUAL_SLOTS_STORAGE}${issue.id}`,
                  JSON.stringify(slotState),
                );
              } catch {
                // ignore
              }
              navigate(
                generatePath(ROUTES.consultationVirtualSlots, {
                  issueId: String(issue.id),
                }),
                { state: slotState },
              );
            }}
          >
            Continue
          </button>
        </footer>
      )}
    </div>
  );
}
