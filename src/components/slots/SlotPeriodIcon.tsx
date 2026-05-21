import morningIcon from "@/assets/icons/patient-app/slots/slot-period-morning.svg";
import twilightIcon from "@/assets/icons/patient-app/slots/slot-period-twilight.svg";

export type SlotPeriod = "morning" | "afternoon" | "evening";

const PERIOD_ICON_SRC: Record<SlotPeriod, string> = {
  morning: morningIcon,
  afternoon: twilightIcon,
  evening: twilightIcon,
};

/** Period icons aligned with patient_app `CommonSlotSelector` (wb_sunny / wb_twilight). */
export function SlotPeriodIcon({ period }: Readonly<{ period: SlotPeriod }>) {
  return (
    <img
      src={PERIOD_ICON_SRC[period]}
      alt=""
      width={18}
      height={18}
      className="vac-slot-pick__sun"
      draggable={false}
    />
  );
}
