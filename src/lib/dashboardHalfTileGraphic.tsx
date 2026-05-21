import { cssBackgroundUrl } from "@/lib/cssBackgroundUrl";
import type { DashboardHalfTileKind } from "@/lib/dashboardServiceGrid";
import consultationCardPng from "@/assets/images/dashboard-patient-app/consultationCardDashbaord.png?url";
import dentalCardPng from "@/assets/images/dashboard-patient-app/DentalCardDashboard.png?url";
import pharmacyCardPng from "@/assets/images/dashboard-patient-app/pharmacyCardDashboard.png?url";
import visionCardPng from "@/assets/images/dashboard-patient-app/VisionCardDashboard.png?url";
import vaccinePng from "@/assets/images/dashboard-patient-app/vaccine.png?url";
import mentalWellnessPng from "@/assets/images/dashboard-patient-app/dashboard_mental_wellness.png?url";
import nutritionPng from "@/assets/images/dashboard-patient-app/nutrition_dashboard_icon.png?url";
import chronicPng from "@/assets/images/dashboard-patient-app/dashboard_chronic.png?url";
import gymMembershipPng from "@/assets/images/dashboard-patient-app/DashboardGymMembership.png?url";
import claimsPng from "@/assets/images/dashboard-patient-app/dashboard_claims.png?url";

function HalfTileRaster({ url }: Readonly<{ url: string }>) {
  return (
    <div
      className="home-card__media"
      style={{ backgroundImage: cssBackgroundUrl(url) }}
      aria-hidden
    />
  );
}

/**
 * Corner artwork for home dashboard half-tiles — raster PNGs from patient-app
 * {@code assets/png} (same paths as {@code AppString.kDashboard*} in string_define.dart).
 */
export function DashboardHalfTileGraphic({
  kind,
}: Readonly<{ kind: DashboardHalfTileKind }>) {
  switch (kind) {
    case "consultation":
      return <HalfTileRaster url={consultationCardPng} />;
    case "dental":
      return <HalfTileRaster url={dentalCardPng} />;
    case "pharmacy":
      return <HalfTileRaster url={pharmacyCardPng} />;
    case "vision":
      return <HalfTileRaster url={visionCardPng} />;
    case "vaccination":
      return <HalfTileRaster url={vaccinePng} />;
    case "mental":
      return <HalfTileRaster url={mentalWellnessPng} />;
    case "chronic":
      return <HalfTileRaster url={chronicPng} />;
    case "nutrition":
      return <HalfTileRaster url={nutritionPng} />;
    case "gym":
      return <HalfTileRaster url={gymMembershipPng} />;
    case "claim":
      return <HalfTileRaster url={claimsPng} />;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
