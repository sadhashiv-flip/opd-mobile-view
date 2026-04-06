import consultationImg from "./Consultation/Consultation.svg";
import dentalImg from "./Dental.svg";
import diagnosticImg from "./Diagnostic.svg";
import pharmacyImg from "./Pharmacy.svg";
import visionImg from "./Vision.svg";

/** Local card artwork — files live alongside this module in `src/assets/images/`. */
export const HOME_IMAGE_URLS = {
  diagnostics: diagnosticImg,
  consultation: consultationImg,
  dental: dentalImg,
  vision: visionImg,
  pharmacy: pharmacyImg,
} as const;
