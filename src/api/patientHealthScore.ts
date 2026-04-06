import { patientJson } from "@/api/patientHttp";

export type CalculateBmiPayload = Readonly<{
  name: string;
  gender: "male" | "female" | "other";
  dob: string;
  height: string;
  weight: number;
  isDiabetic: "yes" | "no";
  language: string;
  isBloodPressure: "yes" | "no";
}>;


export type CalculateBmiResponse = Readonly<{
  health_score: Readonly<{
    bmi: number;
    height: string;
    weight: number;
    patient_id: number;
    nutrition_suggestion: boolean;
  }>;
  message?: string;
}>;

/**
 * Calculate BMI / health score for the user details flow.
 *
 * Backend endpoint can be adjusted here if needed.
 */
export async function calculatePatientBmi(
  payload: CalculateBmiPayload,
): Promise<CalculateBmiResponse> {
  return patientJson<CalculateBmiResponse>("healthscore", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

