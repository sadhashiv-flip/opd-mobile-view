/** patient_app `string_define` + `dental_overview_screen` important notes. */
export const DENTAL_OVERVIEW_IMPORTANT_NOTES = [
  "Your appointment cannot be cancelled once confirmed.",
  "Please arrive 10–15 minutes before the selected time slot.",
  "The selected time is indicative. Actual examination time may vary based on the center's queue.",
  "Carry a valid government-issued photo ID for verification at the center.",
  "Carry any previous dental reports, X-rays or prescriptions (if any).",
] as const;

export const DENTAL_CONFIRM_DIALOG = {
  title: "Confirm Booking",
  message: "Are you sure you want to book this appointment?",
  confirmLabel: "Book Now",
  cancelLabel: "Go Back",
} as const;
