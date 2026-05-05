import {
  fetchFitnessCategories,
  fetchFitnessFavorites,
  filterFitnessCategoriesForUi,
  toggleFitnessFavorite,
  type FitnessCategory,
  type FitnessFavoriteRow,
  type FitnessTag,
} from "@/api/patientFitness";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { writeFitnessTagSnapshot } from "@/constants/fitnessSessionStorage";
import { useToast } from "@/hooks/useToast";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import "./DigitalDiaryPages.css";
import "./FitnessListPage.css";

function tagImageUrl(tag: FitnessTag): string | null {
  return resolveProfileImageUrl(tag.image?.trim() ? tag.image : null);
}

export function FitnessListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState<readonly FitnessCategory[]>([]);
  const [favorites, setFavorites] = useState<readonly FitnessFavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [favLoading, setFavLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"browse" | "favorites">("browse");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchFitnessCategories();
      setCategories(filterFitnessCategoriesForUi(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workouts.");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const rows = await fetchFitnessFavorites();
      setFavorites(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load favorites.");
      setFavorites([]);
    } finally {
      setFavLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (view === "favorites") void loadFavorites();
  }, [view, loadFavorites]);

  const openTag = useCallback(
    (tag: FitnessTag) => {
      const id = String(tag.id).trim();
      writeFitnessTagSnapshot({
        id,
        name: tag.name,
        image: tag.image?.trim() ? tag.image : null,
      });
      void navigate(generatePath(ROUTES.fitnessTag, { tagId: id }));
    },
    [navigate],
  );

  const openFavorite = useCallback(
    (row: FitnessFavoriteRow) => {
      const tag = row.item;
      const idRaw = row.item_id ?? tag?.id;
      if (idRaw == null) return;
      const id = String(idRaw).trim();
      const name =
        (typeof row.name === "string" && row.name.trim()) ||
        tag?.name ||
        "Workout";
      writeFitnessTagSnapshot({
        id,
        name,
        image: tag?.image?.trim() ? tag.image : null,
      });
      void navigate(generatePath(ROUTES.fitnessTag, { tagId: id }));
    },
    [navigate],
  );

  const onToggleFavorite = useCallback(
    async (tag: FitnessTag, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const msg = await toggleFitnessFavorite(String(tag.id));
        if (msg) toast.success(msg);
        await loadCategories();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update favorite.");
      }
    },
    [loadCategories, toast],
  );

  const joinLiveYoga = useCallback(() => {
    void navigate(ROUTES.dashboard);
  }, [navigate]);

  const headerRight = useMemo(() => {
    if (view === "browse") {
      return (
        <button
          type="button"
          className="fitness-list__header-action"
          aria-label="Open favorites"
          onClick={() => setView("favorites")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 21s-6.716-4.432-9.33-8.23C.62 9.45 1.86 6 5.16 6c2.092 0 3.38 1.144 3.84 1.816C9.46 7.144 10.748 6 12.84 6 14.14 6 15.38 6.856 16 8.06 15.62 8.552 15 9.27 15 10.16c0 2.228-1.792 4.432-4.33 8.23L12 21z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      );
    }
    return null;
  }, [view]);

  let body: ReactNode;
  if (loading && categories.length === 0) {
    body = (
      <div className="fitness-list__loading" role="status">
        <div className="fitness-list__spinner" aria-hidden />
        <span className="visually-hidden">Loading workouts</span>
      </div>
    );
  } else if (view === "favorites") {
    body = (
      <div className="fitness-list__favorites">
        <p className="fitness-list__hint">
          Tap a saved workout to open exercise videos.
        </p>
        {favLoading && favorites.length === 0 ? (
          <div className="fitness-list__loading fitness-list__loading--inline" role="status">
            <div className="fitness-list__spinner" aria-hidden />
          </div>
        ) : favorites.length === 0 ? (
          <p className="fitness-list__empty">No favorites yet. Tap the heart on an exercise card.</p>
        ) : (
          <ul className="fitness-list__fav-grid">
            {favorites.map((row, idx) => {
              const tag = row.item;
              const title =
                (typeof row.name === "string" && row.name.trim()) || tag?.name || "Workout";
              const img = tag ? tagImageUrl(tag) : null;
              return (
                <li key={`${row.item_id ?? idx}-${title}`}>
                  <button
                    type="button"
                    className="fitness-card"
                    onClick={() => openFavorite(row)}
                  >
                    <div className="fitness-card__media">
                      {img ? (
                        <img src={img} alt="" className="fitness-card__img" draggable={false} />
                      ) : (
                        <div className="fitness-card__placeholder" aria-hidden />
                      )}
                    </div>
                    <div className="fitness-card__body">
                      <span className="fitness-card__title">{title}</span>
                      <span className="fitness-card__meta fitness-card__meta--muted">
                        Saved workout
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  } else if (!loading && categories.length === 0) {
    body = (
      <p className="fitness-list__empty">
        {error ?? "No workout categories are available right now."}
      </p>
    );
  } else {
    body = (
      <>
        <section className="fitness-hero" aria-label="Fitness">
          <div className="fitness-hero__banner">
            <h2 className="fitness-hero__headline">Train anywhere</h2>
            <p className="fitness-hero__sub">Guided exercises by category</p>
          </div>
        </section>


        <div className="fitness-list__sections">
          {categories.map((cat) => (
            <section key={cat.name} className="fitness-section">
              <h3 className="fitness-section__title">{cat.name}</h3>
              <div className="fitness-section__scroll">
                {cat.tags.map((tag) => {
                  const img = tagImageUrl(tag);
                  return (
                    <article key={String(tag.id)} className="fitness-card fitness-card--horizontal">
                      <button
                        type="button"
                        className="fitness-card__surface"
                        onClick={() => openTag(tag)}
                      >
                        <div className="fitness-card__media">
                          {img ? (
                            <img src={img} alt="" className="fitness-card__img" draggable={false} />
                          ) : (
                            <div className="fitness-card__placeholder" aria-hidden />
                          )}
                        </div>
                        <div className="fitness-card__body">
                          <span className="fitness-card__title">{tag.name}</span>
                          <span className="fitness-card__meta">
                            <span className="fitness-card__kcal">Workout</span>
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="fitness-card__fav-hit"
                        aria-label={tag.isFavorite === 1 ? "Remove from favorites" : "Add to favorites"}
                        onClick={(e) => void onToggleFavorite(tag, e)}
                      >
                        {tag.isFavorite === 1 ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                            <path
                              fill="currentColor"
                              d="M12 21s-6.716-4.432-9.33-8.23C.62 9.45 1.86 6 5.16 6c2.092 0 3.38 1.144 3.84 1.816C9.46 7.144 10.748 6 12.84 6 14.14 6 15.38 6.856 16 8.06 15.62 8.552 15 9.27 15 10.16c0 2.228-1.792 4.432-4.33 8.23L12 21z"
                            />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              d="M12 21s-6.716-4.432-9.33-8.23C.62 9.45 1.86 6 5.16 6c2.092 0 3.38 1.144 3.84 1.816C9.46 7.144 10.748 6 12.84 6 14.14 6 15.38 6.856 16 8.06 15.62 8.552 15 9.27 15 10.16c0 2.228-1.792 4.432-4.33 8.23L12 21z"
                            />
                          </svg>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="fitness-list-page">
      <header className="dd-screen-header fitness-list-page__header">
        <button
          type="button"
          className="dd-screen-header__back"
          aria-label="Back"
          onClick={() =>
            view === "favorites" ? setView("browse") : navigate(ROUTES.services)
          }
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
        <h1 className="dd-screen-header__title">
          {view === "favorites" ? "Favorites" : "Fitness"}
        </h1>
        {headerRight}
      </header>

      <main className="fitness-list-page__main">{body}</main>
      <HomeBottomNav />
    </div>
  );
}
