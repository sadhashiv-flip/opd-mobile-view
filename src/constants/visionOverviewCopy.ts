/** patient_app `string_define` + `vision_overview_screen` important notes. */

export const VISION_OVERVIEW_TITLE = "Vision Overview";

export const VISION_SERVICE_EYE_CHECKUP = "Vision Comprehensive Checkup";
export const VISION_SERVICE_GLASSES_LENS = "Glasses/Lens";

export const VISION_VENDOR_TITLE_EYE = "Clinic / Hospital";
export const VISION_VENDOR_TITLE_GLASSES = "Store";

export const VISION_OVERVIEW_IMPORTANT_NOTES_BASE = [
  "Your appointment cannot be cancelled once confirmed.",
  "Please arrive 10–15 minutes before the selected time slot.",
  "Carry a valid government-issued photo ID for verification at the center.",
  "The selected time is indicative. Actual examination time may vary based on the center's queue.",
] as const;

export const VISION_OVERVIEW_NOTE_CARRY_PRESCRIPTION =
  "Carry your current prescription (if any) when visiting the store.";

export const VISION_CONFIRM_DIALOG = {
  title: "Confirm Booking",
  message: "Are you sure you want to book this appointment?",
  confirmLabel: "Book Now",
  cancelLabel: "Go Back",
} as const;

export const VISION_SLOT_SHEET_TITLE = "Select Your Vision Slots";
