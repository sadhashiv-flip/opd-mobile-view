import type { DigitalDiaryActivityType } from "@/lib/digitalDiary";
import type { IconType } from "react-icons";
import {
  MdOutlineAir,
  MdOutlineBedtime,
  MdOutlineBloodtype,
  MdOutlineFavoriteBorder,
  MdOutlineFitnessCenter,
  MdOutlineHealing,
  MdOutlineHeight,
  MdOutlineLightbulb,
  MdOutlineMedication,
  MdOutlineMonitorHeart,
  MdOutlineMonitorWeight,
  MdOutlineSentimentSatisfiedAlt,
  MdOutlineThermostat,
  MdOutlineWaterDrop,
} from "react-icons/md";

const DD_PRIMARY = "#ff5224";

/** Matches Flutter `ActivitiesHubScreen` / `_HubItem.icon` (Material outlined). */
const TILE_ICON_BY_ACTIVITY: Record<DigitalDiaryActivityType, IconType> = {
  water: MdOutlineWaterDrop,
  workout: MdOutlineFitnessCenter,
  GL: MdOutlineBloodtype,
  BP: MdOutlineMonitorHeart,
  TEMP: MdOutlineThermostat,
  O2: MdOutlineAir,
  HR: MdOutlineFavoriteBorder,
  height: MdOutlineHeight,
  weight: MdOutlineMonitorWeight,
  sleep: MdOutlineBedtime,
  symptom: MdOutlineHealing,
  mood: MdOutlineSentimentSatisfiedAlt,
  medicine: MdOutlineMedication,
};

/** Flutter `_IntroCard`: `Icons.lightbulb_outline_rounded`, size 22, primary. */
export function DigitalDiaryIntroIcon() {
  return (
    <MdOutlineLightbulb
      className="dd-intro__icon-svg"
      size={22}
      color={DD_PRIMARY}
      aria-hidden
    />
  );
}

/** Flutter `_GridTile`: `Icon(item.icon, color: primary, size: 16)`. */
export function DigitalDiaryTileIcon({
  activity,
}: Readonly<{ activity: DigitalDiaryActivityType }>) {
  const Icon = TILE_ICON_BY_ACTIVITY[activity];
  return <Icon className="dd-tile__icon-svg" size={16} color={DD_PRIMARY} aria-hidden />;
}
