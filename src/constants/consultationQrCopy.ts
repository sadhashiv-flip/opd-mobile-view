export const CONSULT_QR_COPY = {
  scannerTitle: "Scan QR code",
  alignHint: "Align the QR code within the frame to scan",
  cameraPermissionRequired: "Camera permission is required to scan QR code",
  fulfillmentTypeMissing: "Fulfillment type is not available for this appointment",
  practoTitle: "Scan Practo QR code",
  upiTitle: "Scan UPI QR to pay",
  genericTitle: "Scan QR code",
  practoMessage:
    "At the clinic, ask the doctor to show the Practo appointment QR code. Scan that code here to complete check-in.",
  upiMessage:
    "Scan the UPI payment QR code shown at the clinic to pay for your consultation.",
  genericMessage: (type: string) =>
    `Scan the ${type} QR code as instructed at the clinic to complete this step.`,
  practoTip1: "Use the QR displayed in your Practo appointment",
  practoTip2: "Hold your phone steady and align the code within the frame",
  upiTip1: "Scan the merchant UPI QR at the reception or billing desk",
  upiTip2: "Complete payment on your UPI app before confirming here",
  genericTip1: "Follow instructions shown at the clinic",
  genericTip2: "Align the QR code within the scanner frame",
  badgePracto: "PRACTO CHECK-IN",
  badgeUpi: "UPI PAYMENT",
  continue: "Continue to scan",
  cancel: "Not now",
  fulfillSuccess: "QR code verified successfully",
  fulfillFailed: "Could not verify QR code",
  appointmentIdMissing: "Appointment id is missing",
} as const;
