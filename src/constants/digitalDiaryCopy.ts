/**
 * User-facing copy aligned with `patient_app` `lib/core/constants/string_define.dart`
 * (digital diary / activities). Single source for the React app.
 */
export const DIGITAL_DIARY_COPY = {
  /** `kDigitalDiaryAppBarTitle` */
  appBarTitle: "Digital Diary",
  /** `kDashboardActivitiesTitle` */
  dashboardActivitiesTitle: "Your Digital Diary",
  /** `kDashboardActivitiesSubtitle` */
  dashboardActivitiesSubtitle:
    "Jot down vitals, water, workouts, mood and medicines - your day to day health story, organised in one place",
  /** `kDashboardActivitiesCta` */
  dashboardActivitiesCta: "Open Diary",
  /** `kActivitiesHubIntro` */
  hubIntro:
    "Pick a category to review your history by day. Everything is grouped so you can find it quickly.",
  /** `kActivitiesSectionDailyHabits` */
  sectionDailyHabits: "Daily habits",
  /** `kActivitiesSectionVitals` */
  sectionVitals: "Vitals",
  /** `kActivitiesSectionBodySleep` */
  sectionBodySleep: "Body & sleep",
  /** `kActivitiesSectionWellness` */
  sectionWellness: "Symptoms & wellness",
  /** `kActivityLogEmpty` */
  logEmpty: "No entries for this day",
  /** `kActivityLogRetry` */
  logRetry: "Try again",
  /** `kActivitySubmitSuccess` */
  submitSuccess: "Saved to your diary",
  /** `kActivitySubmitError` */
  submitError: "Could not save. Please try again.",
  /** `kActivitySheetSave` */
  sheetSave: "Save",
  /** `kActivityFabAdd` */
  fabAdd: "Add",
  /** `kActivityAddOnlyToday` */
  addOnlyToday: "You can add new entries for today only.",
  /** In-form load error (web log page) */
  logLoadError: "Could not load activities.",
  /** Workout log — inline catalog (patient_app activity_log_screen) */
  workoutAddExercise: "Add exercise",
  workoutChooseTitle: "Choose a workout",
  workoutSearchPlaceholder: "Search by name",
  workoutSearchClear: "Clear",
  workoutLoadMore: "Load more",
  workoutNoResults: "No workouts found. Try another search.",
  workoutMinutesTitle: "Duration",
  workoutMinutesLabel: "Minutes",
  workoutCancelCatalog: "Cancel",
  workoutLogSectionTitle: "Your log for this day",
  workoutCatalogGenericError: "Could not load workouts. Please try again.",
  /** `ActivitiesRepository` catch-all (patient_app) */
  loadActivitiesGenericError: "Could not load activities. Please try again.",
  /**
   * Services hub help card — concise entry line (patient `kActivitiesSubtitle` is
   * “Check your activities”; this stays as the richer web teaser).
   */
  helpHubDigitalDiaryDescription:
    "Check your activities",
  /** `kActivitiesSubtitle` — medical records / view-more hub card */
  activitiesHubSubtitle:
    "Log water, mood, vitals, and daily health activities in one place.",
} as const;
