import { useCallback } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";

/** Whether the browser history stack can pop within this tab (React Router sets `idx`). */
export function canGoBackInHistory(): boolean {
  const st = window.history.state as { idx?: number } | null;
  return typeof st?.idx === "number" && st.idx > 0;
}

type NavigateBackOptions = Readonly<{
  /** Passed to `navigate(fallback, options)` when history cannot pop. */
  fallbackNavigate?: NavigateOptions;
}>;

/**
 * Always pops one history entry when the in-app stack allows it (4→3→2→1).
 * Uses `fallbackPath` only on cold entry / refresh when `idx` is 0.
 */
export function useNavigateBack(fallbackPath?: string, options?: NavigateBackOptions) {
  const navigate = useNavigate();

  return useCallback(() => {
    if (canGoBackInHistory()) {
      navigate(-1);
      return;
    }
    if (fallbackPath) {
      navigate(fallbackPath, options?.fallbackNavigate);
    }
  }, [navigate, fallbackPath, options?.fallbackNavigate]);
}
