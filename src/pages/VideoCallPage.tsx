import {
  fetchCallChatMessages,
  patchEndCall,
  patchJoinCall,
  postCallChatText,
  postCallChatUploadPayload,
  postCallFeedback,
} from "@/api/callApi";
import { mapAndSortThreadMessages, normalizeThreadMessage, type SupportTicketThreadMessage } from "@/api/supportTicket";
import { uploadSupportDocumentFile } from "@/api/patientUpload";
import { FEEDBACK_RATINGS, FEEDBACK_RATING_LABELS } from "@/components/support/SupportTicketFeedbackDialog";
import "@/components/support/SupportFeedbackSheet.css";
import { SupportTicketChatMessageList } from "@/components/support/SupportTicketChatMessageList";
import {
  SupportTicketChatComposer,
  type SupportChatDraftAttachment,
} from "@/components/support/SupportTicketChatComposer";
import { ROUTES } from "@/constants";
import { useSignalingWebSocket } from "@/hooks/useSignalingWebSocket";
import { useToast } from "@/hooks/useToast";
import "@/pages/SupportTicketChatPage.css";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./VideoCallPage.css";

const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  audio: true,
  video: { width: 720, height: 540 },
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

const PIP_EDGE_PAD = 12;
/** Clearance from bottom of stage to PiP bottom (matches previous fixed layout). */
const PIP_ABOVE_TOOLBAR = 88;

function clampNum(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clampPipInStage(
  stageW: number,
  stageH: number,
  pipW: number,
  pipH: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const pad = PIP_EDGE_PAD;
  const maxX = Math.max(pad, stageW - pipW - pad);
  const maxY = Math.max(pad, stageH - pipH - pad);
  return {
    x: clampNum(x, pad, maxX),
    y: clampNum(y, pad, maxY),
  };
}

function defaultPipBottomRight(
  stageW: number,
  stageH: number,
  pipW: number,
  pipH: number,
): { x: number; y: number } {
  const pad = PIP_EDGE_PAD;
  return clampPipInStage(stageW, stageH, pipW, pipH, stageW - pipW - pad, stageH - pipH - PIP_ABOVE_TOOLBAR);
}

/** Upper band of stage → snap to top-left or top-right from horizontal position; otherwise nearest corner. */
function snapPipRelease(
  stageW: number,
  stageH: number,
  pipW: number,
  pipH: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const pad = PIP_EDGE_PAD;
  const { x: cx, y: cy } = clampPipInStage(stageW, stageH, pipW, pipH, x, y);
  const maxX = Math.max(pad, stageW - pipW - pad);
  const maxY = Math.max(pad, stageH - pipH - pad);
  const topBandH = stageH * 0.2;
  if (cy < topBandH) {
    const midX = stageW / 2;
    const pipCx = cx + pipW / 2;
    return pipCx < midX ? { x: pad, y: pad } : { x: maxX, y: pad };
  }
  const corners = [
    { x: pad, y: pad },
    { x: maxX, y: pad },
    { x: pad, y: maxY },
    { x: maxX, y: maxY },
  ];
  const pCx = cx + pipW / 2;
  const pCy = cy + pipH / 2;
  let best = corners[0];
  let bestD = Infinity;
  for (const c of corners) {
    const d = (pCx - (c.x + pipW / 2)) ** 2 + (pCy - (c.y + pipH / 2)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const TOOL_ICON_SVG = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
} as const;

function IconMicOn() {
  return (
    <svg {...TOOL_ICON_SVG}>
      <path
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M9 23h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg {...TOOL_ICON_SVG}>
      <path
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity={0.45}
      />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M9 23h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity={0.45} />
      <path d="M2 2l20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconCamOn() {
  return (
    <svg {...TOOL_ICON_SVG} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="14" r="4" />
    </svg>
  );
}

function IconCamOff() {
  return (
    <svg {...TOOL_ICON_SVG} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" opacity={0.45} />
      <circle cx="12" cy="14" r="4" opacity={0.45} />
      <path d="M2 2l20 20" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg {...TOOL_ICON_SVG}>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSwitchCamera() {
  return (
    <svg {...TOOL_ICON_SVG} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/** End call — classic handset curve (phone shape), oriented downward like “hang up”. */
function IconPhoneHangUp() {
  return (
    <svg {...TOOL_ICON_SVG} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <g transform="translate(12 12.25) scale(1 -1) translate(-12 -12.25)">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </g>
    </svg>
  );
}

function getSocketUrl(): string | null {
  const raw = import.meta.env.VITE_SOCKET_URL;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim();
}

function joinEnvelope(roomSourceId: string) {
  return { status: 1, type: "JOIN", source: "ROOM", sourceId: roomSourceId };
}

function rtcMessageEnvelope(roomSourceId: string, data: Record<string, unknown>) {
  return {
    type: "MESSAGE",
    source: "ROOM",
    sourceId: roomSourceId,
    status: 1,
    data,
  };
}

function leaveEnvelope(roomSourceId: string) {
  return { type: "LEAVE", sourceId: roomSourceId };
}

function normalizeSessionDescription(raw: unknown): RTCSessionDescriptionInit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sdp = typeof o.sdp === "string" ? o.sdp : null;
  const type = o.type === "offer" || o.type === "answer" ? o.type : null;
  if (sdp && type) return { type, sdp };
  return null;
}

function normalizeCandidate(raw: unknown): RTCIceCandidateInit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.candidate === "string") {
    return {
      candidate: o.candidate,
      sdpMid: typeof o.sdpMid === "string" ? o.sdpMid : undefined,
      sdpMLineIndex: typeof o.sdpMLineIndex === "number" ? o.sdpMLineIndex : undefined,
    };
  }
  return null;
}

function formatInboundChatPayload(data: Record<string, unknown>): string {
  const content = data.content;
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    const msg = c.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    if (msg && typeof msg === "object") {
      const m = msg as Record<string, unknown>;
      if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
      if (typeof m.body === "string" && m.body.trim()) return m.body.trim();
    }
    const t = c.type;
    if (t === "IMG" || t === "PDF") return `[${String(t)}]`;
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  return "";
}

function mediaErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "SECURE_CONTEXT_REQUIRED") {
      return "Camera and microphone need a secure connection. Open this page over https (or use localhost).";
    }
    if (err.message === "MEDIADEVICES_UNSUPPORTED") {
      return "This browser does not support in-browser camera and microphone.";
    }
  }
  if (!err || typeof err !== "object") return "Could not access camera or microphone.";
  const name = (err as DOMException).name;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera or microphone was found. If access is blocked, allow camera and microphone for this site in your browser settings, then try again.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Permission denied. Allow camera and microphone to join the call.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera or microphone is already in use.";
  }
  return "Could not access camera or microphone.";
}

/** `navigator.mediaDevices` is missing on insecure http (except localhost) and some WebViews. */
function getUserMediaCompat(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof navigator === "undefined") {
    return Promise.reject(new Error("MEDIADEVICES_UNSUPPORTED"));
  }
  const md = navigator.mediaDevices;
  if (md?.getUserMedia) {
    return md.getUserMedia(constraints);
  }
  const nav = navigator as Navigator & {
    getUserMedia?: (
      c: MediaStreamConstraints,
      success: (s: MediaStream) => void,
      failure: (e: unknown) => void,
    ) => void;
  };
  if (typeof nav.getUserMedia === "function") {
    return new Promise((resolve, reject) => {
      nav.getUserMedia!.call(navigator, constraints, resolve, reject);
    });
  }
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return Promise.reject(new Error("SECURE_CONTEXT_REQUIRED"));
    }
  }
  return Promise.reject(new Error("MEDIADEVICES_UNSUPPORTED"));
}

function shouldRetryMediaAcquisition(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.message === "SECURE_CONTEXT_REQUIRED" || err.message === "MEDIADEVICES_UNSUPPORTED") {
      return false;
    }
  }
  return true;
}

type MediaHardBlock = "secure" | "unsupported";

function classifyMediaHardBlock(err: unknown): MediaHardBlock | null {
  if (err instanceof Error) {
    if (err.message === "SECURE_CONTEXT_REQUIRED") return "secure";
    if (err.message === "MEDIADEVICES_UNSUPPORTED") return "unsupported";
  }
  return null;
}

/** Same path/port as now, but https — works after `npm run dev:https` (or any TLS front-end). */
function suggestedHttpsUrl(): string {
  if (typeof window === "undefined") return "";
  const { hostname, port, pathname, search, protocol } = window.location;
  if (protocol === "https:") return "";
  const p = port ? `:${port}` : "";
  return `https://${hostname}${p}${pathname}${search}`;
}

/** When opened via LAN IP, localhost is still a secure context for media on most browsers. */
function suggestedLocalhostDevUrl(): string | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname, port, pathname, search } = window.location;
  if (protocol !== "http:") return null;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  const p = port ? `:${port}` : "";
  return `http://localhost${p}${pathname}${search}`;
}

function newVideoChatAttachmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `vatt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function extractCallChatMessages(body: unknown): SupportTicketThreadMessage[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { messages?: unknown }).messages)
      ? (body as { messages: unknown[] }).messages
      : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
        ? (body as { data: unknown[] }).data
        : [];
  return mapAndSortThreadMessages(rows);
}

function asRecordLoose(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function mergeChatMessage(prev: SupportTicketThreadMessage[], next: SupportTicketThreadMessage): SupportTicketThreadMessage[] {
  if (prev.some((x) => x.id === next.id)) return prev;
  const merged = [...prev, next];
  merged.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  });
  return merged;
}

/** WebSocket / nested payloads: same row shape as REST, or legacy text-only envelopes. */
function messageFromSocketChatPayload(data: Record<string, unknown>): SupportTicketThreadMessage | null {
  const candidates: Record<string, unknown>[] = [data];
  const c = asRecordLoose(data.content);
  const d = asRecordLoose(data.data);
  const p = asRecordLoose(data.payload);
  if (c) candidates.push(c);
  if (d) candidates.push(d);
  if (p) candidates.push(p);

  let i = 0;
  for (const row of candidates) {
    const m = normalizeThreadMessage(row, i);
    i += 1;
    if (m) return m;
  }

  const text = formatInboundChatPayload(data);
  if (!text.trim()) return null;

  const idRaw = data.id;
  const id = typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw) : `rx-${Date.now()}`;
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString();
  const outgoing = String(data.user_type ?? data.userType ?? "").toLowerCase() === "patient";

  return {
    id,
    text: text.trim(),
    createdAt,
    outgoing,
    senderName: null,
    messageType: "TXT",
    attachments: [],
  };
}

export function VideoCallPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { appointmentId: appointmentIdParam } = useParams<{ appointmentId: string }>();
  const appointmentId = appointmentIdParam?.trim() ?? "";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const localWrapRef = useRef<HTMLDivElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const chatOpenRef = useRef(false);

  const socketUrl = useMemo(() => getSocketUrl(), []);

  const httpsSuggestion = useMemo(() => suggestedHttpsUrl(), [appointmentId]);
  const localhostAlternateUrl = useMemo(() => suggestedLocalhostDevUrl(), [appointmentId]);

  const [streamReady, setStreamReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaHardBlock, setMediaHardBlock] = useState<MediaHardBlock | null>(null);
  const [secureHelpFeedback, setSecureHelpFeedback] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<SupportTicketThreadMessage[]>([]);
  const chatListEndRef = useRef<HTMLDivElement | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<SupportChatDraftAttachment[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [techRating, setTechRating] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  /** Pixel offset of local PiP within {@link stageRef}; `null` = CSS default (bottom-right). */
  const [localPipPos, setLocalPipPos] = useState<{ x: number; y: number } | null>(null);
  const localPipPosRef = useRef<{ x: number; y: number } | null>(null);
  const pipDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const pipWindowListenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);
  const pipDragRafRef = useRef<number | null>(null);
  const pipDragPendingRef = useRef<{ x: number; y: number } | null>(null);
  const [pipDragging, setPipDragging] = useState(false);

  const sendJsonRef = useRef<(p: unknown) => void>(() => {});
  const mediaAcquireInFlight = useRef(false);
  const requestLocalMediaRef = useRef<() => void>(() => {});

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const batch = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of batch) {
      try {
        await pc.addIceCandidate(c);
      } catch (e) {
        console.warn("[video] addIceCandidate", e);
      }
    }
  }, []);

  const teardownPeer = useCallback(() => {
    pendingIceRef.current = [];
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setHasRemoteVideo(false);
  }, []);

  const addIceSafe = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn("[video] addIceCandidate", e);
      }
    },
    [],
  );

  const attachLocalToPeer = useCallback(() => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return;
    const existing = new Set(pc.getSenders().map((s) => s.track).filter(Boolean));
    for (const track of stream.getTracks()) {
      if (!existing.has(track)) {
        pc.addTrack(track, stream);
      }
    }
  }, []);

  const sendOfferFromPeer = useCallback(
    (sendJson: (p: unknown) => void) => {
      const pc = pcRef.current;
      if (!pc) return;
      void (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const loc = pc.localDescription;
          if (!loc) return;
          sendJson(
            rtcMessageEnvelope(appointmentId, {
              type: "offer",
              sessionDescription: { type: loc.type, sdp: loc.sdp },
            }),
          );
        } catch (e) {
          console.warn("[video] createOffer", e);
          setConnError("Could not start the video call.");
        }
      })();
    },
    [appointmentId],
  );

  const ensurePeerAndOffer = useCallback(
    (sendJson: (p: unknown) => void) => {
      if (!localStreamRef.current) return;
      if (pcRef.current && pcRef.current.signalingState !== "closed") {
        sendOfferFromPeer(sendJson);
        return;
      }
      teardownPeer();
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        sendJson(
          rtcMessageEnvelope(appointmentId, {
            type: "iceCandidate",
            candidate: ev.candidate.toJSON(),
          }),
        );
      };
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (stream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          setHasRemoteVideo(true);
        }
      };
      attachLocalToPeer();
      sendOfferFromPeer(sendJson);
    },
    [appointmentId, attachLocalToPeer, sendOfferFromPeer, teardownPeer],
  );

  const handleNestedMessage = useCallback(
    async (data: Record<string, unknown>, sendJson: (p: unknown) => void) => {
      const t = typeof data.type === "string" ? data.type : "";
      if (t === "offer") {
        const sd =
          normalizeSessionDescription(data.sessionDescription) ??
          normalizeSessionDescription(data);
        if (!sd) return;
        if (!localStreamRef.current) return;

        if (!pcRef.current || pcRef.current.signalingState === "closed") {
          teardownPeer();
          const pc = new RTCPeerConnection(ICE_SERVERS);
          pcRef.current = pc;
          pc.onicecandidate = (ev) => {
            if (!ev.candidate) return;
            sendJson(
              rtcMessageEnvelope(appointmentId, {
                type: "iceCandidate",
                candidate: ev.candidate.toJSON(),
              }),
            );
          };
          pc.ontrack = (ev) => {
            const [stream] = ev.streams;
            if (stream && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              setHasRemoteVideo(true);
            }
          };
          attachLocalToPeer();
        }
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(sd);
          await flushPendingIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          const loc = pc.localDescription;
          if (loc) {
            sendJson(
              rtcMessageEnvelope(appointmentId, {
                type: "answer",
                sessionDescription: { type: loc.type, sdp: loc.sdp },
              }),
            );
          }
        } catch (e) {
          console.warn("[video] handle offer", e);
          setConnError("Could not connect to the other party.");
        }
        return;
      }

      if (t === "answer") {
        const sd =
          normalizeSessionDescription(data.sessionDescription) ??
          normalizeSessionDescription(data);
        const pc = pcRef.current;
        if (!pc || !sd) return;
        try {
          await pc.setRemoteDescription(sd);
          await flushPendingIce();
        } catch (e) {
          console.warn("[video] handle answer", e);
        }
        return;
      }

      if (t === "iceCandidate") {
        const cand = normalizeCandidate(data.candidate) ?? normalizeCandidate(data);
        if (cand) await addIceSafe(cand);
        return;
      }

      if (t === "message") {
        const m = messageFromSocketChatPayload(data);
        if (!m) return;
        setChatMessages((prev) => mergeChatMessage(prev, m));
        setUnreadChat((u) => (chatOpenRef.current ? u : u + 1));
      }
    },
    [addIceSafe, appointmentId, attachLocalToPeer, flushPendingIce, teardownPeer],
  );

  const handleTopLevel = useCallback(
    (msg: Record<string, unknown>, sendJson: (p: unknown) => void) => {
      const t = typeof msg.type === "string" ? msg.type : "";
      switch (t) {
        case "USER-JOINED":
          ensurePeerAndOffer(sendJson);
          break;
        case "MESSAGE": {
          const inner = msg.data;
          if (inner && typeof inner === "object") {
            void handleNestedMessage(inner as Record<string, unknown>, sendJson);
          }
          break;
        }
        case "LEAVE":
          teardownPeer();
          break;
        case "CONNECTION":
          sendJson(joinEnvelope(appointmentId));
          break;
        case "bye": {
          const stream = localStreamRef.current;
          stream?.getTracks().forEach((track) => {
            void track.stop();
          });
          teardownPeer();
          break;
        }
        case "keepalive":
          break;
        default:
          break;
      }
    },
    [appointmentId, ensurePeerAndOffer, handleNestedMessage, teardownPeer],
  );

  const { sendJson, closeSocket } = useSignalingWebSocket(
    streamReady && appointmentId && socketUrl ? socketUrl : null,
    {
      onOpen: () => {
        try {
          sendJsonRef.current(joinEnvelope(appointmentId));
        } catch (e) {
          setConnError(e instanceof Error ? e.message : "Could not signal join.");
        }
      },
      onMessage: (raw) => {
        try {
          const msg = JSON.parse(raw) as unknown;
          if (!msg || typeof msg !== "object") return;
          handleTopLevel(msg as Record<string, unknown>, sendJsonRef.current);
        } catch {
          console.warn("[video] non-json signaling", raw);
        }
      },
    },
  );

  sendJsonRef.current = sendJson;

  useEffect(() => {
    if (!appointmentId || showFeedback) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const cleanupStream = () => {
      const s = localStreamRef.current;
      localStreamRef.current = null;
      s?.getTracks().forEach((t) => void t.stop());
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      teardownPeer();
      closeSocket();
    };

    const tryAcquire = async () => {
      if (cancelled) return;
      if (localStreamRef.current) return;
      if (mediaAcquireInFlight.current) return;
      mediaAcquireInFlight.current = true;
      try {
        const stream = await getUserMediaCompat(MEDIA_CONSTRAINTS);
        if (cancelled) {
          stream.getTracks().forEach((t) => void t.stop());
          return;
        }
        localStreamRef.current = stream;
        const v = localVideoRef.current;
        if (v) {
          v.srcObject = stream;
        }
        setStreamReady(true);
        setMediaError(null);
        setMediaHardBlock(null);
        setSecureHelpFeedback(null);
        if (intervalId != null) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setMediaError(mediaErrorMessage(err));
        setMediaHardBlock(classifyMediaHardBlock(err));
        if (intervalId == null && shouldRetryMediaAcquisition(err)) {
          intervalId = window.setInterval(() => {
            void tryAcquire();
          }, 3500);
        }
      } finally {
        mediaAcquireInFlight.current = false;
      }
    };

    requestLocalMediaRef.current = () => {
      void tryAcquire();
    };

    setMediaError(null);
    setMediaHardBlock(null);
    setSecureHelpFeedback(null);
    setStreamReady(false);
    setConnError(null);

    void tryAcquire();

    const onVisibleOrFocus = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (localStreamRef.current) return;
      void tryAcquire();
    };
    document.addEventListener("visibilitychange", onVisibleOrFocus);
    window.addEventListener("focus", onVisibleOrFocus);

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibleOrFocus);
      window.removeEventListener("focus", onVisibleOrFocus);
      cleanupStream();
    };
  }, [appointmentId, showFeedback, closeSocket, teardownPeer]);

  /** REST join + chat history as soon as we have an appointment id (not gated on camera or WebSocket). */
  useEffect(() => {
    if (!appointmentId || showFeedback) return;
    let cancelled = false;
    void (async () => {
      try {
        await patchJoinCall(appointmentId);
      } catch (e) {
        if (!cancelled) {
          setConnError(e instanceof Error ? e.message : "Could not join call.");
        }
      }
      try {
        const body = await fetchCallChatMessages(appointmentId);
        if (!cancelled) {
          setChatMessages(extractCallChatMessages(body));
        }
      } catch {
        if (!cancelled) {
          // non-fatal: chat history optional if endpoint fails
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, showFeedback]);

  useEffect(() => {
    localPipPosRef.current = localPipPos;
  }, [localPipPos]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadChat(0);
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    chatListEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatOpen, chatMessages]);

  useEffect(() => {
    if (!streamReady || typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setHasMultipleCameras(false);
      return;
    }
    let cancelled = false;
    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      if (cancelled) return;
      const n = devices.filter((d) => d.kind === "videoinput" && d.deviceId).length;
      setHasMultipleCameras(n > 1);
    });
    return () => {
      cancelled = true;
    };
  }, [streamReady]);

  const hangUp = useCallback(async () => {
    try {
      await patchEndCall(appointmentId);
    } catch {
      // still try to signal leave / cleanup
    }
    try {
      sendJson(leaveEnvelope(appointmentId));
    } catch {
      // ignore
    }
    teardownPeer();
    closeSocket();
    const s = localStreamRef.current;
    s?.getTracks().forEach((t) => void t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setStreamReady(false);
    setHasRemoteVideo(false);
    setShowFeedback(true);
  }, [appointmentId, closeSocket, sendJson, teardownPeer]);

  const toggleMic = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !micOn;
    s.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !camOn;
    s.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
  }, [camOn]);

  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const currentTrack = stream.getVideoTracks()[0];
    if (!currentTrack || !navigator.mediaDevices?.getUserMedia) return;

    let devices: MediaDeviceInfo[];
    try {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput" && d.deviceId,
      );
    } catch {
      return;
    }
    if (devices.length < 2) return;

    const currentId = currentTrack.getSettings?.().deviceId ?? "";
    const idx = Math.max(
      0,
      devices.findIndex((d) => d.deviceId === currentId),
    );
    const nextDevice = devices[(idx + 1) % devices.length];

    try {
      const vOnly = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextDevice.deviceId } },
        audio: false,
      });
      const newTrack = vOnly.getVideoTracks()[0];
      vOnly.getTracks().forEach((t) => {
        if (t !== newTrack) t.stop();
      });

      stream.removeTrack(currentTrack);
      currentTrack.stop();
      stream.addTrack(newTrack);
      newTrack.enabled = camOn;

      const pc = pcRef.current;
      const sender = pc?.getSenders().find((x) => x.track?.kind === "video");
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
      }

      const v = localVideoRef.current;
      if (v) v.srcObject = stream;
    } catch (e) {
      console.warn("[video] switch camera", e);
    }
  }, [camOn]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const wrap = localWrapRef.current;
    if (!stage || !wrap) return;

    const syncLayout = () => {
      const sr = stage.getBoundingClientRect();
      const pipW = wrap.offsetWidth;
      const pipH = wrap.offsetHeight;
      if (sr.width < 8 || sr.height < 8 || pipW < 8 || pipH < 8) return;

      setLocalPipPos((prev) => {
        if (prev === null) {
          return defaultPipBottomRight(sr.width, sr.height, pipW, pipH);
        }
        return clampPipInStage(sr.width, sr.height, pipW, pipH, prev.x, prev.y);
      });
    };

    const ro = new ResizeObserver(() => {
      syncLayout();
    });
    ro.observe(stage);
    ro.observe(wrap);
    syncLayout();
    return () => ro.disconnect();
  }, []);

  const onLocalPipPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-pip-no-drag]")) return;

    const stage = stageRef.current;
    const wrap = localWrapRef.current;
    if (!stage || !wrap) return;

    const sr = stage.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    if (wr.width < 8 || wr.height < 8) return;

    const pos = localPipPosRef.current;
    const x = pos?.x ?? wr.left - sr.left;
    const y = pos?.y ?? wr.top - sr.top;
    if (pos === null) {
      setLocalPipPos({ x, y });
    }

    setPipDragging(true);
    pipDragPendingRef.current = null;
    if (pipDragRafRef.current != null) {
      cancelAnimationFrame(pipDragRafRef.current);
      pipDragRafRef.current = null;
    }

    pipDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: x,
      originY: y,
    };

    const onMove = (ev: PointerEvent) => {
      const drag = pipDragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const st = stageRef.current;
      const wp = localWrapRef.current;
      if (!st || !wp) return;
      const rSt = st.getBoundingClientRect();
      const pipW = wp.offsetWidth;
      const pipH = wp.offsetHeight;
      const dx = ev.clientX - drag.startClientX;
      const dy = ev.clientY - drag.startClientY;
      const next = clampPipInStage(rSt.width, rSt.height, pipW, pipH, drag.originX + dx, drag.originY + dy);
      pipDragPendingRef.current = next;
      if (pipDragRafRef.current == null) {
        pipDragRafRef.current = requestAnimationFrame(() => {
          pipDragRafRef.current = null;
          const pending = pipDragPendingRef.current;
          if (pending) setLocalPipPos(pending);
        });
      }
    };

    const onUp = (ev: PointerEvent) => {
      const drag = pipDragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      pipDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      pipWindowListenersRef.current = null;

      if (pipDragRafRef.current != null) {
        cancelAnimationFrame(pipDragRafRef.current);
        pipDragRafRef.current = null;
      }
      const flushed = pipDragPendingRef.current;
      pipDragPendingRef.current = null;

      const st = stageRef.current;
      const wp = localWrapRef.current;
      if (!st || !wp) {
        setPipDragging(false);
        return;
      }
      const rSt = st.getBoundingClientRect();
      const pipW = wp.offsetWidth;
      const pipH = wp.offsetHeight;
      setLocalPipPos((cur) => {
        const base = flushed ?? cur;
        if (!base) return cur;
        return snapPipRelease(rSt.width, rSt.height, pipW, pipH, base.x, base.y);
      });
      setPipDragging(false);
    };

    pipWindowListenersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  useEffect(() => {
    return () => {
      const h = pipWindowListenersRef.current;
      if (h) {
        window.removeEventListener("pointermove", h.move);
        window.removeEventListener("pointerup", h.up);
        window.removeEventListener("pointercancel", h.up);
        pipWindowListenersRef.current = null;
      }
      pipDragRef.current = null;
      pipDragPendingRef.current = null;
      if (pipDragRafRef.current != null) {
        cancelAnimationFrame(pipDragRafRef.current);
        pipDragRafRef.current = null;
      }
    };
  }, []);

  const refreshChatFromServer = useCallback(async () => {
    try {
      const body = await fetchCallChatMessages(appointmentId);
      setChatMessages(extractCallChatMessages(body));
    } catch {
      // non-fatal
    }
  }, [appointmentId]);

  const onPickChatFiles = useCallback(() => {
    chatFileInputRef.current?.click();
  }, []);

  const onChatFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list?.length) return;
      const picked = Array.from(list);
      e.target.value = "";

      for (const file of picked) {
        const id = newVideoChatAttachmentId();
        setChatAttachments((prev) => [...prev, { id, fileName: file.name, uploading: true, error: null }]);

        void uploadSupportDocumentFile(file)
          .then(async (uploadResponse) => {
            try {
              await postCallChatUploadPayload(appointmentId, uploadResponse);
              setChatAttachments((prev) => prev.filter((a) => a.id !== id));
              await refreshChatFromServer();
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Could not send attachment";
              setChatAttachments((prev) => {
                if (!prev.some((a) => a.id === id)) return prev;
                return prev.map((a) => (a.id === id ? { ...a, uploading: false, error: msg } : a));
              });
              toast.error(msg);
            }
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : "Upload failed";
            setChatAttachments((prev) => {
              if (!prev.some((a) => a.id === id)) return prev;
              return prev.map((a) => (a.id === id ? { ...a, uploading: false, error: msg } : a));
            });
            toast.error(msg);
          });
      }
    },
    [appointmentId, refreshChatFromServer, toast],
  );

  const removeChatAttachment = useCallback((id: string) => {
    setChatAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const sendChat = useCallback(async () => {
    const text = chatDraft.trim();
    if (chatAttachments.some((a) => a.uploading)) {
      toast.error("Wait for attachments to finish sending.");
      return;
    }
    if (!text) {
      toast.error("Type a message to send, or attach a file.");
      return;
    }
    if (chatSending) return;
    setChatSending(true);
    try {
      await postCallChatText(appointmentId, text);
      setChatDraft("");
      await refreshChatFromServer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send chat message.");
    } finally {
      setChatSending(false);
    }
  }, [appointmentId, chatAttachments, chatDraft, chatSending, refreshChatFromServer, toast]);

  const chatSendDisabled = chatAttachments.some((a) => a.uploading) || !chatDraft.trim();

  const submitFeedback = useCallback(async () => {
    try {
      if (rating > 0) {
        await postCallFeedback({
          appointmentId,
          rating,
          techRating: techRating > 0 ? techRating : rating,
          description: feedbackNote.trim(),
        });
      }
    } catch {
      // still leave
    }
    setShowFeedback(false);
    navigate(ROUTES.dashboard, { replace: true });
  }, [appointmentId, feedbackNote, navigate, rating, techRating]);

  const skipFeedback = useCallback(() => {
    setShowFeedback(false);
    navigate(ROUTES.dashboard, { replace: true });
  }, [navigate]);

  if (!appointmentId) {
    return (
      <div className="video-call-page">
        <header className="video-call-page__header">
          <button
            type="button"
            className="app-back-btn video-call-page__back"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            ←
          </button>
          <h1 className="video-call-page__title">Video call</h1>
        </header>
        <div className="video-call-page__banner video-call-page__banner--error">
          Missing appointment id in the URL.
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-page">
      <header className="video-call-page__header">
        <button
          type="button"
          className="app-back-btn video-call-page__back"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <h1 className="video-call-page__title">Video consultation</h1>
      </header>

      {!socketUrl ? (
        <div className="video-call-page__banner video-call-page__banner--error">
          Set <code style={{ fontSize: "0.85em" }}>VITE_SOCKET_URL</code> in your environment for
          live signaling.
        </div>
      ) : null}

      {mediaError && !streamReady ? (
        mediaHardBlock === "secure" ? (
          <div className="video-call-page__media-permission video-call-page__media-permission--secure">
            <div className="video-call-page__banner video-call-page__banner--error">{mediaError}</div>
            <p className="video-call-page__media-permission-hint">
              On this address (<strong>http</strong> + a network IP), the browser hides camera and microphone.
              Switch to <strong>HTTPS</strong> on the same port, or use <strong>http://localhost</strong> on
              your PC.
            </p>
            <ul className="video-call-page__media-secure-steps">
              <li>
                <strong>Fastest:</strong> tap <strong>Open on HTTPS</strong> below (dev server uses HTTPS by
                default). Accept the certificate warning once, then allow camera and mic when asked.
              </li>
              <li>
                <strong>Same PC without HTTPS:</strong>{" "}
                {localhostAlternateUrl ? (
                  <a className="video-call-page__inline-link" href={localhostAlternateUrl}>
                    Open this call on localhost
                  </a>
                ) : (
                  <>Use <code className="video-call-page__inline-code">http://localhost</code> with your dev port.</>
                )}
              </li>
              <li>
                <strong>Plain HTTP only:</strong> set <code className="video-call-page__inline-code">VITE_DEV_SERVER_HTTPS=false</code> in{" "}
                <code className="video-call-page__inline-code">.env</code> and restart Vite — camera will still
                need localhost or HTTPS elsewhere.
              </li>
              <li>
                <strong>Production:</strong> use HTTPS only.
              </li>
            </ul>
            {httpsSuggestion ? (
              <div className="video-call-page__media-secure-actions">
                <p className="video-call-page__media-secure-url-label">
                  This project serves HTTPS in dev by default. Reload on HTTPS, then allow camera and microphone
                  when prompted.
                </p>
                <code className="video-call-page__media-secure-url">{httpsSuggestion}</code>
                <button
                  type="button"
                  className="video-call-page__media-permission-btn video-call-page__media-permission-btn--primary"
                  onClick={() => {
                    window.location.replace(httpsSuggestion);
                  }}
                >
                  Open on HTTPS (enable camera and mic)
                </button>
                <button
                  type="button"
                  className="video-call-page__media-permission-btn video-call-page__media-permission-btn--secondary"
                  onClick={() => {
                    void (async () => {
                      try {
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(httpsSuggestion);
                          setSecureHelpFeedback("Copied. Paste into the address bar if the button above does not work.");
                        } else {
                          setSecureHelpFeedback(`Copy this address: ${httpsSuggestion}`);
                        }
                      } catch {
                        setSecureHelpFeedback(`Copy manually: ${httpsSuggestion}`);
                      }
                      window.setTimeout(() => setSecureHelpFeedback(null), 10000);
                    })();
                  }}
                >
                  Copy HTTPS address
                </button>
              </div>
            ) : null}
            {secureHelpFeedback ? (
              <p className="video-call-page__media-permission-feedback">{secureHelpFeedback}</p>
            ) : null}
          </div>
        ) : mediaHardBlock === "unsupported" ? (
          <div className="video-call-page__media-permission">
            <div className="video-call-page__banner video-call-page__banner--error">{mediaError}</div>
            <p className="video-call-page__media-permission-hint">
              Try another browser or device, or confirm you are not in a restricted embedded web view.
            </p>
          </div>
        ) : (
          <div className="video-call-page__media-permission">
            <div className="video-call-page__banner video-call-page__banner--error">{mediaError}</div>
            <p className="video-call-page__media-permission-hint">
              When your browser asks, choose <strong>Allow</strong> for camera and microphone. This page will
              keep retrying while you stay here.
            </p>
            <p className="video-call-page__media-permission-hint video-call-page__media-permission-hint--sub">
              If you tapped <strong>Block</strong> before: open this site’s settings (lock or tune icon in
              the address bar, or browser Settings → Site settings), enable <strong>Camera</strong> and{" "}
              <strong>Microphone</strong>, then tap the button below.
            </p>
            <button
              type="button"
              className="video-call-page__media-permission-btn video-call-page__media-permission-btn--primary"
              onClick={() => requestLocalMediaRef.current()}
            >
              Allow camera and microphone
            </button>
          </div>
        )
      ) : null}

      {connError ? (
        <div className="video-call-page__banner video-call-page__banner--error">{connError}</div>
      ) : null}

      <div ref={stageRef} className="video-call-page__stage">
        <video
          ref={remoteVideoRef}
          className="video-call-page__remote"
          playsInline
          autoPlay
        />
        {!hasRemoteVideo ? (
          <div className="video-call-page__muted-label">Waiting for doctor's video…</div>
        ) : null}
        <div
          ref={localWrapRef}
          className={`video-call-page__local-wrap${localPipPos ? " video-call-page__local-wrap--placed" : ""}${pipDragging ? " video-call-page__local-wrap--dragging" : ""}`}
          style={
            localPipPos
              ? {
                  left: 0,
                  top: 0,
                  transform: `translate3d(${localPipPos.x}px, ${localPipPos.y}px, 0)`,
                  transition: pipDragging ? "none" : "transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
                }
              : undefined
          }
          role="group"
          aria-label="Your camera preview. Drag to move."
          onPointerDown={onLocalPipPointerDown}
        >
          <div className="video-call-page__local-stack">
            <video
              ref={localVideoRef}
              className="video-call-page__local"
              playsInline
              autoPlay
              muted
            />
            {streamReady ? (
              <div className="video-call-page__local-overlay">
                <button
                  type="button"
                  className="video-call-page__local-cam"
                  data-pip-no-drag
                  aria-label={hasMultipleCameras ? "Switch front or back camera" : "Only one camera available"}
                  disabled={!hasMultipleCameras}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (!hasMultipleCameras) return;
                    void switchCamera();
                  }}
                  onPointerDown={(ev) => ev.stopPropagation()}
                >
                  <IconSwitchCamera />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="video-call-page__toolbar">
        <button
          type="button"
          className={`video-call-page__tool${micOn ? "" : " video-call-page__tool--off"}`}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          onClick={toggleMic}
        >
          {micOn ? <IconMicOn /> : <IconMicOff />}
        </button>
        <button
          type="button"
          className={`video-call-page__tool${camOn ? "" : " video-call-page__tool--off"}`}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          onClick={toggleCam}
        >
          {camOn ? <IconCamOn /> : <IconCamOff />}
        </button>
        {hasMultipleCameras ? (
          <button
            type="button"
            className="video-call-page__tool"
            aria-label="Switch camera"
            onClick={() => void switchCamera()}
          >
            <IconSwitchCamera />
          </button>
        ) : null}
        <button
          type="button"
          className="video-call-page__tool"
          aria-label="Open chat"
          onClick={() => setChatOpen(true)}
        >
          <IconChat />
          {unreadChat > 0 ? (
            <span className="video-call-page__tool-badge">{unreadChat > 9 ? "9+" : unreadChat}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="video-call-page__tool video-call-page__tool--hangup"
          aria-label="Hang up"
          onClick={() => void hangUp()}
        >
          <IconPhoneHangUp />
        </button>
      </footer>

      {chatOpen ? (
        <div
          className="video-call-page__chat-panel"
          role="dialog"
          aria-label="In-call chat"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatOpen(false);
          }}
        >
          <div className="video-call-page__chat-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="video-call-page__chat-head">
              <h2>Chat</h2>
              <button
                type="button"
                className="video-call-page__chat-close"
                aria-label="Close chat"
                onClick={() => setChatOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="video-call-page__chat-list">
              <SupportTicketChatMessageList messages={chatMessages} listEndRef={chatListEndRef} />
            </div>
            <SupportTicketChatComposer
              fileInputRef={chatFileInputRef}
              attachments={chatAttachments}
              draft={chatDraft}
              sending={chatSending}
              sendDisabled={chatSendDisabled}
              placeholder="Message…"
              onPickFiles={onPickChatFiles}
              onFileChange={onChatFileChange}
              onRemoveAttachment={removeChatAttachment}
              onDraftChange={setChatDraft}
              onSend={() => void sendChat()}
            />
          </div>
        </div>
      ) : null}

      {showFeedback ? (
        <div className="video-call-page__feedback" role="dialog" aria-labelledby="video-call-feedback-title">
          <section className="support-chat__feedback-sheet support-chat__feedback-sheet--submit video-call-page__feedback-sheet">
            <div className="support-chat__feedback-handle" aria-hidden />
            <div className="support-chat__feedback-header">
              <h2 id="video-call-feedback-title">How was your call?</h2>
            </div>
            <p className="support-chat__feedback-lead">Rate your experience. Stars are optional; comments help us improve.</p>

            <div className="support-chat__feedback-field">
              <span className="support-chat__feedback-section-label" id="video-call-feedback-overall-label">
                Overall
              </span>
              <div
                className="support-chat__stars feedback-stars"
                role="radiogroup"
                aria-labelledby="video-call-feedback-overall-label"
              >
                {FEEDBACK_RATINGS.map((n) => (
                  <button
                    key={`r-${n}`}
                    type="button"
                    role="radio"
                    className={`support-chat__star${rating >= n ? " support-chat__star--on" : ""}`}
                    onClick={() => setRating(n)}
                    aria-label={`${n} out of 5 stars`}
                    aria-checked={rating === n}
                  >
                    ★
                  </button>
                ))}
              </div>
              {rating > 0 ? (
                <p className="support-chat__feedback-selected-summary" aria-live="polite">
                  <strong>{rating}</strong> of 5 · {FEEDBACK_RATING_LABELS[rating]}
                </p>
              ) : (
                <p className="support-chat__feedback-star-hint">Tap a star (optional).</p>
              )}
            </div>

            <div className="support-chat__feedback-field">
              <span className="support-chat__feedback-section-label" id="video-call-feedback-tech-label">
                Technical quality
              </span>
              <div
                className="support-chat__stars feedback-stars"
                role="radiogroup"
                aria-labelledby="video-call-feedback-tech-label"
              >
                {FEEDBACK_RATINGS.map((n) => (
                  <button
                    key={`t-${n}`}
                    type="button"
                    role="radio"
                    className={`support-chat__star${techRating >= n ? " support-chat__star--on" : ""}`}
                    onClick={() => setTechRating(n)}
                    aria-label={`Technical ${n} out of 5 stars`}
                    aria-checked={techRating === n}
                  >
                    ★
                  </button>
                ))}
              </div>
              {techRating > 0 ? (
                <p className="support-chat__feedback-selected-summary" aria-live="polite">
                  <strong>{techRating}</strong> of 5 · {FEEDBACK_RATING_LABELS[techRating]}
                </p>
              ) : (
                <p className="support-chat__feedback-star-hint">Tap a star (optional).</p>
              )}
            </div>

            <label className="support-chat__feedback-field support-chat__feedback-field--block">
              <span className="support-chat__feedback-section-label">Comments (optional)</span>
              <span className="support-chat__feedback-microcopy">Audio, video, or anything else about this call.</span>
              <textarea
                className="support-chat__feedback-textarea"
                rows={4}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="e.g. Video was clear but audio dropped briefly…"
              />
            </label>

            <div className="support-chat__feedback-actions support-chat__feedback-actions--stack">
              <button
                type="button"
                className="support-chat__feedback-submit"
                onClick={() => void submitFeedback()}
              >
                Done
              </button>
              <button
                type="button"
                className="support-chat__feedback-cancel support-chat__feedback-cancel--ghost"
                onClick={skipFeedback}
              >
                Skip
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
