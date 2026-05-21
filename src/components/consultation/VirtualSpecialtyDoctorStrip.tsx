import { doctorImageUrl, type SpecialityDoctor } from "@/api/consultationVirtual";
import { useCallback, useEffect, useRef } from "react";
import "./VirtualSpecialtyDoctorStrip.css";

const PAUSE_BETWEEN_MS = 800;
const MIN_DURATION_MS = 500;
const MAX_DURATION_MS = 6000;
const MS_PER_PX = 20;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function scrollDurationMs(distance: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, distance * MS_PER_PX));
}

function doctorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Dr";
  const first = parts[0].replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s*/i, "");
  if (!first) {
    return parts.length > 1 ? parts[1].slice(0, 1).toUpperCase() : "D";
  }
  if (parts.length === 1) return first.slice(0, 1).toUpperCase();
  return `${first.slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function DoctorChip({ doctor }: Readonly<{ doctor: SpecialityDoctor }>) {
  const imgUrl = doctorImageUrl(doctor);
  const subtitle =
    doctor.qualification?.trim() ||
    doctor.speciality?.name?.trim() ||
    "";
  const isFemale = (doctor.gender ?? "").toLowerCase() === "female";

  return (
    <div className="csp-doc-strip__chip">
      {imgUrl ? (
        <img
          src={imgUrl}
          alt=""
          className="csp-doc-strip__avatar"
          width={36}
          height={36}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className={`csp-doc-strip__avatar csp-doc-strip__avatar--fallback${isFemale ? " csp-doc-strip__avatar--female" : ""}`}
          aria-hidden
        >
          {doctorInitials(doctor.name)}
        </span>
      )}
      <span className="csp-doc-strip__chip-text">
        <span className="csp-doc-strip__name">{doctor.name}</span>
        {subtitle ? <span className="csp-doc-strip__qual">{subtitle}</span> : null}
      </span>
    </div>
  );
}

export type VirtualSpecialtyDoctorStripProps = Readonly<{
  loading: boolean;
  doctors: readonly SpecialityDoctor[];
}>;

export function VirtualSpecialtyDoctorStrip({ loading, doctors }: VirtualSpecialtyDoctorStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const forwardRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  const cancelAutoScroll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pauseTimerRef.current != null) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (startTimerRef.current != null) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  }, []);

  const maxScrollLeft = useCallback((el: HTMLDivElement) => {
    return Math.max(0, el.scrollWidth - el.clientWidth);
  }, []);

  const animateScrollTo = useCallback(
    (el: HTMLDivElement, target: number, onDone: () => void) => {
      const from = el.scrollLeft;
      const distance = Math.abs(target - from);
      if (distance < 1) {
        el.scrollLeft = target;
        onDone();
        return;
      }

      const duration = scrollDurationMs(distance);
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        el.scrollLeft = from + (target - from) * easeInOutCubic(t);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          el.scrollLeft = target;
          onDone();
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [],
  );

  const runAutoScrollCycle = useCallback(() => {
    const el = scrollRef.current;
    if (!el || pausedRef.current) return;

    const max = maxScrollLeft(el);
    if (max <= 0) return;

    const target = forwardRef.current ? max : 0;
    animateScrollTo(el, target, () => {
      if (pausedRef.current) return;
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (pausedRef.current) return;
        forwardRef.current = !forwardRef.current;
        runAutoScrollCycle();
      }, PAUSE_BETWEEN_MS);
    });
  }, [animateScrollTo, maxScrollLeft]);

  const startAutoScroll = useCallback(() => {
    cancelAutoScroll();
    pausedRef.current = false;
    forwardRef.current = true;

    const el = scrollRef.current;
    if (!el) return;

    el.scrollLeft = 0;

    startTimerRef.current = setTimeout(() => {
      startTimerRef.current = null;
      runAutoScrollCycle();
    }, 120);
  }, [cancelAutoScroll, runAutoScrollCycle]);

  const pauseForUserScroll = useCallback(() => {
    pausedRef.current = true;
    cancelAutoScroll();
  }, [cancelAutoScroll]);

  useEffect(() => {
    if (loading || doctors.length === 0) {
      cancelAutoScroll();
      return;
    }

    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return;
    }

    startAutoScroll();
    return cancelAutoScroll;
  }, [loading, doctors, startAutoScroll, cancelAutoScroll]);

  if (loading) {
    return (
      <div className="csp-doc-strip csp-doc-strip--loading" aria-busy="true">
        <div className="csp-doc-strip__spinner" />
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <p className="csp-doc-strip csp-doc-strip--empty">No doctors found</p>
    );
  }

  return (
    <section className="csp-doc-strip" aria-label="Available doctors">
      <header className="csp-doc-strip__head">
        <span className="csp-doc-strip__head-ic" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="csp-doc-strip__head-title">Available Doctors</span>
        <span className="csp-doc-strip__head-count">{doctors.length} found</span>
      </header>
      <div
        ref={scrollRef}
        className="csp-doc-strip__scroll"
        onPointerDown={pauseForUserScroll}
        onWheel={pauseForUserScroll}
        onTouchStart={pauseForUserScroll}
      >
        {doctors.map((doctor) => (
          <DoctorChip key={doctor.id} doctor={doctor} />
        ))}
      </div>
      <p className="csp-doc-strip__hint">
        <span className="csp-doc-strip__hint-ic" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 10v6M12 7h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        We will assign a doctor from the list above
      </p>
    </section>
  );
}
