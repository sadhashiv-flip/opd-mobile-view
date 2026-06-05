import {
  fetchFitnessVideosForTag,
  resolveFitnessVideoUrl,
  type FitnessVideo,
} from "@/api/patientFitness";
import { submitPatientParameter } from "@/api/patientParameters";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { ROUTES } from "@/constants";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import { readFitnessTagSnapshot } from "@/constants/fitnessSessionStorage";
import { activitySubmitPayloads } from "@/lib/digitalDiary";
import {
  fitnessTotalRounds,
  formatFitnessClock,
  formatFitnessVideoDurationLabel,
  workoutRoundSeconds,
} from "@/lib/fitnessDuration";
import { useToast } from "@/hooks/useToast";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./DigitalDiaryPages.css";
import "./FitnessVideosPage.css";

const REST_SECONDS = 10;

type SessionFinishedSummary = Readonly<{
  videoName: string;
  rounds: number;
  kcal?: number | string;
  /** Exercise / video id for POST `/patient/parameters` (`source_id`) */
  sourceId?: number | string | null;
  /** Total work seconds for `category: watching` (all completed rounds). */
  secondsWatched: number;
}>;

export function FitnessVideosPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const snapshot = readFitnessTagSnapshot();
  const sid = tagId?.trim() ?? "";
  const headerTitle =
    snapshot?.id === sid ? snapshot.name : "Workout";

  const heroImage =
    snapshot?.id === sid
      ? resolveProfileImageUrl(snapshot.image?.trim() ? snapshot.image : null)
      : null;

  const [videos, setVideos] = useState<readonly FitnessVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeVideo, setActiveVideo] = useState<FitnessVideo | null>(null);
  /** All rounds finished — show Complete → navigate to fitness home */
  const [sessionFinished, setSessionFinished] = useState<SessionFinishedSummary | null>(null);

  const [countdown, setCountdown] = useState(0);
  const [primaryLabel, setPrimaryLabel] = useState<"Start" | "Stop">("Start");
  const pausedRef = useRef(false);
  const [pausedUi, setPausedUi] = useState(false);
  const [restPhase, setRestPhase] = useState(false);
  const roundsDone = useRef(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roundTotalSecondsRef = useRef(0);
  const [videoMuted, setVideoMuted] = useState(false);
  const [playNeedsGesture, setPlayNeedsGesture] = useState(false);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTick(), [clearTick]);

  useEffect(() => {
    if (!sid) {
      setError("Missing workout.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const rows = await fetchFitnessVideosForTag(sid);
        if (cancelled) return;
        setVideos(rows);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load videos.");
        setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sid]);

  /** Reliable playback: gesture unlocks audio; fallback muted + optional unmute */
  const tryPlayMedia = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    setPlayNeedsGesture(false);
    try {
      el.muted = false;
      await el.play();
      setVideoMuted(false);
      return;
    } catch {
      try {
        el.muted = true;
        await el.play();
        setVideoMuted(true);
      } catch {
        setPlayNeedsGesture(true);
      }
    }
  }, []);

  const pauseMedia = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const resetMedia = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, []);

  const resetPlayerUi = useCallback(() => {
    setCountdown(0);
    setPrimaryLabel("Start");
    pausedRef.current = false;
    setPausedUi(false);
    setRestPhase(false);
    roundsDone.current = 0;
    remainingRef.current = 0;
    roundTotalSecondsRef.current = 0;
    setPlayNeedsGesture(false);
  }, []);

  const closePlayer = useCallback(() => {
    clearTick();
    resetMedia();
    setSessionFinished(null);
    setActiveVideo(null);
    resetPlayerUi();
  }, [clearTick, resetMedia, resetPlayerUi]);

  const totalRoundsFor = useCallback((video: FitnessVideo) => fitnessTotalRounds(video), []);

  const finishWorkoutSession = useCallback(
    (video: FitnessVideo, cap: number) => {
      clearTick();
      pauseMedia();
      const roundSec = workoutRoundSeconds(video);
      setSessionFinished({
        videoName: video.name,
        rounds: cap,
        kcal: video.cal,
        sourceId: video.id ?? null,
        secondsWatched: roundSec * cap,
      });
    },
    [clearTick, pauseMedia],
  );

  const onCompleteGoFitness = useCallback(async () => {
    const summary = sessionFinished;
    if (!summary) return;

    const sid = summary.sourceId;
    const canSync =
      sid != null && sid !== "" && !(typeof sid === "number" && Number.isNaN(sid));

    if (canSync) {
      setCompleteSubmitting(true);
      try {
        await submitPatientParameter(
          activitySubmitPayloads.fitnessVideoWatch({
            sourceId: sid,
            secondsWatched: summary.secondsWatched,
          }),
        );
        toast.success(DIGITAL_DIARY_COPY.submitSuccess);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : DIGITAL_DIARY_COPY.submitError,
        );
        setCompleteSubmitting(false);
        return;
      } finally {
        setCompleteSubmitting(false);
      }
    }

    closePlayer();
    navigate(ROUTES.fitness);
  }, [closePlayer, navigate, sessionFinished, toast]);

  const afterWorkSlice = useCallback(
    (video: FitnessVideo) => {
      clearTick();
      pauseMedia();
      const cap = totalRoundsFor(video);
      roundsDone.current += 1;
      if (roundsDone.current >= cap) {
        finishWorkoutSession(video, cap);
        return;
      }
      setRestPhase(true);
      setPrimaryLabel("Start");
      pausedRef.current = false;
      setPausedUi(false);
      remainingRef.current = REST_SECONDS;
      setCountdown(REST_SECONDS);
      tickRef.current = setInterval(() => {
        remainingRef.current -= 1;
        setCountdown(remainingRef.current);
        if (remainingRef.current <= 0) {
          clearTick();
          setRestPhase(false);
          const next = workoutRoundSeconds(video);
          remainingRef.current = next;
          roundTotalSecondsRef.current = next;
          setCountdown(next);
          setPrimaryLabel("Start");
        }
      }, 1000);
    },
    [clearTick, finishWorkoutSession, pauseMedia, totalRoundsFor],
  );

  const startWorkSlice = useCallback(
    (video: FitnessVideo) => {
      clearTick();
      let sec = remainingRef.current;
      if (sec <= 0) sec = workoutRoundSeconds(video);
      remainingRef.current = sec;
      roundTotalSecondsRef.current = sec;
      setCountdown(sec);
      setPrimaryLabel("Stop");
      pausedRef.current = false;
      setPausedUi(false);

      const el = videoRef.current;
      if (el) {
        el.loop = true;
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }

      void tryPlayMedia();

      tickRef.current = setInterval(() => {
        if (pausedRef.current) return;
        remainingRef.current -= 1;
        setCountdown(remainingRef.current);
        if (remainingRef.current <= 0) {
          pauseMedia();
          afterWorkSlice(video);
        }
      }, 1000);
    },
    [afterWorkSlice, clearTick, pauseMedia, tryPlayMedia],
  );

  const openVideo = useCallback(
    (video: FitnessVideo) => {
      clearTick();
      resetMedia();
      setSessionFinished(null);
      setActiveVideo(video);
      roundsDone.current = 0;
      const sec = workoutRoundSeconds(video);
      remainingRef.current = sec;
      roundTotalSecondsRef.current = sec;
      setCountdown(sec);
      setPrimaryLabel("Start");
      pausedRef.current = false;
      setPausedUi(false);
      setRestPhase(false);
      setPlayNeedsGesture(false);
    },
    [clearTick, resetMedia],
  );

  const onPrimary = useCallback(() => {
    if (!activeVideo || sessionFinished) return;
    const video = activeVideo;

    if (restPhase) {
      return;
    }

    if (primaryLabel === "Start") {
      startWorkSlice(video);
      return;
    }

    if (primaryLabel === "Stop") {
      pausedRef.current = !pausedRef.current;
      setPausedUi(pausedRef.current);
      if (pausedRef.current) {
        pauseMedia();
      } else {
        void tryPlayMedia();
      }
    }
  }, [
    activeVideo,
    primaryLabel,
    restPhase,
    sessionFinished,
    pauseMedia,
    tryPlayMedia,
    startWorkSlice,
  ]);

  const onTapVideoOverlay = useCallback(() => {
    void tryPlayMedia();
  }, [tryPlayMedia]);

  const onUnmute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    setVideoMuted(false);
    void el.play().catch(() => setPlayNeedsGesture(true));
  }, []);

  /* Short clips: keep looping during round; if browser fires `ended` without loop, restart */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideo || sessionFinished) return;
    const onEnded = () => {
      if (!primaryLabel || primaryLabel !== "Stop" || restPhase || pausedRef.current) return;
      try {
        el.currentTime = 0;
        void el.play().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [activeVideo, primaryLabel, restPhase, sessionFinished]);

  let body: ReactNode;

  if (loading) {
    body = (
      <div className="fitness-videos__loading" role="status">
        <div className="fitness-videos__spinner" aria-hidden />
      </div>
    );
  } else if (error || videos.length === 0) {
    body = (
      <p className="fitness-videos__empty">{error ?? "No videos for this workout."}</p>
    );
  } else if (activeVideo) {
    const src = resolveFitnessVideoUrl(activeVideo.video);
    const totalR = totalRoundsFor(activeVideo);
    const completedRounds = Math.min(roundsDone.current, totalR);
    const clock = formatFitnessClock(countdown);
    const totalSec = roundTotalSecondsRef.current || workoutRoundSeconds(activeVideo);
    const workProgress =
      !restPhase && primaryLabel === "Stop" && totalSec > 0
        ? Math.min(1, Math.max(0, (totalSec - countdown) / totalSec))
        : 0;

    const buttonText =
      primaryLabel === "Stop" && pausedUi
        ? "Resume"
        : restPhase
          ? `${formatFitnessClock(countdown)} rest`
          : primaryLabel;

    const showPauseOverlay =
      !sessionFinished &&
      !restPhase &&
      primaryLabel === "Stop" &&
      (pausedUi || playNeedsGesture);

    const ringCirc = 2 * Math.PI * 54;
    const ringDash = ringCirc * (1 - workProgress);

    body = (
      <div className="fitness-player">
        <div className="fitness-player__video-shell">
          <video
            ref={videoRef}
            className="fitness-player__video fitness-player__video--chromeless"
            src={src}
            playsInline
            preload="auto"
            disablePictureInPicture
            controls={false}
            muted={videoMuted}
            loop
          >
            <track kind="captions" />
          </video>
          {showPauseOverlay ? (
            <button
              type="button"
              className="fitness-player__overlay"
              aria-label={playNeedsGesture ? "Tap to play video" : "Video paused"}
              onClick={() => {
                if (playNeedsGesture) {
                  onTapVideoOverlay();
                  return;
                }
                pausedRef.current = false;
                setPausedUi(false);
                void tryPlayMedia();
              }}
            >
              {playNeedsGesture ? (
                <>
                  <span className="fitness-player__overlay-icon fitness-player__overlay-icon--play" />
                  <span className="fitness-player__overlay-text">Tap to play video</span>
                </>
              ) : (
                <>
                  <span className="fitness-player__overlay-icon fitness-player__overlay-icon--pause" />
                  <span className="fitness-player__overlay-text">Paused</span>
                </>
              )}
            </button>
          ) : null}
          {videoMuted && primaryLabel === "Stop" && !restPhase && !sessionFinished ? (
            <button type="button" className="fitness-player__unmute" onClick={onUnmute}>
              Tap for sound
            </button>
          ) : null}
        </div>

        <h2 className="fitness-player__name">{activeVideo.name}</h2>

        {!sessionFinished ? (
          <>
            <div className="fitness-player__dots" aria-hidden>
              {Array.from({ length: totalR }, (_, i) => {
                const done = i < completedRounds;
                const current =
                  !restPhase &&
                  primaryLabel === "Stop" &&
                  !pausedUi &&
                  i === completedRounds;
                return (
                  <span
                    key={i}
                    className={`fitness-player__dot${done ? " fitness-player__dot--done" : ""}${current ? " fitness-player__dot--current" : ""}`}
                  />
                );
              })}
            </div>
            <p className="fitness-player__rounds-meta">
              {restPhase
                ? `Rest · next round ${Math.min(completedRounds + 1, totalR)} of ${totalR}`
                : `Round ${Math.min(completedRounds + 1, totalR)} of ${totalR}`}
              {activeVideo.reps != null || activeVideo.sets != null ? (
                <span className="fitness-player__rs">
                  {activeVideo.reps != null ? ` · ${activeVideo.reps} reps` : ""}
                  {activeVideo.sets != null ? ` · ${activeVideo.sets} sets` : ""}
                </span>
              ) : null}
            </p>
          </>
        ) : null}

        {!restPhase ? (
          !sessionFinished ? (
            <p className="fitness-player__rounds fitness-player__rounds--compact">
              {primaryLabel === "Start" ? "Press Start to begin" : "Stay with the timer"}
            </p>
          ) : null
        ) : (
          <p className="fitness-player__rounds fitness-player__rounds--rest">Rest between rounds</p>
        )}

        {!sessionFinished ? (
          <div className="fitness-player__ring-wrap">
            <div className="fitness-player__ring-svg" aria-hidden>
              <svg width="176" height="176" viewBox="0 0 120 120">
                <circle
                  className="fitness-player__ring-bg"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  strokeWidth="8"
                />
                {!restPhase && primaryLabel === "Stop" ? (
                  <circle
                    className="fitness-player__ring-progress"
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    strokeWidth="8"
                    strokeDasharray={`${ringCirc}`}
                    strokeDashoffset={ringDash}
                    transform="rotate(-90 60 60)"
                  />
                ) : null}
              </svg>
              <div
                className={`fitness-player__ring-inner${restPhase ? " fitness-player__ring-inner--rest" : ""}`}
              >
                <span className="fitness-player__count">{clock}</span>
              </div>
            </div>
          </div>
        ) : null}

        {sessionFinished ? (
          <section className="fitness-player__done" aria-live="polite">
            <div className="fitness-player__done-check" aria-hidden>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8 12.5l2.5 2.5L16 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="fitness-player__done-title">Workout complete</h3>
            <p className="fitness-player__done-text">
              {sessionFinished.rounds} round{sessionFinished.rounds === 1 ? "" : "s"} ·{" "}
              <strong>{sessionFinished.videoName}</strong>
            </p>
            {sessionFinished.kcal != null ? (
              <p className="fitness-player__done-kcal">~{String(sessionFinished.kcal)} kcal</p>
            ) : null}
            <button
              type="button"
              className="fitness-player__done-btn"
              disabled={completeSubmitting}
              onClick={() => void onCompleteGoFitness()}
            >
              {completeSubmitting ? "Saving…" : "Complete"}
            </button>
          </section>
        ) : (
          <>
            <p className="fitness-player__state">
              {restPhase ? "Rest" : pausedUi ? "Paused" : primaryLabel === "Stop" ? "Go" : "Ready"}
            </p>
            <button
              type="button"
              className={`fitness-player__btn${restPhase ? " fitness-player__btn--muted" : ""}`}
              disabled={restPhase}
              onClick={onPrimary}
            >
              {buttonText}
            </button>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <>
        <div
          className="fitness-videos__hero"
          style={
            heroImage
              ? {
                  backgroundImage: `linear-gradient(180deg,rgba(15,23,42,.55),rgba(15,23,42,.78)), url(${heroImage})`,
                }
              : undefined
          }
        >
          <h2 className="fitness-videos__hero-title">{headerTitle}</h2>
        </div>
        <ul className="fitness-videos__list">
          {videos.map((v, idx) => (
            <li key={v.id != null ? String(v.id) : `${v.name}-${idx}`}>
              <button
                type="button"
                className="fitness-videos__row"
                onClick={() => openVideo(v)}
              >
                <div className="fitness-videos__thumb" aria-hidden>
                  <span className="fitness-videos__play" />
                </div>
                <div className="fitness-videos__meta">
                  <span className="fitness-videos__video-title">{v.name}</span>
                  <span className="fitness-videos__stats">
                    {v.cal != null ? (
                      <span className="fitness-videos__kcal">{String(v.cal)} kcal</span>
                    ) : null}
                    {v.reps != null ? (
                      <span className="fitness-videos__reps">
                        {v.cal != null ? " · " : ""}Reps {v.reps}
                      </span>
                    ) : null}
                    {v.sets != null ? (
                      <span className="fitness-videos__sets"> · Sets {v.sets}</span>
                    ) : null}
                  </span>
                  <span className="fitness-videos__time">
                    {formatFitnessVideoDurationLabel(v.time)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="fitness-videos-page">
      <header className="dd-screen-header fitness-videos-page__header">
        <button
          type="button"
          className="app-back-btn dd-screen-header__back"
          aria-label="Back"
          onClick={() => {
            if (activeVideo) {
              closePlayer();
              return;
            }
            navigate(ROUTES.fitness);
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="dd-screen-header__title">
          {activeVideo ? activeVideo.name : headerTitle}
        </h1>
      </header>
      <main className="fitness-videos-page__main">{body}</main>
    </div>
  );
}
