import { patientFetchChecked, patientJson } from "@/api/patientHttp";

export type SupportTicketPayload = Readonly<{
    message: string;
    language: string;
}>;

export type SupportTicket = Readonly<{
    id: string;
    status: string | null;
    message: string | null;
    language: string | null;
    createdAt: string | null;
    updatedAt: string | null;
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

    return {
        id,
        status,
        message,
        language,
        createdAt,
        updatedAt,
    };
}

export function normalizeSupportTicketsResponse(body: unknown): SupportTicket[] {
    return extractArray(body)
        .map((item, index) => normalizeTicket(item, index))
        .filter((ticket): ticket is SupportTicket => ticket != null);
}

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
    const raw = await patientJson<unknown>("support/ticket", { method: "GET" });
    return normalizeSupportTicketsResponse(raw);
}

export async function createSupportTicket(
    payload: SupportTicketPayload,
): Promise<void> {
    await patientFetchChecked("support/ticket", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
