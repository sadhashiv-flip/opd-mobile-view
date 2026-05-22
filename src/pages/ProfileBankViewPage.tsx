import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AttachmentFilePreview,
  type AttachmentFilePreviewViewer,
} from "@/components/attachments/AttachmentFilePreview";
import {
  fetchPatientBankById,
  maskBankAccountNumber,
  type PatientBankRecord,
} from "@/api/patientBankDetails";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import "./ProfileManagePage.css";
import "./ProfileBankViewPage.css";

function bankVerifyStatusLabel(status: number): string {
  if (status === 1) return "Verified";
  if (status === 2) return "Rejected";
  return "Pending";
}

function bankVerifyStatusColor(status: number): string {
  if (status === 1) return "#43a047";
  if (status === 2) return "#e53935";
  return "#ff9800";
}

export function ProfileBankViewPage() {
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [record, setRecord] = useState<PatientBankRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [chequePreview, setChequePreview] = useState<AttachmentFilePreviewViewer>(null);
  const [chequeImgFailed, setChequeImgFailed] = useState(false);
  const [chequeImgLoaded, setChequeImgLoaded] = useState(false);

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
      setChequeImgFailed(false);
      setChequeImgLoaded(false);
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

  const chequePath = record?.chequeAttachment?.path?.trim() ?? "";
  const chequeUrl = chequePath ? resolveProfileImageUrl(chequePath) : null;
  const isPdf = chequePath.toLowerCase().endsWith(".pdf");

  const openChequePreview = useCallback(() => {
    if (!chequeUrl) return;
    setChequePreview({
      kind: isPdf ? "pdf" : "image",
      url: chequeUrl,
      name: isPdf ? "Cancelled Cheque" : record?.chequeAttachment?.title ?? "Cheque",
    });
  }, [chequeUrl, isPdf, record?.chequeAttachment?.title]);

  const statusColor = useMemo(
    () => (record ? bankVerifyStatusColor(record.verifyStatus) : "#ff9800"),
    [record],
  );

  if (loading || !record) {
    return (
      <div className="profile-manage-page pbv-page pbv-page--detail">
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
          <h1 className="profile-manage-page__title">Bank Details</h1>
          <span className="profile-manage-page__spacer" aria-hidden />
        </header>
        <main className="pbv-page__scroll">
          <p className="pbv-loading">Loading…</p>
        </main>
      </div>
    );
  }

  const rejectionNote =
    record.verifyStatus === 2 && record.verifyReason?.trim()
      ? `Note: ${record.verifyReason.trim()}`
      : null;

  return (
    <div className="profile-manage-page pbv-page pbv-page--detail">
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
        <h1 className="profile-manage-page__title">Bank Details</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="pbv-page__scroll">
        <section className="pbv-status-card" aria-label="Verification status">
          <div className="pbv-status-card__row">
            <span className="pbv-status-card__label">Verification status</span>
            <span
              className="pbv-status-card__pill"
              style={{
                color: statusColor,
                backgroundColor: `${statusColor}1f`,
              }}
            >
              {bankVerifyStatusLabel(record.verifyStatus)}
            </span>
          </div>
          {rejectionNote ? <p className="pbv-status-card__note">{rejectionNote}</p> : null}
        </section>

        <p className="pbv-readonly-hint">
          You can only change bank details when verification is rejected. Contact support if you
          need help.
        </p>

        <div className="pbv-fields">
          <div className="pbv-field">
            <span className="pbv-field__label">Bank Name</span>
            <span className="pbv-field__value">{record.bankName || "—"}</span>
          </div>
          <div className="pbv-field">
            <span className="pbv-field__label">Account Holder Name</span>
            <span className="pbv-field__value">{record.accountHolderName || "—"}</span>
          </div>
          <div className="pbv-field">
            <span className="pbv-field__label">IFSC Code</span>
            <span className="pbv-field__value">{record.ifscCode || "—"}</span>
          </div>
          <div className="pbv-field">
            <span className="pbv-field__label">Branch</span>
            <span className="pbv-field__value">{record.branch || "—"}</span>
          </div>
          <div className="pbv-field">
            <span className="pbv-field__label">Account Number</span>
            <span className="pbv-field__value">
              {record.accountNumber ? maskBankAccountNumber(record.accountNumber) : "—"}
            </span>
          </div>
        </div>

        <section className="pbv-cheque-section" aria-label="Cancelled cheque">
          <h2 className="pbv-cheque-section__title">Cancelled Cheque / Passbook</h2>
          {chequeUrl ? (
            <button
              type="button"
              className="pbv-cheque-tap"
              onClick={openChequePreview}
              aria-label={isPdf ? "Open PDF document" : "View cheque image"}
            >
              {isPdf ? (
                <span className="pbv-cheque-pdf">
                  <span className="pbv-cheque-pdf__icon" aria-hidden>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <span className="pbv-cheque-pdf__text">PDF document</span>
                  <span className="pbv-cheque-pdf__open" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 3h7v7M10 14L21 3M21 3h-5M21 3v5M10 14v7h7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </span>
              ) : (
                <span className="pbv-cheque-img-wrap">
                  {!chequeImgLoaded && !chequeImgFailed ? (
                    <span className="pbv-cheque-img-wrap__loading" aria-busy="true">
                      <span className="pbv-cheque-img-wrap__spinner" />
                    </span>
                  ) : null}
                  {chequeImgFailed ? (
                    <span className="pbv-cheque-img-wrap__error">Could not load image</span>
                  ) : (
                    <img
                      src={chequeUrl}
                      alt="Cancelled cheque"
                      className="pbv-cheque-img-wrap__img"
                      style={{ opacity: chequeImgLoaded ? 1 : 0 }}
                      onLoad={() => setChequeImgLoaded(true)}
                      onError={() => setChequeImgFailed(true)}
                    />
                  )}
                  <span className="pbv-cheque-img-wrap__zoom" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </span>
              )}
            </button>
          ) : (
            <span className="pbv-cheque-empty">—</span>
          )}
        </section>
      </main>

      <AttachmentFilePreview viewer={chequePreview} onClose={() => setChequePreview(null)} />
    </div>
  );
}
