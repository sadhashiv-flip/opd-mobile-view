import { fetchPatientProfileRaw } from "@/api/patientProfile";
import {
  fetchPatientBanners,
  normalizePatientBannersPayload,
} from "@/api/patientBanners";
import {
  fetchPatientDashboard,
  toDashboardHomeModel,
  type PatientDashboardHomeModel,
} from "@/api/patientDashboard";
import { useEffect, useState } from "react";

const EMPTY: PatientDashboardHomeModel = {
  apiBanners: [],
  ahcBanners: [],
  notificationCount: 0,
  primaryAddressLine: null,
  ahc: false,
  ongoing: [],
  mood: 0,
  waterConsumed: 0,
  caloriesBurnt: 0,
  gym: null,
  jmToken: null,
};

export type UseHomeDashboardResult = PatientDashboardHomeModel & {
  /** True until the initial parallel dashboard + banners fetch settles (matches Flutter `isLoadingDashboard` gating). */
  loading: boolean;
};

/**
 * Loads `GET /patient/dashboard` and `GET /patient/banners` on mount (in parallel).
 * Promo + AHC banner strips come from `GET /patient/banners` (split in {@link normalizePatientBannersPayload}).
 */
export function useHomeDashboard(): UseHomeDashboardResult {
  const [model, setModel] = useState<PatientDashboardHomeModel>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPatientProfileRaw().catch(() => {});
    Promise.allSettled([fetchPatientDashboard(), fetchPatientBanners()]).then(
      (results) => {
        if (cancelled) return;
        const dash =
          results[0].status === "fulfilled" ? results[0].value : null;
        const bannersBody =
          results[1].status === "fulfilled" ? results[1].value : null;
        const base = dash ? toDashboardHomeModel(dash) : EMPTY;
        const split = bannersBody ? normalizePatientBannersPayload(bannersBody) : null;
        const apiBanners = split?.promoBanners ?? [];
        const ahcBanners = split?.ahcBanners ?? [];
        setModel({ ...base, apiBanners, ahcBanners });
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...model, loading };
}
