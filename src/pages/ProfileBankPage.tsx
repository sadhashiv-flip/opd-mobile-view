import { useCallback, useEffect, useState } from "react";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  canEditBankDetails,
  fetchPatientBankById,
  fetchAllPatientBankRecords,
  maskBankAccountNumber,
  type PatientBankRecord,
} from "@/api/patientBankDetails";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import "./ProfileManagePage.css";
import "./ProfileBankPage.css";

function BankBuildingIcon({ large }: Readonly<{ large?: boolean }>) {
  return (
    <svg
      className={large ? "profile-bank-list__empty-icon" : "profile-bank-list__row-icon-svg"}
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
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="profile-bank-list__chevron" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <span className="profile-bank-list__warn-badge" aria-hidden>
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
    </span>
  );
}

export function ProfileBankPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<PatientBankRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState(false);

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

  const handleBack = useCallback(() => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath);
    } else {
      navigate(ROUTES.profile);
    }
  }, [location.state, navigate]);

  const openAddBank = useCallback(() => {
    navigate(ROUTES.profileBankAdd);
  }, [navigate]);

  /** patient_app `ClaimsController.openBankFromList` */
  const openBankFromList = useCallback(
    async (bank: PatientBankRecord) => {
      setRowBusy(true);
      try {
        const detail = await fetchPatientBankById(bank.id);
        if (!detail) {
          toast.error("Bank account not found.");
          return;
        }
        if (canEditBankDetails(detail.verifyStatus)) {
          navigate(generatePath(ROUTES.profileBankEdit, { bankId: detail.id }));
        } else {
          navigate(generatePath(ROUTES.profileBankView, { bankId: detail.id }));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not open bank account");
      } finally {
        setRowBusy(false);
      }
    },
    [navigate, toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="profile-manage-page profile-bank-list-page">
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
        <h1 className="profile-manage-page__title">Bank Accounts</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main profile-bank-list-page__main">
        {loading ? (
          <div className="profile-bank-list__skeleton" aria-busy="true">
            <div className="profile-bank-list__skeleton-card" />
            <div className="profile-bank-list__skeleton-card" />
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
          <div className="profile-bank-list__empty">
            <BankBuildingIcon large />
            <p className="profile-bank-list__empty-title">No bank accounts added</p>
            <button type="button" className="profile-bank-list__empty-add" onClick={openAddBank}>
              + Add Bank
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="profile-bank-list">
            {items.map((bank) => (
              <li key={bank.id}>
                <button
                  type="button"
                  className="profile-bank-list__row"
                  onClick={() => void openBankFromList(bank)}
                >
                  <span className="profile-bank-list__row-icon" aria-hidden>
                    <BankBuildingIcon />
                  </span>
                  <span className="profile-bank-list__row-body">
                    <span className="profile-bank-list__bank-name">
                      {bank.bankName || "—"}
                    </span>
                    <span className="profile-bank-list__meta">
                      {maskBankAccountNumber(bank.accountNumber)} (IFSC: {bank.ifscCode || "—"})
                    </span>
                    <span className="profile-bank-list__holder">
                      {bank.accountHolderName || "—"}
                    </span>
                    {bank.verifyStatus === 2 && bank.verifyReason?.trim() ? (
                      <span className="profile-bank-list__reason">{bank.verifyReason.trim()}</span>
                    ) : null}
                    {bank.verifyStatus === 2 ? (
                      <span className="profile-bank-list__update-hint">Tap to update bank details</span>
                    ) : null}
                  </span>
                  {bank.verifyStatus === 2 ? <WarningIcon /> : <ChevronIcon />}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      {!loading && !error ? (
        <button
          type="button"
          className="profile-bank-list__fab"
          aria-label="Add bank"
          onClick={openAddBank}
        >
          <span className="profile-bank-list__fab-icon" aria-hidden>
            +
          </span>
        </button>
      ) : null}

      {rowBusy ? (
        <div className="profile-bank-list__overlay" aria-busy="true" aria-live="polite">
          <div className="profile-bank-list__spinner" />
        </div>
      ) : null}

      <HomeBottomNav />
    </div>
  );
}
