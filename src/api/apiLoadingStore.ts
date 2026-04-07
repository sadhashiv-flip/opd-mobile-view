/** Ref-counted pending state for global API loading UI (incremented in `patientHttp`). */

let pending = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

export function subscribeApiLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiLoadingPendingCount(): number {
  return pending;
}

export function beginApiLoadingRequest(): void {
  pending += 1;
  notify();
}

export function endApiLoadingRequest(): void {
  pending = Math.max(0, pending - 1);
  notify();
}
