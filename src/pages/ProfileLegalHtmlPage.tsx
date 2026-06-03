import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchLegalPrivacyPolicy,
  fetchLegalTermsAndConditions,
  type LegalHtmlContent,
} from "@/api/legalContent";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { normalizeBlogHtml } from "@/lib/healthClubBlog";
import "./ProfileManagePage.css";
import "./ProfileLegalPages.css";

export type ProfileLegalHtmlKind = "privacy" | "terms";

type ProfileLegalHtmlPageProps = Readonly<{
  kind: ProfileLegalHtmlKind;
}>;

type PageMeta = Readonly<{
  title: string;
  load: () => Promise<LegalHtmlContent>;
  introTitle: string;
  introText: string;
  badgeLabel: string;
}>;

const PAGE_META: Record<ProfileLegalHtmlKind, PageMeta> = {
  privacy: {
    title: "Privacy Policy",
    load: fetchLegalPrivacyPolicy,
    introTitle: "Your privacy matters",
    introText:
      "Learn how we collect, use, and protect your personal and health information when you use Flip Health.",
    badgeLabel: "Privacy",
  },
  terms: {
    title: "Terms & Conditions",
    load: fetchLegalTermsAndConditions,
    introTitle: "Terms of use",
    introText:
      "Please read these terms carefully. They explain your rights and responsibilities when using our services.",
    badgeLabel: "Legal",
  },
};

function formatUpdatedAt(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function IconPrivacy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l7 4v5c0 4.5-3 8.5-7 9-4-.5-7-4.5-7-9V7l7-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTerms() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8l2 2v14H6V4l2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function LegalIntro({
  kind,
  badgeLabel,
  introTitle,
  introText,
  updatedLabel,
}: Readonly<{
  kind: ProfileLegalHtmlKind;
  badgeLabel: string;
  introTitle: string;
  introText: string;
  updatedLabel: string | null;
}>) {
  return (
    <div className={`profile-legal-page__intro profile-legal-page__intro--${kind}`}>
      <span className="profile-legal-page__intro-icon" aria-hidden>
        {kind === "privacy" ? <IconPrivacy /> : <IconTerms />}
      </span>
      <div className="profile-legal-page__intro-body">
        <span className="profile-legal-page__intro-badge">{badgeLabel}</span>
        <h2 className="profile-legal-page__intro-title">{introTitle}</h2>
        <p className="profile-legal-page__intro-text">{introText}</p>
        {updatedLabel ? (
          <p className="profile-legal-page__intro-updated">
            <span className="profile-legal-page__intro-updated-dot" aria-hidden />
            Last updated {updatedLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LegalSkeleton() {
  return (
    <div className="profile-legal-page__skeleton" aria-busy="true" aria-label="Loading content">
      <div className="profile-legal-page__skeleton-intro" />
      <div className="profile-legal-page__skeleton-card">
        <div className="profile-legal-page__skeleton-line profile-legal-page__skeleton-line--lg" />
        <div className="profile-legal-page__skeleton-line" />
        <div className="profile-legal-page__skeleton-line" />
        <div className="profile-legal-page__skeleton-line" />
        <div className="profile-legal-page__skeleton-line profile-legal-page__skeleton-line--short" />
      </div>
    </div>
  );
}

function LegalState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: Readonly<{
  icon: ReactNode;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}>) {
  return (
    <div className="profile-legal-page__state">
      <span className="profile-legal-page__state-icon" aria-hidden>
        {icon}
      </span>
      <p className="profile-legal-page__state-title">{title}</p>
      <p className="profile-legal-page__state-text">{text}</p>
      {actionLabel && onAction ? (
        <button type="button" className="profile-legal-page__retry" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ProfileLegalHtmlPage({ kind }: ProfileLegalHtmlPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const meta = PAGE_META[kind];

  const [content, setContent] = useState<LegalHtmlContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    if (location.state && typeof location.state === "object" && "returnPath" in location.state) {
      const returnPath = (location.state as { returnPath?: unknown }).returnPath;
      if (typeof returnPath === "string" && returnPath.trim()) {
        navigate(returnPath);
        return;
      }
    }
    navigate(ROUTES.profile);
  }, [location.state, navigate]);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await meta.load();
      setContent(data);
    } catch (e) {
      setContent(null);
      setError(e instanceof Error ? e.message : "Could not load content");
    } finally {
      setLoading(false);
    }
  }, [meta]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const html = content?.html ? normalizeBlogHtml(content.html) : "";
  const updatedLabel = formatUpdatedAt(content?.updatedAt ?? null);

  return (
    <div className={`profile-manage-page profile-legal-page profile-legal-page--${kind}`}>
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={handleBack}
          className="app-back-btn profile-manage-page__back"
          aria-label="Back"
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
        <h1 className="profile-manage-page__title">{meta.title}</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-legal-page__main">
        {loading ? <LegalSkeleton /> : null}

        {!loading && error ? (
          <LegalState
            icon={<IconAlert />}
            title={`Couldn't load ${meta.title.toLowerCase()}`}
            text={error}
            actionLabel="Try again"
            onAction={() => void fetchContent()}
          />
        ) : null}

        {!loading && !error && content ? (
          <>
            <div className="profile-legal-page__sticky-head">
              <LegalIntro
                kind={kind}
                badgeLabel={meta.badgeLabel}
                introTitle={meta.introTitle}
                introText={meta.introText}
                updatedLabel={updatedLabel}
              />
              <header className="profile-legal-page__article-head">
                <h2 className="profile-legal-page__article-label">Full document</h2>
                <p className="profile-legal-page__article-hint">Scroll below to read all sections.</p>
              </header>
            </div>

            <div className="profile-legal-page__scroll">
              <article className="profile-legal-page__article" aria-label={meta.title}>
                <div className="profile-legal-page__card">
                {html ? (
                  <div
                    className="profile-legal-page__html"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <LegalState
                    icon={<IconAlert />}
                    title="No content available"
                    text="This document isn't available right now. Please try again later."
                    actionLabel="Refresh"
                    onAction={() => void fetchContent()}
                  />
                )}
                </div>
              </article>
            </div>
          </>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}

export function ProfilePrivacyPolicyPage() {
  return <ProfileLegalHtmlPage kind="privacy" />;
}

export function ProfileTermsPage() {
  return <ProfileLegalHtmlPage kind="terms" />;
}
