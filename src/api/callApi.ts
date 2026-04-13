import { patientFetchChecked, patientJson } from "@/api/patientHttp";

/** PATCH `…/patient/joincall/:appointmentId` — e.g. `APP…T…` ongoing appointment id. */
export async function patchJoinCall(appointmentId: string): Promise<void> {
  await patientFetchChecked(`joincall/${encodeURIComponent(appointmentId)}`, {
    method: "PATCH",
    body: JSON.stringify({}),
    skipGlobalLoading: true,
  });
}

/** PATCH `…/patient/endcall/:appointmentId` — before LEAVE on the signaling socket. */
export async function patchEndCall(appointmentId: string): Promise<void> {
  await patientFetchChecked(`endcall/${encodeURIComponent(appointmentId)}`, {
    method: "PATCH",
    body: JSON.stringify({}),
    skipGlobalLoading: true,
  });
}

/** GET `…/patient/chat/messages/:appointmentId` */
export async function fetchCallChatMessages(appointmentId: string): Promise<unknown> {
  return patientJson<unknown>(`chat/messages/${encodeURIComponent(appointmentId)}`, {
    method: "GET",
    skipGlobalLoading: true,
  });
}

/** POST `…/patient/chat/:appointmentId` — in-call text. */
export async function postCallChatText(appointmentId: string, message: string): Promise<void> {
  await patientFetchChecked(`chat/${encodeURIComponent(appointmentId)}`, {
    method: "POST",
    body: JSON.stringify({ message, type: "TXT" }),
    skipGlobalLoading: true,
  });
}

function callChatBodyFromUploadResponse(uploadResponseBody: unknown): unknown {
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
 * POST `…/patient/chat/:appointmentId` with body from `POST /upload` (same unwrap as support tickets).
 */
export async function postCallChatUploadPayload(
  appointmentId: string,
  uploadResponseBody: unknown,
): Promise<void> {
  const path = `chat/${encodeURIComponent(appointmentId)}`;
  const body = callChatBodyFromUploadResponse(uploadResponseBody);
  await patientFetchChecked(path, {
    method: "POST",
    body: JSON.stringify(body),
    skipGlobalLoading: true,
  });
}

export type PostCallFeedbackInput = Readonly<{
  appointmentId: string;
  rating: number;
  techRating: number;
  description: string;
}>;

/** POST `…/patient/feedback` — `src_id` is the appointment id (same as endcall). */
export async function postCallFeedback(input: PostCallFeedbackInput): Promise<void> {
  await patientFetchChecked("feedback", {
    method: "POST",
    body: JSON.stringify({
      src: "appointment",
      rating: input.rating,
      src_id: input.appointmentId,
      description: input.description,
      tech_rating: input.techRating,
    }),
    skipGlobalLoading: true,
  });
}
