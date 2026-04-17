import { applyListPaginationToPath, type ListPaginationOpts } from "@/api/listPagination";
import { patientFetchChecked, patientJson } from "@/api/patientHttp";
import {
  normalizeSupportTicketDetail,
  type PostSupportTicketMessagePayload,
  type SupportTicketDetail,
} from "@/api/supportTicket";
import { uploadSupportDocumentFile } from "@/api/patientUpload";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function messageBodyFromUploadResponse(uploadResponseBody: unknown): unknown {
  const rec = asRecord(uploadResponseBody);
  if (rec && Object.hasOwn(rec, "data")) {
    const data = rec.data;
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      return data;
    }
  }
  return uploadResponseBody;
}

function extractMessagesArrayFromChatResponse(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (!root) return [];
  const data = asRecord(root.data);
  const candidates = [
    root.messages,
    root.results,
    root.items,
    data?.messages,
    data?.results,
    data?.items,
    data?.ticketMessages,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

/**
 * `GET /patient/chat/messages/:appointmentId?page=&limit=` — body normalized like support ticket thread.
 */
export async function fetchConsultationChatDetail(
  appointmentId: string,
  pagination?: ListPaginationOpts,
): Promise<SupportTicketDetail> {
  const id = appointmentId.trim();
  if (!id) {
    return normalizeSupportTicketDetail({ data: { messages: [] } }, "");
  }
  const path = applyListPaginationToPath(`chat/messages/${encodeURIComponent(id)}`, pagination);
  const raw = await patientJson<unknown>(path, { method: "GET" });
  const messages = extractMessagesArrayFromChatResponse(raw);
  const root = asRecord(raw);
  const data = asRecord(root?.data);
  const nestedTicket = asRecord(data?.ticket) ?? asRecord(root?.ticket);
  const msg =
    nestedTicket && typeof nestedTicket.message === "string" && nestedTicket.message.trim()
      ? nestedTicket.message.trim()
      : "Consultation chat";
  const ticketPayload: Record<string, unknown> = nestedTicket
    ? {
        ...nestedTicket,
        id,
        message: msg,
        language: nestedTicket.language ?? null,
        status: nestedTicket.status ?? "1",
      }
    : { id, message: msg, language: null, status: "1" };
  const wrapped = { data: { messages, ticket: ticketPayload } };
  return normalizeSupportTicketDetail(wrapped, id);
}

export async function postConsultationChatUploadPayload(
  appointmentId: string,
  uploadResponseBody: unknown,
): Promise<void> {
  const id = appointmentId.trim();
  const path = `chat/${encodeURIComponent(id)}`;
  const body = messageBodyFromUploadResponse(uploadResponseBody);
  await patientFetchChecked(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postConsultationChatMessage(
  appointmentId: string,
  payload: PostSupportTicketMessagePayload,
): Promise<void> {
  const id = appointmentId.trim();
  const path = `chat/${encodeURIComponent(id)}`;
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
      const inner = messageBodyFromUploadResponse(body);
      await patientFetchChecked(path, {
        method: "POST",
        body: JSON.stringify(inner),
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
      const inner = messageBodyFromUploadResponse(body);
      await patientFetchChecked(path, {
        method: "POST",
        body: JSON.stringify(inner),
      });
    }
    return;
  }

  await patientFetchChecked(path, {
    method: "POST",
    body: JSON.stringify({ message: text }),
  });
}
