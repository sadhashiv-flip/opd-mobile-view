import { useNavigateBack } from "@/hooks/useNavigateBack";
import type { ReactNode } from "react";
import type { NavigateOptions } from "react-router-dom";

const DEFAULT_BACK_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M15 18l-6-6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export type FlowScreenBackProps = Readonly<{
  /** Used only when there is no history to pop (deep link, refresh). */
  fallbackTo?: string;
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
  fallbackNavigate?: NavigateOptions;
  /**
   * Clears persisted data for the current step (and any later steps) before popping history.
   * The previous screen should still have its own data in storage.
   */
  onBeforeBack?: () => void;
}>;

/**
 * Back control for multi-step flows: always `navigate(-1)` when history exists.
 * Do not use `<Link to={...}>` for back — that pushes routes and breaks 4→3→2→1 order.
 */
export function FlowScreenBack({
  fallbackTo,
  className,
  ariaLabel = "Back",
  children = DEFAULT_BACK_ICON,
  fallbackNavigate,
  onBeforeBack,
}: FlowScreenBackProps) {
  const goBack = useNavigateBack(fallbackTo, { fallbackNavigate });

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        onBeforeBack?.();
        goBack();
      }}
    >
      {children}
    </button>
  );
}
