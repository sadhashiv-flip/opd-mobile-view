/** Wellness flow hero art — mirrors patient-app `assets/png/mental_wellness_card.png`. */
import mentalWellnessCardImg from "./wellness/mental_wellness_card.png?url";

export const WELLNESS_IMAGE_URLS = {
  /** `MentalWellnessScreen._buildHeroImage` — full-width card banner. */
  mentalWellnessCard: mentalWellnessCardImg,
} as const;
