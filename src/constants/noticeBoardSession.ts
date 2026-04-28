const NOTICE_BOARD_CONTINUE_KEY = "opd-mobile-view.noticeBoard.continueAcknowledged";

const TRUE = "true";

/**
 * When set, the user has already continued past the notice this tab session — skip
 * `GET /notice-board`. Only the flag is stored, not the API body.
 */
export function isNoticeBoardContinueAcknowledged(): boolean {
  try {
    return sessionStorage.getItem(NOTICE_BOARD_CONTINUE_KEY) === TRUE;
  } catch {
    return false;
  }
}

export function setNoticeBoardContinueAcknowledged(): void {
  try {
    sessionStorage.setItem(NOTICE_BOARD_CONTINUE_KEY, TRUE);
  } catch {
    /* private mode / quota */
  }
}
