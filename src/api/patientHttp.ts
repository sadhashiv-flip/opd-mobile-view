import { getAccessToken, notifyUnauthorizedAndSignOut } from "@/lib/authStorage";
import {
  getPatientApiBase,
  getUploadApiBase,
  readPatientApiError,
} from "@/api/patientClient";

export type PatientHttpInit = RequestInit & Readonly<{ skipAuth?: boolean }>;

async function patientFetchWithBase(
  base: string,
  path: string,
  init: PatientHttpInit = {},
): Promise<Response> {
  const { skipAuth, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);

  const body = rest.body;
  if (body && typeof body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const rel = path.replace(/^\//, "");
  const url = `${base.replace(/\/$/, "")}/${rel}`;

  const res = await fetch(url, { ...rest, headers });

  if (res.status === 401 && !skipAuth) {
    notifyUnauthorizedAndSignOut();
  }

  return res;
}

/**
 * Patient API fetch with request "interceptor" (Bearer token) and 401 handling.
 * Use `skipAuth: true` for register, verify, login, and other public endpoints.
 * Authenticated: `link`, `vlink`, profile, etc.
 */
export async function patientFetch(
  path: string,
  init: PatientHttpInit = {},
): Promise<Response> {
  return patientFetchWithBase(getPatientApiBase(), path, init);
}

/** Same as {@link patientFetch} but uses {@link getUploadApiBase} (e.g. `POST /upload`). */
export async function patientFetchUpload(
  path: string,
  init: PatientHttpInit = {},
): Promise<Response> {
  return patientFetchWithBase(getUploadApiBase(), path, init);
}

/** Throws with server message when `!res.ok`. */
export async function patientFetchChecked(
  path: string,
  init: PatientHttpInit = {},
): Promise<Response> {
  const res = await patientFetch(path, init);
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  return res;
}

/** Upload host; throws with server message when `!res.ok`. */
export async function patientFetchUploadChecked(
  path: string,
  init: PatientHttpInit = {},
): Promise<Response> {
  const res = await patientFetchUpload(path, init);
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  return res;
}

export async function patientJson<T>(
  path: string,
  init: PatientHttpInit = {},
): Promise<T> {
  const res = await patientFetch(path, init);
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  const text = await res.text();
  if (!text) throw new Error("Empty response");
  return JSON.parse(text) as T;
}
