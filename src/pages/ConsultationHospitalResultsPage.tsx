import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import { ROUTES } from "@/constants";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { readHospitalSpecialtyName } from "@/constants/hospitalConsultationStorage";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import {
  fetchNetworkDoctorListPage,
  NETWORK_LIST_PAGE_SIZE,
  resolveSelectedAddressLocation,
  type NetworkListDoctorRow,
} from "@/api/networkList";
import { useToast } from "@/hooks/useToast";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { SortSheet, type SortOptionId } from "@/components/sort/SortSheet";
import "@/components/sort/SortSheet.css";
import networkDoctorsHospitalSvg from "@/assets/images/Consultation/NetworkDoctorsHospital.svg";
import "./ConsultationHospitalResultsPage.css";

function doctorNameInitial(name: string): string {
  const t = name.trim();
  if (!t) return "—";
  // If name starts with 'Dr ' or 'Dr. ', use character after that
  const drMatch = /^Dr[.\s]+/i;
  if (drMatch.test(t)) {
    const afterDr = t.replace(drMatch, "").trim();
    return afterDr ? afterDr.charAt(0).toUpperCase() : "—";
  }
  return t.charAt(0).toUpperCase();
}

export function ConsultationHospitalResultsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";
  const chrLocAddrRaw = useSelectedAddressLine("");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortId, setSortId] = useState<SortOptionId>("relevance");
  const [doctors, setDoctors] = useState<readonly NetworkListDoctorRow[]>([]);
  const [doctorsLoad, setDoctorsLoad] = useState<"loading" | "error" | "ok">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  /** Bumps when the user picks another address so doctor list refetches for the new `lat,lng`. */
  const [addrEpoch, setAddrEpoch] = useState(0);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const nextPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const dscrollRef = useRef<HTMLDivElement>(null);

  const specialtyIdNum = useMemo(() => {
    const n = Number(specialtyId);
    return Number.isFinite(n) ? n : null;
  }, [specialtyId]);

  useEffect(() => {
    const unsub = subscribeSelectedAddress(() => setAddrEpoch((n) => n + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (specialtyIdNum == null) {
      setDoctors([]);
      setDoctorsLoad("ok");
      setDoctorsError(null);
      nextPageRef.current = 1;
      hasMoreRef.current = true;
      loadingMoreRef.current = false;
      return;
    }
    let cancelled = false;
    setDoctorsLoad("loading");
    setDoctorsError(null);
    setDoctors([]);
    nextPageRef.current = 1;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;
    void (async () => {
      await ensureDefaultSelectedAddressIfNeeded();
      if (cancelled) return;
      const location = await resolveSelectedAddressLocation();
      if (cancelled) return;
      try {
        const list = await fetchNetworkDoctorListPage({
          location,
          service: "consultation",
          speciality_id: specialtyIdNum,
          page: 1,
          limit: NETWORK_LIST_PAGE_SIZE,
        });
        if (cancelled) return;
        setDoctors(list);
        if (list.length === 0) {
          hasMoreRef.current = false;
        } else {
          nextPageRef.current = 2;
        }
        setDoctorsLoad("ok");
      } catch (e: unknown) {
        if (!cancelled) {
          setDoctors([]);
          setDoctorsLoad("error");
          const msg = e instanceof Error ? e.message : "Could not load doctors";
          setDoctorsError(msg);
          toast.error(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [specialtyIdNum, toast, addrEpoch]);

  const loadMore = useCallback(async () => {
    if (specialtyIdNum == null || !hasMoreRef.current || doctorsLoad !== "ok") return;
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const location = await resolveSelectedAddressLocation();
      const list = await fetchNetworkDoctorListPage(
        {
          location,
          service: "consultation",
          speciality_id: specialtyIdNum,
          page: nextPageRef.current,
          limit: NETWORK_LIST_PAGE_SIZE,
        },
        { skipGlobalLoading: true },
      );
      if (list.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      setDoctors((prev) => [...prev, ...list]);
      nextPageRef.current += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load more doctors";
      toast.error(msg);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [specialtyIdNum, doctorsLoad, toast]);

  const onDscroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const thresholdPx = 100;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx;
      if (nearBottom) void loadMore();
    },
    [loadMore],
  );

  /** If the first page(s) do not overflow the scroll area, fetch more until they do or the API returns []. */
  useEffect(() => {
    if (specialtyIdNum == null || doctorsLoad !== "ok" || doctors.length === 0) return;
    if (!hasMoreRef.current || loadingMoreRef.current) return;
    const el = dscrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 2) void loadMore();
  }, [doctors.length, doctorsLoad, specialtyIdNum, loadMore]);

  const specialtyLabel = useMemo(() => {
    const fromSession = readHospitalSpecialtyName(specialtyId);
    if (fromSession) return fromSession;
    const map: Record<string, string> = {
      gp: "General Physician",
      diet: "Dietician",
      derm: "Dermatologist",
      pulm: "Pulmonologist",
      card: "Cardiologist",
      dent: "Dentist",
    };
    return map[specialtyId] ?? "Speciality";
  }, [specialtyId]);

  let doctorsScrollBody: ReactNode;
  if (specialtyIdNum == null) {
    doctorsScrollBody = (
      <div className="chr-dlist-msg">Select a specialty from the list to see doctors.</div>
    );
  } else if (doctorsLoad === "loading") {
    doctorsScrollBody = (
      <div className="chr-dlist-msg" aria-busy="true">
        Loading doctors…
      </div>
    );
  } else if (doctorsLoad === "error") {
    doctorsScrollBody = (
      <div className="chr-dlist-msg chr-dlist-msg--err" role="alert">
        {doctorsError ?? "Could not load doctors"}
      </div>
    );
  } else if (doctors.length === 0) {
    doctorsScrollBody = <div className="chr-dlist-msg">No doctors found for this specialty.</div>;
  } else {
    doctorsScrollBody = (
      <>
        {doctors.map((d) => (
          <div key={d.id} className="chr-dcard">
            <div className="chr-dcard__sec chr-dcard__sec--head">
              <div className="chr-doc">
                <div className="chr-doc__avatar-wrap">
                  {d.imageUrl ? (
                    <img className="chr-doc__avatar-img" src={d.imageUrl} alt="" width={44} height={44} />
                  ) : (
                    <div className="chr-doc__avatar--placeholder" aria-hidden="true">
                      <span className="chr-doc__avatar-letter">{doctorNameInitial(d.name)}</span>
                      <span className="chr-doc__avatar-badge" aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"
                            stroke="#ffffff"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                  )}
                </div>
                <div className="chr-doc__meta">
                  <div className="chr-doc__name-row">
                    <span className="chr-doc__name">{d.name}</span>
                    <span className="chr-doc__chev" aria-hidden="true">
                      ›
                    </span>
                  </div>
                  <div className="chr-doc__deg">{d.degree || "—"}</div>
                  <div className="chr-doc__spec">{specialtyLabel}</div>
                </div>
              </div>
            </div>

            {d.networkName || d.networkAddress ? (
              <div className="chr-dcard__sec chr-dcard__sec--hospital">
                <div className="chr-dtags__hospital-row">
                  <div className="chr-dtags__hospital-ic" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="4" fill="#12b10f" />
                      <path
                        d="M12 8v8M8 12h8"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="chr-dtags__hospital-copy">
                    {d.networkName ? (
                      <div className="chr-dtags__hospital-name">{d.networkName}</div>
                    ) : null}
                    {d.networkAddress ? (
                      <div className="chr-dtags__hospital-addr-line">{d.networkAddress}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="chr-dcard__sec chr-dcard__sec--cta">
              {d.expLabel ? (
                <div className="chr-dtags__exp">
                  <span className="chr-dtags__exp-ic" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"
                        stroke="#9a9a9a"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="chr-dtags__exp-txt">{d.expLabel}</span>
                </div>
              ) : null}
              <button
                type="button"
                className="chr-book"
                onClick={() => {
                  if (!d.networkId?.trim()) {
                    toast.error("Network information is missing for this doctor.");
                    return;
                  }
                  navigate(
                    generatePath(ROUTES.consultationHospitalSlots, {
                      specialtyId,
                      networkId: d.networkId.trim(),
                      doctorId: d.id,
                    }),
                  );
                }}
              >
                Book Appointment
              </button>
            </div>
          </div>
        ))}
        {loadingMore ? (
          <div className="chr-dlist-more" aria-busy="true">
            Loading more…
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="chr-page">
      <header className="chr-top">
        <Link
          to={generatePath(ROUTES.consultationSpecialties, { type: "at_hospital" })}
          className="chr-back"
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
        <h1 className="chr-title">At Hospital Consultation</h1>
      </header>

      <button
        type="button"
        className="chr-loc"
        aria-label={chrLocAddrRaw.trim() ? "Choose address" : "Add delivery address"}
        onClick={() => setAddrSheetOpen(true)}
      >
        <span className="chr-loc__pin" aria-hidden="true">
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
          addrRaw={chrLocAddrRaw}
          titleClassName="chr-loc__title"
          sepClassName="chr-loc__sep"
          addrClassName="chr-loc__addr"
          promptClassName="chr-loc__addr chr-loc__addr--prompt"
        />
        <span className="chr-loc__chev" aria-hidden="true">
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

      <div className="chr-banner-container">
                <img
          className="chr-banner__art"
          src={networkDoctorsHospitalSvg}
          alt=""
          width={64}
          height={44}
          draggable={false}
          aria-hidden
        />
      <div className="chr-banner">
        <span className="chr-banner__text">Consult Top Doctors In-Clinic</span>
      </div>
      </div>

      <main className="chr-main">
        <div className="chr-search">
          <span className="chr-search__ic" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            className="chr-search__input"
            placeholder="Search Doctors"
            aria-label="Search doctors"
          />
        </div>
        <div className="chr-dlist" aria-label="Doctors list">
          <div className="chr-dscroll" ref={dscrollRef} onScroll={onDscroll}>
            {doctorsScrollBody}
          </div>
        </div>
      </main>

      <SortSheet
        open={isSortOpen}
        value={sortId}
        onChange={setSortId}
        onClose={() => setIsSortOpen(false)}
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16M7 12h10M10 18h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="8" cy="6" r="2" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
            <circle cx="14" cy="12" r="2" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="18" r="2" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          </svg>
        }
      />
    </div>
  );
}

