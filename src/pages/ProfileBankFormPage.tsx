import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  createPatientBankDetails,
  fetchAllBankTypeOptions,
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

/** Same-origin path only — used for `returnPath` / `returnTo` from claim detail, new claim, etc. */
function safeReturnNavigatePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

export function ProfileBankFormPage() {
  const { bankId } = useParams<{ bankId: string }>();
  const isEdit = Boolean(bankId);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  /** Prefer explicit `returnPath` (e.g. claim detail), then `returnTo` (e.g. new claim flow). */
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

  const [bankOptions, setBankOptions] = useState<BankTypeOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [bankKey, setBankKey] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [verifyAccountNumber, setVerifyAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** Set after successful `POST /upload` (used as `cheque` on save). */
  const [chequeAttachmentId, setChequeAttachmentId] = useState<string | null>(null);
  const [uploadingCheque, setUploadingCheque] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const chequeUploadSeqRef = useRef(0);
  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [loadedServerChequePath, setLoadedServerChequePath] = useState<string | null>(null);
  /** Loaded row `verify_status`. PATCH corrections are allowed only when this is `2` (admin rejected). */
  const [bankRecordVerifyStatus, setBankRecordVerifyStatus] = useState<number | null>(null);

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
    let cancelled = false;
    void (async () => {
      try {
        const opts = await fetchAllBankTypeOptions();
        if (!cancelled) setBankOptions(opts);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load banks list");
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

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

  /** When bank + file are set, upload immediately; re-runs if bank or file changes. */
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

  const clearFile = useCallback(() => {
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

  const chequeStatusMessage = useMemo(() => {
    if (!chequeAttachmentId?.trim() || uploadingCheque) return null;
    if (chequeFile) return "New cheque uploaded — ready to save.";
    if (isEdit) return "Cheque on file — ready to save, or replace with a new file.";
    return "Cheque uploaded — ready to save.";
  }, [chequeAttachmentId, uploadingCheque, chequeFile, isEdit]);

  const pickFileButtonLabel = useMemo(() => {
    if (!bankKey.trim()) return "Select bank first";
    if (isEdit) return "Replace cheque file";
    return "Choose file";
  }, [bankKey, isEdit]);

  /** PATCH `/bank_details/:id` is validated for `verify_status === 2` only. */
  const correctionPatchAllowed = !isEdit || bankRecordVerifyStatus === BANK_VERIFY_REJECTED;

  const submitButtonLabel = useMemo(() => {
    if (submitting) return "Saving…";
    if (isEdit && !correctionPatchAllowed) return "Correction not available";
    if (isEdit) return "Update bank account";
    return "Save bank account";
  }, [submitting, isEdit, correctionPatchAllowed]);

  const canSubmit = useMemo(() => {
    const chequeBusyOrInvalid =
      uploadingCheque || (!isEdit && !chequeAttachmentId?.trim());
    return (
      bankKey.trim().length > 0 &&
      ifscCode.trim().length > 0 &&
      branch.trim().length > 0 &&
      accountsMatch &&
      accountHolderName.trim().length > 0 &&
      !chequeBusyOrInvalid &&
      !submitting &&
      correctionPatchAllowed
    );
  }, [
    bankKey,
    ifscCode,
    branch,
    accountsMatch,
    accountHolderName,
    chequeAttachmentId,
    uploadingCheque,
    submitting,
    correctionPatchAllowed,
    isEdit,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const chequeTrim = chequeAttachmentId?.trim() ?? "";
    if (!isEdit && !chequeTrim) return;
    setSubmitting(true);
    try {
      if (isEdit && bankId) {
        const replacingCheque = Boolean(chequeFile);
        /** Saved row `cheque` from GET bank_details (same as `data[n].cheque`). */
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

  if (loadingInit) {
    return (
      <div className="profile-manage-page pbf-page">
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
          <h1 className="profile-manage-page__title">Edit bank</h1>
          <span className="profile-manage-page__spacer" aria-hidden />
        </header>
        <main className="profile-manage-page__main" style={{ paddingTop: 24 }}>
          <p className="profile-manage-page__intro">Loading bank account…</p>
        </main>
        <HomeBottomNav />
      </div>
    );
  }

  return (
    <div className="profile-manage-page pbf-page">
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
        <h1 className="profile-manage-page__title">{isEdit ? "Edit bank" : "Add bank"}</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main">
        {isEdit && bankRecordVerifyStatus === BANK_VERIFY_REJECTED ? (
          <div className="pbf-patch-notice pbf-patch-notice--rejected" role="status">
            <strong>Bank profile was rejected.</strong> Update your details and save — we’ll verify again
            (status returns to pending). Use an active bank <strong>type key</strong> for bank name and a new
            cancelled-cheque upload if needed.
          </div>
        ) : null}
        {isEdit && bankRecordVerifyStatus !== null && bankRecordVerifyStatus !== BANK_VERIFY_REJECTED ? (
          <div className="pbf-patch-notice pbf-patch-notice--blocked" role="note">
            Corrections through this form are only accepted after an admin rejection. Your bank row is not
            in rejected state yet, so this update cannot be submitted here. For help, contact support.
          </div>
        ) : null}
        <p className="profile-manage-page__intro">
          {isEdit
            ? "Bank name, IFSC, branch, account details, and holder name are required. Replacing the cancelled cheque is optional — if you do not pick a new file, your existing cheque attachment id is sent again with the update."
            : "Choose a bank first, then pick a cancelled cheque — it uploads immediately to /upload. Save sends that id as cheque with your account details."}
        </p>

        <section className="pbf-card" aria-label="Bank account form">
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="pbf-bank">
              Select bank
            </label>
            <select
              id="pbf-bank"
              className="pbf-select"
              value={bankKey}
              disabled={optionsLoading}
              onChange={(e) => setBankKey(e.target.value)}
            >
              <option value="">
                {optionsLoading ? "Loading banks…" : "Choose a bank"}
              </option>
              {bankOptions.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pbf-field">
            <label className="pbf-label" htmlFor="pbf-ifsc">
              Bank IFSC
            </label>
            <input
              id="pbf-ifsc"
              className="pbf-input"
              autoComplete="off"
              placeholder="e.g. SBIN0001234"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            />
          </div>

          <div className="pbf-field">
            <label className="pbf-label" htmlFor="pbf-branch">
              Branch name
            </label>
            <input
              id="pbf-branch"
              className="pbf-input"
              autoComplete="off"
              placeholder="Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>

          <div className="pbf-field">
            <label className="pbf-label" htmlFor="pbf-account">
              Account number
            </label>
            <input
              id="pbf-account"
              className="pbf-input"
              inputMode="numeric"
              autoComplete="off"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

          <div className="pbf-field">
            <label className="pbf-label" htmlFor="pbf-verify">
              Verify account number
            </label>
            <input
              id="pbf-verify"
              className="pbf-input"
              inputMode="numeric"
              autoComplete="off"
              value={verifyAccountNumber}
              onChange={(e) => setVerifyAccountNumber(e.target.value)}
            />
            {verifyAccountNumber.length > 0 && !accountsMatch ? (
              <p className="pbf-field-hint pbf-field-hint--err">Account numbers do not match.</p>
            ) : null}
          </div>

          <div className="pbf-field">
            <label className="pbf-label" htmlFor="pbf-holder">
              Account holder name
            </label>
            <input
              id="pbf-holder"
              className="pbf-input"
              autoComplete="name"
              placeholder="As per bank records"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
            />
          </div>

          <div className="pbf-attach">
            <p className="pbf-attach__title">Attachment (Cancelled cheque leaf)</p>
            {uploadingCheque ? (
              <p className="pbf-attach__status" aria-live="polite">
                Uploading cheque…
              </p>
            ) : null}
            {chequeStatusMessage ? (
              <p className="pbf-attach__ok" aria-live="polite">
                {chequeStatusMessage}
              </p>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="pbf-file-input"
              aria-label="Upload cancelled cheque"
              disabled={!bankKey.trim() || uploadingCheque}
              onChange={onFileChange}
            />
            {chequeFile ? null : (
              <button
                type="button"
                className="pbf-attach__pick"
                disabled={!bankKey.trim() || uploadingCheque}
                onClick={() => fileInputRef.current?.click()}
              >
                {pickFileButtonLabel}
              </button>
            )}

            {isEdit && serverChequeImgUrl && !chequeFile ? (
              <div className="pbf-preview pbf-preview--server">
                <p className="pbf-preview__server-label">Current cheque on file</p>
                <img
                  src={serverChequeImgUrl}
                  alt="Current cancelled cheque on file"
                  className="pbf-preview__img"
                />
              </div>
            ) : null}

            {previewUrl && chequeFile?.type.startsWith("image/") ? (
              <div className="pbf-preview">
                <button
                  type="button"
                  className="pbf-preview__clear"
                  aria-label="Remove file"
                  disabled={uploadingCheque}
                  onClick={clearFile}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6h8z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <img src={previewUrl} alt="Cheque preview" className="pbf-preview__img" />
              </div>
            ) : null}

            {chequeFile && !chequeFile.type.startsWith("image/") ? (
              <div className="pbf-preview pbf-preview--file">
                <button
                  type="button"
                  className="pbf-preview__clear"
                  aria-label="Remove file"
                  disabled={uploadingCheque}
                  onClick={clearFile}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6h8z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <p className="pbf-preview__fname">{chequeFile.name}</p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="profile-manage-page__save pbf-submit"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitButtonLabel}
          </button>
        </section>
      </main>

      <HomeBottomNav />
    </div>
  );
}
