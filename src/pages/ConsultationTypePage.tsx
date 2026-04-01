import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

const toTitle = (type: string) => {
  if (type === "at_hospital") return "Consultation - At Hospital";
  if (type === "virtual") return "Consultation - Virtual";
  return `Consultation - ${type}`;
};

export function ConsultationTypePage() {
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "";
  const title = useMemo(() => toTitle(type || "virtual"), [type]);
  return <PlaceholderPage title={title} />;
}

