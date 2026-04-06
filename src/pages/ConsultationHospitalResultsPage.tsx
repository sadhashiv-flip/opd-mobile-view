import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { ROUTES } from "@/constants";
import { readHospitalSpecialtyName } from "@/constants/hospitalConsultationStorage";
import { fetchNetworkDoctorList, readNetworkListLocation, type NetworkListDoctorRow } from "@/api/networkList";
import { useToast } from "@/hooks/useToast";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortId, setSortId] = useState<SortOptionId>("relevance");
  const [doctors, setDoctors] = useState<readonly NetworkListDoctorRow[]>([]);
  const [doctorsLoad, setDoctorsLoad] = useState<"loading" | "error" | "ok">("loading");
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  const specialtyIdNum = useMemo(() => {
    const n = Number(specialtyId);
    return Number.isFinite(n) ? n : null;
  }, [specialtyId]);

  useEffect(() => {
    if (specialtyIdNum == null) {
      setDoctors([]);
      setDoctorsLoad("ok");
      setDoctorsError(null);
      return;
    }
    let cancelled = false;
    setDoctorsLoad("loading");
    setDoctorsError(null);
    void fetchNetworkDoctorList({
      location: readNetworkListLocation(),
      service: "consultation",
      speciality_id: specialtyIdNum,
    })
      .then((list) => {
        if (!cancelled) {
          setDoctors(list);
          setDoctorsLoad("ok");
          setPage(1);
        }
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

  const pageSize = 2;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(doctors.length / pageSize));
  const visibleDoctors = useMemo(() => {
    const start = (page - 1) * pageSize;
    return doctors.slice(start, start + pageSize);
  }, [doctors, page, pageSize]);

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
    doctorsScrollBody = visibleDoctors.map((d) => (
      <div key={d.id} className="chr-dcard">
        <div className="chr-dcard__top">
          <div className="chr-doc">
            <div className="chr-doc__avatar" aria-hidden="true" />
            <div className="chr-doc__meta">
              <div className="chr-doc__name">{d.name}</div>
              <div className="chr-doc__deg">{d.degree || "—"}</div>
            </div>
          </div>
          <div className="chr-chip">Cashless Available</div>
        </div>

        <div className="chr-tags">
          {d.exp ? <span className="chr-tag">{d.exp}</span> : null}
          {d.hospital ? <span className="chr-tag chr-tag--pill">{d.hospital}</span> : null}
        </div>

        <div className="chr-fee">
          <div className="chr-fee__k">Your Consultation Fee</div>
          <div className="chr-fee__v">₹ {d.fee}</div>
        </div>

        <button
          type="button"
          className="chr-book"
          onClick={() =>
            navigate(
              generatePath(ROUTES.consultationHospitalSlots, {
                specialtyId,
                doctorId: d.id,
              }),
            )
          }
        >
          Book Appointment
        </button>
      </div>
    ));
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
        <span className="chr-loc__addr">Isprout, 7th floor, Plot No: 25, Divyasree trinity,</span>
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
            <div className="chr-dlist__pager">
              <button
                type="button"
                className="chr-pagebtn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || doctorsLoad !== "ok" || doctors.length === 0}
              >
                Prev
              </button>
              <span className="chr-pagecount">
                {page}/{pageCount}
              </span>
              <button
                type="button"
                className="chr-pagebtn"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount || doctorsLoad !== "ok" || doctors.length === 0}
              >
                Next
              </button>
            </div>
          </div>

          <div className="chr-dscroll">{doctorsScrollBody}</div>
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

