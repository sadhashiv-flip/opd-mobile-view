import dialogConfirmIllustration from "./dialog_confirm_illustration.png";
import dialogErrorIllustration from "./dialog_error_illustration.png";
import dialogSuccessIllustration from "./dialog_success_illustration.png";
import dialogWarningIllustration from "./dialog_warning_illustration.png";
import flipHealthPrescriptionIllustration from "./flip_health_prescription_illustration.png";
import medicineDelivery from "./medicine_delivery.png";
import otcProductsIllustration from "./otc_products_illustration.png";
import prescriptionDetailIllustration from "./prescription_detail_illustration.png";
import uploadPrescriptionIllustration from "./upload_prescription_illustration.png";

/** Artwork for the pharmacy module (`src/assets/images/pharmacy/`). */
export const PHARMACY_IMAGES = {
  medicineDelivery,
  uploadPrescription: uploadPrescriptionIllustration,
  flipHealthPrescription: flipHealthPrescriptionIllustration,
  otcProducts: otcProductsIllustration,
  dialogConfirm: dialogConfirmIllustration,
  dialogSuccess: dialogSuccessIllustration,
  prescriptionDetail: prescriptionDetailIllustration,
  dialogError: dialogErrorIllustration,
  dialogWarning: dialogWarningIllustration,
} as const;
