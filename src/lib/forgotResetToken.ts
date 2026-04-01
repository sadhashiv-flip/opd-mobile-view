/** Short-lived reset JWT from POST /verify (action FORGOT) for POST /reset. */

export const FORGOT_RESET_TOKEN_KEY = "opd-mobile-view.forgot.resetToken";

export function saveForgotResetToken(token: string): void {
  try {
    localStorage.setItem(FORGOT_RESET_TOKEN_KEY, token);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getForgotResetToken(): string | null {
  try {
    const t = localStorage.getItem(FORGOT_RESET_TOKEN_KEY);
    return t?.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

export function clearForgotResetToken(): void {
  try {
    localStorage.removeItem(FORGOT_RESET_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
