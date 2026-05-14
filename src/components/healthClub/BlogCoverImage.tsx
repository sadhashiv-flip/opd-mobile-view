import { useState } from "react";
import "./BlogCoverImage.css";

export function BlogCoverImage({
  url,
  size,
  className = "",
}: {
  url: string | null;
  /** `dashboard` ~84px row thumb, `list` square thumb, `detail` hero */
  size: "dashboard" | "list" | "detail";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const icSize = size === "detail" ? 34 : size === "list" ? 28 : 30;

  if (!url || failed) {
    return (
      <div className={`hc-cover-fallback hc-cover-fallback--${size} ${className}`.trim()} aria-hidden>
        <svg width={icSize} height={icSize} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 19.5A2.5 2.5 0 016.5 17H20"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M6.5 17L9 11l4 6 3-4 4.5 6.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M18 10h.01M14 10a2 2 0 110-4 2 2 0 010 4z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={`hc-cover-img hc-cover-img--${size} ${className}`.trim()}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
