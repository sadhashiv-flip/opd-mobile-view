import splashDiagnostics from "@/assets/images/splash/splash.png";
import splashChronic from "@/assets/images/splash/splash1.png";
import splashAnnual from "@/assets/images/splash/splash2.png";

export type SplashSlide = Readonly<{
  image: string;
  title: string;
  subtitle: string;
}>;

export const SPLASH_SLIDES: readonly SplashSlide[] = [
  {
    image: splashDiagnostics,
    title: "Book Diagnostics",
    subtitle: "Book lab tests/health check ups",
  },
  {
    image: splashChronic,
    title: "Chronic Medication",
    subtitle: "Dedicated chronic medication",
  },
  {
    image: splashAnnual,
    title: "Annual Health Checkup",
    subtitle: "Book annual health checkup and stay updated",
  },
];
