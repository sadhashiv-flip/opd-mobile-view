import { useCallback, useEffect, useRef } from "react";

export type SignalingWebSocketHandlers = Readonly<{
  onOpen?: () => void;
  onMessage?: (raw: string) => void;
  onError?: (ev: Event) => void;
  onClose?: (ev: CloseEvent) => void;
}>;

/**
 * Minimal WebSocket wrapper for JSON signaling (video consult parity with Angular).
 * Handlers are read from a ref so callers can update logic without reconnecting.
 */
export function useSignalingWebSocket(
  url: string | null | undefined,
  handlers: SignalingWebSocketHandlers,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => handlersRef.current.onOpen?.();
    ws.onmessage = (ev) => handlersRef.current.onMessage?.(String(ev.data));
    ws.onerror = (ev) => handlersRef.current.onError?.(ev);
    ws.onclose = (ev) => handlersRef.current.onClose?.(ev);
    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [url]);

  const sendJson = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      ws.close();
    } catch {
      // ignore
    }
    wsRef.current = null;
  }, []);

  return { sendJson, closeSocket, wsRef };
}
