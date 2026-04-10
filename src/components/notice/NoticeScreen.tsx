import { useEffect, useState } from "react";
import type { ActivePreLoginNotice } from "@/lib/noticeBoard";
import { NoticeCard } from "./NoticeCard";
import "./NoticeScreen.css";

export type NoticeScreenProps = Readonly<{
  notice: ActivePreLoginNotice;
  onContinueToLogin?: () => void;
  onSkipToLogin?: () => void;
}>;

export function NoticeScreen({ notice, onContinueToLogin, onSkipToLogin }: NoticeScreenProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`notice-screen${entered ? " notice-screen--entered" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={notice.title ? "prelogin-notice-title" : undefined}
      aria-label={notice.title ? undefined : "Important notice"}
    >
      <div className="notice-screen__backdrop" aria-hidden />
      <div className="notice-screen__center">
        <div className="notice-screen__card-wrap">
          <NoticeCard
            imageUrl={notice.imageUrl}
            title={notice.title}
            note={notice.note}
            blockLogin={notice.blockLogin}
            onContinueToLogin={onContinueToLogin}
            onSkipToLogin={onSkipToLogin}
          />
        </div>
      </div>
    </div>
  );
}
