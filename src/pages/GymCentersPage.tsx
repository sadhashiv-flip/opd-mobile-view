import { fetchGymNetworkCenters, directionsUriFromCoordinates } from "@/api/patientGymNetwork";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { GymNetworkCenter } from "@/api/patientGymNetwork";
import "./GymCentersPage.css";

type GymCentersLocationState = Readonly<{
  cityKey?: string;
  cityDisplayLabel?: string;
}>;

function DirectionsIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function GymCentersPage() {
  const location = useLocation();
  const toast = useToast();
  const state = (location.state as GymCentersLocationState | null) ?? null;
  const cityKey = (state?.cityKey ?? "").trim();
  const cityDisplayLabel = (state?.cityDisplayLabel ?? "").trim() || cityKey;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<readonly GymNetworkCenter[]>([]);

  const title = useMemo(
    () => (cityDisplayLabel ? `Gym centers · ${cityDisplayLabel}` : "Gym centers"),
    [cityDisplayLabel],
  );

  useEffect(() => {
    if (!cityKey) {
      setLoading(false);
      setError("Select a location first.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchGymNetworkCenters(cityKey)
      .then((list) => {
        if (!cancelled) setCenters(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setCenters([]);
          setError(e instanceof Error ? e.message : "Could not load gym centers");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cityKey]);

  const openDirections = (coordinates: string) => {
    const url = directionsUriFromCoordinates(coordinates);
    if (!url) {
      toast.error("Could not open maps");
      return;
    }
    try {
      globalThis.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open maps");
    }
  };

  return (
    <div className="gcent-page">
      <header className="gcent-header">
        <Link to={ROUTES.gymMembershipContact} className="app-back-btn gcent-back" aria-label="Back">
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
        <h1 className="gcent-title">{title}</h1>
      </header>

      <main className="gcent-main">
        {loading ? (
          <p className="gcent-status" role="status">
            Loading centers…
          </p>
        ) : null}
        {!loading && error ? (
          <p className="gcent-status gcent-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && centers.length === 0 ? (
          <p className="gcent-status">No gym centers found for this city.</p>
        ) : null}
        {!loading && !error && centers.length > 0 ? (
          <ul className="gcent-list">
            {centers.map((c, index) => {
              const dirUrl = directionsUriFromCoordinates(c.coordinates);
              return (
                <li key={`${c.id}-${index}`} className="gcent-card">
                  <div className="gcent-card__body">
                    <h2 className="gcent-card__name">{c.name}</h2>
                    {c.displayAddress ? (
                      <p className="gcent-card__address">
                        <span className="gcent-card__pin" aria-hidden>
                          📍
                        </span>
                        {c.displayAddress}
                      </p>
                    ) : null}
                  </div>
                  {dirUrl ? (
                    <button
                      type="button"
                      className="gcent-card__dir"
                      aria-label={`Open ${c.name} in Maps`}
                      onClick={() => openDirections(c.coordinates)}
                    >
                      <DirectionsIcon />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
