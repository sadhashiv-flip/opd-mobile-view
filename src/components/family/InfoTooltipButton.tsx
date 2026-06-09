import { MaterialIcon } from "@/components/icons/MaterialIcon";
import { useEffect, useId, useRef, useState } from "react";
import "./InfoTooltipButton.css";

const MEMBER_PHONE_OTP_TOOLTIP =
  "OTP will be sent to this number. Verify OTP before proceeding further.";

type InfoTooltipButtonProps = Readonly<{
  message?: string;
  className?: string;
}>;

export function InfoTooltipButton({
  message = MEMBER_PHONE_OTP_TOOLTIP,
  className,
}: InfoTooltipButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = wrapRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const rootClass = className
    ? `afm-info-tooltip ${className}`
    : "afm-info-tooltip";

  return (
    <div className={rootClass} ref={wrapRef}>
      <button
        type="button"
        className="afm-info-tooltip__btn"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MaterialIcon name="info_outline" rounded size={22} />
        <span className="visually-hidden">{message}</span>
      </button>
      {open ? (
        <div id={tooltipId} className="afm-info-tooltip__bubble" role="tooltip">
          {message}
        </div>
      ) : null}
    </div>
  );
}
