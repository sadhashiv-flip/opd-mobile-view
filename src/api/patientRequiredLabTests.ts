import { patientJson } from "@/api/patientHttp";

/** GET /patient/required_lab_tests (Bearer after verify). */

export type RequiredLabTestsData = Readonly<{
  required_test: boolean;
  access_block: boolean;
  limit: number;
  used: number;
}>;

export type RequiredLabTestsResponse = Readonly<{
  data: RequiredLabTestsData;
  message?: string;
}>;

export async function fetchRequiredLabTests(): Promise<RequiredLabTestsResponse> {
  return patientJson<RequiredLabTestsResponse>("required_lab_tests", {
    method: "GET",
    skipGlobalLoading: true,
  });
}
