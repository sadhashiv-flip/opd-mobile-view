import "./slotPeriodGlyphs.css";

export type SlotPeriod = "morning" | "afternoon" | "evening";

const PERIOD_GLYPH: Record<SlotPeriod, Readonly<{ char: string; pm: boolean }>> = {
  morning: { char: "☀", pm: false },
  afternoon: { char: "✷", pm: true },
  evening: { char: "☾", pm: true },
};

const PERIOD_LABEL: Record<SlotPeriod, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/** ☀ / ✷ / ☾ — shared across vision, dental, vaccine, consultation, diagnostics slots. */
export function SlotPeriodGlyph({ period }: Readonly<{ period: SlotPeriod }>) {
  const { char, pm } = PERIOD_GLYPH[period];
  return (
    <span className={pm ? "cas-sun cas-sun--pm" : "cas-sun"} aria-hidden="true">
      {char}
    </span>
  );
}

/** `cas-section__head` row with glyph + label (diagnostics / consultation layout). */
export function SlotPeriodSectionHead(
  props: Readonly<{ period: SlotPeriod; label?: string }>,
) {
  return (
    <div className="cas-section__head">
      <SlotPeriodGlyph period={props.period} />
      <span>{props.label ?? PERIOD_LABEL[props.period]}</span>
    </div>
  );
}

/** Alias for use inside `vac-slot-pick__group-head`. */
export function SlotPeriodIcon({ period }: Readonly<{ period: SlotPeriod }>) {
  return <SlotPeriodGlyph period={period} />;
}
