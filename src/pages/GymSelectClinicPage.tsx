import { ROUTES } from "@/constants";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./HealthCheckupsOverviewPage.css";
import "./GymSelectClinicPage.css";

const GYM_PLAN_ID_KEY = "opd-mobile-view.gym-membership.planId";

function readStoredPlanId(): string | null {
  try {
    const p = localStorage.getItem(GYM_PLAN_ID_KEY);
    return p && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

type ClinicRow = Readonly<{
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  category: string;
  address: string;
  closesAt: string;
  phone: string;
  servicesLine: string;
  websiteUrl: string;
  mapsQuery: string;
}>;

const MOCK_CLINICS: readonly ClinicRow[] = [
  {
    id: "1",
    name: "Cult Gym Gachibowli",
    rating: 4.5,
    reviewCount: 841,
    category: "Gym",
    address:
      "3rd Floor, Jyothi Imperial, Main Road, above South India Shopping Mall, near Bio Diversity Park, Gachibowli",
    closesAt: "10pm",
    phone: "099164 75188",
    servicesLine: "On-site services · Online classes",
    websiteUrl: "https://www.cult.fit",
    mapsQuery: "Cult Gym Gachibowli",
  },
  {
    id: "2",
    name: "Cult Gym Hitech City",
    rating: 4.6,
    reviewCount: 1204,
    category: "Gym",
    address: "2nd Floor, Mindspace Mall, Hitech City Main Rd, Hyderabad, Telangana",
    closesAt: "11pm",
    phone: "040 7123 4567",
    servicesLine: "On-site services · Personal training",
    websiteUrl: "https://www.cult.fit",
    mapsQuery: "Cult Gym Hitech City Hyderabad",
  },
  {
    id: "3",
    name: "Cult Gym Jubilee Hills",
    rating: 4.4,
    reviewCount: 672,
    category: "Gym",
    address: "Road No 36, Jubilee Hills, beside coffee shop, Hyderabad",
    closesAt: "10pm",
    phone: "099164 75200",
    servicesLine: "On-site services · Online classes",
    websiteUrl: "https://www.cult.fit",
    mapsQuery: "Cult Gym Jubilee Hills",
  },
];

function GlobeIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 12h18M12 3c2.5 3.2 2.5 14.8 0 18M12 3c-2.5 3.2-2.5 14.8 0 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DirectionsIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20.5V10.5h7.5m0 0l-2.75-2.75M19.5 10.5l-2.75 2.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GymSelectClinicPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const statePlanId =
    typeof (location.state as { planId?: unknown } | null)?.planId === "string"
      ? (location.state as { planId: string }).planId
      : null;
  const planId = statePlanId ?? readStoredPlanId();

  const configureBack = useMemo(
    () => (planId ? ({ planId } as const) : undefined),
    [planId],
  );

  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const gscLocAddrRaw = useSelectedAddressLine("");

  useEffect(() => {
    if (!planId) {
      navigate(ROUTES.gymMembership, { replace: true });
    }
  }, [planId, navigate]);

  const openWebsite = (url: string) => {
    try {
      globalThis.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

  const openDirections = (query: string) => {
    const q = encodeURIComponent(query);
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    try {
      globalThis.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

  if (!planId) {
    return null;
  }

  return (
    <div className="gsc-page">
      <header className="hco-top gsc-header">
        <Link
          to={ROUTES.gymMembershipConfigure}
          state={configureBack}
          className="hco-back"
          aria-label="Back to gym membership"
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
        <h1 className="hco-title">Select Gym Location</h1>
        <span className="gsc-header__spacer" aria-hidden="true" />
      </header>

      <div className="gsc-loc-wrap">
        <button
          type="button"
          className="hco-loc"
          aria-label={gscLocAddrRaw.trim() ? "Choose address" : "Add delivery address"}
          onClick={() => setAddrSheetOpen(true)}
        >
          <span className="hco-loc__pin" aria-hidden="true">
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
            addrRaw={gscLocAddrRaw}
            titleClassName="hco-loc__title"
            sepClassName="hco-loc__sep"
            addrClassName="hco-loc__addr"
            promptClassName="hco-loc__addr hco-loc__addr--prompt"
          />
          <span className="hco-loc__chev" aria-hidden="true">
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
      </div>

      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />

      <ul className="gsc-list">
        {MOCK_CLINICS.map((clinic) => (
          <li key={clinic.id} className="gsc-row">
            <div className="gsc-row__main">
              <h2 className="gsc-row__name">{clinic.name}</h2>
              <div className="gsc-row__rating-line">
                <span className="gsc-rating-num">{clinic.rating}</span>
                <span className="gsc-stars" aria-hidden>
                  ★★★★★
                </span>
                <span className="gsc-rating-meta">
                  ({clinic.reviewCount}) · {clinic.category}
                </span>
              </div>
              <p className="gsc-row__address">{clinic.address}</p>
              <p className="gsc-row__status">
                <span className="gsc-row__status-open">Open</span>
                {" · "}
                Closes {clinic.closesAt} · {clinic.phone}
              </p>
              <p className="gsc-row__services">{clinic.servicesLine}</p>
            </div>
            <div className="gsc-actions">
              <button
                type="button"
                className="gsc-action"
                onClick={() => openWebsite(clinic.websiteUrl)}
              >
                <span className="gsc-action__circle">
                  <GlobeIcon />
                </span>
                <span className="gsc-action__label">Website</span>
              </button>
              <button
                type="button"
                className="gsc-action"
                onClick={() => openDirections(clinic.mapsQuery)}
              >
                <span className="gsc-action__circle">
                  <DirectionsIcon />
                </span>
                <span className="gsc-action__label">Directions</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
