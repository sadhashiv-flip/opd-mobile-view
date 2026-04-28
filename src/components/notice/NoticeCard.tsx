import { useLayoutEffect, useRef, useState } from "react";
import type { ActivePreLoginNotice } from "@/lib/noticeBoard";
import "./NoticeCard.css";

function formatDurationMs(ms: number): string {
  const d = Math.max(0, ms);
  const mins = Math.floor(d / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) {
    const hRem = hrs % 24;
    if (hRem > 0) return `${days} day${days > 1 ? "s" : ""} ${hRem} hr${hRem > 1 ? "s" : ""}`;
    return `${days} day${days > 1 ? "s" : ""}`;
  }
  if (hrs > 0) {
    const mRem = mins % 60;
    if (mRem > 0) return `${hrs} hr${hrs > 1 ? "s" : ""} ${mRem} min`;
    return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  }
  return `${Math.max(1, mins)} min`;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatScheduleDate(ms: number): string {
  return dateFmt.format(new Date(ms));
}

function formatScheduleTime(ms: number): string {
  return timeFmt.format(new Date(ms));
}

export type NoticeCardProps = Readonly<{
  notice: ActivePreLoginNotice;
  /** When true, play entry / image scale animations. */
  entered?: boolean;
  onContinue?: () => void;
}>;

function IcSchedule() {
  return (
    <svg className="notice-board__ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
      />
    </svg>
  );
}

function IcPlay() {
  return (
    <svg className="notice-board__ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7.08L8 5z" />
    </svg>
  );
}

function IcStop() {
  return (
    <svg className="notice-board__ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path fill="currentColor" d="M8 8h8v8H8V8zm4-6C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
    </svg>
  );
}

function IcArrowFwd() {
  return (
    <svg className="notice-board__ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
    </svg>
  );
}

function IcHourglass() {
  return (
    <svg className="notice-board__ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"
      />
    </svg>
  );
}

function IcBlock() {
  return (
    <svg className="notice-board__ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"
      />
    </svg>
  );
}

function IcDetails() {
  return (
    <svg className="notice-board__ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
      />
    </svg>
  );
}

function IcCampaignLarge() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden className="notice-board__fallback-campaign">
      <path
        fill="currentColor"
        d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.39 3.5 1.39v-3.93c-.87-.07-1.71-.33-2.5-.82l-1 1.36zM16 9c0-.71-.15-1.39-.38-2H8v3h5.26c.48-.65.89-1.36 1.14-2H16zm5.5 3L18 11h-2v5.09c.91.26 1.87.41 2.91.41 1.04 0 2-.15 2.91-.41V11h-2l1.5-1.5zM6 9H3v2h3V9zm3 5c-.83 1.2-1.5 2.54-1.62 3.96-.17 2.14 1.22 3.99 3.35 3.99 1.86 0 3.35-1.35 3.35-3 0-2.11-1.35-3.35-3.35-3.35-.57 0-1.11.11-1.6.28l2.27-2.27L9 14zm9-6h-3V6h3v3zM6 6H3v3h3V6zm3 5H3v2h6v-2z"
      />
    </svg>
  );
}

export function NoticeCard({ notice, entered = false, onContinue }: NoticeCardProps) {
  const { imageUrl, note, blockLogin, eventStartMs, eventEndMs } = notice;
  const [imgPhase, setImgPhase] = useState<"loading" | "loaded" | "fallback">(
    imageUrl ? "loading" : "fallback",
  );
  const bannerImgRef = useRef<HTMLImageElement | null>(null);

  /**
   * Reset when the URL changes; for cache hits the image is often `complete` before `onLoad`
   * runs, so we check synchronously after the new `<img>` is mounted.
   */
  useLayoutEffect(() => {
    if (!imageUrl) {
      setImgPhase("fallback");
      return;
    }
    setImgPhase("loading");
    const el = bannerImgRef.current;
    if (el?.complete) {
      setImgPhase(el.naturalWidth > 0 ? "loaded" : "fallback");
    }
  }, [imageUrl]);

  const start = eventStartMs != null ? new Date(eventStartMs) : null;
  const end = eventEndMs != null ? new Date(eventEndMs) : null;
  const now = Date.now();
  const showSchedule =
    (start != null && !Number.isNaN(start.getTime())) || (end != null && !Number.isNaN(end.getTime()));
  const startOk = start != null && !Number.isNaN(start.getTime());
  const endOk = end != null && !Number.isNaN(end.getTime());
  const isOngoing =
    startOk &&
    endOk &&
    eventStartMs != null &&
    eventEndMs != null &&
    now >= eventStartMs &&
    now <= eventEndMs;
  const endTimeMs = endOk && end ? end.getTime() : null;
  const remainingMs =
    blockLogin && endTimeMs != null && endTimeMs > now ? endTimeMs - now : null;

  const showNote = note.trim().length > 0;
  const showIllustration = !imageUrl || imgPhase === "fallback";

  return (
    <article
      className={`notice-board${entered ? " notice-board--entered" : ""}`}
      aria-label={blockLogin ? "Important notice" : "Announcement"}
    >
      <div className="notice-board__scroll">
        <div className="notice-board__pad">
          <div
            className={`notice-board__banner-wrap${!showIllustration && imgPhase === "loading" ? " notice-board__banner-wrap--loading" : ""}`}
          >
            {showIllustration ? (
              <div className="notice-board__illustration">
                <span className="notice-board__decor notice-board__decor--a" />
                <span className="notice-board__decor notice-board__decor--b" />
                <span className="notice-board__decor notice-board__decor--c" />
                <div className="notice-board__illustration-inner">
                  <div className="notice-board__illustration-icon">
                    <IcCampaignLarge />
                  </div>
                  <p className="notice-board__illustration-label">Notice Board</p>
                </div>
              </div>
            ) : (
              <div className="notice-board__banner-stack">
                <img
                  ref={bannerImgRef}
                  key={imageUrl}
                  className={`notice-board__banner-img${imgPhase === "loaded" ? " notice-board__banner-img--visible" : ""}`}
                  src={imageUrl}
                  alt=""
                  decoding="async"
                  onLoad={() => setImgPhase("loaded")}
                  onError={() => setImgPhase("fallback")}
                />
                {imgPhase === "loading" ? (
                  <div className="notice-board__img-placeholder" aria-busy="true">
                    <span className="notice-board__spinner" />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {showSchedule ? (
            <section className="notice-board__card notice-board__schedule">
              <div className="notice-board__card-head">
                <div className="notice-board__icon-box notice-board__icon-box--schedule">
                  <IcSchedule />
                </div>
                <h2 className="notice-board__card-title">Schedule</h2>
                {isOngoing ? (
                  <div className="notice-board__ongoing">
                    <span className="notice-board__ongoing-dot" />
                    <span>Ongoing</span>
                  </div>
                ) : null}
              </div>

              <div className="notice-board__timeline">
                {startOk && start ? (
                  <div className="notice-board__date-block notice-board__date-block--start">
                    <div className="notice-board__date-label">
                      <IcPlay />
                      <span>Starts</span>
                    </div>
                    <p className="notice-board__date-main">{formatScheduleDate(start.getTime())}</p>
                    <p className="notice-board__date-sub">{formatScheduleTime(start.getTime())}</p>
                  </div>
                ) : null}
                {startOk && endOk ? (
                  <div className="notice-board__timeline-arrow" aria-hidden>
                    <IcArrowFwd />
                  </div>
                ) : null}
                {endOk && end ? (
                  <div className="notice-board__date-block notice-board__date-block--end">
                    <div className="notice-board__date-label">
                      <IcStop />
                      <span>Ends</span>
                    </div>
                    <p className="notice-board__date-main">{formatScheduleDate(end.getTime())}</p>
                    <p className="notice-board__date-sub">{formatScheduleTime(end.getTime())}</p>
                  </div>
                ) : null}
              </div>

              {remainingMs != null ? (
                <div className="notice-board__resume">
                  <IcHourglass />
                  <span>Expected to resume in {formatDurationMs(remainingMs)}</span>
                </div>
              ) : null}
            </section>
          ) : null}

          {showNote ? (
            <section
              className={`notice-board__card notice-board__details${blockLogin ? " notice-board__details--blocked" : ""}`}
            >
              <div className="notice-board__card-head">
                <div className="notice-board__icon-box notice-board__icon-box--details">
                  <IcDetails />
                </div>
                <h2 className="notice-board__card-title">Details</h2>
              </div>
              <div className="notice-board__rule" />
              <p className="notice-board__note-text">{note}</p>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="notice-board__footer">
        {blockLogin ? (
          <div className="notice-board__blocked" aria-live="polite">
            <IcBlock />
            <p className="notice-board__blocked-text">
              Access is temporarily restricted. Please check back later.
            </p>
          </div>
        ) : (
          <button type="button" className="notice-board__continue" onClick={onContinue}>
            <span>Continue</span>
            <IcArrowFwd />
          </button>
        )}
      </footer>
    </article>
  );
}
