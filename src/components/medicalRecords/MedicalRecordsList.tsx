import { ConsultationRecordsList } from "@/components/medicalRecords/ConsultationRecordsList";
import { HealthRecordsList } from "@/components/medicalRecords/HealthRecordsList";
import { LabTestRecordsList } from "@/components/medicalRecords/LabTestRecordsList";
import { PrescriptionRecordsList } from "@/components/medicalRecords/PrescriptionRecordsList";
import { ServiceRequestRecordsList } from "@/components/medicalRecords/ServiceRequestRecordsList";
import { VitalRecordsList } from "@/components/medicalRecords/VitalRecordsList";
import type { MedicalRecordCategoryDef } from "@/constants/medicalRecordsCategories";
import { openMedicalRecordRow } from "@/lib/medicalRecordsNavigation";
import { useToast } from "@/hooks/useToast";
import { useNavigate } from "react-router-dom";

export type MedicalRecordsListProps = Readonly<{
  category: MedicalRecordCategoryDef;
  rows: readonly Record<string, unknown>[];
  onSymptomOpen?: (row: Record<string, unknown>) => void;
}>;

export function MedicalRecordsList({ category, rows, onSymptomOpen }: MedicalRecordsListProps) {
  const navigate = useNavigate();
  const toast = useToast();

  const onOpen = (row: Record<string, unknown>) => {
    openMedicalRecordRow(navigate, category, row, (msg) => toast.error(msg));
  };

  switch (category.slug) {
    case "consultations":
      return <ConsultationRecordsList rows={rows} />;
    case "lab-tests":
      return <LabTestRecordsList rows={rows} onOpen={onOpen} />;
    case "prescriptions":
      return <PrescriptionRecordsList rows={rows} onOpen={onOpen} />;
    case "mental-wellness":
    case "nutrition":
    case "dental":
    case "vision":
    case "vaccine":
      return <ServiceRequestRecordsList category={category} rows={rows} onOpen={onOpen} />;
    case "vitals":
      return <VitalRecordsList rows={rows} />;
    case "symptoms":
    case "medicines":
    case "moods":
    case "measurements":
    case "womens":
    case "conditions":
      return <HealthRecordsList category={category} rows={rows} onSymptomOpen={onSymptomOpen} />;
    default:
      return null;
  }
}
