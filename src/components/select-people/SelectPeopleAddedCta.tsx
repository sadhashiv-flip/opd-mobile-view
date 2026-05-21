import { SELECT_PEOPLE_COPY } from "@/lib/selectPeopleShared";

/** patient-app `UserCard` — primary pill with check + “Added”. */
export function SelectPeopleAddedCta() {
  return (
    <span className="hc-person__cta hc-person__cta--added">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {SELECT_PEOPLE_COPY.added}
    </span>
  );
}
