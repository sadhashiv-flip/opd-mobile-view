import { NoticeBoardBlockingLayer } from "@/components/notice/NoticeBoardBlockingLayer";
import { LoginPage } from "@/pages/LoginPage";

/**
 * Pre-login middleware: fetches notice banners once; shows {@link NoticeScreen} when a valid
 * notice is active, otherwise renders {@link LoginPage}.
 */
export function PreLoginNoticeGate() {
  return <NoticeBoardBlockingLayer resolved={<LoginPage />} />;
}
