import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SearchablePickerField.css";

export type SearchablePickerOption = Readonly<{
  value: string;
  label: string;
  description?: string;
  /** When true, row is visible but cannot be chosen (e.g. subscription inactive). */
  disabled?: boolean;
}>;

const DEFAULT_PAGE_SIZE = 8;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function optionMatches(option: SearchablePickerOption, q: string): boolean {
  if (!q) return true;
  const label = option.label.toLowerCase();
  const desc = option.description?.toLowerCase() ?? "";
  return label.includes(q) || desc.includes(q);
}

export type SearchablePickerFieldProps = Readonly<{
  label: string;
  placeholder: string;
  sheetTitle: string;
  searchPlaceholder?: string;
  options: readonly SearchablePickerOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  requiredMark?: boolean;
  /** Initial batch size; each time you scroll to the bottom, this many more rows append. */
  pageSize?: number;
  emptySearchMessage?: string;
  fieldClassName?: string;
}>;

export function SearchablePickerField({
  label,
  placeholder,
  sheetTitle,
  searchPlaceholder = "Search…",
  options,
  value,
  onChange,
  disabled = false,
  requiredMark = false,
  pageSize = DEFAULT_PAGE_SIZE,
  emptySearchMessage = "No matches",
  fieldClassName,
}: SearchablePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const displayText = selected?.label ?? placeholder;
  const isPlaceholder = !selected;

  const filtered = useMemo(() => {
    const q = normalizeQuery(searchQuery);
    if (!q) return [...options];
    return options.filter((o) => optionMatches(o, q));
  }, [options, searchQuery]);

  const totalFiltered = filtered.length;

  const visibleSlice = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const hasMore = visibleCount < totalFiltered;

  const openSheet = useCallback(() => {
    if (disabled) return;
    setSearchQuery("");
    setVisibleCount(pageSize);
    setOpen(true);
  }, [disabled, pageSize]);

  const closeSheet = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
    setVisibleCount(pageSize);
  }, [pageSize]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusId = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(focusId);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pick = useCallback(
    (v: string) => {
      onChange(v);
      closeSheet();
    },
    [onChange, closeSheet],
  );

  useEffect(() => {
    if (!open || !hasMore) return;
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + pageSize, totalFiltered));
      },
      { root, rootMargin: "80px", threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [open, hasMore, pageSize, totalFiltered]);

  let metaLine: string;
  if (totalFiltered === 0) {
    metaLine = searchQuery.trim() ? emptySearchMessage : "No options";
  } else if (hasMore) {
    metaLine = `${totalFiltered} found · scroll for more`;
  } else {
    metaLine = `${totalFiltered} ${totalFiltered === 1 ? "option" : "options"}`;
  }

  return (
    <div className={`searchable-picker-field${fieldClassName ? ` ${fieldClassName}` : ""}`}>
      <span className="searchable-picker-field__label">
        {label}
        {requiredMark ? <span className="searchable-picker-field__req"> *</span> : null}
      </span>
      <button
        type="button"
        className={
          disabled
            ? "searchable-picker-field__trigger searchable-picker-field__trigger--disabled"
            : "searchable-picker-field__trigger"
        }
        onClick={openSheet}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          className={
            isPlaceholder
              ? "searchable-picker-field__trigger-text searchable-picker-field__trigger-text--placeholder"
              : "searchable-picker-field__trigger-text"
          }
        >
          {displayText}
        </span>
        <span className="searchable-picker-field__trigger-chevron" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <dialog
          className="searchable-picker-sheet__dialog"
          open
          aria-modal="true"
          aria-labelledby="searchable-picker-sheet-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSheet();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeSheet();
          }}
        >
          <section className="searchable-picker-sheet">
            <header className="searchable-picker-sheet__header">
              <h2 id="searchable-picker-sheet-title" className="searchable-picker-sheet__title">
                {sheetTitle}
              </h2>
              <button
                type="button"
                className="searchable-picker-sheet__close"
                aria-label="Close"
                onClick={closeSheet}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <div className="searchable-picker-sheet__search-wrap">
              <span className="searchable-picker-sheet__search-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M11 19a8 8 0 100-16 8 8 0 000 16zm9 2l-4.35-4.35"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="search"
                className="searchable-picker-sheet__search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(pageSize);
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
            </div>

            <p className="searchable-picker-sheet__meta" aria-live="polite">
              {metaLine}
            </p>

            <ul
              ref={listRef}
              className="searchable-picker-sheet__list"
              role="listbox"
              aria-label={`${sheetTitle} options`}
            >
              {visibleSlice.map((o) => {
                const active = o.value === value;
                const rowDisabled = Boolean(o.disabled);
                return (
                  <li key={o.value} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      aria-disabled={rowDisabled}
                      disabled={rowDisabled}
                      className={
                        rowDisabled
                          ? "searchable-picker-sheet__row searchable-picker-sheet__row--disabled"
                          : active
                            ? "searchable-picker-sheet__row searchable-picker-sheet__row--active"
                            : "searchable-picker-sheet__row"
                      }
                      onClick={() => {
                        if (rowDisabled) return;
                        pick(o.value);
                      }}
                    >
                      <span className="searchable-picker-sheet__row-main">
                        <span className="searchable-picker-sheet__row-label">{o.label}</span>
                        {o.description ? (
                          <span className="searchable-picker-sheet__row-desc">{o.description}</span>
                        ) : null}
                      </span>
                      {active ? (
                        <span className="searchable-picker-sheet__check" aria-hidden>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M20 6L9 17l-5-5"
                              stroke="currentColor"
                              strokeWidth="2.25"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {hasMore ? (
                <li
                  ref={sentinelRef}
                  className="searchable-picker-sheet__sentinel"
                  aria-hidden="true"
                />
              ) : null}
            </ul>
          </section>
        </dialog>
      ) : null}
    </div>
  );
}
