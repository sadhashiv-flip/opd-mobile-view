import { useCallback, useState } from "react";
import { NoticeScreen } from "@/components/notice/NoticeScreen";
import { usePreLoginNotice } from "@/hooks/usePreLoginNotice";
import { LoginPage } from "@/pages/LoginPage";
import "./PreLoginNoticeGate.css";

/**
 * Pre-login middleware: fetches notice banners once; shows {@link NoticeScreen} when a valid
 * notice is active, otherwise renders {@link LoginPage}.
 */
export function PreLoginNoticeGate() {
  const { phase, activeNotice } = usePreLoginNotice();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const goToLogin = useCallback(() => {
    setNoticeDismissed(true);
  }, []);

  if (phase === "loading") {
    return (
      <div className="prelogin-notice-gate prelogin-notice-gate--loading" aria-busy="true">
        <div className="prelogin-notice-gate__spinner" aria-hidden />
        <p className="prelogin-notice-gate__loading-text">Loading…</p>
      </div>
    );
  }

  if (activeNotice && !noticeDismissed) {
    return (
      <NoticeScreen
        notice={activeNotice}
        onContinueToLogin={activeNotice.blockLogin ? undefined : goToLogin}
        onSkipToLogin={activeNotice.blockLogin ? undefined : goToLogin}
      />
    );
  }

  return <LoginPage />;
}
