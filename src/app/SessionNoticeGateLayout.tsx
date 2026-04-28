import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  NoticeBoardBlockingLayer,
  NoticeGateLoading,
} from "@/components/notice/NoticeBoardBlockingLayer";
import { getAuthSession } from "@/lib/authStorage";

/**
 * For routes with a stored auth session: fetches the notice board from the API before
 * {@link Outlet} mounts, so hooks such as {@link useHomeDashboard} do not run authenticated APIs
 * until the notice step has completed.
 */
export function SessionNoticeGateLayout() {
  const [authPhase, setAuthPhase] = useState<"checking" | "ready">("checking");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAuthSession().then((s) => {
      if (cancelled) return;
      setAuthed(!!s?.token);
      setAuthPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authPhase === "checking") {
    return <NoticeGateLoading />;
  }

  if (!authed) {
    return <Outlet />;
  }

  return <NoticeBoardBlockingLayer resolved={<Outlet />} />;
}
