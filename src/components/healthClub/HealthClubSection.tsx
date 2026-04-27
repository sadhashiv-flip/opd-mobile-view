import { ROUTES } from "@/constants";
import { useHealthClubBlogs } from "@/hooks/useHealthClubBlogs";
import {
  blogCoverImageUrl,
  shortSubtitle,
  type HealthClubBlog,
} from "@/lib/healthClubBlog";
import { blogRouteParam } from "@/lib/healthClubBlogSlug";
import { BlogCoverImage } from "@/components/healthClub/BlogCoverImage";
import { metaDashboardTile } from "@/components/healthClub/healthClubMeta";
import { generatePath, useNavigate } from "react-router-dom";
import "./HealthClubSection.css";

function DashboardBlogTile({
  blog,
  onOpen,
}: {
  blog: HealthClubBlog;
  onOpen: (b: HealthClubBlog) => void;
}) {
  const url = blogCoverImageUrl(blog.imagePath);
  const meta = metaDashboardTile(blog);

  return (
    <button type="button" className="hc-dash-tile" onClick={() => onOpen(blog)}>
      <div className="hc-dash-tile__thumb">
        <BlogCoverImage url={url} size="dashboard" />
      </div>
      <div className="hc-dash-tile__text">
        <span className="hc-dash-tile__title">{blog.title}</span>
        <span className="hc-dash-tile__sub">{shortSubtitle(blog)}</span>
        {meta ? <span className="hc-dash-tile__meta">{meta}</span> : null}
      </div>
    </button>
  );
}

/** Home dashboard — mirrors Flutter `DashboardHealthClubSection`. */
export function HealthClubSection() {
  const navigate = useNavigate();
  const { blogs, loading } = useHealthClubBlogs();

  const openDetail = (blog: HealthClubBlog) => {
    navigate(generatePath(ROUTES.healthClubDetail, { blogId: blogRouteParam(blog) }), {
      state: { blog },
    });
  };

  const openList = () => navigate(ROUTES.healthClub);

  const showPreview = blogs.length > 0;
  const showViewAll = blogs.length > 3;

  return (
    <section className="hc-section" aria-labelledby="hc-section-title">
      <div className="hc-section__head">
        <h2 id="hc-section-title" className="hc-section__title">
          Health Club
        </h2>
        {showViewAll ? (
          <button type="button" className="hc-section__cta" onClick={openList}>
            View all
          </button>
        ) : null}
      </div>
      <p className="hc-section__subtitle">
        Expert-backed reads to help you stay informed between consultations.
      </p>

      {loading ? (
        <div className="hc-section__skeletons" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="hc-skel-row" />
          ))}
        </div>
      ) : null}

      {!loading && !showPreview ? (
        <div className="hc-empty-card">
          <span className="hc-empty-card__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 19.5A2.5 2.5 0 016.5 17H20"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path d="M8 14V6a4 4 0 018 0v8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <div className="hc-empty-card__text">
            <span className="hc-empty-card__title">Fresh reads coming soon</span>
            <span className="hc-empty-card__sub">
              We are curating helpful wellness and care guides for you.
            </span>
          </div>
        </div>
      ) : null}

      {!loading && showPreview ? (
        <div className="hc-dash-tiles">
          {blogs.slice(0, 3).map((b) => (
            <DashboardBlogTile key={b.id || b.title} blog={b} onOpen={openDetail} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
