import chronicBanner from "@/assets/chronic/chronic_banner.jpg";
import chronicManagementBanner from "@/assets/chronic/chronic_management_banner.png";
import optInBanner from "@/assets/chronic/opt_in.png";
import optInBannerSm from "@/assets/chronic/opt_in_sm.jpg";
import chronicOrderBanner from "@/assets/chronic/order_chronic_medicine.png";
import chronicOrderBannerSm from "@/assets/chronic/order_chronic_medicine_lg.jpg";

import diabetesCard from "@/assets/chronic/diabetes_new.png";
import cadCard from "@/assets/chronic/coronary_new.png";
import hypertensionCard from "@/assets/chronic/hypertension.png";
import thyroidCard from "@/assets/chronic/thyroid.jpg";

import diabetesDetail from "@/assets/chronic/detailed/Diabetes.jpg";
import cadDetail from "@/assets/chronic/detailed/CoronaryArtery.jpg";
import hypertensionDetail from "@/assets/chronic/detailed/Hypertension.jpg";
import thyroidDetail from "@/assets/chronic/detailed/Thyroid.jpg";

import diabetesDetailWide from "@/assets/chronic/detailed/Diabetes_new.png";
import cadDetailWide from "@/assets/chronic/detailed/CoronaryArtery_new.png";
import hypertensionDetailWide from "@/assets/chronic/detailed/Hypertension_new.png";
import thyroidDetailWide from "@/assets/chronic/detailed/Thyroid_new.jpg";

import consultationBanner from "@/assets/chronic/detailed/book_conultation_banner.png";
import yogaBanner from "@/assets/chronic/detailed/yoga_banner.png";
import nutritionBanner from "@/assets/chronic/detailed/nutrition_plan_card.png";
import dietTipsBanner from "@/assets/chronic/detailed/diet_tips.png";

import benefitNutrition from "@/assets/chronic/conditions/nutrition.png";
import benefitFitness from "@/assets/chronic/conditions/fitness.png";
import benefitWebinar from "@/assets/chronic/conditions/webinar.png";
import benefitVitals from "@/assets/chronic/conditions/vitals.png";
import benefitBlogs from "@/assets/chronic/conditions/blogs.png";
import benefitProgress from "@/assets/chronic/conditions/progress.png";
import type { ChronicConditionId } from "@/lib/chronicConditions";

export const CHRONIC_ASSETS = {
  banners: {
    chronicBanner,
    chronicManagementBanner,
    optInBanner,
    optInBannerSm,
    chronicOrderBanner,
    chronicOrderBannerSm,
  },
  enrollBenefits: [
    { title: "Personalized Diet Charts", icon: benefitNutrition },
    { title: "Personalized Fitness Regime", icon: benefitFitness },
    { title: "Wellness Webinars", icon: benefitWebinar },
    { title: "Frequent vital checkup", icon: benefitVitals },
    { title: "Blogs & Newsletters", icon: benefitBlogs },
    { title: "Progress Charts", icon: benefitProgress },
  ] as const,
  detailFeatureBanners: {
    consultationBanner,
    yogaBanner,
    nutritionBanner,
    dietTipsBanner,
  },
} as const;

export const CHRONIC_PROGRAM_CARD_IMAGE: Record<
  ChronicConditionId,
  string
> = {
  Diabetes: diabetesCard,
  CoronaryArtery: cadCard,
  Hypertension: hypertensionCard,
  Thyroid: thyroidCard,
};

export const CHRONIC_DETAIL_HERO_IMAGE: Record<
  ChronicConditionId,
  string
> = {
  Diabetes: diabetesDetail,
  CoronaryArtery: cadDetail,
  Hypertension: hypertensionDetail,
  Thyroid: thyroidDetail,
};

export const CHRONIC_DETAIL_HERO_WIDE_IMAGE: Record<
  ChronicConditionId,
  string
> = {
  Diabetes: diabetesDetailWide,
  CoronaryArtery: cadDetailWide,
  Hypertension: hypertensionDetailWide,
  Thyroid: thyroidDetailWide,
};
