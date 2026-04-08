import { fetchAllListPages, type ListPaginationOpts } from "@/api/listPagination";
import { patientFetchChecked, patientJson, patientJsonList } from "@/api/patientHttp";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { uploadSupportDocumentFile } from "@/api/patientUpload";

export type SupportTicketPayload = Readonly<{
    message: string;
    language: string;
}>;

/** Server payload for submitted feedback, or `null` when none yet. */
export type SupportTicketFeedback = Readonly<Record<string, unknown>> | null;

export type SupportTicket = Readonly<{
    id: string;
    status: string | null;
    message: string | null;
    language: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    feedback: SupportTicketFeedback;
}>;

function str(v: unknown): string | null {
    if (v == null) return null;
    if (typeof v === "string") {
        const trimmed = v.trim();
        return trimmed.length ? trimmed : null;
    }
    if (typeof v === "number" || typeof v === "boolean") {
        return String(v);
    }
    return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
    return v !== null && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
}

const TICKET_ARRAY_KEYS = ["tickets", "data", "items", "results", "list"] as const;

function extractArray(body: unknown): unknown[] {
    if (Array.isArray(body)) return body;
    const root = asRecord(body);
    if (!root) return [];

    for (const key of TICKET_ARRAY_KEYS) {
        const candidate = root[key];
        if (Array.isArray(candidate)) return candidate;
    }

    const candidate = root.tickets ?? root.data ?? root.items ?? root.results;
    if (Array.isArray(candidate)) return candidate;
    return [];
}

function normalizeTicket(item: unknown, index: number): SupportTicket | null {
    const o = asRecord(item);
    if (!o) return null;

    const id =
        str(o.id) ??
        str(o.ticket_id) ??
        str(o.ticketId) ??
        str(o.reference) ??
        `ticket-${index}`;

    const status =
        str(o.status) ??
        str(o.state) ??
        str(o.ticket_status) ??
        str(o.status_label);

    const message =
        str(o.message) ??
        str(o.description) ??
        str(o.summary) ??
        str(o.title);

    const language =
        str(o.language) ??
        str(o.lang) ??
        str(o.locale);

    const createdAt =
        str(o.created_at) ??
        str(o.createdAt) ??
        str(o.created_on) ??
        str(o.date);

    const updatedAt =
        str(o.updated_at) ??
        str(o.updatedAt) ??
        str(o.updated_on);

    let feedback: SupportTicketFeedback = null;
    if (Object.hasOwn(o, "feedback")) {
        const f = o.feedback;
        if (f != null && typeof f === "object" && !Array.isArray(f)) {
            feedback = f as Readonly<Record<string, unknown>>;
        }
    }

    return {
        id,
        status,
        message,
        language,
        createdAt,
        updatedAt,
        feedback,
    };
}

/** True when API has stored feedback for this ticket (non-empty object). */
export function supportTicketHasFeedback(feedback: SupportTicketFeedback): boolean {
    if (feedback == null) return false;
    return Object.keys(feedback).length > 0;
}

/** Normalized rating + text for displaying saved feedback in the UI. */
export type SupportTicketFeedbackDisplay = Readonly<{
    rating: number | null;
    description: string | null;
}>;

function parseFeedbackRatingField(v: unknown): number | null {
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) return v;
    if (typeof v === "string") {
        const n = Number.parseInt(v.trim(), 10);
        if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
    }
    return null;
}

/** Reads common API shapes (`rating`, `description`, `comment`, etc.). */
export function parseSupportTicketFeedbackDisplay(feedback: SupportTicketFeedback): SupportTicketFeedbackDisplay {
    if (feedback == null) {
        return { rating: null, description: null };
    }
    const o = feedback;
    const rating =
        parseFeedbackRatingField(o.rating) ??
        parseFeedbackRatingField(o.star_rating) ??
        parseFeedbackRatingField(o.starRating) ??
        parseFeedbackRatingField(o.score);
    const description =
        str(o.description) ??
        str(o.feedback_text) ??
        str(o.feedbackText) ??
        str(o.comment) ??
        str(o.comments) ??
        str(o.message);
    return { rating, description };
}

export function isSupportTicketInactiveStatus(status: string | null): boolean {
    const n = (status ?? "").trim().toLowerCase();
    return n === "2" || n === "inactive";
}

/** Tickets shown under the hub "Closed" tab (includes inactive / status 2). */
export function isSupportTicketClosedTabStatus(status: string | null): boolean {
    const s = (status ?? "").trim().toLowerCase();
    return (
        s === "closed" ||
        s === "resolved" ||
        s === "completed" ||
        s === "2" ||
        s === "inactive"
    );
}

export function normalizeSupportTicketsResponse(body: unknown): SupportTicket[] {
    return extractArray(body)
        .map((item, index) => normalizeTicket(item, index))
        .filter((ticket): ticket is SupportTicket => ticket != null);
}

/** GET `/support/ticket?page=&limit=` */
export async function fetchSupportTickets(
    pagination?: ListPaginationOpts,
): Promise<SupportTicket[]> {
    const raw = await patientJsonList<unknown>("support/ticket", { method: "GET" }, pagination);
    return normalizeSupportTicketsResponse(raw);
}

/** Loads every page until a short or empty response. */
export async function fetchAllSupportTickets(): Promise<SupportTicket[]> {
    return fetchAllListPages((opts) => fetchSupportTickets(opts));
}

export async function createSupportTicket(
    payload: SupportTicketPayload,
): Promise<void> {
    await patientFetchChecked("support/ticket", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// —— Ticket thread (GET/POST support/ticket/:tid) —————————————————————————————

export type SupportTicketAttachment = Readonly<{
    url: string;
    mimeType: string | null;
    name: string | null;
}>;

export type SupportTicketThreadMessage = Readonly<{
    id: string;
    text: string | null;
    createdAt: string | null;
    /** True when aligned to this account (patient); false for admin side (system, user, support, etc.). */
    outgoing: boolean;
    /** Display name from API `user.name` when present. */
    senderName: string | null;
    /** Raw API `type` e.g. TXT, IMG (not used for MIME on attachments). */
    messageType: string | null;
    attachments: SupportTicketAttachment[];
}>;

export type SupportTicketDetail = Readonly<{
    ticket: SupportTicket;
    messages: SupportTicketThreadMessage[];
}>;

const MESSAGE_ARRAY_KEYS = [
    "ticketMessages",
    "messages",
    "replies",
    "comments",
    "conversation",
    "thread",
    "chats",
    "history",
    "activity",
] as const;

function extractDetailRoot(body: unknown): Record<string, unknown> | null {
    const root = asRecord(body);
    if (!root) return null;
    const data = asRecord(root.data);
    if (data) return data;
    return root;
}

function extractMessagesArray(root: Record<string, unknown>): unknown[] {
    for (const key of MESSAGE_ARRAY_KEYS) {
        const candidate = root[key];
        if (Array.isArray(candidate)) return candidate;
    }
    return [];
}

function resolveAttachmentUrl(raw: string | null): string | null {
    if (raw == null) return null;
    const t = raw.trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return t;
    return resolveProfileImageUrl(t);
}

function normalizeAttachment(item: unknown, index: number): SupportTicketAttachment | null {
    const o = asRecord(item);
    if (!o) return null;
    const url =
        resolveAttachmentUrl(
            str(o.url) ??
                str(o.file_url) ??
                str(o.fileUrl) ??
                str(o.link) ??
                str(o.path) ??
                str(o.src),
        );
    if (!url) return null;
    const mimeFromField = str(o.mime_type) ?? str(o.mimeType);
    const typeField = str(o.type);
    const mimeType =
        mimeFromField ??
        (typeField && !/^(txt|img|pdf|file|document)$/i.test(typeField) ? typeField : null);
    return {
        url,
        mimeType,
        name: str(o.name) ?? str(o.filename) ?? str(o.file_name) ?? `attachment-${index + 1}`,
    };
}

function normalizeAttachments(v: unknown): SupportTicketAttachment[] {
    if (!Array.isArray(v)) return [];
    return v
        .map((item, i) => normalizeAttachment(item, i))
        .filter((a): a is SupportTicketAttachment => a != null);
}

/**
 * Chat alignment: outgoing (right) = this patient account; incoming (left) = admin/support.
 * Primary signal: API `user_type` — patient → you; system | user | support | agent | staff | admin → admin side.
 */
function inferOutgoing(o: Record<string, unknown>): boolean {
    const userType = (str(o.user_type) ?? str(o.userType) ?? "").toLowerCase();
    if (userType === "patient") return true;
    if (
        userType === "system" ||
        userType === "user" ||
        userType === "support" ||
        userType === "agent" ||
        userType === "staff" ||
        userType === "admin"
    ) {
        return false;
    }

    const sender = (str(o.sender) ?? str(o.sender_type) ?? str(o.senderType) ?? "").toLowerCase();
    const role = (str(o.role) ?? str(o.from) ?? "").toLowerCase();
    const direction = (str(o.direction) ?? "").toLowerCase();

    if (direction === "outbound" || direction === "out") return true;
    if (direction === "inbound" || direction === "in" || direction === "support") return false;
    if (direction === "user") return false;

    if (/support|agent|admin|staff|system|team/i.test(sender)) return false;
    if (sender === "user") return false;
    if (/patient|customer|member/i.test(sender)) return true;
    if (/support|agent|admin|staff|system/i.test(role)) return false;
    if (role === "user") return false;
    if (/patient|customer|member|me/i.test(role)) return true;

    const staffish =
        o.is_staff === true ||
        o.isStaff === true ||
        o.is_support === true ||
        o.isSupport === true ||
        o.from_agent === true ||
        o.fromAgent === true ||
        o.from_support === true ||
        o.fromSupport === true;
    if (staffish) return false;

    const patientish =
        o.is_patient === true ||
        o.isPatient === true ||
        o.from_patient === true ||
        o.fromPatient === true;
    if (patientish) return true;

    return true;
}

/**
 * Backend may embed the ticket record inside `ticketMessages` (same `id` as ticket, plus status/priority).
 * That row should merge into {@link SupportTicket}, not render as a chat line.
 */
function extractEmbeddedTicketRow(
    o: Record<string, unknown>,
    ticketId: string,
): Partial<SupportTicket> | null {
    const oid = str(o.id);
    if (oid !== ticketId) return null;

    const looksLikeTicket =
        (o.status !== undefined && o.status !== null) ||
        o.priority !== undefined ||
        o.assigned_to !== undefined ||
        o.assigned_by !== undefined ||
        o.canReopen !== undefined;

    if (!looksLikeTicket) return null;

    const row: {
        status?: string | null;
        message?: string | null;
        language?: string | null;
        createdAt?: string | null;
        updatedAt?: string | null;
        feedback?: SupportTicketFeedback;
    } = {
        status: str(o.status),
        message: str(o.message),
        language: str(o.language),
        createdAt: str(o.createdAt) ?? str(o.created_at),
        updatedAt: str(o.updatedAt) ?? str(o.updated_at),
    };
    if (Object.hasOwn(o, "feedback")) {
        const f = o.feedback;
        if (f != null && typeof f === "object" && !Array.isArray(f)) {
            row.feedback = f as Readonly<Record<string, unknown>>;
        } else {
            row.feedback = null;
        }
    }
    return row;
}

function parseMessageTime(iso: string | null): number {
    if (!iso) return 0;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? 0 : t;
}

function partitionTicketMessagesList(
    rawList: unknown[],
    ticketId: string,
): Readonly<{ embeddedParts: Partial<SupportTicket>[]; chatItems: unknown[] }> {
    const embeddedParts: Partial<SupportTicket>[] = [];
    const chatItems: unknown[] = [];
    for (const item of rawList) {
        const o = asRecord(item);
        if (o) {
            const embedded = extractEmbeddedTicketRow(o, ticketId);
            if (embedded) {
                embeddedParts.push(embedded);
            } else {
                chatItems.push(item);
            }
        }
    }
    return { embeddedParts, chatItems };
}

function mapAndSortThreadMessages(chatItems: unknown[]): SupportTicketThreadMessage[] {
    const messages = chatItems
        .map((item, index) => normalizeThreadMessage(item, index))
        .filter((m): m is SupportTicketThreadMessage => m != null);
    messages.sort((a, b) => parseMessageTime(a.createdAt) - parseMessageTime(b.createdAt));
    return messages;
}

function normalizeThreadMessage(item: unknown, index: number): SupportTicketThreadMessage | null {
    const o = asRecord(item);
    if (!o) return null;

    const id =
        str(o.id) ??
        str(o.message_id) ??
        str(o.messageId) ??
        `msg-${index}`;

    const msgRaw = o.message;
    let text: string | null = null;
    const fromMessageObject: SupportTicketAttachment[] = [];

    if (msgRaw != null && typeof msgRaw === "object" && !Array.isArray(msgRaw)) {
        const mo = msgRaw as Record<string, unknown>;
        const path = str(mo.path);
        const title = str(mo.title);
        if (path) {
            const url = resolveAttachmentUrl(path);
            if (url) {
                const mt = (str(o.type) ?? "").toUpperCase();
                const mimeType =
                    mt === "IMG"
                        ? "image/jpeg"
                        : mt === "PDF"
                          ? "application/pdf"
                          : null;
                const baseName = path.includes("/") ? path.replace(/^.*\//, "") : path;
                fromMessageObject.push({
                    url,
                    mimeType,
                    name: title ?? baseName,
                });
            }
        }
    } else {
        text =
            str(msgRaw) ??
            str(o.body) ??
            str(o.text) ??
            str(o.content) ??
            str(o.comment);
    }

    const createdAt =
        str(o.created_at) ??
        str(o.createdAt) ??
        str(o.sent_at) ??
        str(o.timestamp) ??
        str(o.date);

    const singleAttachment =
        o.attachment == null ? [] : normalizeAttachments([o.attachment]);
    const merged = [
        ...fromMessageObject,
        ...normalizeAttachments(o.attachments),
        ...normalizeAttachments(o.media),
        ...normalizeAttachments(o.files),
        ...singleAttachment,
    ].filter((a, i, arr) => arr.findIndex((x) => x.url === a.url) === i);

    const hasText = Boolean(text?.trim());
    if (merged.length === 0 && !hasText) return null;

    const userRec = asRecord(o.user);
    const senderName = userRec ? str(userRec.name) : null;

    return {
        id,
        text,
        createdAt,
        outgoing: inferOutgoing(o),
        senderName,
        messageType: str(o.type),
        attachments: merged,
    };
}

function ticketRecordFromDetail(
    root: Record<string, unknown>,
    fallbackId: string,
    index: number,
): SupportTicket | null {
    const nested = asRecord(root.ticket) ?? asRecord(root.data);
    const o = nested && Object.keys(nested).length ? nested : root;
    return normalizeTicket(o, index) ?? normalizeTicket({ ...o, id: fallbackId }, index);
}

export function normalizeSupportTicketDetail(body: unknown, ticketId: string): SupportTicketDetail {
    const emptyTicket: SupportTicket = {
        id: ticketId,
        status: null,
        message: null,
        language: null,
        createdAt: null,
        updatedAt: null,
        feedback: null,
    };

    const root = extractDetailRoot(body) ?? asRecord(body);
    if (!root) {
        return { ticket: emptyTicket, messages: [] };
    }

    const rawList = extractMessagesArray(root);
    const { embeddedParts, chatItems } = partitionTicketMessagesList(rawList, ticketId);

    let ticket =
        ticketRecordFromDetail(root, ticketId, 0) ??
        ({ ...emptyTicket } satisfies SupportTicket);

    for (const part of embeddedParts) {
        ticket = { ...ticket, ...part, id: ticketId };
    }

    let messages = mapAndSortThreadMessages(chatItems);

    // Some APIs nest messages under `ticket` only (no top-level `ticketMessages`)
    const ticketObj = asRecord(root.ticket);
    if (ticketObj && messages.length === 0) {
        const nestedList = extractMessagesArray(ticketObj);
        const { embeddedParts: nestedEmbedded, chatItems: nestedChat } =
            partitionTicketMessagesList(nestedList, ticketId);
        for (const part of nestedEmbedded) {
            ticket = { ...ticket, ...part, id: ticketId };
        }
        messages = mapAndSortThreadMessages(nestedChat);
    }

    if (Object.hasOwn(root, "feedback")) {
        const f = root.feedback;
        if (f != null && typeof f === "object" && !Array.isArray(f)) {
            ticket = { ...ticket, feedback: f as Readonly<Record<string, unknown>> };
        } else {
            ticket = { ...ticket, feedback: null };
        }
    }

    return {
        ticket: { ...ticket, id: ticketId },
        messages,
    };
}

export async function fetchSupportTicketDetail(ticketId: string): Promise<SupportTicketDetail> {
    const path = `support/ticket/${encodeURIComponent(ticketId)}`;
    const raw = await patientJson<unknown>(path, { method: "GET" });
    return normalizeSupportTicketDetail(raw, ticketId);
}

/**
 * When `/upload` returns `{ data: { ... } }`, the ticket message body must be the inner object only
 * (no `data` wrapper). Otherwise returns the response unchanged.
 */
function ticketMessageBodyFromUploadResponse(uploadResponseBody: unknown): unknown {
    if (
        uploadResponseBody !== null &&
        typeof uploadResponseBody === "object" &&
        !Array.isArray(uploadResponseBody) &&
        Object.hasOwn(uploadResponseBody as object, "data")
    ) {
        const data = (uploadResponseBody as Record<string, unknown>).data;
        if (data !== null && typeof data === "object" && !Array.isArray(data)) {
            return data;
        }
    }
    return uploadResponseBody;
}

/**
 * Sends one support thread message: body is the upload JSON, unwrapping a top-level `data` object when present.
 */
export async function postSupportTicketUploadPayload(ticketId: string, uploadResponseBody: unknown): Promise<void> {
    const path = `support/ticket/${encodeURIComponent(ticketId)}`;
    const body = ticketMessageBodyFromUploadResponse(uploadResponseBody);
    await patientFetchChecked(path, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export type PostSupportTicketMessagePayload = Readonly<{
    message: string;
    /**
     * Parsed JSON from each `POST /upload` — if the shape is `{ data: { ... } }`, only the inner
     * object is sent as the body of `POST support/ticket/:id` (one request per item).
     */
    uploadResponses?: readonly unknown[];
    /** Upload on send, then post each full `/upload` JSON body to the ticket (legacy). */
    files?: readonly File[];
}>;

export async function postSupportTicketMessage(
    ticketId: string,
    payload: PostSupportTicketMessagePayload,
): Promise<void> {
    const path = `support/ticket/${encodeURIComponent(ticketId)}`;
    const { message, files, uploadResponses } = payload;
    const responseBodies = uploadResponses?.length ? [...uploadResponses] : [];
    const fileList = files?.length ? [...files] : [];
    const text = message.trim();

    if (responseBodies.length > 0) {
        if (text.length > 0) {
            await patientFetchChecked(path, {
                method: "POST",
                body: JSON.stringify({ message: text }),
            });
        }
        for (const body of responseBodies) {
            const payload = ticketMessageBodyFromUploadResponse(body);
            await patientFetchChecked(path, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        }
        return;
    }

    if (fileList.length > 0) {
        const uploadedBodies = await Promise.all(fileList.map((file) => uploadSupportDocumentFile(file)));
        if (text.length > 0) {
            await patientFetchChecked(path, {
                method: "POST",
                body: JSON.stringify({ message: text }),
            });
        }
        for (const body of uploadedBodies) {
            const payload = ticketMessageBodyFromUploadResponse(body);
            await patientFetchChecked(path, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        }
        return;
    }

    await patientFetchChecked(path, {
        method: "POST",
        body: JSON.stringify({ message: text }),
    });
}
