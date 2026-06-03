const ONBOARDING_DONE_KEY = "opd-mobile-view.onboarding-done";

export function isOnboardingDone(): boolean {
  try {
    return globalThis.localStorage?.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingDone(done = true) {
  try {
    if (!done) {
      globalThis.localStorage?.removeItem(ONBOARDING_DONE_KEY);
      return;
    }
    globalThis.localStorage?.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}
