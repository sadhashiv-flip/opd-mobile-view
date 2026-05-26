/** Virtual (online) consultation — selected issue on specialties screen. */
export const VIRTUAL_SELECTED_ISSUE_ID_KEY = "opd-mobile-view.virtualBooking.selectedIssueId";

/** At-hospital consultation — selected specialty on specialties screen. */
export const HOSPITAL_SELECTED_SPECIALTY_ID_KEY =
  "opd-mobile-view.consultation.hospitalSelectedSpecialtyId";

/** Virtual (online) consultation slot picks — used on slots page and overview. */
export const VIRTUAL_BOOKING_SLOT_DATE_KEY = "opd-mobile-view.virtualBooking.slotDate";
export const VIRTUAL_BOOKING_SELECTED_SLOT_KEY = "opd-mobile-view.virtualBooking.selectedSlotKey";

export function readVirtualSelectedIssueId(): string | null {
  try {
    const v = sessionStorage.getItem(VIRTUAL_SELECTED_ISSUE_ID_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function writeVirtualSelectedIssueId(issueId: string | null | undefined): void {
  try {
    const id = issueId?.trim();
    if (!id) {
      sessionStorage.removeItem(VIRTUAL_SELECTED_ISSUE_ID_KEY);
      return;
    }
    sessionStorage.setItem(VIRTUAL_SELECTED_ISSUE_ID_KEY, id);
  } catch {
    // ignore
  }
}

export function readHospitalSelectedSpecialtyId(): string | null {
  try {
    const v = sessionStorage.getItem(HOSPITAL_SELECTED_SPECIALTY_ID_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function writeHospitalSelectedSpecialtyId(specialtyId: string | null | undefined): void {
  try {
    const id = specialtyId?.trim();
    if (!id) {
      sessionStorage.removeItem(HOSPITAL_SELECTED_SPECIALTY_ID_KEY);
      return;
    }
    sessionStorage.setItem(HOSPITAL_SELECTED_SPECIALTY_ID_KEY, id);
  } catch {
    // ignore
  }
}

export type VirtualBookingSlotDraft = Readonly<{
  slotDate: string;
  selectedSlotKey: string;
}>;

export function readVirtualBookingSlotDraft(): VirtualBookingSlotDraft | null {
  try {
    const slotDate = sessionStorage.getItem(VIRTUAL_BOOKING_SLOT_DATE_KEY)?.trim() ?? "";
    const selectedSlotKey =
      sessionStorage.getItem(VIRTUAL_BOOKING_SELECTED_SLOT_KEY)?.trim() ?? "";
    if (!slotDate && !selectedSlotKey) return null;
    return { slotDate, selectedSlotKey };
  } catch {
    return null;
  }
}

export function writeVirtualBookingSlotDraft(
  slotDate: string,
  selectedSlotKey: string,
): void {
  try {
    const date = slotDate.trim();
    const key = selectedSlotKey.trim();
    if (date) {
      sessionStorage.setItem(VIRTUAL_BOOKING_SLOT_DATE_KEY, date);
    } else {
      sessionStorage.removeItem(VIRTUAL_BOOKING_SLOT_DATE_KEY);
    }
    if (key) {
      sessionStorage.setItem(VIRTUAL_BOOKING_SELECTED_SLOT_KEY, key);
    } else {
      sessionStorage.removeItem(VIRTUAL_BOOKING_SELECTED_SLOT_KEY);
    }
  } catch {
    // ignore
  }
}

/** At-hospital consultation slots draft (day index + slot) before overview confirm. */
export type HospitalSlotsDraft = Readonly<{
  selectedDayIdx: number;
  slotKey: string;
}>;

function hospitalSlotsDraftKey(networkId: string, doctorId: string): string {
  return `opd-mobile-view.consultation.hospitalSlotsDraft.${networkId.trim()}.${doctorId.trim()}`;
}

export function readHospitalSlotsDraft(
  networkId: string,
  doctorId: string,
): HospitalSlotsDraft | null {
  if (!networkId.trim() || !doctorId.trim()) return null;
  try {
    const raw = sessionStorage.getItem(hospitalSlotsDraftKey(networkId, doctorId));
    if (!raw?.trim()) return null;
    const p = JSON.parse(raw) as Partial<HospitalSlotsDraft>;
    const selectedDayIdx =
      typeof p.selectedDayIdx === "number" && Number.isFinite(p.selectedDayIdx)
        ? Math.max(0, Math.floor(p.selectedDayIdx))
        : 0;
    const slotKey = typeof p.slotKey === "string" ? p.slotKey.trim() : "";
    if (!slotKey && selectedDayIdx === 0) return null;
    return { selectedDayIdx, slotKey };
  } catch {
    return null;
  }
}

export function writeHospitalSlotsDraft(
  networkId: string,
  doctorId: string,
  draft: HospitalSlotsDraft,
): void {
  if (!networkId.trim() || !doctorId.trim()) return;
  try {
    sessionStorage.setItem(
      hospitalSlotsDraftKey(networkId, doctorId),
      JSON.stringify({
        selectedDayIdx: Math.max(0, Math.floor(draft.selectedDayIdx)),
        slotKey: draft.slotKey.trim(),
      }),
    );
  } catch {
    // ignore
  }
}
