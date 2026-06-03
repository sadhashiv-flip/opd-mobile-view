import splashImage1 from "@/assets/images/splash/splash_image_1.svg";
import splashImage2 from "@/assets/images/splash/splash_image_2.svg";
import splashImage3 from "@/assets/images/splash/splash_image_3.svg";

/** Matches patient-app `OnboardingController` / `AppString.kOnboardingScreen*`. */
export type SplashSlide = Readonly<{
  image: string;
  title: string;
  subtitle: string;
}>;

export const SPLASH_SLIDES: readonly SplashSlide[] = [
  {
    image: splashImage1,
    title: "Book Diagnostics",
    subtitle: "Book lab tests/health check ups",
  },
  {
    image: splashImage2,
    title: "Chronic Medication",
    subtitle: "Dedicated chronic medication",
  },
  {
    image: splashImage3,
    title: "Annual Health Checkup",
    subtitle: "Book annual health checkup and stay\nupdated",
  },
];
