import { GoogleMap, Marker } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

export type AddressMapPickerProps = Readonly<{
  /** When false, show setup instructions instead of a map */
  useGoogleMaps: boolean;
  mapsLoaded: boolean;
  mapsLoadError?: Error;
  /** Google could not authorise the map (see in-app checklist). */
  mapsAuthFailed?: boolean;
  lat: number;
  lng: number;
  zoom?: number;
  onPinSettled: (lat: number, lng: number) => void;
  /** Nominatim-style viewbox: minLon,maxLat,maxLon,minLat */
  onViewBoxChange?: (viewbox: string) => void;
  /** Like AGM `(mapReady)` — map instance is ready */
  onMapReady?: (map: google.maps.Map) => void;
}>;

export function AddressMapPicker({
  useGoogleMaps,
  mapsLoaded,
  mapsLoadError,
  mapsAuthFailed = false,
  lat,
  lng,
  zoom = 16,
  onPinSettled,
  onViewBoxChange,
  onMapReady,
}: AddressMapPickerProps) {
  const mapCenter = useMemo(() => ({ lat, lng }), [lat, lng]);
  const [pageOrigin, setPageOrigin] = useState("");
  useEffect(() => {
    setPageOrigin(globalThis.location.origin);
  }, []);

  const emitViewBox = useCallback(
    (map: google.maps.Map) => {
      const b = map.getBounds();
      if (!b) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      onViewBoxChange?.(
        `${sw.lng()},${ne.lat()},${ne.lng()},${sw.lat()}`,
      );
    },
    [onViewBoxChange],
  );

  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      onMapReady?.(map);
      emitViewBox(map);
      map.addListener("idle", () => emitViewBox(map));
    },
    [emitViewBox, onMapReady],
  );

  if (!useGoogleMaps) {
    return (
      <div
        className="paf-map-inner paf-map-inner--fallback"
        role="note"
        aria-label="Map disabled"
      >
        Add <code>VITE_GOOGLE_MAPS_API_KEY</code> in your <code>.env</code> file to enable the
        interactive map (same idea as Angular <code>agm-map</code> — drag the pin, tap the map).
      </div>
    );
  }

  if (mapsLoadError) {
    return (
      <div className="paf-map-inner paf-map-inner--error" role="alert">
        Could not load Google Maps: {mapsLoadError.message}
      </div>
    );
  }

  if (!mapsLoaded) {
    return (
      <div className="paf-map-inner paf-map-inner--loading" aria-busy="true">
        Loading map…
      </div>
    );
  }

  if (mapsAuthFailed) {
    const refLine =
      pageOrigin.length > 0 ? `${pageOrigin}/*` : "http://YOUR_HOST:PORT/*";
    return (
      <div className="paf-map-inner paf-map-inner--error" role="alert">
        <div className="paf-map-err-detail">
          <strong>Google Maps blocked this page</strong>
          <p className="paf-map-err-detail__lead">
            The script loaded, but Google refused to show the map (referrer, API, billing, or key
            type). Fix it in Google Cloud, then hard-refresh.
          </p>
          <ol className="paf-map-err-detail__list">
            <li>
              <strong>HTTP referrers</strong> — In Credentials → your API key → Website
              restrictions, add exactly:
              <div className="paf-map-err-detail__code">{refLine}</div>
              <code>localhost</code>, <code>127.0.0.1</code>, and <code>192.168.x.x</code> are
              different; use the same host you see in the browser address bar.
            </li>
            <li>
              <strong>APIs</strong> — Enable <strong>Maps JavaScript API</strong> for this
              project.
            </li>
            <li>
              <strong>Billing</strong> — Billing must be enabled on the Google Cloud project.
            </li>
            <li>
              <strong>Env</strong> — Use <code>VITE_GOOGLE_MAPS_API_KEY</code> (with{" "}
              <code>VITE_</code> prefix). Restart <code>npm run dev</code> after changing{" "}
              <code>.env</code>.
            </li>
          </ol>
          <a
            className="paf-map-err-detail__link"
            href="https://developers.google.com/maps/documentation/javascript/error-messages#referer-not-allowed-map-error"
            target="_blank"
            rel="noopener noreferrer"
          >
            RefererNotAllowedMapError (Google docs)
          </a>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName="paf-map-inner"
      center={mapCenter}
      zoom={zoom}
      options={mapOptions}
      onLoad={handleMapLoad}
      onClick={(e) => {
        const p = e.latLng;
        if (p) onPinSettled(p.lat(), p.lng());
      }}
    >
      <Marker
        position={mapCenter}
        draggable
        onDragEnd={(e) => {
          const p = e.latLng;
          if (p) onPinSettled(p.lat(), p.lng());
        }}
      />
    </GoogleMap>
  );
}
