import { NoticeBoardBlockingLayer } from "@/components/notice/NoticeBoardBlockingLayer";
import { LoginPage } from "@/pages/LoginPage";

/**
 * Pre-login: fetches `GET /notice-board` unless the user already chose Continue this tab session
 * (sessionStorage flag); shows {@link NoticeScreen} when needed, otherwise {@link LoginPage}.
 */
export function PreLoginNoticeGate() {
  return <NoticeBoardBlockingLayer resolved={<LoginPage />} />;
}
