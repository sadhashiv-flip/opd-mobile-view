/** `?url` keeps stable file URLs for backgrounds (see {@link cssBackgroundUrl}). */
import consultationImg from "./Consultation/Consultation.svg?url";
import dentalImg from "./Dental.svg?url";
import diagnosticImg from "./Diagnostic.svg?url";
/** Raster hero art for ongoing slides — replace files in `src/assets/images/` as needed. */
import doctorConsultationImg from "./doctorConsultation.jpg?url";
import mentalhealthImg from "./mentalhealth.jpg?url";
import nutritionImg from "./nutrition.jpg?url";
import vaccineImg from "./vaccine.jpg?url";
import pharmacyImg from "./Pharmacy.svg?url";
import visionImg from "./Vision.svg?url";

/** Local card artwork — files live alongside this module in `src/assets/images/`. */
export const HOME_IMAGE_URLS = {
  diagnostics: diagnosticImg,
  consultation: consultationImg,
  /** Ongoing / consultation-style orders — `doctorConsultation.png`. */
  doctorConsultation: doctorConsultationImg,
  /** Ongoing mental wellness — `mentalhealth.png`. */
  mentalhealth: mentalhealthImg,
  /** Ongoing nutrition — `nutrition.png`. */
  nutrition: nutritionImg,
  dental: dentalImg,
  vision: visionImg,
  pharmacy: pharmacyImg,
  /** Ongoing vaccine — `vaccine.jpg`; matches `type` / `order_type` e.g. `VACCINE`. */
  vaccine: vaccineImg,
} as const;
