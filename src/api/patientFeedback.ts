import { patientFetchChecked } from "@/api/patientHttp";

export type SupportFeedbackPayload = Readonly<{
    src: "support";
    src_id: string;
    rating: "1" | "2" | "3" | "4" | "5";
    description: string;
}>;

/**
 * POST `feedback` — rating and description required for `src: "support"` (no `tech_rating`).
 */
export async function postSupportFeedback(payload: SupportFeedbackPayload): Promise<void> {
    await patientFetchChecked("feedback", {
        method: "POST",
        body: JSON.stringify({
            src: payload.src,
            src_id: payload.src_id,
            rating: payload.rating,
            description: payload.description.trim(),
        }),
    });
}
