import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { NoticeScreen } from "@/components/notice/NoticeScreen";
import { markPreLoginNoticeBoardUiComplete } from "@/constants/preLoginNoticeBoardSession";
import { usePreLoginNotice } from "@/hooks/usePreLoginNotice";
import "@/pages/PreLoginNoticeGate.css";

export function NoticeGateLoading(): ReactNode {
  return (
    <div className="prelogin-notice-gate prelogin-notice-gate--loading" aria-busy="true">
      <div className="prelogin-notice-gate__spinner" aria-hidden />
      <p className="prelogin-notice-gate__loading-text">Loading…</p>
    </div>
  );
}

type NoticeBoardBlockingLayerProps = Readonly<{
  /** Rendered once notice resolution finished and there is nothing blocking, or after dismiss. */
  resolved: ReactNode;
}>;

/**
 * Resolves the pre-login notice board (`sessionStorage` keys in `preLoginNoticeBoardSession.ts`),
 * shows {@link NoticeScreen} when needed, then renders `resolved`.
 */
export function NoticeBoardBlockingLayer({ resolved }: NoticeBoardBlockingLayerProps) {
  const { phase, activeNotice } = usePreLoginNotice();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const dismiss = useCallback(() => {
    markPreLoginNoticeBoardUiComplete();
    setNoticeDismissed(true);
  }, []);

  if (phase === "loading") {
    return <NoticeGateLoading />;
  }

  if (activeNotice && !noticeDismissed) {
    return (
      <NoticeScreen
        notice={activeNotice}
        onContinueToLogin={activeNotice.blockLogin ? undefined : dismiss}
        onSkipToLogin={activeNotice.blockLogin ? undefined : dismiss}
      />
    );
  }

  return resolved;
}
