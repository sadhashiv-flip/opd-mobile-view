import { readAppointmentResponseMessage } from "@/api/appointmentBook";
import { patientFetch } from "@/api/patientHttp";
import { readPatientApiError } from "@/api/patientClient";

/** PATCH `{apiUrl}/appointment/paymentverify` — server verifies Razorpay signature after Checkout.js success. */
export type AppointmentPaymentVerifyBody = Readonly<{
  order_id: string;
  payment_id: string;
  signature: string;
}>;

export type AppointmentPaymentVerifyResult = Readonly<{
  message: string | undefined;
}>;

export async function verifyAppointmentPayment(
  body: AppointmentPaymentVerifyBody,
): Promise<AppointmentPaymentVerifyResult> {
  const res = await patientFetch("appointment/paymentverify", {
    method: "PATCH",
    body: JSON.stringify({
      order_id: body.order_id,
      payment_id: body.payment_id,
      signature: body.signature,
    }),
  });
  if (!res.ok) {
    throw new Error(await readPatientApiError(res));
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // empty body is ok
  }
  return { message: readAppointmentResponseMessage(json) };
}
