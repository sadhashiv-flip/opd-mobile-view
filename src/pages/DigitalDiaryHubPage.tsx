import {
  DigitalDiaryIntroIcon,
  DigitalDiaryTileIcon,
} from "@/components/digitalDiary/DigitalDiaryHubIcons";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import { DIGITAL_DIARY_SECTIONS } from "@/lib/digitalDiary";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import "./DigitalDiaryPages.css";

export function DigitalDiaryHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath =
    typeof location.state === "object" &&
    location.state !== null &&
    "returnPath" in location.state &&
    typeof (location.state as { returnPath?: unknown }).returnPath === "string"
      ? (location.state as { returnPath: string }).returnPath
      : ROUTES.dashboard;

  return (
    <div className="dd-page">
      <header className="dd-screen-header">
        <button
          type="button"
          className="app-back-btn dd-screen-header__back"
          aria-label="Back"
          onClick={() => navigate(returnPath)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="dd-screen-header__title">{DIGITAL_DIARY_COPY.appBarTitle}</h1>
      </header>

      <main className="dd-hub__main">
        <section className="dd-intro" aria-label={DIGITAL_DIARY_COPY.appBarTitle}>
          <span className="dd-intro__icon" aria-hidden>
            <DigitalDiaryIntroIcon />
          </span>
          <p className="dd-intro__text">{DIGITAL_DIARY_COPY.hubIntro}</p>
        </section>

        {DIGITAL_DIARY_SECTIONS.map((section) => (
          <section key={section.title} className="dd-section">
            <h2 className="dd-section__title">{section.title}</h2>
            <div className="dd-grid">
              {section.items.map((item) => (
                <button
                  key={item.apiArg}
                  type="button"
                  className="dd-tile"
                  onClick={() =>
                    navigate(
                      generatePath(ROUTES.digitalDiaryLog, {
                        activityType: item.apiArg,
                      }),
                      { state: { returnPath: ROUTES.digitalDiary } },
                    )
                  }
                >
                  <span className="dd-tile__icon-wrap" aria-hidden>
                    <DigitalDiaryTileIcon activity={item.apiArg} />
                  </span>
                  <span className="dd-tile__title">{item.title}</span>
                  <span className="dd-tile__hint">{item.hint}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>

      <HomeBottomNav />
    </div>
  );
}
