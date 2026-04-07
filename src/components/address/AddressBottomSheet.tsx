import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchPatientAddresses,
  formatAddressLines,
  type PatientAddressRecord,
} from "@/api/patientAddress";
import { ROUTES } from "@/constants";
import "./AddressBottomSheet.css";

export type AddressBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

export function AddressBottomSheet({ open, onClose }: AddressBottomSheetProps) {
  const navigate = useNavigate();
  const [list, setList] = useState<PatientAddressRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPatientAddresses();
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load addresses");
      setList([]);
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
    navigate(ROUTES.profileAddressAdd);
  }, [navigate, onClose]);

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
          <ul className="addr-sheet__list">
            {list.map((a) => (
              <li key={a.id} className="addr-sheet__item">
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
              </li>
            ))}
          </ul>
        ) : null}

        <div className="addr-sheet__actions">
          <button type="button" className="addr-sheet__add-btn" onClick={goAdd}>
            Add new Address
          </button>
          <Link to={ROUTES.profileAddress} className="addr-sheet__manage-link" onClick={onClose}>
            Manage addresses
          </Link>
        </div>
      </section>
    </dialog>
  );
}
