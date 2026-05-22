import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchBankDirectoryPage, type BankTypeOption } from "@/api/patientBankDetails";
import "@/components/address/AddressBottomSheet.css";
import "./BankTypeSearchSheet.css";

export type BankTypeSearchSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onSelect: (option: BankTypeOption) => void;
}>;

const SEARCH_DEBOUNCE_MS = 400;

export function BankTypeSearchSheet({ open, onClose, onSelect }: BankTypeSearchSheetProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<BankTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef("");
  const skipQueryDebounceRef = useRef(false);

  const loadPage = useCallback(async (reset: boolean, search: string, pageToFetch: number) => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    setError(null);
    try {
      const { items: pageItems, hasMore: more } = await fetchBankDirectoryPage(
        pageToFetch,
        search,
      );
      if (gen !== loadGenRef.current) return;
      if (reset) {
        setItems(pageItems);
      } else {
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.key));
          const merged = [...prev];
          for (const o of pageItems) {
            if (!seen.has(o.key)) merged.push(o);
          }
          return merged;
        });
      }
      setHasMore(more);
      setNextPage(more ? pageToFetch + 1 : pageToFetch);
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      setError(e instanceof Error ? e.message : "Could not load banks");
      if (reset) setItems([]);
      setHasMore(false);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    void loadPage(false, searchRef.current, nextPage);
  }, [hasMore, loadPage, loading, nextPage]);

  useEffect(() => {
    if (!open) return;
    skipQueryDebounceRef.current = true;
    searchRef.current = "";
    setQuery("");
    setNextPage(1);
    setHasMore(true);
    void loadPage(true, "", 1);
  }, [open, loadPage]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (skipQueryDebounceRef.current) {
      skipQueryDebounceRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchRef.current = query;
      setNextPage(1);
      setHasMore(true);
      void loadPage(true, query, 1);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, loadPage]);

  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      loadMore();
    }
  }, [loadMore]);

  const pick = useCallback(
    (opt: BankTypeOption) => {
      onSelect(opt);
      onClose();
    },
    [onClose, onSelect],
  );

  if (!open) return null;

  const dialog = (
    <dialog
      className="bank-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="bank-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="bank-sheet">
        <div className="bank-sheet__handle" aria-hidden />
        <header className="bank-sheet__header">
          <h2 id="bank-sheet-title" className="bank-sheet__title">
            Select bank
          </h2>
          <button type="button" className="bank-sheet__close" aria-label="Close" onClick={onClose}>
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

        <div className="bank-sheet__search-wrap">
          <label className="bank-sheet__search" aria-label="Search bank">
            <span className="bank-sheet__search-ic" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              className="bank-sheet__search-input"
              placeholder="Search bank..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        <div ref={listRef} className="bank-sheet__list-wrap" onScroll={onListScroll}>
          {loading && items.length === 0 ? (
            <div className="bank-sheet__loader" aria-busy="true">
              <span className="bank-sheet__loader-dot" />
            </div>
          ) : null}
          {!loading && error ? (
            <p className="bank-sheet__error" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <p className="bank-sheet__empty">No banks found</p>
          ) : null}
          {items.length > 0 ? (
            <ul className="bank-sheet__list">
              {items.map((b) => (
                <li key={b.key}>
                  <button type="button" className="bank-sheet__item" onClick={() => pick(b)}>
                    <span className="bank-sheet__item-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 10v8h16v-8M4 10l2-6h12l2 6M9 14h6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="bank-sheet__item-label">{b.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {loading && items.length > 0 ? (
            <div className="bank-sheet__loader" aria-busy="true">
              <span className="bank-sheet__loader-dot" />
            </div>
          ) : null}
        </div>
      </section>
    </dialog>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
