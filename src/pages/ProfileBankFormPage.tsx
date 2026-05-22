import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BankTypeSearchSheet } from "@/components/bank/BankTypeSearchSheet";
import {
  createPatientBankDetails,
  fetchPatientBankById,
  updatePatientBankDetails,
  type BankTypeOption,
} from "@/api/patientBankDetails";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { uploadBankChequeFile } from "@/api/patientUpload";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import "./ProfileManagePage.css";
import "./ProfileBankFormPage.css";

/** Backend allows PATCH correction only when the saved row is admin-rejected. */
const BANK_VERIFY_REJECTED = 2;

function safeReturnNavigatePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

type ProfileBankFieldProps = Readonly<{
  id: string;
  label: string;
  required?: boolean;
  icon: ReactNode;
  children: ReactNode;
}>;

function ProfileBankField({ id, label, required, icon, children }: ProfileBankFieldProps) {
  return (
    <div className="pbf-field">
      <label className="pbf-field__label" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="pbf-field__control">
        <span className="pbf-field__icon" aria-hidden>
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

export function ProfileBankFormPage() {
  const { bankId } = useParams<{ bankId: string }>();
  const isEdit = Boolean(bankId);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const resolvedReturnPath = useMemo(() => {
    const s = location.state as { returnPath?: unknown; returnTo?: unknown } | null | undefined;
    return safeReturnNavigatePath(s?.returnPath) ?? safeReturnNavigatePath(s?.returnTo);
  }, [location.state]);

  const navigateAfterBankSave = useMemo(
    () => resolvedReturnPath ?? ROUTES.profileBank,
    [resolvedReturnPath],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialChequeIdRef = useRef<string | null>(null);

  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [bankKey, setBankKey] = useState("");
  const [bankLabel, setBankLabel] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [verifyAccountNumber, setVerifyAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [chequeAttachmentId, setChequeAttachmentId] = useState<string | null>(null);
  const [uploadingCheque, setUploadingCheque] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const chequeUploadSeqRef = useRef(0);
  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [loadedServerChequePath, setLoadedServerChequePath] = useState<string | null>(null);
  const [bankRecordVerifyStatus, setBankRecordVerifyStatus] = useState<number | null>(null);

  const pageTitle = isEdit ? "Edit Bank Account" : "Add Bank Account";

  useEffect(() => {
    if (!bankId) {
      initialChequeIdRef.current = null;
      setLoadedServerChequePath(null);
      setBankRecordVerifyStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingInit(true);
      try {
        const r = await fetchPatientBankById(bankId);
        if (cancelled) return;
        if (!r) {
          toast.error("Bank account not found.");
          navigate(ROUTES.profileBank);
          return;
        }
        initialChequeIdRef.current = r.cheque.trim() || null;
        setChequeAttachmentId(r.cheque.trim() || null);
        setBankKey(r.bankName);
        setBankLabel(r.bankName);
        setIfscCode(r.ifscCode);
        setBranch(r.branch);
        setAccountNumber(r.accountNumber);
        setVerifyAccountNumber(r.accountNumber);
        setAccountHolderName(r.accountHolderName);
        setLoadedServerChequePath(r.chequeAttachment?.path?.trim() || null);
        setBankRecordVerifyStatus(r.verifyStatus);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load bank account");
          navigate(ROUTES.profileBank);
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bankId, navigate, toast]);

  const serverChequeImgUrl = useMemo(
    () => (loadedServerChequePath ? resolveProfileImageUrl(loadedServerChequePath) : null),
    [loadedServerChequePath],
  );

  useEffect(() => {
    if (!chequeFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(chequeFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [chequeFile]);

  useEffect(() => {
    if (!bankKey.trim()) {
      if (isEdit && initialChequeIdRef.current) {
        setChequeAttachmentId(initialChequeIdRef.current);
      } else {
        setChequeAttachmentId(null);
      }
      return;
    }
    if (!chequeFile) {
      if (isEdit && initialChequeIdRef.current) {
        setChequeAttachmentId(initialChequeIdRef.current);
      } else if (!isEdit) {
        setChequeAttachmentId(null);
      }
      return;
    }

    setChequeAttachmentId(null);
    const seq = ++chequeUploadSeqRef.current;
    let cancelled = false;

    setUploadingCheque(true);
    void (async () => {
      try {
        const id = await uploadBankChequeFile(chequeFile, bankKey.trim());
        if (cancelled || seq !== chequeUploadSeqRef.current) return;
        setChequeAttachmentId(id);
      } catch (e) {
        if (cancelled || seq !== chequeUploadSeqRef.current) return;
        toast.error(e instanceof Error ? e.message : "Cheque upload failed");
        setChequeAttachmentId(null);
        setChequeFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        if (!cancelled && seq === chequeUploadSeqRef.current) {
          setUploadingCheque(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bankKey, chequeFile, isEdit, toast]);

  const onBankSelect = useCallback((opt: BankTypeOption) => {
    setBankKey(opt.key);
    setBankLabel(opt.label);
  }, []);

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) {
        setChequeFile(null);
        return;
      }
      if (!bankKey.trim()) {
        toast.error("Select a bank before choosing a cheque file.");
        e.target.value = "";
        return;
      }
      setChequeFile(f);
    },
    [bankKey, toast],
  );

  const clearCheque = useCallback(() => {
    chequeUploadSeqRef.current += 1;
    setChequeFile(null);
    setUploadingCheque(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (isEdit && initialChequeIdRef.current) {
      setChequeAttachmentId(initialChequeIdRef.current);
    } else {
      setChequeAttachmentId(null);
    }
  }, [isEdit]);

  const accountsMatch = accountNumber === verifyAccountNumber && accountNumber.length > 0;

  const hasChequeOnFile = Boolean(
    chequeFile || (isEdit && serverChequeImgUrl && !chequeFile) || chequeAttachmentId?.trim(),
  );

  const correctionPatchAllowed = !isEdit || bankRecordVerifyStatus === BANK_VERIFY_REJECTED;

  const isFormValid = useMemo(
    () =>
      bankKey.trim().length > 0 &&
      accountHolderName.trim().length > 0 &&
      accountNumber.trim().length > 0 &&
      verifyAccountNumber.trim().length > 0 &&
      accountsMatch &&
      ifscCode.trim().length > 0 &&
      branch.trim().length > 0 &&
      hasChequeOnFile &&
      Boolean(chequeAttachmentId?.trim()) &&
      !uploadingCheque,
    [
      bankKey,
      accountHolderName,
      accountNumber,
      verifyAccountNumber,
      accountsMatch,
      ifscCode,
      branch,
      hasChequeOnFile,
      chequeAttachmentId,
      uploadingCheque,
    ],
  );

  const canSubmit = isFormValid && !submitting && correctionPatchAllowed;

  const saveButtonLabel = useMemo(() => {
    if (submitting) return null;
    if (isEdit && !correctionPatchAllowed) return "Correction not available";
    return isEdit ? "Update Bank Account" : "Save Bank Account";
  }, [submitting, isEdit, correctionPatchAllowed]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const chequeTrim = chequeAttachmentId?.trim() ?? "";
    if (!isEdit && !chequeTrim) return;
    setSubmitting(true);
    try {
      if (isEdit && bankId) {
        const replacingCheque = Boolean(chequeFile);
        const existingChequeId = initialChequeIdRef.current?.trim() ?? "";
        const chequeToSend = replacingCheque ? chequeTrim : existingChequeId || chequeTrim;
        if (!chequeToSend.trim()) {
          toast.error(
            replacingCheque
              ? "Cheque upload did not return an attachment id."
              : "Cancelled cheque id is missing. Reload the page or upload a new cheque file.",
          );
          return;
        }
        await updatePatientBankDetails(bankId, {
          bank_name: bankKey.trim(),
          branch: branch.trim(),
          ifsc_code: ifscCode.trim(),
          account_number: accountNumber.trim(),
          account_holder_name: accountHolderName.trim(),
          cheque: chequeToSend.trim(),
        });
        toast.success("Bank details updated — pending verification.");
      } else {
        await createPatientBankDetails({
          bank_name: bankKey.trim(),
          ifsc_code: ifscCode.trim(),
          branch: branch.trim(),
          account_number: accountNumber.trim(),
          verify_account_number: verifyAccountNumber.trim(),
          account_holder_name: accountHolderName.trim(),
          cheque: chequeTrim,
        });
        toast.success("Bank account added.");
      }
      navigate(navigateAfterBankSave, {
        replace: true,
        state: resolvedReturnPath ? { refreshReimbursementDetail: true } : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save bank details");
    } finally {
      setSubmitting(false);
    }
  }, [
    accountHolderName,
    accountNumber,
    bankId,
    bankKey,
    branch,
    canSubmit,
    chequeAttachmentId,
    chequeFile,
    ifscCode,
    isEdit,
    navigate,
    navigateAfterBankSave,
    resolvedReturnPath,
    toast,
    verifyAccountNumber,
  ]);

  const chequeThumbSrc = previewUrl ?? (isEdit && !chequeFile ? serverChequeImgUrl : null);
  const chequeIsPdf = chequeFile?.name.toLowerCase().endsWith(".pdf") ?? false;

  if (loadingInit) {
    return (
      <div className="profile-manage-page pbf-page pbf-page--form">
        <header className="profile-manage-page__top">
          <Link to={navigateAfterBankSave} className="profile-manage-page__back" aria-label="Back">
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
          <h1 className="profile-manage-page__title">{pageTitle}</h1>
          <span className="profile-manage-page__spacer" aria-hidden />
        </header>
        <main className="pbf-page__scroll">
          <p className="pbf-loading">Loading bank account…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="profile-manage-page pbf-page pbf-page--form">
      <header className="profile-manage-page__top">
        <Link
          to={navigateAfterBankSave}
          className="profile-manage-page__back"
          aria-label={resolvedReturnPath ? "Back to previous page" : "Back to bank list"}
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
        <h1 className="profile-manage-page__title">{pageTitle}</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="pbf-page__scroll">
        {isEdit && bankRecordVerifyStatus === BANK_VERIFY_REJECTED ? (
          <div className="pbf-patch-notice pbf-patch-notice--rejected" role="status">
            <strong>Bank profile was rejected.</strong> Update your details and save — we’ll verify
            again.
          </div>
        ) : null}
        {isEdit && bankRecordVerifyStatus !== null && bankRecordVerifyStatus !== BANK_VERIFY_REJECTED ? (
          <div className="pbf-patch-notice pbf-patch-notice--blocked" role="note">
            Corrections through this form are only accepted after an admin rejection.
          </div>
        ) : null}

        <div className="pbf-form">
          <div className="pbf-field">
            <span className="pbf-field__label">Bank name *</span>
            <button
              type="button"
              className="pbf-bank-select"
              onClick={() => setBankSheetOpen(true)}
            >
              <span className="pbf-bank-select__icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 10v8h16v-8M4 10l2-6h12l2 6M9 14h6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span
                className={
                  bankLabel.trim()
                    ? "pbf-bank-select__text"
                    : "pbf-bank-select__text pbf-bank-select__text--placeholder"
                }
              >
                {bankLabel.trim() || "Select bank"}
              </span>
              <span className="pbf-bank-select__chev" aria-hidden>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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
          </div>

          <ProfileBankField
            id="pbf-holder"
            label="Account holder name"
            required
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M5 20c0-4 3.5-6 7-6s7 2 7 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            }
          >
            <input
              id="pbf-holder"
              className="pbf-input"
              autoComplete="name"
              placeholder="Enter account holder name"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
            />
          </ProfileBankField>

          <ProfileBankField
            id="pbf-account"
            label="Account number"
            required
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            }
          >
            <input
              id="pbf-account"
              className="pbf-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(digitsOnly(e.target.value))}
            />
          </ProfileBankField>

          <ProfileBankField
            id="pbf-verify"
            label="Confirm account number"
            required
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            }
          >
            <input
              id="pbf-verify"
              className="pbf-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Re-enter account number"
              value={verifyAccountNumber}
              onChange={(e) => setVerifyAccountNumber(digitsOnly(e.target.value))}
            />
          </ProfileBankField>
          {verifyAccountNumber.length > 0 && !accountsMatch ? (
            <p className="pbf-field-hint pbf-field-hint--err">Account numbers do not match.</p>
          ) : null}

          <ProfileBankField
            id="pbf-ifsc"
            label="IFSC code"
            required
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2v4M8 6h8M6 10h12v12H6V10z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            <input
              id="pbf-ifsc"
              className="pbf-input"
              autoComplete="off"
              placeholder="Enter IFSC code"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            />
          </ProfileBankField>

          <ProfileBankField
            id="pbf-branch"
            label="Branch"
            required
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 21h18M6 21V9l6-4 6 4v12M10 14h4v7h-4v-7z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            <input
              id="pbf-branch"
              className="pbf-input"
              autoComplete="off"
              placeholder="Enter branch name"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </ProfileBankField>

          <section className="pbf-cheque" aria-label="Cancelled cheque">
            <div className="pbf-cheque__head">
              <span className="pbf-cheque__head-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="9" cy="9" r="1.5" fill="currentColor" />
                  <path d="M4 16l5-5 4 4 6-7 1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <span className="pbf-cheque__head-title">Cancelled cheque *</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="pbf-file-input"
              aria-label="Upload cancelled cheque"
              onChange={onFileChange}
            />

            {uploadingCheque ? (
              <p className="pbf-cheque__status" aria-live="polite">
                Uploading cheque…
              </p>
            ) : null}

            {!chequeThumbSrc && !uploadingCheque ? (
              <button
                type="button"
                className="pbf-cheque__upload"
                disabled={!bankKey.trim()}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="pbf-cheque__upload-icon" aria-hidden>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="pbf-cheque__upload-label">Upload cheque photo</span>
                <span className="pbf-cheque__upload-hint">JPG, PNG or PDF</span>
              </button>
            ) : null}

            {chequeThumbSrc || (chequeFile && chequeIsPdf) ? (
              <div className="pbf-cheque__thumbs">
                <div className="pbf-cheque__thumb-wrap">
                  {chequeThumbSrc && !chequeIsPdf ? (
                    <img src={chequeThumbSrc} alt="Cheque preview" className="pbf-cheque__thumb-img" />
                  ) : (
                    <div className="pbf-cheque__thumb-file">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <span>{chequeFile?.name ?? "Cheque file"}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="pbf-cheque__thumb-remove"
                    aria-label="Remove cheque"
                    disabled={uploadingCheque}
                    onClick={clearCheque}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <footer className="pbf-page__footer">
        <button
          type="button"
          className={`pbf-save${canSubmit ? "" : " pbf-save--disabled"}`}
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {submitting ? (
            <span className="pbf-save__spinner" aria-hidden />
          ) : (
            saveButtonLabel
          )}
        </button>
      </footer>

      <BankTypeSearchSheet
        open={bankSheetOpen}
        onClose={() => setBankSheetOpen(false)}
        onSelect={onBankSelect}
      />
    </div>
  );
}
