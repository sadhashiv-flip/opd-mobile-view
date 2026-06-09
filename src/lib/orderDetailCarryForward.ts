/**
 * When `GET /invoice/:id` returns a sparse body after payment (status updated but
 * `info.details` empty), merge missing fields from the previous response — parity with
 * patient_app carrying payment quote + invoice into the success summary.
 */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function isNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function isNonEmptyArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0;
}

function isNonEmptyRecord(v: unknown): v is Record<string, unknown> {
  const r = asRecord(v);
  return r != null && Object.keys(r).length > 0;
}

function readInfo(payload: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(payload.info);
  if (direct) return direct;
  const inv = asRecord(payload.invoice);
  if (inv) {
    const fromInv = asRecord(inv.info);
    if (fromInv) return fromInv;
  }
  const data = asRecord(payload.data);
  if (data) {
    const nested = asRecord(data.info);
    if (nested) return nested;
    const inv2 = asRecord(data.invoice);
    if (inv2) {
      const fromInv2 = asRecord(inv2.info);
      if (fromInv2) return fromInv2;
    }
  }
  return null;
}

function writeInfo(payload: Record<string, unknown>, info: Record<string, unknown>): void {
  if (asRecord(payload.info)) {
    payload.info = info;
    return;
  }
  const data = asRecord(payload.data);
  if (data && asRecord(data.info)) {
    data.info = info;
    payload.data = data;
    return;
  }
  const inv = asRecord(payload.invoice);
  if (inv && asRecord(inv.info)) {
    inv.info = info;
    payload.invoice = inv;
    return;
  }
  payload.info = info;
}

function mergeRecordDeep(
  previous: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!previous) return incoming;
  if (!incoming) return previous;
  const out: Record<string, unknown> = { ...previous };
  for (const [key, incVal] of Object.entries(incoming)) {
    const prevVal = previous[key];
    if (isNonEmptyArray(incVal)) {
      out[key] = incVal;
      continue;
    }
    if (isNonEmptyRecord(incVal)) {
      const mergedChild = mergeRecordDeep(asRecord(prevVal), incVal);
      out[key] = mergedChild ?? incVal;
      continue;
    }
    if (isNonEmptyString(incVal)) {
      out[key] = incVal;
      continue;
    }
    if (incVal != null && typeof incVal !== "object") {
      out[key] = incVal;
      continue;
    }
    if (prevVal !== undefined) {
      out[key] = prevVal;
    }
  }
  return out;
}

function mergeInfoCarryForward(
  previous: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!previous) return incoming;
  if (!incoming) return previous;

  const merged = mergeRecordDeep(previous, incoming);
  if (!merged) return incoming;

  const statusKeys = ["status", "status_text", "statusText", "cancellation_reason", "cancellationReason"];
  for (const key of statusKeys) {
    if (incoming[key] !== undefined && incoming[key] !== null) {
      merged[key] = incoming[key];
    }
  }

  const prevDetails = asRecord(previous.details);
  const incDetails = asRecord(incoming.details);
  merged.details = mergeRecordDeep(prevDetails, incDetails) ?? incDetails ?? prevDetails;

  if (isNonEmptyArray(incoming.attachments)) merged.attachments = incoming.attachments;
  else if (isNonEmptyArray(previous.attachments)) merged.attachments = previous.attachments;

  if (isNonEmptyArray(incoming.reports)) merged.reports = incoming.reports;
  else if (isNonEmptyArray(previous.reports)) merged.reports = incoming.reports;

  const prevAdd = asRecord(previous.additional_info) ?? asRecord(previous.additionalInfo);
  const incAdd = asRecord(incoming.additional_info) ?? asRecord(incoming.additionalInfo);
  const mergedAdd = mergeRecordDeep(prevAdd, incAdd);
  if (mergedAdd) {
    merged.additional_info = mergedAdd;
    delete merged.additionalInfo;
  }

  return merged;
}

function serviceRequestDetailsHasContent(details: Record<string, unknown> | null): boolean {
  if (!details) return false;
  if (details.slot != null) return true;
  if (isNonEmptyRecord(details.center)) return true;
  if (details.address != null) return true;
  if (isNonEmptyArray(details.request)) return true;
  if (isNonEmptyRecord(details.visitor_info) || isNonEmptyRecord(details.visitorInfo)) return true;
  if (isNonEmptyString(details.preferred_date_time) || isNonEmptyString(details.booking_time)) {
    return true;
  }
  return false;
}

/** True when `info.details` lacks slot / center / address / request data the detail UI needs. */
export function isSparseServiceRequestInvoicePayload(payload: Record<string, unknown>): boolean {
  const info = readInfo(payload);
  if (!info) return true;
  return !serviceRequestDetailsHasContent(asRecord(info.details));
}

function mergeArrayPreferIncoming(previous: unknown, incoming: unknown): unknown {
  if (isNonEmptyArray(incoming)) return incoming;
  if (isNonEmptyArray(previous)) return previous;
  return incoming ?? previous;
}

/**
 * Overlay `incoming` on `previous` when the new invoice response is sparse after payment.
 * Fresh status / payments win; missing detail fields are carried forward.
 */
export function carryForwardServiceRequestInvoicePayload(
  previous: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!previous) return incoming;
  if (!isSparseServiceRequestInvoicePayload(incoming)) return incoming;
  if (isSparseServiceRequestInvoicePayload(previous)) return incoming;

  const merged = mergeRecordDeep(previous, incoming) ?? incoming;

  const prevInfo = readInfo(previous);
  const incInfo = readInfo(incoming);
  const mergedInfo = mergeInfoCarryForward(prevInfo, incInfo);
  if (mergedInfo) writeInfo(merged, mergedInfo);

  merged.user = incoming.user ?? previous.user ?? merged.user;
  merged.payments = mergeArrayPreferIncoming(previous.payments, incoming.payments);
  merged.items = mergeArrayPreferIncoming(previous.items, incoming.items);
  merged.details = mergeArrayPreferIncoming(previous.details, incoming.details);

  const prevInv = asRecord(previous.invoice);
  const incInv = asRecord(incoming.invoice);
  if (prevInv || incInv) {
    const mergedInv = mergeRecordDeep(prevInv, incInv);
    if (mergedInv) {
      mergedInv.details = mergeArrayPreferIncoming(prevInv?.details, incInv?.details);
      const mergedInvInfo = mergeInfoCarryForward(
        asRecord(prevInv?.info),
        asRecord(incInv?.info),
      );
      if (mergedInvInfo) mergedInv.info = mergedInvInfo;
      merged.invoice = mergedInv;
    }
  }

  const prevData = asRecord(previous.data);
  const incData = asRecord(incoming.data);
  if (prevData || incData) {
    let mergedData = mergeRecordDeep(prevData, incData) ?? incData ?? prevData;
    if (mergedData) {
      const mergedDataInfo = mergeInfoCarryForward(
        asRecord(prevData?.info),
        asRecord(incData?.info),
      );
      if (mergedDataInfo) mergedData = { ...mergedData, info: mergedDataInfo };

      const prevDataInv = asRecord(prevData?.invoice);
      const incDataInv = asRecord(incData?.invoice);
      const mergedDataInv = mergeRecordDeep(prevDataInv, incDataInv);
      if (mergedDataInv) {
        const mergedDataInvInfo = mergeInfoCarryForward(
          asRecord(prevDataInv?.info),
          asRecord(incDataInv?.info),
        );
        if (mergedDataInvInfo) mergedDataInv.info = mergedDataInvInfo;
        mergedData = { ...mergedData, invoice: mergedDataInv };
      }
      merged.data = mergedData;
    }
  }

  const envelopeKey = "__FH_DATA_ADDITIONAL_INFO__";
  if (previous[envelopeKey] != null && incoming[envelopeKey] == null) {
    merged[envelopeKey] = previous[envelopeKey];
  }

  return merged;
}
