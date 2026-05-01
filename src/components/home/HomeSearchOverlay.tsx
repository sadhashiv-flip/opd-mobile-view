import type { ScoredHomeSearchAction } from "@/lib/homeSearchScore";
import type { HomeSearchAction } from "@/constants/homeSearchIndex";
import "./HomeSearchOverlay.css";

type HomeSearchOverlayProps = {
  query: string;
  /** Raw field value (for “recent” label when non-empty) */
  results: ScoredHomeSearchAction[];
  recents: string[];
  onResultNavigate: (action: HomeSearchAction) => void;
  onRecentSelect: (text: string) => void;
  onRecentRemove: (text: string) => void;
  onClearRecents: () => void;
};

export function HomeSearchOverlay({
  query,
  results,
  recents,
  onResultNavigate,
  onRecentSelect,
  onRecentRemove,
  onClearRecents,
}: HomeSearchOverlayProps) {
  const q = query.trim();
  const showResults = q.length > 0;

  return (
    <div className="home-search-overlay" role="presentation">
      <div className="home-search-overlay__panel">
        {showResults ? (
          <HomeSearchResultsBody results={results} onPick={onResultNavigate} />
        ) : (
          <HomeSearchRecentsBody
            recents={recents}
            onPick={onRecentSelect}
            onRemove={onRecentRemove}
            onClearAll={onClearRecents}
          />
        )}
      </div>
    </div>
  );
}

function HomeSearchResultsBody({
  results,
  onPick,
}: {
  results: ScoredHomeSearchAction[];
  onPick: (action: HomeSearchAction) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="home-search-overlay__empty">
        <span className="home-search-overlay__empty-icon" aria-hidden>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <p className="home-search-overlay__empty-title">No results found</p>
        <p className="home-search-overlay__empty-sub">Try different keywords</p>
      </div>
    );
  }

  let lastCategory: string | undefined;
  return (
    <ul className="home-search-overlay__list" role="listbox" aria-label="Search suggestions">
      {results.map(({ action }, i) => {
        const showCat = action.category !== lastCategory;
        lastCategory = action.category;
        return (
          <li key={action.id} className="home-search-overlay__item-wrap" role="none">
            {showCat ? (
              <p className="home-search-overlay__category">{action.category.toUpperCase()}</p>
            ) : null}
            <button
              type="button"
              role="option"
              className="home-search-overlay__row"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onPick(action)}
            >
              <span className="home-search-overlay__icon" aria-hidden>
                {action.title.slice(0, 1)}
              </span>
              <span className="home-search-overlay__text">
                <span className="home-search-overlay__title">{action.title}</span>
                <span className="home-search-overlay__subtitle">{action.subtitle}</span>
              </span>
              <span className="home-search-overlay__arrow" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 17L17 7M17 7H9M17 7v8"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function HomeSearchRecentsBody({
  recents,
  onPick,
  onRemove,
  onClearAll,
}: {
  recents: string[];
  onPick: (text: string) => void;
  onRemove: (text: string) => void;
  onClearAll: () => void;
}) {
  if (recents.length === 0) {
    return (
      <div className="home-search-overlay__hint">
        <span className="home-search-overlay__hint-icon" aria-hidden>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <p className="home-search-overlay__hint-text">
          Search for services, medicines, tests, claims…
        </p>
      </div>
    );
  }

  return (
    <div className="home-search-overlay__recents">
      <div className="home-search-overlay__recents-head">
        <span className="home-search-overlay__recents-label">Recent searches</span>
        <button type="button" className="home-search-overlay__clear-all" onClick={onClearAll}>
          Clear all
        </button>
      </div>
      <ul className="home-search-overlay__list home-search-overlay__list--recents" role="list">
        {recents.map((text) => (
          <li key={text} className="home-search-overlay__recent-li">
            <button
              type="button"
              className="home-search-overlay__recent-row"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onPick(text)}
            >
              <span className="home-search-overlay__recent-ic" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="home-search-overlay__recent-text">{text}</span>
            </button>
            <button
              type="button"
              className="home-search-overlay__recent-remove"
              aria-label={`Remove ${text}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onRemove(text)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
