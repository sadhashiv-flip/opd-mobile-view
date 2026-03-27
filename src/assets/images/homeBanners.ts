/** Promotional carousel on the home screen — copy and imagery can be swapped without touching UI. */
export type HomeBannerOverlay = "teal" | "indigo" | "amber";

export type HomeBannerSlide = Readonly<{
  id: string;
  image: string;
  title: string;
  date: string;
  cta: string;
  overlay: HomeBannerOverlay;
}>;

export const HOME_BANNER_SLIDES: readonly HomeBannerSlide[] = [
  {
    id: "nutrition",
    image:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80",
    title: "Nutrition Webinar",
    date: "August 22nd, 3:00 PM - 4:00 PM",
    cta: "Join",
    overlay: "teal",
  },
  {
    id: "cardio",
    image:
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80",
    title: "Heart Health Screening",
    date: "September 5th, 10:00 AM - 2:00 PM",
    cta: "Book",
    overlay: "indigo",
  },
  {
    id: "telehealth",
    image:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80",
    title: "24/7 Teleconsultation",
    date: "Video visits · First session complimentary",
    cta: "Learn",
    overlay: "amber",
  },
];
