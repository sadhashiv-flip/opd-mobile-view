import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { fetchPatientBankById, type PatientBankRecord } from "@/api/patientBankDetails";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import "./ProfileManagePage.css";
import "./ProfileBankViewPage.css";

export function ProfileBankViewPage() {
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [record, setRecord] = useState<PatientBankRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!bankId) return;
    setLoading(true);
    try {
      const r = await fetchPatientBankById(bankId);
      if (!r) {
        toast.error("Bank account not found.");
        navigate(ROUTES.profileBank);
        return;
      }
      setRecord(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load bank account");
      navigate(ROUTES.profileBank);
    } finally {
      setLoading(false);
    }
  }, [bankId, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const chequeUrl = record?.chequeAttachment?.path
    ? resolveProfileImageUrl(record.chequeAttachment.path)
    : null;
  const isPdf =
    record?.chequeAttachment?.title?.toLowerCase().endsWith(".pdf") ?? false;

  const chequeSection = useMemo(() => {
    if (!chequeUrl) {
      return <p className="pbv-cheque__missing">No cheque image on file.</p>;
    }
    if (isPdf) {
      const pdfTitle = record?.chequeAttachment?.title ?? "document";
      return (
        <div className="pbv-cheque">
          <p className="pbv-cheque__label">Cancelled cheque</p>
          <a
            href={chequeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pbv-cheque__link"
          >
            Open PDF ({pdfTitle})
          </a>
        </div>
      );
    }
    return (
      <div className="pbv-cheque">
        <p className="pbv-cheque__label">Cancelled cheque</p>
        <img src={chequeUrl} alt="Cheque on file" className="pbv-cheque__img" />
      </div>
    );
  }, [chequeUrl, isPdf, record]);

  if (loading || !record) {
    return (
      <div className="profile-manage-page">
        <header className="profile-manage-page__top">
          <Link to={ROUTES.profileBank} className="profile-manage-page__back" aria-label="Back">
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
          <h1 className="profile-manage-page__title">Bank account</h1>
          <span className="profile-manage-page__spacer" aria-hidden />
        </header>
        <main className="profile-manage-page__main" style={{ paddingTop: 24 }}>
          <p className="profile-manage-page__intro">Loading…</p>
        </main>
        <HomeBottomNav />
      </div>
    );
  }

  return (
    <div className="profile-manage-page pbv-page">
      <header className="profile-manage-page__top">
        <Link to={ROUTES.profileBank} className="profile-manage-page__back" aria-label="Back to list">
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
        <h1 className="profile-manage-page__title">Bank account</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main">
        <section className="pbv-card" aria-label="Bank details read-only">
          <h2 className="pbv-card__title">{record.accountHolderName || "—"}</h2>
          <dl className="pbv-dl">
            <div className="pbv-dl__row">
              <dt>Bank</dt>
              <dd>{record.bankName || "—"}</dd>
            </div>
            <div className="pbv-dl__row">
              <dt>IFSC</dt>
              <dd>{record.ifscCode || "—"}</dd>
            </div>
            <div className="pbv-dl__row">
              <dt>Branch</dt>
              <dd>{record.branch || "—"}</dd>
            </div>
            <div className="pbv-dl__row">
              <dt>Account number</dt>
              <dd>{record.accountNumber || "—"}</dd>
            </div>
            <div className="pbv-dl__row">
              <dt>Verification</dt>
              <dd>
                {record.verifyStatus === 1 ? (
                  <span className="pbv-badge pbv-badge--ok">Verified</span>
                ) : (
                  <span className="pbv-badge">Pending</span>
                )}
                {record.verifyReason ? ` — ${record.verifyReason}` : null}
              </dd>
            </div>
          </dl>

          {chequeSection}

          <Link
            to={generatePath(ROUTES.profileBankEdit, { bankId: record.id })}
            className="profile-manage-page__save pbv-edit-btn"
          >
            Edit bank account
          </Link>
        </section>
      </main>

      <HomeBottomNav />
    </div>
  );
}
