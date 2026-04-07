import { useSyncExternalStore } from "react";
import {
  getApiLoadingPendingCount,
  subscribeApiLoading,
} from "@/api/apiLoadingStore";
import logoSm from "@/assets/images/logos/logo-sm.png";
import "./ApiLoadingOverlay.css";

function subscribe(listener: () => void): () => void {
  return subscribeApiLoading(listener);
}

function getSnapshot(): number {
  return getApiLoadingPendingCount();
}

function getServerSnapshot(): number {
  return 0;
}

/** Full-screen overlay while any `patientFetch` / upload request is in flight. */
export function ApiLoadingOverlay() {
  const pending = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (pending <= 0) return null;

  return (
    <div
      className="api-loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <img
        src={logoSm}
        alt=""
        className="api-loading-overlay__spinner"
        width={44}
        height={44}
        draggable={false}
      />
    </div>
  );
}
