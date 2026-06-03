/** Copy aligned with patient-app `string_define.dart` mental wellness strings. */

export const WELLNESS_PAGE_TITLE = {
  mental: "Mental Wellness",
  nutrition: "Talk to a Nutritionist",
} as const;

export const WELLNESS_DESCRIPTION = {
  mental:
    "Enter your details below, and once confirmed, our team will call you within 20 minutes to schedule a session with a specialist.",
  nutrition: "Enter your details here and we will connect you to a nutritionist.",
} as const;

export const WELLNESS_REVIEW_HINT =
  "Please confirm the details below. You can go back to change anything before raising the request.";

export const WELLNESS_DISCLAIMER_EMERGENCY =
  "Disclaimer: We do not handle emergencies. For urgent medical assistance, please contact your doctor or the nearest hospital.";

export const WELLNESS_DISCLAIMER_HOURS =
  "Service hours: 9:30 AM – 6:30 PM. Requests received after this time will be processed the next day.";

export const WELLNESS_SUCCESS_TITLE = "Thank you for your request";

export const WELLNESS_SUCCESS_BODY = {
  mental: "Our team will call you within 20 minutes to schedule your session.",
  nutrition: "Our team will call you within 20 minutes to connect you with a nutritionist.",
} as const;
