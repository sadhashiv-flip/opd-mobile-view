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
  /** Use Material Icons Round — matches Flutter `Icons.*_rounded`. */
  rounded?: boolean;
}>;

export function MaterialIcon({
  name,
  codePoint,
  size = 24,
  className,
  rounded = false,
}: MaterialIconProps) {
  const glyph =
    codePoint != null ? String.fromCodePoint(codePoint) : (name?.trim() ?? "");
  if (!glyph) return null;

  const roundClass = rounded ? " material-icons--round" : "";

  return (
    <span
      className={`material-icons${roundClass}${className ? ` ${className}` : ""}`}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
