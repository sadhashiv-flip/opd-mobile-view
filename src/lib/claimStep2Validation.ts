import type {
  MultiDocumentClaimTypeOption,
  ReimbursementCreateBillFileWithServices,
  RequiredDocRow,
} from "@/api/patientReimbursement";

function rowParticularsRequired(row: RequiredDocRow): boolean {
  return row.particulars?.required === true;
}

function mergedServiceKeysForCategory(
  files: readonly ReimbursementCreateBillFileWithServices[],
  category: string,
): Set<string> {
  const merged = new Set<string>();
  for (const file of files) {
    if ((file.document_type ?? "").trim() !== category.trim()) continue;
    for (const st of file.service_types) {
      const k = st.key.trim();
      if (k) merged.add(k);
    }
  }
  return merged;
}

/** patient_app `ClaimsController._step2ValidationSync` */
export function computeStep2DocumentsValid(
  requiredPayments: readonly RequiredDocRow[],
  requiredReports: readonly RequiredDocRow[],
  paymentFiles: readonly ReimbursementCreateBillFileWithServices[],
  reportFiles: readonly ReimbursementCreateBillFileWithServices[],
): boolean {
  if (!requiredPayments.length && !requiredReports.length) return true;

  for (const row of requiredPayments) {
    if (!rowParticularsRequired(row)) continue;
    const merged = mergedServiceKeysForCategory(paymentFiles, row.category);
    for (const ct of row.claim_type) {
      const ck = ct.key.trim();
      if (ck && !merged.has(ck)) return false;
    }
  }

  for (const row of requiredReports) {
    if (!rowParticularsRequired(row)) continue;
    const merged = mergedServiceKeysForCategory(reportFiles, row.category);
    for (const ct of row.claim_type) {
      const ck = ct.key.trim();
      if (ck && !merged.has(ck)) return false;
    }
  }

  return true;
}

export function annotateRequiredDocMissing(
  rows: readonly RequiredDocRow[],
  files: readonly ReimbursementCreateBillFileWithServices[],
): RequiredDocRow[] {
  return rows.map((row) => {
    if (!rowParticularsRequired(row)) {
      return { ...row, missingReports: [] };
    }
    const merged = mergedServiceKeysForCategory(files, row.category);
    const missing: MultiDocumentClaimTypeOption[] = [];
    for (const ct of row.claim_type) {
      const ck = ct.key.trim();
      if (ck && !merged.has(ck)) missing.push(ct);
    }
    return { ...row, missingReports: missing };
  });
}

export function paymentFileIsGeneral(file: ReimbursementCreateBillFileWithServices): boolean {
  const dt = (file.document_type ?? "").trim();
  return !dt || dt === "PAYMENT";
}

/** patient_app `AppString.kVaccineReportNote` */
export const VACCINE_REPORT_NOTE =
  "Note: For children, please upload the vaccination card. For adults, please upload the prescription/report.";

/** patient_app `_shouldShowVaccineReportNote` — reports section only, `vaccine_report` + `prescribed_vaccine`. */
export function shouldShowVaccineReportNote(
  row: RequiredDocRow,
  refType: "PAYMENT" | "REPORT",
): boolean {
  if (refType !== "REPORT") return false;
  if (row.particulars?.key?.trim() !== "vaccine_report") return false;
  return row.claim_type.some((ct) => ct.key.trim() === "prescribed_vaccine");
}
