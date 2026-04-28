import { useEffect, useState } from "react";
import type { ActivePreLoginNotice } from "@/lib/noticeBoard";
import { NoticeCard } from "./NoticeCard";
import "./NoticeScreen.css";

export type NoticeScreenProps = Readonly<{
  notice: ActivePreLoginNotice;
  onContinueToLogin?: () => void;
}>;

export function NoticeScreen({ notice, onContinueToLogin }: NoticeScreenProps) {
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
      aria-label="Notice board"
    >
      <div className="notice-screen__shell">
        <NoticeCard notice={notice} entered={entered} onContinue={onContinueToLogin} />
      </div>
    </div>
  );
}
