import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { DIGITAL_DIARY_COPY } from "@/constants/digitalDiaryCopy";
import { DIGITAL_DIARY_SECTIONS } from "@/lib/digitalDiary";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import "./DigitalDiaryPages.css";

function HubTileIcon({ kind }: { kind: string }) {
  const c = "#ff5224";
  const stroke = 1.6;
  switch (kind) {
    case "water":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3s6 7 6 12a6 6 0 11-12 0c0-5 6-12 6-12z"
            stroke={c}
            strokeWidth={stroke}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "workout":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 10h10M9 16l1.5-6M15 16l-1.5-6"
            stroke={c}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path d="M5 14h3M16 14h3" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "GL":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4v16M8 8h8" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "BP":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 13h10v6H7zM9 13V9a3 3 0 016 0v4"
            stroke={c}
            strokeWidth={stroke}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "TEMP":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M10 14V6a3 3 0 116 0v8" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
          <circle cx="13" cy="17" r="3" stroke={c} strokeWidth={stroke} />
        </svg>
      );
    case "O2":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 14a7 7 0 0114 0M8 14h8" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "HR":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 12h3l2-7 4 14 2-7h5"
            stroke={c}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "height":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4v16M9 8l3-4 3 4" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "weight":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="6" y="8" width="12" height="10" rx="2" stroke={c} strokeWidth={stroke} />
          <path d="M9 8V6a3 3 0 016 0v2" stroke={c} strokeWidth={stroke} />
        </svg>
      );
    case "sleep":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 12a5 5 0 018-4M15 18a8 8 0 01-14-6" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "symptom":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 16l2-4 3 5 3-9" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
          <circle cx="8" cy="8" r="2" stroke={c} strokeWidth={stroke} />
        </svg>
      );
    case "mood":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke={c} strokeWidth={stroke} />
          <path d="M9 15h6M9 10h.01M15 10h.01" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      );
    case "medicine":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M10 6h8v8h-8zM6 14l8-8" stroke={c} strokeWidth={stroke} strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke={c} strokeWidth={stroke} />
        </svg>
      );
  }
}

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
          className="dd-screen-header__back"
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v4M12 17v4M4 12h4M16 12h4"
                stroke="#ff5224"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="3" stroke="#ff5224" strokeWidth="1.8" />
            </svg>
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
                    <HubTileIcon kind={item.apiArg} />
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
