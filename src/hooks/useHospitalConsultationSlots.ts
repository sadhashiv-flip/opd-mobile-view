import { fetchNetworkSlots, type NetworkSlotsPayload } from "@/api/networkSlots";
import { readConsultSelectedPersonId } from "@/constants/consultationSelectedMemberStorage";
import { readHospitalVendorBookingContext } from "@/constants/consultationBookingStorage";
import {
  buildLegacyCalendarDays,
  buildVendorCalendarDays,
  defaultVendorDayIndex,
  isVendorOfflineSlots,
} from "@/utils/vendorConsultationSlots";
import { useCallback, useEffect, useMemo, useState } from "react";

export type HospitalSlotsLoadState = "loading" | "error" | "ok";

export function useHospitalConsultationSlots(
  networkId: string,
  doctorId: string,
  options?: Readonly<{
    enabled?: boolean;
    vendorCode?: string;
    /** Explicit user id override (order-detail reschedule uses invoice `user_id`). */
    userId?: string | null;
    /** Include `user_id` query when loading slots (patient_app uses this for reschedule too). */
    includeUserId?: boolean;
  }>,
) {
  const enabled = options?.enabled !== false;
  const includeUserId = options?.includeUserId !== false;
  const vendorCtx = useMemo(() => readHospitalVendorBookingContext(), [networkId, doctorId]);
  const explicitVendorCode = options?.vendorCode?.trim() ?? "";
  const vendorCode = explicitVendorCode || vendorCtx?.vendorMeta.source?.trim() || "";
  const isVendor =
    explicitVendorCode.length > 0 || isVendorOfflineSlots(vendorCtx?.vendorMeta ?? null);

  const [load, setLoad] = useState<HospitalSlotsLoadState>("loading");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<NetworkSlotsPayload | null>(null);

  const reload = useCallback(() => {
    if (!enabled) return;
    if (!networkId.trim() || !doctorId.trim()) {
      setLoad("error");
      setLoadErr("Missing network or doctor.");
      return;
    }
    if (isVendor && !vendorCode) {
      setLoad("error");
      setLoadErr("Vendor information is missing for this doctor.");
      return;
    }
    const explicitUserId = options?.userId?.trim() ?? "";
    const userId = includeUserId
      ? explicitUserId || readConsultSelectedPersonId()
      : null;
    if (includeUserId && !userId) {
      setLoad("error");
      setLoadErr("Please select a patient from the consultation flow.");
      return;
    }
    let cancelled = false;
    setLoad("loading");
    setLoadErr(null);
    void fetchNetworkSlots(networkId, doctorId, {
      ...(isVendor ? { vendorCode } : {}),
      ...(userId ? { userId } : {}),
    })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setLoad("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoad("error");
        setLoadErr(e instanceof Error ? e.message : "Could not load slots");
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, doctorId, isVendor, vendorCode, enabled, includeUserId, options?.userId]);

  useEffect(() => {
    if (!enabled) return;
    const cleanup = reload();
    return cleanup;
  }, [reload, enabled]);

  const calendarDays = useMemo(() => {
    if (!payload) return isVendor ? [] : buildLegacyCalendarDays();
    if (isVendor && payload.datedSlots.length > 0) {
      return buildVendorCalendarDays(payload.datedSlots);
    }
    return buildLegacyCalendarDays();
  }, [payload, isVendor]);

  const defaultDayIdx = useMemo(() => {
    if (!isVendor || !payload?.datedSlots.length) return 0;
    return defaultVendorDayIndex(calendarDays, payload.datedSlots);
  }, [isVendor, payload, calendarDays]);

  const doctorName = payload?.doctor?.name ?? "Doctor";

  return {
    vendorCtx,
    isVendor,
    vendorCode,
    load,
    loadErr,
    payload,
    calendarDays,
    defaultDayIdx,
    doctorName,
    reload,
  };
}
