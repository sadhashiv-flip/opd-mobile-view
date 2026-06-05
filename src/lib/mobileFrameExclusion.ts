/** DOM target for the phone column ({@link MobileShell} → `.mobile-app-root` → `.mobile-frame`). */
export function getMobileFrameElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".mobile-app-root .mobile-frame");
}

/** True when viewport coordinates fall inside the centered phone column. */
export function isPointerInsideMobileFrame(clientX: number, clientY: number): boolean {
  const frame = getMobileFrameElement();
  if (!frame) return true;
  const rect = frame.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

/** True when the phone column does not span the full viewport width (desktop side gutters exist). */
export function hasMobileFrameGutters(): boolean {
  const frame = getMobileFrameElement();
  if (!frame) return false;
  const rect = frame.getBoundingClientRect();
  return rect.left > 2 || rect.right < window.innerWidth - 2;
}

/**
 * Clip-path that shows content only outside `.mobile-frame` (desktop side gutters).
 * Coordinates are relative to `layer` when provided (the splash overlay inside `.mobile-app-root`).
 */
export function clipPathExcludingMobileFrame(layer?: HTMLElement | null): string {
  const layerRect = layer?.getBoundingClientRect();
  const w = Math.round(layer?.clientWidth ?? window.innerWidth);
  const h = Math.round(layer?.clientHeight ?? window.innerHeight);
  const offsetX = layerRect?.left ?? 0;
  const offsetY = layerRect?.top ?? 0;

  const frame = getMobileFrameElement();
  if (!frame || !hasMobileFrameGutters()) {
    return "inset(100% 100% 100% 100%)";
  }

  const rect = frame.getBoundingClientRect();
  const left = Math.round(rect.left - offsetX);
  const top = Math.round(rect.top - offsetY);
  const right = Math.round(rect.right - offsetX);
  const bottom = Math.round(rect.bottom - offsetY);

  return `polygon(evenodd, 0px 0px, ${w}px 0px, ${w}px ${h}px, 0px ${h}px, 0px 0px, ${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${top}px, ${left}px ${top}px)`;
}
