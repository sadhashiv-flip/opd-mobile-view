import { useCallback, useEffect, useState } from "react";
import { Link, generatePath } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  fetchAllPatientBankRecords,
  type PatientBankRecord,
} from "@/api/patientBankDetails";
import { ROUTES } from "@/constants";
import "./ProfileManagePage.css";
import "./ProfileBankPage.css";

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16.5V20h3.5L17.5 10 14 6.5 4 16.5zM14 6.5l2-2 3.5 3.5-2 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BankBuildingIcon() {
  return (
    <svg
      className="profile-bank-card__icon-svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 21h18M4 21V10.5M20 21V10.5M6 21v-6h3v6M11 21v-6h2v6M15 21v-6h3v6M2 10.5L12 3l10 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5h.01M12 8.5h.01M15 8.5h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProfileBankPage() {
  const [items, setItems] = useState<PatientBankRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await fetchAllPatientBankRecords();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bank details");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="profile-manage-page">
      <header className="profile-manage-page__top">
        <Link
          to={ROUTES.profile}
          className="profile-manage-page__back"
          aria-label="Back to profile"
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
        </Link>
        <h1 className="profile-manage-page__title">Bank details</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main">
        <p className="profile-manage-page__intro">
          Your saved accounts. Add a new bank with a cancelled cheque upload.
        </p>

        <div className="profile-bank-page__toolbar">
          <Link to={ROUTES.profileBankAdd} className="profile-bank-page__add-btn">
            + Add bank
          </Link>
        </div>

        {loading ? (
          <div className="profile-sub-skeleton" aria-busy="true">
            <div className="profile-sub-skeleton__card" />
            <div className="profile-sub-skeleton__card" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="profile-manage-page__card profile-sub-error">
            <p className="profile-sub-error__text">{error}</p>
            <button type="button" className="profile-manage-page__save" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="profile-manage-page__hint">No bank accounts yet. Tap Add bank to add one.</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="profile-bank-page__grid">
            {items.map((a) => (
              <article key={a.id} className="profile-bank-card">
                <div className="profile-bank-card__actions">
                  <Link
                    to={generatePath(ROUTES.profileBankView, { bankId: a.id })}
                    className="profile-bank-card__icon-btn"
                    aria-label="View bank account"
                  >
                    <EyeIcon />
                  </Link>
                  <Link
                    to={generatePath(ROUTES.profileBankEdit, { bankId: a.id })}
                    className="profile-bank-card__icon-btn"
                    aria-label="Edit bank account"
                  >
                    <PencilIcon />
                  </Link>
                </div>
                <div className="profile-bank-card__row">
                  <div className="profile-bank-card__icon-wrap" aria-hidden>
                    <BankBuildingIcon />
                  </div>
                  <div className="profile-bank-card__text">
                    <p className="profile-bank-card__holder">
                      {a.accountHolderName || "—"}
                    </p>
                    <p className="profile-bank-card__line">
                      <span className="profile-bank-card__lbl">Account :</span>{" "}
                      {a.accountNumber || "—"}
                    </p>
                    <p className="profile-bank-card__line">
                      <span className="profile-bank-card__lbl">Ifsc :</span>{" "}
                      {a.ifscCode || "—"}
                    </p>
                    {a.bankName ? (
                      <p className="profile-bank-card__meta">{a.bankName}</p>
                    ) : null}
                    {a.verifyStatus === 1 ? (
                      <span className="profile-bank-card__badge profile-bank-card__badge--ok">
                        Verified
                      </span>
                    ) : (
                      <span className="profile-bank-card__badge">Pending review</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
