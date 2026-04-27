import { fetchPatientBlogs } from "@/api/patientBlogs";
import { BlogCoverImage } from "@/components/healthClub/BlogCoverImage";
import { metaListRow } from "@/components/healthClub/healthClubMeta";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import {
  blogCoverImageUrl,
  shortSubtitle,
  type HealthClubBlog,
} from "@/lib/healthClubBlog";
import { blogRouteParam } from "@/lib/healthClubBlogSlug";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import "./DigitalDiaryPages.css";
import "./HealthClubListPage.css";

export function HealthClubListPage() {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState<readonly HealthClubBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPatientBlogs({ page: 1, limit: 50 });
      setBlogs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load articles.");
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (blog: HealthClubBlog) => {
    navigate(generatePath(ROUTES.healthClubDetail, { blogId: blogRouteParam(blog) }), {
      state: { blog },
    });
  };

  let body: ReactNode;
  if (loading && blogs.length === 0) {
    body = (
      <div className="hc-list-loading" role="status" aria-live="polite">
        <div className="hc-list-spinner" aria-hidden />
        <span className="visually-hidden">Loading articles</span>
      </div>
    );
  } else if (!loading && blogs.length === 0) {
    body = (
      <p className="hc-list-empty">
        {error ?? "We are curating helpful wellness and care guides for you."}
      </p>
    );
  } else {
    body = (
      <ul className="hc-list">
        {blogs.map((blog) => {
          const url = blogCoverImageUrl(blog.imagePath);
          const meta = metaListRow(blog);
          return (
            <li key={blog.id || blog.title}>
              <button type="button" className="hc-list-row" onClick={() => open(blog)}>
                <BlogCoverImage url={url} size="list" />
                <div className="hc-list-row__text">
                  <span className="hc-list-row__title">{blog.title}</span>
                  <span className="hc-list-row__sub">{shortSubtitle(blog)}</span>
                  {meta ? <span className="hc-list-row__meta">{meta}</span> : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="hc-list-page">
      <header className="dd-screen-header hc-list-page__header">
        <button
          type="button"
          className="dd-screen-header__back"
          aria-label="Back"
          onClick={() => navigate(ROUTES.dashboard)}
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
        <h1 className="dd-screen-header__title">Health Club</h1>
        <button
          type="button"
          className="hc-list-page__refresh"
          aria-label="Refresh articles"
          disabled={loading}
          onClick={() => void load()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 12a8 8 0 0113.657-5.657M20 12a8 8 0 01-13.657 5.657M4 12H1m19 0h3M12 4V1m0 19v3"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <main className="hc-list-page__main">{body}</main>

      <HomeBottomNav />
    </div>
  );
}
