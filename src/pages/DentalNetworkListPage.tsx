import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import {
  DEFAULT_LOCATION_ADDRESS_LINE,
  subscribeSelectedAddress,
} from "@/constants/selectedAddressStorage";
import { ROUTES } from "@/constants";
import {
  fetchDentalNetworkClinicList,
  resolveSelectedAddressLocation,
  type DentalNetworkClinicRow,
} from "@/api/networkList";
import { useToast } from "@/hooks/useToast";
import { useSelectedAddressLine, useSelectedAddressTag } from "@/hooks/useSelectedAddressLine";
import clinicDistanceIcon from "@/assets/icons/common/ClinicDistance.svg";
import "@/pages/HealthCheckupsPage.css";
import "./DentalNetworkListPage.css";
import { DENTAL_SELECTED_CLINIC_KEY } from "@/constants/dentalBookingStorage";

export function DentalNetworkListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const addrLine = useSelectedAddressLine(DEFAULT_LOCATION_ADDRESS_LINE);
  const addrTag = useSelectedAddressTag("HOME");
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const [addrEpoch, setAddrEpoch] = useState(0);
  const [clinics, setClinics] = useState<DentalNetworkClinicRow[]>([]);
  const [load, setLoad] = useState<"loading" | "error" | "ok">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeSelectedAddress(() => setAddrEpoch((n) => n + 1));
    return unsub;
  }, []);

  const loadClinics = useCallback(async () => {
    setLoad("loading");
    setErrorMsg(null);
    try {
      const loc = await resolveSelectedAddressLocation();
      const list = await fetchDentalNetworkClinicList(loc);
      setClinics(list);
      setSelectedIndex(null);
      setLoad("ok");
    } catch (e) {
      setClinics([]);
      setLoad("error");
      const msg = e instanceof Error ? e.message : "Could not load clinics";
      setErrorMsg(msg);
      toast.error(msg);
    }
  }, [toast]);

  useEffect(() => {
    void loadClinics();
  }, [loadClinics, addrEpoch]);

  const onContinue = () => {
    const row = selectedIndex == null ? null : (clinics[selectedIndex] ?? null);
    if (!row) {
      toast.error("Select a clinic to continue.");
      return;
    }
    try {
      sessionStorage.setItem(DENTAL_SELECTED_CLINIC_KEY, JSON.stringify(row));
    } catch {
      // ignore
    }
    void navigate(ROUTES.dentalSlots);
  };

  return (
    <div className="dnl-page">
      <header className="dnl-top">
        <Link to={ROUTES.dentalSelectPeople} className="dnl-back" aria-label="Back">
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
        <h1 className="dnl-title">Dental Service</h1>
        <span className="dnl-spacer" aria-hidden />
      </header>

      <button
        type="button"
        className="dnl-loc"
        aria-label="Choose address"
        onClick={() => setAddrSheetOpen(true)}
      >
        <span className="dnl-loc__pin" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
              fill="#FF541E"
            />
            <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
          </svg>
        </span>
        <span className="dnl-loc__title">{addrTag}</span>
        <span className="dnl-loc__sep" aria-hidden="true">
          |
        </span>
        <span className="dnl-loc__addr">{addrLine}</span>
        <span className="dnl-loc__chev" aria-hidden="true">
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

      <main className="dnl-main">
        {load === "loading" ? (
          <p className="dnl-status" aria-busy="true">
            Loading clinics…
          </p>
        ) : null}

        {load === "error" && errorMsg ? (
          <p className="dnl-status" role="alert">
            {errorMsg}
          </p>
        ) : null}

        {load === "ok" && clinics.length === 0 ? (
          <p className="dnl-status">No clinics found for this location.</p>
        ) : null}

        {load === "ok"
          ? clinics.map((c, idx) => {
              const selected = selectedIndex === idx;
              const mapsUrl = c.location.trim();
              return (
                <button
                  key={`${c.clinicid}-${c.providerid}-${idx}`}
                  type="button"
                  className={`dnl-card${selected ? " dnl-card--selected" : ""}`}
                  onClick={() => setSelectedIndex(idx)}
                >
                  <div className="dnl-card__head">
                    <h2 className="dnl-card__name">{c.name}</h2>
                    <span className="dnl-card__chk" aria-hidden="true">
                      {selected ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M20 6L9 17l-5-5"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                  </div>
                  <p className="dnl-card__addr">{c.practiceaddress}</p>
                  <div className="dnl-card__foot">
                    <div className="dnl-card__nav">
                      {mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dnl-card__dir"
                          aria-label="Open directions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <img
                            src={clinicDistanceIcon}
                            alt=""
                            width={20}
                            height={20}
                            className="dnl-card__dir-ic"
                            draggable={false}
                            aria-hidden
                          />
                        </a>
                      ) : (
                        <span className="dnl-card__dir" aria-hidden>
                          <img
                            src={clinicDistanceIcon}
                            alt=""
                            width={20}
                            height={20}
                            className="dnl-card__dir-ic"
                            draggable={false}
                            aria-hidden
                          />
                        </span>
                      )}
                      <span className="dnl-card__dist">{c.distance} km</span>
                    </div>
                  </div>
                </button>
              );
            })
          : null}
      </main>

      <footer className="hc-footer">
        <button
          type="button"
          className="bottom-continue"
          disabled={selectedIndex == null || load !== "ok"}
          onClick={onContinue}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
