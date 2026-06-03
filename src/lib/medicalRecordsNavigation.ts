import { generatePath, type NavigateFunction } from "react-router-dom";
import { ROUTES } from "@/constants";
import type { MedicalRecordCategoryDef } from "@/constants/medicalRecordsCategories";
import {
  labTestInvoiceId,
  labTestOrderDetailId,
  prescriptionId,
  pickStr,
  serviceRequestInvoiceId,
  serviceRequestType,
} from "@/lib/medicalRecordRow";
import { consultationInvoiceId } from "@/lib/consultationRecordRow";
import { pathToOrderDetail } from "@/lib/orderDetailRoutes";

export type MedicalRecordsNavigate = NavigateFunction;

function orderKindForServiceType(typeNorm: string): string {
  if (typeNorm === "mentalwellness") return "mental-wellness";
  if (typeNorm === "nutrition" || typeNorm === "yoga" || typeNorm === "diet&nutrition") return "nutrition";
  if (typeNorm === "dental") return "dental";
  if (typeNorm === "vision") return "vision";
  if (typeNorm === "vaccine") return "vaccine";
  return "other";
}

/**
 * Opens the same invoice detail flows as patient-app `MedicalRecordsOrderNavigation`.
 */
export function openMedicalRecordRow(
  navigate: MedicalRecordsNavigate,
  category: MedicalRecordCategoryDef,
  row: Record<string, unknown>,
  onMissing: (message: string) => void,
): void {
  switch (category.slug) {
    case "consultations": {
      const inv = consultationInvoiceId(row);
      if (inv) {
        navigate(pathToOrderDetail("consultation", inv));
        return;
      }
      onMissing("Order details are not available for this visit.");
      return;
    }
    case "lab-tests": {
      const inv = labTestInvoiceId(row) || labTestOrderDetailId(row);
      if (inv) {
        navigate(pathToOrderDetail("lab", inv));
        return;
      }
      onMissing("Order details are not available for this lab test.");
      return;
    }
    case "prescriptions": {
      const id = prescriptionId(row);
      if (id) {
        navigate(generatePath(ROUTES.medicalRecordsPrescriptionDetail, { prescriptionId: id }), {
          state: {
            row,
            returnPath: generatePath(ROUTES.medicalRecordsCategory, { categorySlug: "prescriptions" }),
          },
        });
        return;
      }
      onMissing("Prescription details are not available.");
      return;
    }
    case "mental-wellness":
    case "nutrition":
    case "dental":
    case "vision":
    case "vaccine": {
      const inv = serviceRequestInvoiceId(row);
      if (!inv) {
        onMissing("No order linked to this record.");
        return;
      }
      const kind = orderKindForServiceType(serviceRequestType(row) || category.apiSegment);
      navigate(pathToOrderDetail(kind, inv));
      return;
    }
    default:
      break;
  }

  const genericInv = pickStr(row.invoice_id, row.invoiceId);
  if (genericInv) {
    navigate(pathToOrderDetail("other", genericInv));
  }
}
