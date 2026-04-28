import { useEffect, useState } from "react";
import { fetchActivePreLoginNotice } from "@/api/patientNoticeBanners";
import { isNoticeBoardContinueAcknowledged } from "@/constants/noticeBoardSession";
import type { ActivePreLoginNotice } from "@/lib/noticeBoard";

export type PreLoginNoticePhase = "loading" | "ready";

export type UsePreLoginNoticeResult = Readonly<{
  phase: PreLoginNoticePhase;
  activeNotice: ActivePreLoginNotice | null;
}>;

/**
 * Loads the notice board from `GET /notice-board` on mount unless
 * {@link isNoticeBoardContinueAcknowledged} is set (user already tapped Continue this session).
 * The API response is not stored — only the continue flag in sessionStorage.
 */
export function usePreLoginNotice(): UsePreLoginNoticeResult {
  const [phase, setPhase] = useState<PreLoginNoticePhase>(() =>
    isNoticeBoardContinueAcknowledged() ? "ready" : "loading",
  );
  const [activeNotice, setActiveNotice] = useState<ActivePreLoginNotice | null>(null);

  useEffect(() => {
    if (isNoticeBoardContinueAcknowledged()) {
      setActiveNotice(null);
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        const notice = await fetchActivePreLoginNotice(new Date(), { signal: ac.signal });
        if (ac.signal.aborted) return;
        setActiveNotice(notice);
      } catch {
        if (ac.signal.aborted) return;
        setActiveNotice(null);
      } finally {
        if (!ac.signal.aborted) {
          setPhase("ready");
        }
      }
    })();
    return () => ac.abort();
  }, []);

  return { phase, activeNotice };
}
