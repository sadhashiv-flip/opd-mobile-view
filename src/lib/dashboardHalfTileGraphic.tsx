import Lottie from "lottie-react";
import { cssBackgroundUrl } from "@/lib/cssBackgroundUrl";
import type { DashboardHalfTileKind } from "@/lib/dashboardServiceGrid";
import consultationCardPng from "@/assets/images/dashboard-patient-app/consultationCardDashbaord.png?url";
import dentalCardPng from "@/assets/images/dashboard-patient-app/DentalCardDashboard.png?url";
import pharmacyCardPng from "@/assets/images/dashboard-patient-app/pharmacyCardDashboard.png?url";
import visionCardPng from "@/assets/images/dashboard-patient-app/VisionCardDashboard.png?url";
import vaccinationServicesSvg from "@/assets/icons/patient-app/hub/services/vaccinationServices.svg?url";
import dashboardClaimLottie from "@/assets/lotties/dashboard_claims.json";
import dashboardGymLottie from "@/assets/lotties/dashboard_gym_membership.json";
import dashboardMentalLottie from "@/assets/lotties/dashboard_mental_wellness.json";
import chemistryLabLottie from "@/assets/lotties/chemistry_lab.json";
import scientistNutritionLottie from "@/assets/lotties/scientist.json";

const LOTTIE_OPTS = { loop: true } as const;

/**
 * Corner / strip artwork for home dashboard half-tiles — raster & SVG from patient-app PNGs;
 * Lottie JSON copied from patient-app {@code assets/lotties} (same paths as Flutter {@code AppString.kLottieDashboard*}).
 */
export function DashboardHalfTileGraphic({
  kind,
}: Readonly<{ kind: DashboardHalfTileKind }>) {
  switch (kind) {
    case "mental":
      return (
        <div className="home-card__media home-card__media--lottie" aria-hidden>
          <Lottie
            {...LOTTIE_OPTS}
            animationData={dashboardMentalLottie}
            className="home-card__lottie"
          />
        </div>
      );
    case "chronic":
      return (
        <div className="home-card__media home-card__media--lottie" aria-hidden>
          <Lottie
            {...LOTTIE_OPTS}
            animationData={chemistryLabLottie}
            className="home-card__lottie"
          />
        </div>
      );
    case "nutrition":
      return (
        <div className="home-card__media home-card__media--lottie" aria-hidden>
          <Lottie
            {...LOTTIE_OPTS}
            animationData={scientistNutritionLottie}
            className="home-card__lottie"
          />
        </div>
      );
    case "gym":
      return (
        <div className="home-card__media home-card__media--lottie" aria-hidden>
          <Lottie
            {...LOTTIE_OPTS}
            animationData={dashboardGymLottie}
            className="home-card__lottie"
          />
        </div>
      );
    case "claim":
      return (
        <div className="home-card__media home-card__media--lottie" aria-hidden>
          <Lottie
            {...LOTTIE_OPTS}
            animationData={dashboardClaimLottie}
            className="home-card__lottie"
          />
        </div>
      );
    case "consultation":
      return (
        <div
          className="home-card__media"
          style={{ backgroundImage: cssBackgroundUrl(consultationCardPng) }}
          aria-hidden
        />
      );
    case "dental":
      return (
        <div
          className="home-card__media"
          style={{ backgroundImage: cssBackgroundUrl(dentalCardPng) }}
          aria-hidden
        />
      );
    case "pharmacy":
      return (
        <div
          className="home-card__media"
          style={{ backgroundImage: cssBackgroundUrl(pharmacyCardPng) }}
          aria-hidden
        />
      );
    case "vision":
      return (
        <div
          className="home-card__media"
          style={{ backgroundImage: cssBackgroundUrl(visionCardPng) }}
          aria-hidden
        />
      );
    case "vaccination":
      return (
        <div
          className="home-card__media home-card__media--svg"
          style={{ backgroundImage: cssBackgroundUrl(vaccinationServicesSvg) }}
          aria-hidden
        />
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
