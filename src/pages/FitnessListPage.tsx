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

const FITNESS_HEART_PATH =
  "M20.5 4.609A5.811 5.811 0 0 0 16 2.5a5.75 5.75 0 0 0-4 1.455A5.75 5.75 0 0 0 8 2.5 5.811 5.811 0 0 0 3.5 4.609c-.953 1.156-1.95 3.249-1.289 6.66 1.055 5.447 8.966 9.917 9.3 10.1a1 1 0 0 0 .974 0c.336-.187 8.247-4.657 9.3-10.1C22.45 7.858 21.453 5.765 20.5 4.609Zm-.674 6.28C19.08 14.74 13.658 18.322 12 19.34c-2.336-1.41-7.142-4.95-7.821-8.451-.513-2.646.189-4.183.869-5.007A3.819 3.819 0 0 1 8 4.5a3.493 3.493 0 0 1 3.115 1.469 1.005 1.005 0 0 0 1.76.011A3.489 3.489 0 0 1 16 4.5a3.819 3.819 0 0 1 2.959 1.382C19.637 6.706 20.339 8.243 19.826 10.889Z";

function FitnessHeartIcon({
  size = 22,
  filled = false,
}: Readonly<{ size?: number; filled?: boolean }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={FITNESS_HEART_PATH}
        fill="currentColor"
        opacity={filled ? 1 : 0.42}
      />
    </svg>
  );
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

  const headerRight = useMemo(() => {
    if (view === "browse") {
      return (
        <button
          type="button"
          className="fitness-list__header-action"
          aria-label="Open favorites"
          onClick={() => setView("favorites")}
        >
          <FitnessHeartIcon />
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
                        <FitnessHeartIcon size={20} filled={tag.isFavorite === 1} />
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
          className="app-back-btn dd-screen-header__back"
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
