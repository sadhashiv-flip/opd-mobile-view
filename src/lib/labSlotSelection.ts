import type { DiagnosticSlotPick } from "@/api/patientDiagnosticsLab";

export type LabSlotBuckets = Readonly<{
  morning: readonly DiagnosticSlotPick[];
  afternoon: readonly DiagnosticSlotPick[];
  evening: readonly DiagnosticSlotPick[];
}>;

export function labSlotsBucketsEmpty(buckets: LabSlotBuckets): boolean {
  return buckets.morning.length === 0 && buckets.afternoon.length === 0 && buckets.evening.length === 0;
}
