import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchLegalFaq, type LegalFaqCategory, type LegalFaqQuestion } from "@/api/legalContent";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import "./ProfileManagePage.css";
import "./ProfileFaqPage.css";

const ALL_CATEGORIES = "all";

type FaqSection = Readonly<{
  categoryKey: string;
  categoryLabel: string;
  title: string;
  questions: readonly LegalFaqQuestion[];
}>;

function faqItemKey(categoryIndex: number, questionIndex: number): string {
  return `${categoryIndex}-${questionIndex}`;
}

function sectionKey(section: FaqSection, index: number): string {
  return `${section.categoryKey}-${section.title}-${index}`;
}

function normalizeSections(categories: readonly LegalFaqCategory[]): FaqSection[] {
  return categories.map((block, index) => {
    const categoryLabel = block.category.trim() || "General";
    const title = block.title.trim() || categoryLabel;
    return {
      categoryKey: block.category.trim() || `section-${index}`,
      categoryLabel,
      title,
      questions: block.questions,
    };
  });
}

function matchesSearch(item: LegalFaqQuestion, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.question.toLowerCase().includes(q) ||
    item.answer.toLowerCase().includes(q)
  );
}

function IconSearch() {
  return (
    <svg className="profile-faq-page__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconSection() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h10M4 18h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEmpty() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5a3 3 0 014 0M12 15h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

type FaqAccordionItemProps = Readonly<{
  item: LegalFaqQuestion;
  itemKey: string;
  open: boolean;
  forceExpanded: boolean;
  questionNumber: number;
  onToggle: (key: string) => void;
}>;

function FaqAccordionItem({
  item,
  itemKey,
  open,
  forceExpanded,
  questionNumber,
  onToggle,
}: FaqAccordionItemProps) {
  const expanded = forceExpanded || open;
  const panelId = `faq-answer-${itemKey}`;

  return (
    <li
      className={`profile-faq-page__item${expanded ? " profile-faq-page__item--open" : ""}${forceExpanded ? " profile-faq-page__item--match" : ""}`}
    >
      <button
        type="button"
        className="profile-faq-page__trigger"
        onClick={() => onToggle(itemKey)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className="profile-faq-page__q-badge" aria-hidden>
          {questionNumber}
        </span>
        <span className="profile-faq-page__trigger-body">
          <p className="profile-faq-page__question">{item.question}</p>
        </span>
        <span className="profile-faq-page__chev-btn" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <FaqAnswerPanel id={panelId}>
        {item.answer ? (
          <p className="profile-faq-page__answer">{item.answer}</p>
        ) : (
          <p className="profile-faq-page__answer">No answer provided yet.</p>
        )}
      </FaqAnswerPanel>
    </li>
  );
}

function FaqAnswerPanel({ id, children }: Readonly<{ id: string; children: ReactNode }>) {
  return (
    <div
      id={id}
      className="profile-faq-page__answer-wrap"
    >
      <div className="profile-faq-page__answer-inner">{children}</div>
    </div>
  );
}

type FaqSectionHeadProps = Readonly<{
  section: FaqSection;
  categoryIndex: number;
}>;

function FaqSectionHead({ section, categoryIndex }: FaqSectionHeadProps) {
  return (
    <div className="profile-faq-page__section-head">
      <span className="profile-faq-page__section-icon" aria-hidden>
        <IconSection />
      </span>
      <div className="profile-faq-page__section-meta">
        {section.categoryLabel && section.categoryLabel !== section.title ? (
          <p className="profile-faq-page__section-label">{section.categoryLabel}</p>
        ) : null}
        <h2 id={`profile-faq-section-${categoryIndex}`} className="profile-faq-page__section-title">
          {section.title}
        </h2>
      </div>
      <span className="profile-faq-page__section-count">{section.questions.length}</span>
    </div>
  );
}

export function ProfileFaqPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<readonly LegalFaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLegalFaq();
      setCategories(data);
    } catch (e) {
      setCategories([]);
      setError(e instanceof Error ? e.message : "Could not load FAQs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => normalizeSections(categories), [categories]);

  const categoryChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: { key: string; label: string }[] = [];
    for (const section of sections) {
      const key = section.categoryKey;
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({ key, label: section.categoryLabel });
    }
    return chips;
  }, [sections]);

  const trimmedSearch = searchQuery.trim();
  const isSearching = trimmedSearch.length > 0;

  const filteredSections = useMemo(() => {
    return sections
      .filter((section) => activeCategory === ALL_CATEGORIES || section.categoryKey === activeCategory)
      .map((section) => ({
        ...section,
        questions: section.questions.filter((q) => matchesSearch(q, trimmedSearch)),
      }))
      .filter((section) => section.questions.length > 0);
  }, [sections, activeCategory, trimmedSearch]);

  const totalVisibleQuestions = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.questions.length, 0),
    [filteredSections],
  );

  const handleToggle = useCallback((key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setOpenKey(null);
  }, []);

  const resetFilters = useCallback(() => {
    handleSearchChange("");
    setActiveCategory(ALL_CATEGORIES);
  }, [handleSearchChange]);

  return (
    <div className="profile-manage-page profile-faq-page">
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={handleBack}
          className="profile-manage-page__back"
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
        <h1 className="profile-manage-page__title">FAQs</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-faq-page__main">
        <div className="profile-faq-page__intro">
          <h2 className="profile-faq-page__intro-title">How can we help?</h2>
          <p className="profile-faq-page__intro-text">
            Browse common questions or search below to find answers about your account, bookings, and more.
          </p>
        </div>

        {!loading && !error && sections.length > 0 ? (
          <>
            <label className="profile-faq-page__search-wrap">
              <span className="profile-faq-page__sr-only">Search FAQs</span>
              <IconSearch />
              <input
                type="search"
                className="profile-faq-page__search"
                placeholder="Search questions…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="profile-faq-page__search-clear"
                  aria-label="Clear search"
                  onClick={() => handleSearchChange("")}
                >
                  ×
                </button>
              ) : null}
            </label>

            {categoryChips.length > 1 ? (
              <div className="profile-faq-page__chips" role="tablist" aria-label="FAQ categories">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === ALL_CATEGORIES}
                  className={`profile-faq-page__chip${activeCategory === ALL_CATEGORIES ? " profile-faq-page__chip--active" : ""}`}
                  onClick={() => setActiveCategory(ALL_CATEGORIES)}
                >
                  All
                </button>
                {categoryChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === chip.key}
                    className={`profile-faq-page__chip${activeCategory === chip.key ? " profile-faq-page__chip--active" : ""}`}
                    onClick={() => setActiveCategory(chip.key)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {loading ? (
          <FaqSkeleton />
        ) : null}

        {!loading && error ? (
          <FaqState
            icon={<IconEmpty />}
            title="Couldn't load FAQs"
            text={error}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : null}

        {!loading && !error && sections.length === 0 ? (
          <FaqState
            icon={<IconEmpty />}
            title="No FAQs yet"
            text="Check back later — we're adding helpful answers soon."
          />
        ) : null}

        {!loading && !error && sections.length > 0 && filteredSections.length === 0 ? (
          <FaqState
            icon={<IconSearch />}
            title="No matches found"
            text="Try a different keyword or clear your filters to see all questions."
            actionLabel="Show all FAQs"
            onAction={resetFilters}
          />
        ) : null}

        {!loading && !error && filteredSections.length > 0 ? (
          <>
            {isSearching ? (
              <p className="profile-faq-page__results-hint">
                Showing <strong>{totalVisibleQuestions}</strong>{" "}
                {totalVisibleQuestions === 1 ? "result" : "results"} for &ldquo;{trimmedSearch}&rdquo;
              </p>
            ) : null}

            {filteredSections.map((section, categoryIndex) => (
              <section
                key={sectionKey(section, categoryIndex)}
                className="profile-faq-page__section"
                aria-labelledby={`profile-faq-section-${categoryIndex}`}
              >
                <FaqSectionHead section={section} categoryIndex={categoryIndex} />

                <ul className="profile-faq-page__list">
                  {section.questions.map((item, questionIndex) => {
                    const key = faqItemKey(categoryIndex, questionIndex);
                    return (
                      <FaqAccordionItem
                        key={key}
                        item={item}
                        itemKey={key}
                        open={openKey === key}
                        forceExpanded={isSearching}
                        questionNumber={questionIndex + 1}
                        onToggle={handleToggle}
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}

function FaqSkeleton() {
  return (
    <div className="profile-faq-page__skeleton" aria-busy="true" aria-label="Loading FAQs">
      <div className="profile-faq-page__skeleton-card" />
      <div className="profile-faq-page__skeleton-card" />
      <div className="profile-faq-page__skeleton-card" />
    </div>
  );
}

function FaqState({
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
    <div className="profile-faq-page__state">
      <span className="profile-faq-page__state-icon" aria-hidden>
        {icon}
      </span>
      <p className="profile-faq-page__state-title">{title}</p>
      <p className="profile-faq-page__state-text">{text}</p>
      {actionLabel && onAction ? (
        <button type="button" className="profile-faq-page__retry" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

