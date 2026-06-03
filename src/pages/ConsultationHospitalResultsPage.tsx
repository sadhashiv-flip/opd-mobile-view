import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import {
  deliveryAddressChooserAriaLabel,
  subscribeSelectedAddress,
} from "@/constants/selectedAddressStorage";
import { ROUTES } from "@/constants";
import { useHasSelectedDeliveryAddress } from "@/hooks/useSelectedAddressLine";
import { clearHospitalConsultationResultsStep } from "@/lib/bookingFlowStackCleanup";
import { persistHospitalConsultationSummaryFields } from "@/lib/hospitalConsultationSummary";
import { sortNetworkDoctors } from "@/lib/sortNetworkDoctors";
import { readHospitalSpecialtyName } from "@/constants/hospitalConsultationStorage";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import {
  fetchNetworkDoctorListPage,
  NETWORK_LIST_PAGE_SIZE,
  resolveSelectedAddressLocation,
  type NetworkListDoctorRow,
} from "@/api/networkList";
import { readConsultSelectedPersonId } from "@/constants/consultationSelectedMemberStorage";
import { writeHospitalVendorBookingContext } from "@/constants/consultationBookingStorage";
import {
  writeNetworkDoctorDetailEntry,
  type NetworkDoctorDetailEntry,
} from "@/constants/networkDoctorDetailStorage";
import { NetworkDoctorListCard } from "@/components/consultation/NetworkDoctorListCard";
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

/** Client-side filter — parity with patient_app `searchNearbyDoctors`. */
function filterDoctorsBySearch(
  rows: readonly NetworkListDoctorRow[],
  query: string,
): readonly NetworkListDoctorRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((d) => {
    const name = d.name.trim().toLowerCase();
    const network = d.networkName.trim().toLowerCase();
    return name.includes(q) || (network.length > 0 && network.includes(q));
  });
}

export function ConsultationHospitalResultsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";
  const hasDeliveryAddress = useHasSelectedDeliveryAddress();
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortId, setSortId] = useState<SortOptionId>("relevance");
  const [doctors, setDoctors] = useState<readonly NetworkListDoctorRow[]>([]);
  const [doctorsLoad, setDoctorsLoad] = useState<"loading" | "error" | "ok">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  /** Bumps when the user picks another address so doctor list refetches for the new `lat,lng`. */
  const [addrEpoch, setAddrEpoch] = useState(0);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
    setSearchQuery("");
    nextPageRef.current = 1;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;
    void (async () => {
      await ensureDefaultSelectedAddressIfNeeded();
      if (cancelled) return;
      const location = await resolveSelectedAddressLocation();
      if (cancelled) return;
      const userId = readConsultSelectedPersonId();
      if (!userId) {
        if (!cancelled) {
          setDoctors([]);
          setDoctorsLoad("error");
          setDoctorsError("Please select a patient from the consultation flow.");
        }
        return;
      }
      try {
        const list = await fetchNetworkDoctorListPage({
          location,
          service: "consultation",
          speciality_id: specialtyIdNum,
          page: 1,
          limit: NETWORK_LIST_PAGE_SIZE,
          user_id: userId,
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
      const userId = readConsultSelectedPersonId();
      if (!userId) return;
      const list = await fetchNetworkDoctorListPage(
        {
          location,
          service: "consultation",
          speciality_id: specialtyIdNum,
          page: nextPageRef.current,
          limit: NETWORK_LIST_PAGE_SIZE,
          user_id: userId,
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

  const filteredDoctors = useMemo(() => {
    const searched = filterDoctorsBySearch(doctors, searchQuery);
    return sortNetworkDoctors(searched, sortId);
  }, [doctors, searchQuery, sortId]);

  const searchActive = searchQuery.trim().length > 0;

  const onBookDoctor = useCallback(
    (d: NetworkListDoctorRow) => {
      if (!d.networkId?.trim()) {
        toast.error("Network information is missing for this doctor.");
        return;
      }
      persistHospitalConsultationSummaryFields({
        doctorName: d.name,
        doctorQualification: d.degree,
        networkName: d.networkName,
      });
      if (d.vendorMeta) {
        writeHospitalVendorBookingContext({
          vendorMeta: {
            source: d.vendorMeta.source,
            price: d.vendorMeta.price,
            timings: d.vendorMeta.timings,
            isCashless: d.vendorMeta.isCashless,
          },
          practiceId: d.networkId.trim(),
          network: {
            name: d.networkName,
            displayAddress: d.networkAddress,
            coordinates: d.networkCoordinates,
          },
          doctor: {
            id: d.id,
            name: d.name,
            gender: d.gender,
            qualification: d.degree,
          },
        });
      } else {
        writeHospitalVendorBookingContext(null);
      }
      navigate(
        generatePath(ROUTES.consultationHospitalSlots, {
          specialtyId,
          networkId: d.networkId.trim(),
          doctorId: d.id,
        }),
      );
    },
    [navigate, specialtyId, toast],
  );

  const onViewDoctorDetail = useCallback(
    (d: NetworkListDoctorRow) => {
      const vendorCode = d.vendorMeta?.source?.trim() ?? "";
      if (!d.id.trim() || !vendorCode) {
        toast.error("Unable to open doctor details");
        return;
      }
      const entry: NetworkDoctorDetailEntry = {
        doctor: d,
        specialtyId,
        specialtyLabel,
      };
      writeNetworkDoctorDetailEntry(entry);
      navigate(
        generatePath(ROUTES.consultationHospitalDoctorDetail, {
          specialtyId,
          doctorId: d.id,
        }),
        { state: entry },
      );
    },
    [navigate, specialtyId, specialtyLabel, toast],
  );

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
  } else if (filteredDoctors.length === 0 && searchActive) {
    doctorsScrollBody = (
      <div className="chr-dlist-msg">No doctors match your search</div>
    );
  } else {
    doctorsScrollBody = (
      <>
        {filteredDoctors.map((d) => (
          <NetworkDoctorListCard
            key={d.id}
            doctor={d}
            specialtyLabel={specialtyLabel}
            onBook={() => onBookDoctor(d)}
            onViewDetail={
              d.vendorMeta?.source?.trim()
                ? () => onViewDoctorDetail(d)
                : undefined
            }
          />
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
        <FlowScreenBack
          fallbackTo={generatePath(ROUTES.consultationSpecialties, { type: "at_hospital" })}
          className="app-back-btn chr-back"
          onBeforeBack={clearHospitalConsultationResultsStep}
        />
        <h1 className="chr-title">At Hospital Consultation</h1>
      </header>

      <button
        type="button"
        className="chr-loc"
        aria-label={deliveryAddressChooserAriaLabel(hasDeliveryAddress)}
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
        <div className="chr-search-row">
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="chr-filter"
            aria-label="Sort doctors"
            onClick={() => setIsSortOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="chr-dlist" aria-label="Doctors list">
          <div className="chr-dscroll hide-scrollbar" ref={dscrollRef} onScroll={onDscroll}>
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

