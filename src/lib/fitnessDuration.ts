import type { FitnessVideo } from "@/api/patientFitness";

/**
 * Per-round timer length — patient-webapp uses {@code video.time} directly as the countdown
 * (seconds), not minutes × 60 ({@code fitnessby-id.component.ts}: {@code this.countdown = rep.time}).
 */
export function workoutRoundSeconds(video: FitnessVideo): number {
  const t = Number(video.time);
  if (!Number.isFinite(t) || t <= 0) return 30;
  return Math.min(Math.max(1, Math.round(t)), 24 * 3600);
}

/** Total work rounds: {@code reps × sets} when both exist (e.g. 3 × 4); else {@code reps}; else 1. */
export function fitnessTotalRounds(video: FitnessVideo): number {
  const r = Number(video.reps);
  const s = Number(video.sets);
  const repsOk = Number.isFinite(r) && r > 0;
  const setsOk = Number.isFinite(s) && s > 0;
  if (repsOk && setsOk) return Math.floor(r) * Math.floor(s);
  if (repsOk) return Math.floor(r);
  return 1;
}

/** `MM:SS` / `H:MM:SS` for the workout ring. */
export function formatFitnessClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** List row — API {@code time} is seconds in reference app timer. */
export function formatFitnessVideoDurationLabel(time: unknown): string {
  const t = Number(time);
  if (!Number.isFinite(t) || t <= 0) return "";
  if (t < 60) return `${Math.round(t)} sec`;
  if (t < 3600) return `${Math.round(t / 60)} min`;
  const hrs = Math.floor(t / 3600);
  const mins = Math.round((t % 3600) / 60);
  return `${hrs}h ${mins}m`;
}
