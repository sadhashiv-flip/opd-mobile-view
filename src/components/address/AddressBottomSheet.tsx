import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchAllPatientAddresses,
  formatAddressLines,
  type PatientAddressRecord,
} from "@/api/patientAddress";
import { readSelectedAddress, writeSelectedAddress } from "@/constants/selectedAddressStorage";
import { ROUTES } from "@/constants";
import "./AddressBottomSheet.css";

export type AddressBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Called when the user picks an address (radio). */
  onSelectionChange?: (address: PatientAddressRecord) => void;
}>;

export function AddressBottomSheet({ open, onClose, onSelectionChange }: AddressBottomSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [list, setList] = useState<PatientAddressRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchAllPatientAddresses();
      setList(data);
      const stored = readSelectedAddress();
      const match = stored ? data.find((a) => a.id === stored.id) : undefined;
      const pick = match ?? data.find((a) => a.isPrimary) ?? data[0] ?? null;
      setSelectedId(pick?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load addresses");
      setList([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const goAdd = useCallback(() => {
    onClose();
    const returnTo = `${location.pathname}${location.search}`;
    navigate(ROUTES.profileAddressAdd, {
      state: { returnTo },
    });
  }, [location.pathname, location.search, navigate, onClose]);

  const selectAddress = useCallback(
    (a: PatientAddressRecord) => {
      setSelectedId(a.id);
      const displayLine = formatAddressLines(a);
      writeSelectedAddress({ id: a.id, displayLine, tag: a.tag.trim() || undefined });
      onSelectionChange?.(a);
    },
    [onSelectionChange],
  );

  if (!open) return null;

  return (
    <dialog
      className="addr-sheet-dialog"
      open
      aria-modal="true"
      aria-labelledby="addr-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="addr-sheet">
        <header className="addr-sheet__header">
          <h2 id="addr-sheet-title" className="addr-sheet__title">
            Your addresses
          </h2>
          <button type="button" className="addr-sheet__close" aria-label="Close" onClick={onClose}>
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

        <p className="addr-sheet__hint">
          Choose a saved address or add a new one. Primary is used as the default where needed.
        </p>

        {loading ? (
          <div className="addr-sheet__skeleton" aria-busy="true">
            <div className="addr-sheet__skeleton-line" />
            <div className="addr-sheet__skeleton-line addr-sheet__skeleton-line--short" />
          </div>
        ) : null}

        {!loading && error ? (
          <p className="addr-sheet__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && list.length === 0 ? (
          <p className="addr-sheet__empty">No saved addresses yet.</p>
        ) : null}

        {!loading && !error && list.length > 0 ? (
          <ul className="addr-sheet__list" role="radiogroup" aria-label="Saved addresses">
            {list.map((a) => {
              const inputId = `addr-sheet-${a.id}`;
              return (
                <li key={a.id} className="addr-sheet__item-wrap">
                  <label
                    htmlFor={inputId}
                    className={`addr-sheet__item${selectedId === a.id ? " addr-sheet__item--selected" : ""}`}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      className="addr-sheet__radio"
                      name="addr-sheet-address"
                      checked={selectedId === a.id}
                      onChange={() => selectAddress(a)}
                    />
                    <span className="addr-sheet__item-body">
                      <span className="addr-sheet__tag">{a.tag}</span>
                      {a.isPrimary ? (
                        <span className="addr-sheet__primary-pill" aria-label="Primary address">
                          Primary
                        </span>
                      ) : null}
                      <p className="addr-sheet__lines">{formatAddressLines(a)}</p>
                      <p className="addr-sheet__meta">
                        {a.city}
                        {a.city && a.state ? ", " : ""}
                        {a.state} {a.pincode}
                      </p>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="addr-sheet__actions">
          <button type="button" className="addr-sheet__add-btn" onClick={goAdd}>
            <span className="addr-sheet__add-ic" aria-hidden="true">
              +
            </span>
            <span>Add new Address</span>
          </button>
        </div>
      </section>
    </dialog>
  );
}
