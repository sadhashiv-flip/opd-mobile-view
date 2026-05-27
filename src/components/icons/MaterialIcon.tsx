import "./MaterialIcon.css";

/** Material Icons ligature — `<mat-icon>directions</mat-icon>`. */
export const MATERIAL_ICON_DIRECTIONS = "directions";

export type MaterialIconProps = Readonly<{
  /** Material Icons ligature, e.g. `directions_bike`. */
  name?: string;
  /** Raw codepoint when matching Flutter `IconData`. */
  codePoint?: number;
  size?: number;
  className?: string;
}>;

export function MaterialIcon({ name, codePoint, size = 24, className }: MaterialIconProps) {
  const glyph =
    codePoint != null ? String.fromCodePoint(codePoint) : (name?.trim() ?? "");
  if (!glyph) return null;

  return (
    <span
      className={`material-icons${className ? ` ${className}` : ""}`}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
