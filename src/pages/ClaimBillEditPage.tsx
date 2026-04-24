import { useCallback, useEffect, useMemo, useState } from "react";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import {
  canPatientEditClaimBillDetails,
  fetchReimbursementById,
  parseReimbursementDetailResponse,
  type ReimbursementUploadFileRecord,
  updateReimbursementBill,
} from "@/api/patientReimbursement";
import { uploadReimbursementBillDocumentId } from "@/api/patientUpload";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import "@/pages/ProfileBankFormPage.css";
import "./ClaimsPages.css";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function billDateForInput(iso: string | null): string {
  if (!iso?.trim()) return "";
  const t = iso.trim();
  if (t.length >= 10 && t[4] === "-" && t[7] === "-") return t.slice(0, 10);
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return "";
}

function formatAmountForInput(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(n);
}

export function ClaimBillEditPage() {
  const { claimId = "", billId = "" } = useParams<{ claimId: string; billId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorReg, setDoctorReg] = useState("");
  const [billFiles, setBillFiles] = useState<readonly ReimbursementUploadFileRecord[]>([]);
  const [billUploading, setBillUploading] = useState(false);

  const canEdit = useMemo(() => canPatientEditClaimBillDetails(statusCode), [statusCode]);

  useEffect(() => {
    const cid = claimId.trim();
    const bid = billId.trim();
    if (!cid || !bid) {
      setLoading(false);
      setError("Missing claim or bill");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = await fetchReimbursementById(cid);
        if (cancelled) return;
        const parsed = parseReimbursementDetailResponse(raw);
        if (!parsed) {
          setError("Could not read claim");
          return;
        }
        setStatusCode(parsed.statusCode);
        if (!canPatientEditClaimBillDetails(parsed.statusCode)) {
          setError("This claim cannot be edited in the app right now.");
          return;
        }
        const bill = parsed.bills.find((b) => b.billId === bid);
        if (!bill) {
          setError("Bill not found on this claim");
          return;
        }
        if (bill.billDocumentStatus !== 0) {
          navigate(generatePath(ROUTES.claimsDetail, { claimId: cid }), { replace: true });
          return;
        }
        setBillNumber(bill.billNumber.trim());
        setBillDate(billDateForInput(bill.billDate));
        setBillAmount(formatAmountForInput(bill.billAmount));
        setClinicName(bill.clinicName?.trim() ?? "");
        setClinicAddress(bill.clinicAddress?.trim() ?? "");
        setDoctorName(bill.doctorName?.trim() ?? "");
        setDoctorReg(bill.doctorRegistrationNumber?.trim() ?? "");
        setBillFiles([...bill.billFileRecords]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load claim");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimId, billId]);

  const onPickBillFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const billNo = billNumber.trim();
      if (!billNo) {
        toast.error("Enter bill number before uploading files");
        return;
      }
      setBillUploading(true);
      try {
        const recs: ReimbursementUploadFileRecord[] = [];
        for (let i = 0; i < files.length; i += 1) {
          recs.push(await uploadReimbursementBillDocumentId(files[i], billNo));
        }
        setBillFiles((prev) => [...prev, ...recs]);
        toast.success("File(s) uploaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBillUploading(false);
      }
    },
    [billNumber, toast],
  );

  const onSave = useCallback(async () => {
    const bid = billId.trim();
    if (!bid) return;
    if (!billNumber.trim() || !billDate || !billAmount.trim() || !clinicName.trim() || !clinicAddress.trim()) {
      toast.error("Please fill all required bill fields");
      return;
    }
    if (!billFiles.length) {
      toast.error("Add at least one bill image");
      return;
    }
    const amt = Number(String(billAmount).replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid bill amount");
      return;
    }
    setSaving(true);
    try {
      const raw = await updateReimbursementBill(bid, {
        bill_number: billNumber.trim(),
        bill_date: billDate,
        bill_amount: amt,
        clinic_name: clinicName.trim(),
        clinic_address: clinicAddress.trim(),
        doctor_name: doctorName.trim() || null,
        doctor_registration_number: doctorReg.trim() || null,
        document_name: "",
        reimbursement_bill_files: billFiles.map((f) => ({ id: f.id })),
      });
      const root = asRecord(raw);
      const msg = str(root?.message) || "Bill updated";
      toast.success(msg);
      navigate(-1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }, [
    billAmount,
    billDate,
    billFiles,
    billId,
    billNumber,
    clinicAddress,
    clinicName,
    doctorName,
    doctorReg,
    navigate,
    toast,
  ]);

  const onBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const detailPath = generatePath(ROUTES.claimsDetail, { claimId: claimId.trim() || "—" });

  if (loading) {
    return (
      <div className="claim-new-page pbf-page">
        <header className="claims-screen-header">
          <span style={{ width: 44 }} aria-hidden />
          <h1 className="claims-screen-header__title">Edit bill</h1>
          <span style={{ width: 44 }} aria-hidden />
        </header>
        <main className="claim-new-page__main">
          <p className="claims-row__meta">Loading…</p>
        </main>
      </div>
    );
  }

  if (error || !canEdit) {
    return (
      <div className="claim-new-page pbf-page">
        <header className="claims-screen-header">
          <button type="button" className="claims-screen-header__back" aria-label="Back" onClick={onBack}>
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
          <h1 className="claims-screen-header__title">Edit bill</h1>
          <span style={{ width: 44 }} aria-hidden />
        </header>
        <main className="claim-new-page__main">
          <p className="claims-row__meta">{error ?? "Unable to edit this bill."}</p>
          <button type="button" className="claim-footer__primary" style={{ marginTop: 16 }} onClick={() => navigate(detailPath)}>
            Back to claim
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="claim-new-page pbf-page">
      <header className="claims-screen-header">
        <button type="button" className="claims-screen-header__back" aria-label="Back" onClick={onBack}>
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
        <h1 className="claims-screen-header__title">Edit bill</h1>
        <span style={{ width: 44 }} aria-hidden />
      </header>

      <main className="claim-new-page__main">
        <p className="claims-row__meta" style={{ marginBottom: 12 }}>
          Update bill details and files, then save. Your claim will show the latest information after a refresh.
        </p>
        <section className="pbf-card" aria-label="Bill details">
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="edit-claim-bill-no">
              Bill number
            </label>
            <input
              id="edit-claim-bill-no"
              className="pbf-input"
              autoComplete="off"
              placeholder="Enter bill number"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
            />
          </div>
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="edit-claim-bill-date">
              Bill date
            </label>
            <input
              id="edit-claim-bill-date"
              className="pbf-input"
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </div>
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="edit-claim-bill-amt">
              Bill amount
            </label>
            <input
              id="edit-claim-bill-amt"
              className="pbf-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Enter bill amount (₹)"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
            />
          </div>
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="edit-claim-clinic">
              Clinic / hospital name
            </label>
            <input
              id="edit-claim-clinic"
              className="pbf-input"
              autoComplete="off"
              placeholder="Enter clinic or hospital name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="edit-claim-clinic-addr">
              Clinic address
            </label>
            <input
              id="edit-claim-clinic-addr"
              className="pbf-input"
              autoComplete="street-address"
              placeholder="Enter clinic address"
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
            />
          </div>
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="edit-claim-doctor">
              Doctor name (optional)
            </label>
            <input
              id="edit-claim-doctor"
              className="pbf-input"
              autoComplete="name"
              placeholder="Enter doctor name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
          </div>
          <div className="pbf-field">
            <label className="pbf-label" htmlFor="edit-claim-doctor-reg">
              Doctor registration number (optional)
            </label>
            <input
              id="edit-claim-doctor-reg"
              className="pbf-input"
              autoComplete="off"
              placeholder="Enter doctor registration number"
              value={doctorReg}
              onChange={(e) => setDoctorReg(e.target.value)}
            />
          </div>
          <div className="pbf-field">
            <p className="claim-new-page__upload-heading">Bill images</p>
            <div className="claim-bill-upload-stack">
              <label className="claim-upload claim-upload--pbf">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  hidden
                  disabled={billUploading || !billNumber.trim()}
                  onChange={(e) => void onPickBillFiles(e.target.files)}
                />
                {billUploading ? "Uploading…" : "＋ Upload"}
              </label>
              {billFiles.length > 0 ? (
                <div className="claim-thumb-row" aria-label="Uploaded files">
                  {billFiles.map((f) => (
                    <div key={f.id} className="claim-thumb" title={f.id}>
                      <span className="claim-thumb__label">File</span>
                      <button
                        type="button"
                        className="claim-thumb__remove"
                        aria-label="Remove"
                        onClick={() => setBillFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <div className="claim-new-page__bottom-chrome">
        <div className="claim-footer">
          <button type="button" className="claim-footer__back" onClick={onBack}>
            Cancel
          </button>
          <button type="button" className="claim-footer__primary" disabled={saving} onClick={() => void onSave()}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
