import { GYM_IMAGES } from "@/assets/images/gym";
import type { GymCheckPackage } from "@/api/patientGym";
import type { GymMembershipPlan, GymPlanAccent } from "@/constants/gymPlans";

const ACCENTS: readonly GymPlanAccent[] = ["gold", "orange", "blue"];
const CARD_IMAGES = [GYM_IMAGES.elite12, GYM_IMAGES.elite9, GYM_IMAGES.pro6] as const;

function benefitLinesFromTnc(html: string): string[] {
  if (!html.trim()) return ["See terms for details"];
  if (typeof DOMParser === "undefined") return ["See terms for details"];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const items = [...doc.querySelectorAll("li")]
    .map((li) => li.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean);
  return items.length ? items : ["See terms for details"];
}

function validityMonths(pkg: GymCheckPackage): number {
  const u = pkg.validity_units?.toLowerCase() ?? "";
  const v = pkg.validity_value;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  if (u === "months" || u === "month") return Math.round(v);
  if (u === "years" || u === "year") return Math.round(v * 12);
  return Math.round(v);
}

/** Maps a gym/check package to the card + modal shape used across gym flows. */
export function gymPackageToMembershipPlan(pkg: GymCheckPackage, index: number): GymMembershipPlan {
  const accent = ACCENTS[index % ACCENTS.length];
  const image = CARD_IMAGES[index % CARD_IMAGES.length];
  const mrp = pkg.mrp_amount;
  const pay = pkg.pay_amount ?? pkg.package_amount ?? mrp;
  const name = pkg.package_name?.trim() || "Gym membership";
  const words = name.split(/\s+/).filter(Boolean);
  const tierHighlight = words[0] ?? "Membership";

  const months = validityMonths(pkg) || 1;
  const showStrikethrough = mrp > pay && mrp > 0;

  return {
    id: pkg.package_code,
    tier: `Cult ${tierHighlight}`,
    months,
    oldPrice: mrp,
    price: pay,
    perPerson: "per person",
    bannerColor: "#1f141f",
    badgeText: "Membership",
    accent,
    image,
    taxFeesLabel: pkg.enable_wallet ? "Eligible for wallet" : "Pay as shown",
    benefits: benefitLinesFromTnc(pkg.tnc),
    tncHtml: pkg.tnc,
    cardTitle: name,
    packageCode: pkg.package_code,
  };
}
