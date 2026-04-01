import { GYM_IMAGES } from "@/assets/images/gym";

export type GymPlanAccent = "gold" | "orange" | "blue";

export type GymMembershipPlan = Readonly<{
  id: string;
  tier: string;
  months: number;
  oldPrice: number;
  price: number;
  perPerson: string;
  bannerColor: string;
  badgeText: string;
  accent: GymPlanAccent;
  image: string;
  taxFeesLabel: string;
  /** Lines shown in View Benefits popup */
  benefits: readonly string[];
}>;

export const GYM_MEMBERSHIP_PLANS: readonly GymMembershipPlan[] = [
  {
    id: "elite-12",
    tier: "Cult ELITE",
    months: 12,
    oldPrice: 15000,
    price: 11000,
    perPerson: "per person",
    bannerColor: "#1f141f",
    badgeText: "Membership",
    accent: "gold",
    image: GYM_IMAGES.elite12,
    taxFeesLabel: "(+1,560 taxes & fees)",
    benefits: [
      "Yoga",
      "HRX Workout",
      "Cardio",
      "Strength Training",
      "Kick Boxing",
      "Zumba",
    ],
  },
  {
    id: "elite-9",
    tier: "Cult ELITE",
    months: 9,
    oldPrice: 12000,
    price: 9000,
    perPerson: "per person",
    bannerColor: "#21151b",
    badgeText: "Membership",
    accent: "orange",
    image: GYM_IMAGES.elite9,
    taxFeesLabel: "(+1,200 taxes & fees)",
    benefits: [
      "Yoga",
      "HRX Workout",
      "Cardio",
      "Strength Training",
      "Kick Boxing",
      "Zumba",
    ],
  },
  {
    id: "pro-6",
    tier: "Cult PRO",
    months: 6,
    oldPrice: 10000,
    price: 6000,
    perPerson: "per person",
    bannerColor: "#03103f",
    badgeText: "Membership",
    accent: "blue",
    image: GYM_IMAGES.pro6,
    taxFeesLabel: "(+1,080 taxes & fees)",
    benefits: [
      "Yoga",
      "HRX Workout",
      "Cardio",
      "Strength Training",
      "Dance Fitness",
      "Zumba",
    ],
  },
];

/** Phrase for legal copy, e.g. "Cult Elite membership purchase". */
export function getGymMembershipTermsProductPhrase(planId: string | null): string {
  if (!planId) return "Cult Elite membership";
  const plan = GYM_MEMBERSHIP_PLANS.find((p) => p.id === planId);
  if (!plan) return "Cult Elite membership";
  if (plan.id.startsWith("pro")) return "Cult Pro membership";
  return "Cult Elite membership";
}

/** Labels for gym plan ids (shared by plan picker and configure step). */
export function getGymPlanPackageLabel(planId: string | null): string {
  if (!planId) return "Select Package";
  const labels: Record<string, string> = {
    "elite-12": "Cult ELITE — 12 Months",
    "elite-9": "Cult ELITE — 9 Months",
    "pro-6": "Cult PRO — 6 Months",
  };
  return labels[planId] ?? "Select Package";
}
