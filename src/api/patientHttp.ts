import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearSession,
  getAccessToken,
} from "@/lib/authStorage";
import { getPatientApiBase, readPatientApiError } from "@/api/patientClient";

export type PatientHttpInit = RequestInit & Readonly<{ skipAuth?: boolean }>;

/**
 * Patient API fetch with request "interceptor" (Bearer token) and 401 handling.
 * Use `skipAuth: true` for register, verify, and other public endpoints.
 */
export async function patientFetch(
  path: string,
  init: PatientHttpInit = {},
): Promise<Response> {
  const { skipAuth, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);

  const body = init.body;
  if (body && typeof body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let sentAuthorization = false;
  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      sentAuthorization = true;
    }
  }

  const base = getPatientApiBase();
  const rel = path.replace(/^\//, "");
  const url = `${base}/${rel}`;

  // Avoid stale API responses (304 + cached body) differing from Postman / server truth.
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-cache");
  }
  if (!headers.has("Pragma")) {
    headers.set("Pragma", "no-cache");
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    cache: rest.cache ?? "no-store",
  });
  if (res.status === 401 && sentAuthorization) {
    clearSession();
    globalThis.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
  }

  return res;
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
