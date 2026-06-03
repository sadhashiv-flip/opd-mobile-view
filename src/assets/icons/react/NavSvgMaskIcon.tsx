import type { ImgHTMLAttributes } from "react";

export type NavSvgMaskIconProps = Readonly<{
  src: string;
  size?: number;
  /** `medical` — black-fill asset; needs inactive gray filter like Flutter tint. */
  variant?: "default" | "medical" | "fab";
}> &
  Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height">;

/**
 * Patient-app bottom nav SVGs (pre-tinted #8E8E8E or black for medical).
 * Active tab recolor via CSS filter in {@link HomeBottomNav.css}.
 */
export function NavSvgMaskIcon({
  src,
  size = 22,
  variant = "default",
  className,
  ...rest
}: NavSvgMaskIconProps) {
  const variantClass =
    variant === "medical"
      ? " home-nav__icon-img--medical"
      : variant === "fab"
        ? " home-nav__icon-img--fab"
        : "";

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={`home-nav__icon-img${variantClass}${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}
