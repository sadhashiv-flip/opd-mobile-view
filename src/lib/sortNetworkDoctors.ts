import type { NetworkListDoctorRow } from "@/api/networkList";
import { resolveConsultationFeeDisplay } from "@/lib/networkDoctorCardUi";
import type { SortOptionId } from "@/components/sort/SortSheet";

/** Parses `21+ years exp` / numeric experience into sortable years. */
export function parseDoctorExperienceYears(expLabel: string): number {
  const t = expLabel.trim();
  if (!t) return 0;
  const m = /(\d+)/.exec(t);
  return m ? Number.parseInt(m[1], 10) || 0 : 0;
}

function doctorFee(d: NetworkListDoctorRow): number {
  return resolveConsultationFeeDisplay(d) ?? 0;
}

/** Client-side sort for hospital doctor list (SortSheet options). */
export function sortNetworkDoctors(
  rows: readonly NetworkListDoctorRow[],
  sortId: SortOptionId,
): readonly NetworkListDoctorRow[] {
  if (sortId === "relevance" || sortId === "distance") {
    // API relevance order; distance not returned on list rows.
    return rows;
  }
  const list = [...rows];
  switch (sortId) {
    case "experience":
      return list.sort(
        (a, b) => parseDoctorExperienceYears(b.expLabel) - parseDoctorExperienceYears(a.expLabel),
      );
    case "feesLowHigh":
      return list.sort((a, b) => doctorFee(a) - doctorFee(b));
    case "feesHighLow":
      return list.sort((a, b) => doctorFee(b) - doctorFee(a));
    default:
      return rows;
  }
}
