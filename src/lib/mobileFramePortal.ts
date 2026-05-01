import type { ReactNode, ReactPortal } from "react";
import { createPortal } from "react-dom";

/**
 * Preferred DOM parent for full-bleed overlays so they stay inside the phone shell
 * ({@link MobileShell} → `.mobile-app-root` → `.mobile-frame`).
 */
export function getMobileFrameRoot(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".mobile-app-root .mobile-frame");
  if (el) return el;
  const root = document.getElementById("root");
  if (root) return root;
  return document.body;
}

/** Render overlay UI into `.mobile-frame` (scoped `position: absolute` layers). */
export function portalToMobileFrame(children: ReactNode): ReactPortal {
  return createPortal(children, getMobileFrameRoot());
}
