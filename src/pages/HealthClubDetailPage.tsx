import { fetchPatientBlogs } from "@/api/patientBlogs";
import { BlogCoverImage } from "@/components/healthClub/BlogCoverImage";
import { metaListRow } from "@/components/healthClub/healthClubMeta";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import {
  blogCoverImageUrl,
  normalizeBlogHtml,
  parseHealthClubBlog,
  type HealthClubBlog,
} from "@/lib/healthClubBlog";
import { blogMatchesPathParam } from "@/lib/healthClubBlogSlug";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./DigitalDiaryPages.css";
import "./HealthClubDetailPage.css";

function blogFromLocationState(raw: unknown): HealthClubBlog | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rj = o.rawJson;
  if (rj && typeof rj === "object" && !Array.isArray(rj)) {
    return parseHealthClubBlog(rj as Record<string, unknown>);
  }
  return parseHealthClubBlog(o as Record<string, unknown>);
}

export function HealthClubDetailPage() {
  const { blogId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromNav = blogFromLocationState(
    typeof location.state === "object" && location.state !== null && "blog" in location.state
      ? (location.state as { blog?: unknown }).blog
      : undefined,
  );

  const hydratedFromNav =
    fromNav && blogMatchesPathParam(fromNav, blogId) ? fromNav : null;

  const [blog, setBlog] = useState<HealthClubBlog | null>(() => hydratedFromNav);
  const [loading, setLoading] = useState(() => !hydratedFromNav);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fromRoute = fromNav && blogMatchesPathParam(fromNav, blogId) ? fromNav : null;
    if (fromRoute) {
      setBlog(fromRoute);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchPatientBlogs({ page: 1, limit: 100 });
        if (cancelled) return;
        const found = rows.find((b) => blogMatchesPathParam(b, blogId));
        setBlog(found ?? null);
        setError(found ? null : "Unable to load this article.");
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load article.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blogId, fromNav]);

  const url = blog ? blogCoverImageUrl(blog.imagePath) : null;
  const html = blog ? normalizeBlogHtml(blog.description) : "";
  const metaLine = blog ? metaListRow(blog) : "";

  return (
    <div className="hc-detail-page">
      <header className="dd-screen-header hc-detail-page__header">
        <button
          type="button"
          className="dd-screen-header__back"
          aria-label="Back"
          onClick={() => navigate(ROUTES.healthClub)}
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
      </header>

      <main className="hc-detail-page__main">
        {loading && !blog ? (
          <div className="hc-detail-loading" role="status">
            <div className="hc-list-spinner" aria-hidden />
          </div>
        ) : null}

        {!loading && !blog ? (
          <p className="hc-detail-fallback">
            {error ?? "Unable to load this article."}
          </p>
        ) : null}

        {blog ? (
          <article className="hc-detail-article">
            <div className="hc-detail-hero">
              <BlogCoverImage url={url} size="detail" />
            </div>
            <h2 className="hc-detail-title">{blog.title}</h2>
            {metaLine ? <p className="hc-detail-meta">{metaLine}</p> : null}
            <div className="hc-detail-card">
              {html ? (
                <div className="hc-detail-html" dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <p className="hc-detail-plain">Article details are not available right now.</p>
              )}
            </div>
          </article>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
