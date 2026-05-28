const DASHBOARD_WALKTHROUGH_DONE_KEY = "opd-mobile-view.dashboard-walkthrough-done";

export function isDashboardWalkthroughDone(): boolean {
  try {
    return globalThis.localStorage?.getItem(DASHBOARD_WALKTHROUGH_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDashboardWalkthroughDone(done = true) {
  try {
    if (!done) {
      globalThis.localStorage?.removeItem(DASHBOARD_WALKTHROUGH_DONE_KEY);
      return;
    }
    globalThis.localStorage?.setItem(DASHBOARD_WALKTHROUGH_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}
