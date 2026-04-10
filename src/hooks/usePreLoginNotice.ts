import { useEffect, useState } from "react";
import { fetchActivePreLoginNotice } from "@/api/patientNoticeBanners";
import type { ActivePreLoginNotice } from "@/lib/noticeBoard";

export type PreLoginNoticePhase = "loading" | "ready";

export type UsePreLoginNoticeResult = Readonly<{
  phase: PreLoginNoticePhase;
  activeNotice: ActivePreLoginNotice | null;
}>;

/**
 * Single in-flight fetch before login; aborted on unmount / Strict Mode remount.
 */
export function usePreLoginNotice(): UsePreLoginNoticeResult {
  const [phase, setPhase] = useState<PreLoginNoticePhase>("loading");
  const [activeNotice, setActiveNotice] = useState<ActivePreLoginNotice | null>(null);

  useEffect(() => {
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
