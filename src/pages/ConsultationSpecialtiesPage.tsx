import { Link, generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { DEFAULT_LOCATION_ADDRESS_LINE } from "@/constants/selectedAddressStorage";
import { ROUTES } from "@/constants";
import { clearVirtualFollowUpAppointmentId } from "@/constants/virtualConsultationSessionStorage";
import { useSelectedAddressLine, useSelectedAddressTag } from "@/hooks/useSelectedAddressLine";
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
  const virtualScrollRef = useRef<HTMLUListElement | null>(null);

  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const cspLocAddrLine = useSelectedAddressLine(DEFAULT_LOCATION_ADDRESS_LINE);
  const cspLocAddrTag = useSelectedAddressTag("HOME");
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState("");

  const filteredHospitalSpecs = useMemo(() => {
    const q = hospitalSearchQuery.trim().toLowerCase();
    if (!q) return hospitalSpecs;
    return hospitalSpecs.filter((s) => s.name.toLowerCase().includes(q));
  }, [hospitalSpecs, hospitalSearchQuery]);

  useEffect(() => {
    if (!isHospital) return;
    void ensureDefaultSelectedAddressIfNeeded();
  }, [isHospital]);

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

  const onVirtualScroll = useCallback(
    (e: UIEvent<HTMLUListElement>) => {
      const el = e.currentTarget;
      const thresholdPx = 80;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx) void loadMoreVirtual();
    },
    [loadMoreVirtual],
  );

  useEffect(() => {
    if (isHospital || issuesLoad !== "ok" || virtualIssues.length === 0) return;
    if (!hasMoreVirtualRef.current || loadingMoreVirtualRef.current) return;
    const el = virtualScrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 2) void loadMoreVirtual();
  }, [isHospital, issuesLoad, virtualIssues.length, loadMoreVirtual]);

  const topArea =
    isHospital ? null : (
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
          placeholder="Search for doctors, symptoms, health concerns"
          aria-label="Search"
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
                  {typeof s.consultation_price === "number" ? (
                    <span className="csp-item__price-pill">
                      ₹{s.consultation_price.toLocaleString("en-IN")}
                    </span>
                  ) : null}
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
  } else {
    virtualSpecialtiesBody = (
      <>
        <ul
          ref={virtualScrollRef}
          className="csp-list"
          aria-label="Specialties"
          onScroll={onVirtualScroll}
        >
          {virtualIssues.map((issue) => {
            const imgUrl = resolveProfileImageUrl(issue.image);
            const slotState = {
              parent: issue.parent,
              issueTitle: issue.title,
              /** `availableSlots?spid=` expects the issue’s `parent` (e.g. 1), not `id` (e.g. 132). */
              spid: issue.parent,
            };
            return (
              <li key={issue.id}>
                <button
                  type="button"
                  className="csp-item"
                  onClick={() => {
                    clearVirtualFollowUpAppointmentId();
                    sessionStorage.setItem(
                      `${VIRTUAL_SLOTS_STORAGE}${issue.id}`,
                      JSON.stringify(slotState),
                    );
                    navigate(
                      generatePath(ROUTES.consultationVirtualSlots, {
                        issueId: String(issue.id),
                      }),
                      { state: slotState },
                    );
                  }}
                >
                  <div className="csp-item__ic" aria-hidden="true">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt=""
                        className="csp-item__thumb"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="csp-item__ic-fallback">—</span>
                    )}
                  </div>
                  <div className="csp-item__label">{issue.title}</div>
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
            aria-label="Choose address"
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
            <span className="csp-loc__title">{cspLocAddrTag}</span>
            <span className="csp-loc__sep" aria-hidden="true">
              |
            </span>
            <span className="csp-loc__addr">{cspLocAddrLine}</span>
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
        <div className="csp-banner csp-banner--green">
          <span className="csp-banner__text">Consult Top Doctors Online</span>
          <span className="csp-banner__art" aria-hidden="true" />
        </div>
      )}

      <main className="csp-main">
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

        <div className="csp-section">
          <div className="csp-section__title">Common specialties</div>
          {isHospital ? hospitalSpecialtiesBody : virtualSpecialtiesBody}
        </div>
      </main>
    </div>
  );
}
