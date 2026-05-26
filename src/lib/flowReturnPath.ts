import type { Location } from "react-router-dom";

export type FlowReturnPathState = Readonly<{
  returnPath?: string;
}>;

/** Reads `location.state.returnPath` when set by the screen that launched this flow. */
export function readFlowReturnPath(location: Location): string | null {
  const st = location.state as FlowReturnPathState | null;
  const rp = st?.returnPath?.trim();
  return rp || null;
}

export function currentLocationPath(location: Location): string {
  return `${location.pathname}${location.search}`;
}
