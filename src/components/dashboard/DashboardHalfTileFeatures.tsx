import atHospitalSvg from "@/assets/icons/Dashboard/AtHospital.svg";
import virtualSvg from "@/assets/icons/Dashboard/Virtual.svg";
import type { DashboardHalfTileFeature } from "@/lib/dashboardServiceGrid";
import {
  MdOutlineLocalMall,
  MdOutlineMedication,
  MdOutlineVaccines,
} from "react-icons/md";
import "./DashboardHalfTileFeatures.css";

const FEATURE_MD_ICON_SIZE = 10;

function FeatureIcon({ icon }: Readonly<{ icon: DashboardHalfTileFeature["icon"] }>) {
  if (icon === "virtual") {
    return (
      <img
        src={virtualSvg}
        alt=""
        width={FEATURE_MD_ICON_SIZE}
        height={FEATURE_MD_ICON_SIZE}
        draggable={false}
        className="home-card__feature-ic home-card__feature-ic--img"
      />
    );
  }
  if (icon === "at-hospital") {
    return (
      <img
        src={atHospitalSvg}
        alt=""
        width={FEATURE_MD_ICON_SIZE}
        height={FEATURE_MD_ICON_SIZE}
        draggable={false}
        className="home-card__feature-ic home-card__feature-ic--img"
      />
    );
  }
  if (icon === "medication") {
    return (
      <MdOutlineMedication
        aria-hidden
        size={FEATURE_MD_ICON_SIZE}
        className="home-card__feature-ic home-card__feature-ic--md"
      />
    );
  }
  if (icon === "local-mall") {
    return (
      <MdOutlineLocalMall
        aria-hidden
        size={FEATURE_MD_ICON_SIZE}
        className="home-card__feature-ic home-card__feature-ic--md"
      />
    );
  }
  if (icon === "vaccines") {
    return (
      <MdOutlineVaccines
        aria-hidden
        size={FEATURE_MD_ICON_SIZE}
        className="home-card__feature-ic home-card__feature-ic--md"
      />
    );
  }
  return (
    <span className="home-card__feature-ic home-card__feature-ic--dot" aria-hidden />
  );
}

export function DashboardHalfTileFeatures({
  features,
}: Readonly<{ features: readonly DashboardHalfTileFeature[] }>) {
  if (features.length === 0) return null;

  return (
    <div className="home-card__features" aria-hidden>
      {features.map((feature) => (
        <span
          key={feature.label}
          className={`home-card__feature home-card__feature--${feature.tone ?? "muted"}`}
        >
          <FeatureIcon icon={feature.icon} />
          <span className="home-card__feature-label">{feature.label}</span>
        </span>
      ))}
    </div>
  );
}
