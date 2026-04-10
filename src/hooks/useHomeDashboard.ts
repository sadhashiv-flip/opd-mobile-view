import {
  fetchPatientBanners,
  normalizePatientBannersList,
} from "@/api/patientBanners";
import {
  fetchPatientDashboard,
  toDashboardHomeModel,
  type PatientDashboardHomeModel,
} from "@/api/patientDashboard";
import { useEffect, useState } from "react";

const EMPTY: PatientDashboardHomeModel = {
  apiBanners: [],
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

export type UseHomeDashboardResult = PatientDashboardHomeModel;

/**
 * Loads `GET /patient/dashboard` and `GET /patient/banners` on mount (in parallel).
 * Banner images for the home carousel come only from the banners API.
 */
export function useHomeDashboard(): UseHomeDashboardResult {
  const [model, setModel] = useState<PatientDashboardHomeModel>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchPatientDashboard(), fetchPatientBanners()]).then(
      (results) => {
        if (cancelled) return;
        const dash =
          results[0].status === "fulfilled" ? results[0].value : null;
        const bannersBody =
          results[1].status === "fulfilled" ? results[1].value : null;
        const base = dash ? toDashboardHomeModel(dash) : EMPTY;
        const apiBanners = bannersBody
          ? normalizePatientBannersList(bannersBody.banners)
          : [];
        setModel({ ...base, apiBanners });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return model;
}
