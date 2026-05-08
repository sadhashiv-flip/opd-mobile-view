import { useCallback, useEffect, useRef, useState } from "react";

/** Same window as Flutter `listenFor` (~10s). */
const LISTEN_DURATION_MS = 10_000;

/** Minimal Web Speech API surface — mutable props match browser {@link SpeechRecognition}. */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionResultLike = Readonly<{
  results: ArrayLike<{ 0?: { transcript?: string } }>;
}>;

type SpeechRecognitionErrorLike = Readonly<{ error: string }>;

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof globalThis.window === "undefined") return null;
  const w = globalThis.window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export type WebSpeechErrorCode = string | "not-supported" | "start-failed";

type UseWebSpeechRecognitionOptions = Readonly<{
  /** Called with accumulated transcript (interim + final), same idea as Flutter `onResult`. */
  onTranscript: (text: string) => void;
  /** BCP-47 tag; defaults to `navigator.language`. */
  lang?: string;
  onError?: (code: WebSpeechErrorCode) => void;
}>;

/**
 * Browser speech-to-text for dashboard voice search — analogous to Flutter `speech_to_text` +
 * `AppSearchController._startListening` / `_stopListening`.
 */
export function useWebSpeechRecognition({
  onTranscript,
  lang,
  onError,
}: UseWebSpeechRecognitionOptions) {
  const [supported] = useState(isSpeechRecognitionSupported);
  const [listening, setListening] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const clearListenTimer = useCallback(() => {
    if (stopTimerRef.current != null) {
      globalThis.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearListenTimer();
    const r = recRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        try {
          r.abort();
        } catch {
          /* ignore */
        }
      }
      recRef.current = null;
    }
    setListening(false);
  }, [clearListenTimer]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.("not-supported");
      return;
    }

    clearListenTimer();
    const prev = recRef.current;
    if (prev) {
      try {
        prev.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }

    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      onError?.("start-failed");
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang =
      lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");

    recognition.onresult = (event: SpeechRecognitionResultLike) => {
      if (recRef.current !== recognition) return;
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0]?.transcript ?? "";
      }
      onTranscriptRef.current(text.trimStart());
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      if (recRef.current !== recognition) return;
      if (event.error === "aborted") return;
      onError?.(event.error);
      clearListenTimer();
      recRef.current = null;
      setListening(false);
    };

    recognition.onend = () => {
      if (recRef.current !== recognition) return;
      clearListenTimer();
      recRef.current = null;
      setListening(false);
    };

    try {
      recognition.start();
      recRef.current = recognition;
      setListening(true);
      stopTimerRef.current = globalThis.setTimeout(() => {
        try {
          recognition.stop();
        } catch {
          try {
            recognition.abort();
          } catch {
            /* ignore */
          }
        }
      }, LISTEN_DURATION_MS);
    } catch {
      recRef.current = null;
      setListening(false);
      onError?.("start-failed");
    }
  }, [clearListenTimer, lang, onError]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  useEffect(() => () => {
    clearListenTimer();
    const r = recRef.current;
    if (r) {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
  }, [clearListenTimer]);

  return { supported, listening, start, stop, toggle };
}
