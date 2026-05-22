/** patient_app `string_define` + `vaccine_overview_screen` / `CommonDialog.confirm`. */
export const VACCINATION_OVERVIEW_IMPORTANT_NOTES = [
  "Your appointment cannot be cancelled once confirmed.",
  "Please arrive 10–15 minutes before the selected time slot.",
  "The selected time is indicative. Actual examination time may vary based on the center's queue.",
  "Carry a valid government-issued photo ID for verification at the center.",
  "Follow your physician's advice about food / medication before the dose.",
  "For children age 5 or below, a prescription upload is mandatory.",
] as const;

export const VACCINATION_CONFIRM_DIALOG = {
  title: "Confirm Booking",
  message: "Are you sure you want to book this appointment?",
  confirmLabel: "Book Now",
  cancelLabel: "Go Back",
} as const;
