import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { DEFAULT_LOCATION_ADDRESS_LINE } from "@/constants/selectedAddressStorage";
import { ROUTES } from "@/constants";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { readHospitalSpecialtyName } from "@/constants/hospitalConsultationStorage";
import {
  fetchNetworkDoctorListPage,
  NETWORK_LIST_PAGE_SIZE,
  readNetworkListLocation,
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
import sortSvg from "@/assets/icons/common/Sort.svg";
import networkDoctorsHospitalSvg from "@/assets/images/Consultation/NetworkDoctorsHospital.svg";
import "./ConsultationHospitalResultsPage.css";

type Hospital = Readonly<{ id: string; name: string; location: string }>;

const HOSPITALS: readonly Hospital[] = [
  { id: "medicover", name: "Medicover Hospitals", location: "Hitech City · 12km" },
  { id: "kims", name: "KIMS Hospitals", location: "Gachibowli · 16km" },
  { id: "yashoda", name: "Yashoda Hospitals", location: "Somajiguda · 9km" },
  { id: "care", name: "CARE Hospitals", location: "Banjara Hills · 11km" },
] as const;

export function ConsultationHospitalResultsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";
  const chrLocAddrLine = useSelectedAddressLine(DEFAULT_LOCATION_ADDRESS_LINE);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortId, setSortId] = useState<SortOptionId>("relevance");
  const [doctors, setDoctors] = useState<readonly NetworkListDoctorRow[]>([]);
  const [doctorsLoad, setDoctorsLoad] = useState<"loading" | "error" | "ok">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
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
    void fetchNetworkDoctorListPage({
      location: readNetworkListLocation(),
      service: "consultation",
      speciality_id: specialtyIdNum,
      page: 1,
      limit: NETWORK_LIST_PAGE_SIZE,
    })
      .then((list) => {
        if (cancelled) return;
        setDoctors(list);
        if (list.length === 0) {
          hasMoreRef.current = false;
        } else {
          nextPageRef.current = 2;
        }
        setDoctorsLoad("ok");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDoctors([]);
          setDoctorsLoad("error");
          const msg = e instanceof Error ? e.message : "Could not load doctors";
          setDoctorsError(msg);
          toast.error(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [specialtyIdNum, toast]);

  const loadMore = useCallback(async () => {
    if (specialtyIdNum == null || !hasMoreRef.current || doctorsLoad !== "ok") return;
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const list = await fetchNetworkDoctorListPage(
        {
          location: readNetworkListLocation(),
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
                {d.imageUrl ? (
                  <img className="chr-doc__avatar-img" src={d.imageUrl} alt="" width={44} height={44} />
                ) : (
                  <div className="chr-doc__avatar" aria-hidden="true" />
                )}
                <div className="chr-doc__meta">
                  <div className="chr-doc__name">{d.name}</div>
                  <div className="chr-doc__deg">{d.degree || "—"}</div>
                </div>
              </div>
              <div className="chr-dcard__head-right">
                <span className="chr-chip">Cashless Available</span>
                <span className="chr-dcard__chev" aria-hidden="true">
                  ›
                </span>
              </div>
            </div>

            <div className="chr-dcard__sec chr-dcard__sec--tags">
              {d.expLabel ? (
                <span className="chr-tag chr-tag--exp">
                  <span className="chr-tag__ic chr-tag__ic--exp" aria-hidden="true" />
                  {d.expLabel}
                </span>
              ) : null}
              {d.networkName ? (
                <span className="chr-tag chr-tag--net">
                  <span className="chr-tag__ic chr-tag__ic--net" aria-hidden="true" />
                  {d.networkName}
                </span>
              ) : null}
            </div>

            <div className="chr-dcard__sec chr-dcard__sec--fee">
              <div className="chr-fee__k">Your Consultation Fee</div>
              <div className="chr-fee__v">₹ {d.consultationFee}</div>
            </div>

            <div className="chr-dcard__sec chr-dcard__sec--cta">
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
        aria-label="Choose address"
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
        <span className="chr-loc__title">Home</span>
        <span className="chr-loc__sep" aria-hidden="true">
          |
        </span>
        <span className="chr-loc__addr">{chrLocAddrLine}</span>
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
            placeholder="Search for doctors, symptoms, health concerns"
            aria-label="Search"
          />
          <button
            type="button"
            className="chr-filter"
            aria-label="Sort and filters"
            onClick={() => setIsSortOpen(true)}
          >
            <img src={sortSvg} alt="" width={22} height={22} draggable={false} />
          </button>
        </div>

        <div className="chr-row">
          <div className="chr-row__k">Featured Hospitals</div>
          <button type="button" className="chr-row__link">
            See all <span aria-hidden="true">›</span>
          </button>
        </div>

        <div className="chr-hscroll" aria-label="Featured hospitals">
          {HOSPITALS.map((h) => (
            <div key={h.id} className="chr-hcard">
              <div className="chr-hcard__logo" aria-hidden="true">
                {h.name.split(" ")[0][0]}
              </div>
              <div className="chr-hcard__name">{h.name}</div>
              <div className="chr-hcard__meta">{h.location}</div>
            </div>
          ))}
        </div>

        <div className="chr-dlist" aria-label="Doctors list">
          <div className="chr-dlist__head">
            <div className="chr-dlist__title">{specialtyLabel}</div>
          </div>

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

