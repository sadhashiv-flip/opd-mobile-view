import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchBankDetailsPage, type PatientBankRecord } from "@/api/patientBankDetails";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { MEMBER_NOT_ACTIVATED_LABEL } from "@/lib/gymMemberDisplay";
import { fetchPatientProfile } from "@/api/patientProfile";
import {
  createReimbursement,
  fetchReimbursementRequiredDocLists,
  fetchReimbursementServiceTypes,
  type RequiredDocRow,
  toReimbursementCreateClaimServiceType,
  type CreateReimbursementBillPayload,
  type MultiDocumentTypeRow,
  type ReimbursementCreateBillFileWithServices,
  type ReimbursementServiceType,
  type ReimbursementUploadFileRecord,
} from "@/api/patientReimbursement";
import { uploadReimbursementBillDocumentId, uploadReimbursementClaimDocument } from "@/api/patientUpload";
import { ClaimBillFileThumb } from "@/components/claims/ClaimAttachmentFileRow";
import { ClaimBillFieldLabel, ClaimBillUploadHeading } from "@/components/claims/ClaimBillFieldLabel";
import { ClaimStep1Patient } from "@/components/claims/ClaimStep1Patient";
import { ClaimStep2Documents } from "@/components/claims/ClaimStep2Documents";
import { ROUTES } from "@/constants";
import { clampLocalDateToMax, localYyyyMmDd } from "@/lib/localDate";
import { CLAIMS_DISCLOSURES_GATE_SESSION_KEY } from "@/constants/appSessionStorageKeys";
import { CLAIM_CHECKLIST_ESCROW_STORAGE_KEY } from "@/constants/claimsChecklistEscrow";
import { useAppConfirm } from "@/components/dialog/AppConfirmDialog";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useTermsScrollGate } from "@/hooks/useTermsScrollGate";
import { useToast } from "@/hooks/useToast";
import {
  annotateRequiredDocMissing,
  computeStep2DocumentsValid,
} from "@/lib/claimStep2Validation";
import "@/components/address/AddressBottomSheet.css";
import "@/pages/ProfileBankFormPage.css";
import "./ClaimsPages.css";

type StepId = 1 | 2 | 3;

type DraftBill = Readonly<{
  localId: string;
  billNumber: string;
  billDate: string;
  billAmount: string;
  clinicName: string;
  clinicAddress: string;
  doctorName: string;
  doctorReg: string;
  billFiles: readonly ReimbursementUploadFileRecord[];
  serviceTypes: readonly ReimbursementServiceType[];
  /** Parsed checklist from `multi_document/type` (for reopen + validation). */
  multiDocChecklist?: Readonly<{ rows: readonly MultiDocumentTypeRow[]; message: string | null }>;
  /** Checklist page uploads keyed by {@link buildBillChecklistSlots} `slotId`. */
  checklistFilesBySlot: Readonly<Record<string, readonly ReimbursementCreateBillFileWithServices[]>>;
}>;

function newLocalId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDraftBill(): DraftBill {
  return {
    localId: newLocalId(),
    billNumber: "",
    billDate: "",
    billAmount: "",
    clinicName: "",
    clinicAddress: "",
    doctorName: "",
    doctorReg: "",
    billFiles: [],
    serviceTypes: [],
    checklistFilesBySlot: {},
  };
}

/** Deep copy so the sheet draft does not share mutable refs with `bills[]` rows. */
type ClaimStep2ClaimFiles = Readonly<{
  payment: ReimbursementCreateBillFileWithServices[];
  report: ReimbursementCreateBillFileWithServices[];
  other: ReimbursementCreateBillFileWithServices[];
}>;

const EMPTY_CLAIM_STEP2_FILES: ClaimStep2ClaimFiles = { payment: [], report: [], other: [] };

type ClaimDocBucket = "payment" | "report" | "other";

function claimRefTypeToBucket(refType: "PAYMENT" | "REPORT" | "OTHER"): ClaimDocBucket {
  if (refType === "PAYMENT") return "payment";
  if (refType === "REPORT") return "report";
  return "other";
}

function claimBucketToRefType(bucket: ClaimDocBucket): "PAYMENT" | "REPORT" | "OTHER" {
  if (bucket === "payment") return "PAYMENT";
  if (bucket === "report") return "REPORT";
  return "OTHER";
}

function cloneDraftBill(b: DraftBill): DraftBill {
  const checklistFilesBySlot: Record<string, ReimbursementCreateBillFileWithServices[]> = {};
  for (const [slotId, files] of Object.entries(b.checklistFilesBySlot)) {
    checklistFilesBySlot[slotId] = files.map((f) => ({ ...f, service_types: [...f.service_types] }));
  }
  return {
    ...b,
    billFiles: [...b.billFiles],
    serviceTypes: [...b.serviceTypes],
    checklistFilesBySlot,
    multiDocChecklist: b.multiDocChecklist
      ? { rows: [...b.multiDocChecklist.rows], message: b.multiDocChecklist.message }
      : undefined,
  };
}

function formatInrInteger(amountStr: string): string {
  const n = Number(String(amountStr).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(amountStr).trim() || "0";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function formatInrNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

/** Required fields for “Save Bill” on the add-bill sheet (matches patient-app `isMedicalBillFormComplete`). */
function isBillDraftFormComplete(d: DraftBill): boolean {
  if (!d.billNumber.trim() || !d.billDate || !d.billAmount.trim() || !d.clinicName.trim() || !d.clinicAddress.trim()) {
    return false;
  }
  if (!d.billFiles.length) return false;
  const amt = Number(String(d.billAmount).replace(/,/g, ""));
  if (!Number.isFinite(amt) || amt < 1) return false;
  return true;
}

/** Insert or replace a bill row by `localId` (never drops other bills). */
function upsertBillInList(
  prev: readonly DraftBill[],
  draft: DraftBill,
  replaceLocalId: string | null,
): DraftBill[] {
  const d = cloneDraftBill(draft);
  const replaceId = replaceLocalId?.trim() || null;
  if (replaceId) {
    const idx = prev.findIndex((x) => x.localId === replaceId);
    if (idx >= 0) {
      return prev.map((x, i) => (i === idx ? d : cloneDraftBill(x)));
    }
  }
  const existingIdx = prev.findIndex((x) => x.localId === d.localId);
  if (existingIdx >= 0) {
    return prev.map((x, i) => (i === existingIdx ? d : cloneDraftBill(x)));
  }
  return [...prev.map(cloneDraftBill), d];
}

function mergeChecklistDoneBills(
  prev: readonly DraftBill[],
  escrow: { bills: readonly DraftBill[]; billDraft: DraftBill } | null,
  localBillId: string,
  files: Readonly<Record<string, readonly ReimbursementCreateBillFileWithServices[]>>,
  fallbackDraft?: DraftBill | null,
): DraftBill[] {
  let merged = prev.map(cloneDraftBill);
  if (escrow) {
    for (const row of escrow.bills) {
      merged = upsertBillInList(merged, row, row.localId);
    }
    if (escrow.billDraft.localId === localBillId) {
      merged = upsertBillInList(merged, { ...escrow.billDraft, checklistFilesBySlot: { ...files } }, localBillId);
    }
    return merged;
  }
  const idx = merged.findIndex((x) => x.localId === localBillId);
  if (idx >= 0) {
    merged[idx] = cloneDraftBill({
      ...merged[idx],
      checklistFilesBySlot: { ...files },
    });
    return merged;
  }
  if (fallbackDraft?.localId === localBillId) {
    return upsertBillInList(merged, { ...fallbackDraft, checklistFilesBySlot: { ...files } }, null);
  }
  return merged;
}

function readChecklistEscrow(): {
  bills: DraftBill[];
  billDraft: DraftBill;
  editingBillLocalId: string | null;
} | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(CLAIM_CHECKLIST_ESCROW_STORAGE_KEY);
    if (!raw?.trim()) return null;
    globalThis.sessionStorage.removeItem(CLAIM_CHECKLIST_ESCROW_STORAGE_KEY);
    const v = JSON.parse(raw) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (!Array.isArray(o.bills) || o.billDraft === null || typeof o.billDraft !== "object" || Array.isArray(o.billDraft)) {
      return null;
    }
    const draft = o.billDraft as DraftBill;
    const bills = o.bills as DraftBill[];
    const stored =
      typeof o.editingBillLocalId === "string" && o.editingBillLocalId.trim()
        ? o.editingBillLocalId.trim()
        : null;
    const editingBillLocalId =
      stored ?? (bills.some((b) => b.localId === draft.localId) ? draft.localId : null);
    return { bills, billDraft: draft, editingBillLocalId };
  } catch {
    return null;
  }
}

function parseDigits(s: string): number | null {
  const d = s.replace(/\D/g, "");
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

function memberNumericId(m: MemberDisplay): number | null {
  if (m.patientNumericId != null && Number.isFinite(m.patientNumericId)) return m.patientNumericId;
  const n = Number(m.id);
  return Number.isFinite(n) ? n : null;
}

function memberLocTag(m: MemberDisplay): string {
  if (m.memberKind === "primary") return "SELF";
  const r = m.relationship?.trim();
  return r ? r.toUpperCase() : "MEMBER";
}

function bankAccountTail(b: PatientBankRecord): string {
  const n = b.accountNumber.trim();
  return n.length >= 4 ? n.slice(-4) : n;
}

/** Shared copy for first-time gate and in-flow terms sheets (OPD reimbursement). */
function ClaimOpdGeneralTermsBody() {
  return (
    <div className="claim-terms-box claim-terms-box--scroll">
      <p>
        Please read the following terms carefully before submitting a claim under your OPD (Outpatient Department)
        benefits.
      </p>
      <ol>
        <li>
          <strong>Scope of Coverage:</strong> Claims must fall strictly under OPD benefits and as defined within your
          policy. Only covered services, as outlined in the policy, are eligible for reimbursement.
        </li>
        <li>
          <strong>Documentation Requirements:</strong> You must submit genuine and complete documentation, including
          valid prescriptions, invoices and bills, and diagnostic or lab reports where applicable. The invoice must
          clearly itemize all services and products purchased. Incomplete submissions may lead to claim rejection.
        </li>
        <li>
          <strong>Timelines:</strong> All claims must be submitted within 30 days from the invoice date. Late
          submissions will not be considered and may result in claim rejection.
        </li>
        <li>
          <strong>Review &amp; Processing:</strong> Submitted claims will be reviewed and verified for eligibility.
          Processing time may vary based on the nature and completeness of the claim. Submission of a claim does not
          guarantee reimbursement.
        </li>
        <li>
          <strong>Fraud &amp; Rejection:</strong> Incomplete, falsified, or manipulated claims will be rejected and may
          be reported to relevant authorities.
        </li>
        <li>
          <strong>Data Accuracy &amp; Privacy:</strong> You are responsible for the accuracy and authenticity of all data
          and documents uploaded. Personal data is collected for claim processing and handled according to our privacy
          practices.
        </li>
        <li>
          <strong>Policy Updates:</strong> These terms may be updated from time to time. Continued use of the service
          implies acceptance of the latest terms.
        </li>
      </ol>
    </div>
  );
}

/** Important note shown after T&amp;C (first-run gate and step-1 agree flow). */
function ClaimImportantNoteBody() {
  return (
    <div className="claim-terms-box claim-terms-box--scroll">
      <p>
        Claims will be rejected if any details are incomplete or do not match the bill or service. Please ensure all
        details are filled out <strong>accurately and thoroughly.</strong>
      </p>
      <p>
        Claims will be processed only if the bill includes the correct address, service type, bill amount, and payment
        receipt (if required) and <strong>is submitted within 30 days from the bill date.</strong>
      </p>
    </div>
  );
}

type OpdTermsSheetState = { open: false } | { open: true; variant: "step1" | "browse" };

/** patient_app `AppString.kBillReviewDisclaimer` */
const BILL_REVIEW_DISCLAIMER =
  "Claims may be rejected if details are incomplete or do not match the bill. Please review carefully before proceeding.";

export function ClaimNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const confirm = useAppConfirm();
  const mod = useProfileModuleGates();
  const canAddFamilyMember = mod.planDependents.dependentAddAllowed;
  const returnPath =
    (location.state as { returnPath?: string } | null)?.returnPath?.trim() || ROUTES.claims;

  const maxBillDate = localYyyyMmDd(new Date());

  const [gate, setGate] = useState<"terms" | "note" | "done">(() =>
    typeof globalThis.sessionStorage !== "undefined" &&
      globalThis.sessionStorage.getItem(CLAIMS_DISCLOSURES_GATE_SESSION_KEY) === "1"
      ? "done"
      : "terms",
  );
  const [step, setStep] = useState<StepId>(1);
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [memberId, setMemberId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [banks, setBanks] = useState<PatientBankRecord[]>([]);
  const [bankId, setBankId] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [bills, setBills] = useState<DraftBill[]>([]);
  const billsRef = useRef(bills);
  billsRef.current = bills;
  /** When set, “Save bill” replaces this row instead of appending a new bill. */
  const [editingBillLocalId, setEditingBillLocalId] = useState<string | null>(null);
  const editingBillLocalIdRef = useRef<string | null>(null);
  editingBillLocalIdRef.current = editingBillLocalId;
  const [serviceTypesCatalog, setServiceTypesCatalog] = useState<ReimbursementServiceType[]>([]);

  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);
  const [billSheetOpen, setBillSheetOpen] = useState(false);
  /** Bumps when opening add/edit so the bill form remounts with the correct values. */
  const [billSheetKey, setBillSheetKey] = useState(0);
  /** patient_app `showBillReviewTermsBottomSheet` — short disclaimer before service types (new bills only). */
  const [billReviewDisclaimerOpen, setBillReviewDisclaimerOpen] = useState(false);
  const [billDraft, setBillDraft] = useState<DraftBill>(emptyDraftBill);
  const billDraftRef = useRef(billDraft);
  billDraftRef.current = billDraft;
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [serviceDraftSelection, setServiceDraftSelection] = useState<ReimbursementServiceType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [billUploading, setBillUploading] = useState(false);
  const [claimExtraFiles, setClaimExtraFiles] = useState<ClaimStep2ClaimFiles>(EMPTY_CLAIM_STEP2_FILES);
  const [claimDocUploading, setClaimDocUploading] = useState(false);
  const [requiredPayments, setRequiredPayments] = useState<RequiredDocRow[]>([]);
  const [requiredReports, setRequiredReports] = useState<RequiredDocRow[]>([]);
  const [claimDocPending, setClaimDocPending] = useState<{
    refType: "PAYMENT" | "REPORT" | "OTHER";
    file: ReimbursementUploadFileRecord;
    documentType: string;
    editFileId: string | null;
  } | null>(null);
  const [claimDocServiceSheetOpen, setClaimDocServiceSheetOpen] = useState(false);
  const [claimDocServiceSelection, setClaimDocServiceSelection] = useState<ReimbursementServiceType[]>([]);
  const [opdTermsSheet, setOpdTermsSheet] = useState<OpdTermsSheetState>({ open: false });
  const [step1ImportantNoteOpen, setStep1ImportantNoteOpen] = useState(false);

  const gateTermsScroll = useTermsScrollGate(gate === "terms");
  const opdTermsScroll = useTermsScrollGate(opdTermsSheet.open);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setInitLoading(true);
      try {
        const [prof, mems, bankPage, st] = await Promise.all([
          fetchPatientProfile(),
          fetchAllPatientMembers(),
          fetchBankDetailsPage(1),
          fetchReimbursementServiceTypes(),
        ]);
        if (cancelled) return;
        setProfilePhone(prof.phone?.trim() ?? "");
        setProfileEmail(prof.email?.trim() ?? "");
        setMembers(mems);
        setBanks(bankPage.items);
        setServiceTypesCatalog(st);
        const subscribed = mems.filter((m) => m.isSubscribed);
        const primary =
          subscribed.find((m) => m.memberKind === "primary") ?? subscribed[0] ?? null;
        if (primary) {
          setMemberId(primary.id);
          setPhone((primary.phone ?? prof.phone)?.trim() ?? "");
          setEmail(prof.email?.trim() ?? "");
        } else {
          setMemberId("");
          setPhone(prof.phone?.trim() ?? "");
          setEmail(prof.email?.trim() ?? "");
        }
        if (bankPage.items.length === 1) {
          setBankId(bankPage.items[0].id);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load form data");
        }
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    const st = location.state as
      | {
          checklistDone?: { localBillId: string; filesBySlot: Record<string, ReimbursementCreateBillFileWithServices[]> };
          returnPath?: string;
          afterChecklistReview?: boolean;
          restoreClaimBillEscrow?: boolean;
          openNewBillSheet?: boolean;
          removeBillLocalId?: string;
        }
      | null
      | undefined;

    if (st?.restoreClaimBillEscrow) {
      const escrow = readChecklistEscrow();
      if (escrow) {
        if (st.openNewBillSheet) {
          setBills(upsertBillInList(escrow.bills, escrow.billDraft, escrow.billDraft.localId));
          setEditingBillLocalId(null);
          setBillDraft(emptyDraftBill());
        } else {
          setBills(escrow.bills.map((row) => cloneDraftBill(row)));
          setBillDraft(cloneDraftBill(escrow.billDraft));
          setEditingBillLocalId(escrow.editingBillLocalId);
        }
        setBillSheetKey((k) => k + 1);
        setStep(2);
        setBillSheetOpen(true);
        setBillReviewDisclaimerOpen(false);
        setServiceSheetOpen(false);
      }

      if (st.removeBillLocalId?.trim()) {
        const id = st.removeBillLocalId.trim();
        setBills((prev) => prev.filter((x) => x.localId !== id));
        setBillDraft((prev) => (prev.localId === id ? emptyDraftBill() : prev));
        toast.success("Bill removed");
      }

      const rp = typeof st?.returnPath === "string" && st.returnPath.trim() ? st.returnPath.trim() : undefined;
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: rp ? { returnPath: rp } : {},
      });
      return;
    }

    const done = st?.checklistDone;
    const afterChecklistReview = Boolean(st?.afterChecklistReview);
    if (done?.localBillId) {
      const files = done.filesBySlot;
      const escrow = readChecklistEscrow();
      const completedDraft =
        escrow?.billDraft.localId === done.localBillId
          ? cloneDraftBill({ ...escrow.billDraft, checklistFilesBySlot: { ...files } })
          : escrow?.billDraft ?? billDraftRef.current;
      setBillDraft(completedDraft);
      setBills((prev) => mergeChecklistDoneBills(prev, escrow, done.localBillId, files, billDraftRef.current));
      setEditingBillLocalId(null);
      setBillSheetOpen(false);
      setBillReviewDisclaimerOpen(false);
      setServiceSheetOpen(false);
    }
    if (afterChecklistReview) {
      setStep(3);
      setBillSheetOpen(false);
      setBillReviewDisclaimerOpen(false);
    }
    if (!done?.localBillId && !afterChecklistReview) return;
    const rp = typeof st?.returnPath === "string" && st.returnPath.trim() ? st.returnPath.trim() : undefined;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: rp ? { returnPath: rp } : {},
    });
  }, [location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (
      !memberSheetOpen &&
      !bankSheetOpen &&
      !opdTermsSheet.open &&
      !step1ImportantNoteOpen &&
      !billSheetOpen &&
      !billReviewDisclaimerOpen &&
      !serviceSheetOpen
    )
      return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [
    memberSheetOpen,
    bankSheetOpen,
    opdTermsSheet.open,
    step1ImportantNoteOpen,
    billSheetOpen,
    billReviewDisclaimerOpen,
    serviceSheetOpen,
  ]);

  const closeOpdTermsSheet = useCallback(() => {
    setOpdTermsSheet({ open: false });
  }, []);

  const goAddMember = useCallback(() => {
    if (!canAddFamilyMember) {
      toast.error("Your plan doesn’t allow adding family members.");
      return;
    }
    setMemberSheetOpen(false);
    const returnTo = `${location.pathname}${location.search}`;
    navigate(ROUTES.profileMembersAdd, { state: { returnTo } });
  }, [canAddFamilyMember, location.pathname, location.search, navigate, toast]);

  const goAddBank = useCallback(() => {
    setBankSheetOpen(false);
    const returnTo = `${location.pathname}${location.search}`;
    navigate(ROUTES.profileBankAdd, { state: { returnTo } });
  }, [location.pathname, location.search, navigate]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId],
  );

  const selectedBank = useMemo(() => banks.find((b) => b.id === bankId) ?? null, [banks, bankId]);

  const onMemberChange = useCallback(
    (id: string) => {
      const m = members.find((x) => x.id === id);
      if (!m?.isSubscribed) return;
      setMemberId(id);
      setPhone((m.phone ?? profilePhone).trim());
      setEmail(profileEmail);
    },
    [members, profilePhone, profileEmail],
  );

  const canStep1Continue =
    Boolean(memberId) &&
    Boolean(selectedMember?.isSubscribed) &&
    Boolean(bankId) &&
    termsChecked &&
    phone.trim().length >= 10 &&
    email.trim().length > 3;

  const closeBillSheet = useCallback(() => {
    setEditingBillLocalId(null);
    setBillReviewDisclaimerOpen(false);
    setServiceSheetOpen(false);
    setBillSheetOpen(false);
  }, []);

  const openAddBill = useCallback(() => {
    setEditingBillLocalId(null);
    setBillDraft(emptyDraftBill());
    setBillReviewDisclaimerOpen(false);
    setServiceSheetOpen(false);
    setBillSheetKey((k) => k + 1);
    setBillSheetOpen(true);
  }, []);

  const openEditBill = useCallback((b: DraftBill) => {
    const latest = billsRef.current.find((x) => x.localId === b.localId) ?? b;
    setEditingBillLocalId(latest.localId);
    const draft = cloneDraftBill(latest);
    setBillDraft({
      ...draft,
      billDate: clampLocalDateToMax(draft.billDate, maxBillDate),
    });
    setBillReviewDisclaimerOpen(false);
    setServiceSheetOpen(false);
    setBillSheetKey((k) => k + 1);
    setBillSheetOpen(true);
  }, [maxBillDate]);

  const openServiceTypesSheet = useCallback(() => {
    setServiceDraftSelection([...billDraftRef.current.serviceTypes]);
    setServiceSheetOpen(true);
  }, []);

  const toggleServiceInDraft = useCallback((t: ReimbursementServiceType) => {
    setServiceDraftSelection((prev) => {
      const on = prev.some((x) => x.id === t.id);
      if (on) return prev.filter((x) => x.id !== t.id);
      return [...prev, t];
    });
  }, []);

  const persistBillDraft = useCallback(
    (d: DraftBill): boolean => {
      if (!d.serviceTypes.length) {
        toast.error("Select at least one service type");
        return false;
      }
      const replaceId = editingBillLocalIdRef.current;
      setEditingBillLocalId(null);
      setBills((prev) => upsertBillInList(prev, d, replaceId));
      return true;
    },
    [toast],
  );

  const closeBillFlowSheets = useCallback(() => {
    setServiceSheetOpen(false);
    setBillReviewDisclaimerOpen(false);
    setBillSheetOpen(false);
  }, []);

  const allBillServiceTypes = useMemo(() => {
    const seen = new Set<number>();
    const out: ReimbursementServiceType[] = [];
    for (const b of bills) {
      for (const s of b.serviceTypes) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        out.push(s);
      }
    }
    return out;
  }, [bills]);

  const syncRequiredDocuments = useCallback(async () => {
    const keys = allBillServiceTypes.map((s) => s.key.trim()).filter(Boolean);
    if (!keys.length) {
      setRequiredPayments([]);
      setRequiredReports([]);
      return;
    }
    try {
      const lists = await fetchReimbursementRequiredDocLists(keys);
      setRequiredPayments(lists.payments);
      setRequiredReports(lists.reports);
    } catch {
      setRequiredPayments([]);
      setRequiredReports([]);
    }
  }, [allBillServiceTypes]);

  const finishServiceSelection = useCallback(async () => {
    if (!serviceDraftSelection.length) {
      toast.error("Select at least one service type");
      return;
    }
    const base = billDraftRef.current;
    const next: DraftBill = {
      ...base,
      serviceTypes: [...serviceDraftSelection],
    };
    setBillDraft(next);
    const replaceId = editingBillLocalIdRef.current;
    if (persistBillDraft(next)) {
      closeBillFlowSheets();
      await syncRequiredDocuments();
      toast.success(replaceId ? "Bill updated" : "Bill added");
    }
  }, [serviceDraftSelection, toast, persistBillDraft, closeBillFlowSheets, syncRequiredDocuments]);

  const onPickBillFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const billNo = billDraft.billNumber.trim();
      if (!billNo) {
        toast.error("Enter bill number before uploading files");
        return;
      }
      setBillUploading(true);
      try {
        const recs: ReimbursementUploadFileRecord[] = [];
        for (let i = 0; i < files.length; i += 1) {
          const rec = await uploadReimbursementBillDocumentId(files[i], billNo);
          recs.push(rec.name ? rec : { ...rec, name: files[i].name });
        }
        setBillDraft((b) => ({ ...b, billFiles: [...b.billFiles, ...recs] }));
        toast.success("File(s) uploaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBillUploading(false);
      }
    },
    [billDraft.billNumber, toast],
  );

  /**
   * patient_app `onSaveMedicalBillPressed`: new bill → disclaimer sheet → service types;
   * edit bill → service types directly.
   */
  const submitBillDraftToReview = useCallback(() => {
    const d = billDraft;
    if (!isBillDraftFormComplete(d)) {
      toast.error("Please fill mandatory bill fields and attach at least one bill image");
      return;
    }
    if (!serviceTypesCatalog.length) {
      toast.error("Could not load service types. Try again.");
      return;
    }
    if (editingBillLocalId) {
      openServiceTypesSheet();
      return;
    }
    setBillReviewDisclaimerOpen(true);
  }, [billDraft, editingBillLocalId, serviceTypesCatalog.length, openServiceTypesSheet, toast]);

  const onBillReviewDisclaimerAgree = useCallback(() => {
    setBillReviewDisclaimerOpen(false);
    setServiceDraftSelection([]);
    setServiceSheetOpen(true);
  }, []);

  useEffect(() => {
    void syncRequiredDocuments();
  }, [syncRequiredDocuments]);

  const requiredPaymentsAnnotated = useMemo(
    () => annotateRequiredDocMissing(requiredPayments, claimExtraFiles.payment),
    [requiredPayments, claimExtraFiles.payment],
  );

  const requiredReportsAnnotated = useMemo(
    () => annotateRequiredDocMissing(requiredReports, claimExtraFiles.report),
    [requiredReports, claimExtraFiles.report],
  );

  const step2DocumentsValid = useMemo(
    () =>
      computeStep2DocumentsValid(
        requiredPaymentsAnnotated,
        requiredReportsAnnotated,
        claimExtraFiles.payment,
        claimExtraFiles.report,
      ),
    [requiredPaymentsAnnotated, requiredReportsAnnotated, claimExtraFiles.payment, claimExtraFiles.report],
  );

  const openClaimDocFilePicker = useCallback(
    (refType: "PAYMENT" | "REPORT" | "OTHER", documentType: string) => {
      if (!allBillServiceTypes.length) {
        toast.error("Add bills and select service types before uploading documents.");
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,application/pdf";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        void (async () => {
          setClaimDocUploading(true);
          try {
            const rec = await uploadReimbursementClaimDocument(file, refType, documentType);
            const fileRow = rec.name ? rec : { ...rec, name: file.name };
            setClaimDocPending({ refType, file: fileRow, documentType, editFileId: null });
            setClaimDocServiceSelection([]);
            setClaimDocServiceSheetOpen(true);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed");
          } finally {
            setClaimDocUploading(false);
          }
        })();
      };
      input.click();
    },
    [allBillServiceTypes.length, toast],
  );

  const toggleClaimDocService = useCallback((t: ReimbursementServiceType) => {
    setClaimDocServiceSelection((prev) => {
      const on = prev.some((x) => x.id === t.id);
      if (on) return prev.filter((x) => x.id !== t.id);
      return [...prev, t];
    });
  }, []);

  const applyClaimDocServices = useCallback(() => {
    const pending = claimDocPending;
    if (!pending) return;
    if (!claimDocServiceSelection.length) {
      toast.error("Select at least one service type");
      return;
    }
    const bucket = claimRefTypeToBucket(pending.refType);
    const entry: ReimbursementCreateBillFileWithServices = {
      ...pending.file,
      document_type: pending.documentType,
      service_types: claimDocServiceSelection.map(toReimbursementCreateClaimServiceType),
    };
    setClaimExtraFiles((prev) => {
      const list = [...prev[bucket]];
      if (pending.editFileId) {
        const idx = list.findIndex((f) => f.id === pending.editFileId);
        if (idx >= 0) list[idx] = entry;
        else list.push(entry);
      } else {
        list.push(entry);
      }
      return { ...prev, [bucket]: list };
    });
    setClaimDocPending(null);
    setClaimDocServiceSelection([]);
    setClaimDocServiceSheetOpen(false);
    toast.success("Document saved");
  }, [claimDocPending, claimDocServiceSelection, toast]);

  const removeClaimLevelDoc = useCallback((bucket: ClaimDocBucket, fileId: string) => {
    setClaimExtraFiles((prev) => ({
      ...prev,
      [bucket]: prev[bucket].filter((f) => f.id !== fileId),
    }));
  }, []);

  const editClaimDocServices = useCallback(
    (bucket: ClaimDocBucket, fileId: string) => {
      const list = claimExtraFiles[bucket];
      const row = list.find((f) => f.id === fileId);
      if (!row) return;
      const refType = claimBucketToRefType(bucket);
      setClaimDocPending({
        refType,
        file: row,
        documentType: (row.document_type ?? "").trim() || refType,
        editFileId: fileId,
      });
      setClaimDocServiceSelection(
        row.service_types
          .map((st) => allBillServiceTypes.find((x) => x.key === st.key))
          .filter((x): x is ReimbursementServiceType => x != null),
      );
      setClaimDocServiceSheetOpen(true);
    },
    [claimExtraFiles, allBillServiceTypes],
  );

  const claimTotal = useMemo(
    () =>
      bills.reduce((sum, b) => {
        const n = Number(String(b.billAmount).replace(/,/g, ""));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [bills],
  );

  const overviewDocCounts = useMemo(
    () => ({
      payment: claimExtraFiles.payment.length,
      reports: claimExtraFiles.report.length,
      other: claimExtraFiles.other.length,
    }),
    [claimExtraFiles],
  );

  const overviewBillImageCount = useMemo(
    () => bills.reduce((acc, b) => acc + b.billFiles.length, 0),
    [bills],
  );

  const submitClaim = useCallback(async () => {
    const m = selectedMember;
    if (!m || !bankId) {
      toast.error("Select user and bank");
      return;
    }
    const uid = memberNumericId(m);
    if (uid == null) {
      toast.error("User id missing for selected member");
      return;
    }
    const bid = Number(bankId);
    if (!Number.isFinite(bid)) {
      toast.error("Invalid bank account");
      return;
    }
    const alt = parseDigits(altPhone);
    const paymentFiles = [...claimExtraFiles.payment];
    const reportFiles = [...claimExtraFiles.report];
    const otherFiles = [...claimExtraFiles.other];

    const payloadBills: CreateReimbursementBillPayload[] = bills.map((b) => ({
      bill_number: b.billNumber.trim(),
      bill_date: b.billDate,
      bill_amount: Number(String(b.billAmount).replace(/,/g, "")),
      clinic_name: b.clinicName.trim(),
      clinic_address: b.clinicAddress.trim(),
      doctor_name: b.doctorName.trim(),
      doctor_registration_number: b.doctorReg.trim(),
      document_name: "",
      reimbursement_bill_files: b.billFiles,
      service_types: b.serviceTypes.map(toReimbursementCreateClaimServiceType),
    }));

    setSubmitting(true);
    try {
      const res = await createReimbursement({
        user_id: uid,
        bank_id: bid,
        alternative_number: alt === null ? "" : String(alt),
        reason_for_reimbursement: null,
        claim_amount: claimTotal || payloadBills.reduce((s, x) => s + x.bill_amount, 0),
        reimbursement_bills: payloadBills,
        reimbursement_bill_payment_files: paymentFiles,
        reimbursement_report_files: reportFiles,
        reimbursement_other_files: otherFiles,
      });
      toast.success(res.message || "Claim submitted");
      navigate(returnPath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [selectedMember, bankId, altPhone, bills, claimExtraFiles, claimTotal, navigate, returnPath, toast]);

  const onOpdTermsSheetContinue = useCallback(() => {
    setOpdTermsSheet((prev) => {
      if (!prev.open) return prev;
      if (prev.variant === "step1") {
        setTermsChecked(true);
      }
      return { open: false };
    });
  }, []);

  const onStep1ImportantNoteContinue = useCallback(() => {
    const ready =
      Boolean(memberId) &&
      Boolean(bankId) &&
      phone.trim().length >= 10 &&
      email.trim().length > 3;
    if (!ready) {
      toast.error("Please complete user, bank, and contact details before continuing");
      setStep1ImportantNoteOpen(false);
      return;
    }
    setStep1ImportantNoteOpen(false);
    setStep(2);
  }, [memberId, bankId, phone, email, toast]);

  const closeStep1ImportantNote = useCallback(() => {
    setStep1ImportantNoteOpen(false);
  }, []);

  const confirmRemoveBill = useCallback(
    async (localId: string) => {
      const ok = await confirm({
        title: "Remove bill?",
        message: "Are you sure you want to remove this bill?",
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
        variant: "destructive",
      });
      if (!ok) return;
      setBills((prev) => prev.filter((b) => b.localId !== localId));
      if (editingBillLocalIdRef.current === localId) {
        setEditingBillLocalId(null);
        setBillDraft(emptyDraftBill());
        setBillSheetOpen(false);
        setBillReviewDisclaimerOpen(false);
        setServiceSheetOpen(false);
      }
      toast.success("Bill removed");
    },
    [confirm, toast],
  );

  const canSaveBillDraft = useMemo(() => isBillDraftFormComplete(billDraft), [billDraft]);

  const tryExitClaimFlow = useCallback(async () => {
    if (bills.length > 0) {
      const ok = await confirm({
        title: "Leave claim?",
        message:
          "You have added bill details. Going back will clear all entered data. Do you want to continue?",
        confirmLabel: "Yes, leave",
        cancelLabel: "Stay",
        variant: "destructive",
      });
      if (!ok) return;
      setBills([]);
      setBillDraft(emptyDraftBill());
      setEditingBillLocalId(null);
      setClaimExtraFiles(EMPTY_CLAIM_STEP2_FILES);
      setRequiredPayments([]);
      setRequiredReports([]);
      setBillSheetOpen(false);
      setBillReviewDisclaimerOpen(false);
      setServiceSheetOpen(false);
      setClaimDocPending(null);
      setClaimDocServiceSheetOpen(false);
    }
    navigate(returnPath);
  }, [bills.length, confirm, navigate, returnPath]);

  const onBack = useCallback(async () => {
    if (opdTermsSheet.open) {
      closeOpdTermsSheet();
      return;
    }
    if (step1ImportantNoteOpen) {
      closeStep1ImportantNote();
      return;
    }
    if (serviceSheetOpen) {
      setServiceSheetOpen(false);
      return;
    }
    if (billReviewDisclaimerOpen) {
      setBillReviewDisclaimerOpen(false);
      return;
    }
    if (billSheetOpen) {
      closeBillSheet();
      return;
    }
    if (bankSheetOpen) {
      setBankSheetOpen(false);
      return;
    }
    if (memberSheetOpen) {
      setMemberSheetOpen(false);
      return;
    }
    if (step === 1) {
      await tryExitClaimFlow();
      return;
    }
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  }, [
    opdTermsSheet.open,
    step1ImportantNoteOpen,
    serviceSheetOpen,
    billReviewDisclaimerOpen,
    billSheetOpen,
    bankSheetOpen,
    memberSheetOpen,
    closeOpdTermsSheet,
    closeStep1ImportantNote,
    closeBillSheet,
    tryExitClaimFlow,
    step,
  ]);

  const stepper = (
    <div className="claim-stepper">
      {([1, 2, 3] as const).map((n) => {
        const active = step === n;
        const done = step > n;
        return (
          <div
            key={n}
            className={`claim-stepper__seg${done ? " claim-stepper__seg--done" : ""}${active ? " claim-stepper__seg--active" : ""}`}
          >
            <div
              className={`claim-stepper__circle${active ? " claim-stepper__circle--active" : ""}${done ? " claim-stepper__circle--done" : ""}`}
            >
              {done ? "✓" : n}
            </div>
            <span className={`claim-stepper__label${active ? " claim-stepper__label--active" : ""}`}>
              {n === 1 ? "User" : n === 2 ? "Bills" : "Review"}
            </span>
          </div>
        );
      })}
    </div>
  );

  if (initLoading) {
    return (
      <div className="claim-new-page pbf-page">
        <header className="claims-screen-header">
          <span style={{ width: 44 }} aria-hidden />
          <h1 className="claims-screen-header__title">Add New Claim</h1>
          <span style={{ width: 44 }} aria-hidden />
        </header>
        <main className="claim-new-page__main">
          <p className="claims-row__meta">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className={`claim-new-page pbf-page${step === 1 ? " claim-new-page--step1" : ""}`}>
      <header className="claims-screen-header">
        <button type="button" className="app-back-btn claims-screen-header__back" aria-label="Back" onClick={() => void onBack()}>
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
        <h1 className="claims-screen-header__title">Add New Claim</h1>
        <span style={{ width: 44 }} aria-hidden />
      </header>

      <main className={`claim-new-page__main${step === 3 ? " claim-new-page__main--review" : ""}`}>
        {stepper}

        {step === 1 ? (
          <ClaimStep1Patient
            selectedMember={selectedMember}
            selectedBank={selectedBank}
            memberTag={selectedMember ? memberLocTag(selectedMember) : ""}
            bankAccountTail={selectedBank ? bankAccountTail(selectedBank) : ""}
            phone={phone}
            email={email}
            altPhone={altPhone}
            onOpenMemberSheet={() => setMemberSheetOpen(true)}
            onOpenBankSheet={() => setBankSheetOpen(true)}
            onPhoneChange={setPhone}
            onEmailChange={setEmail}
            onAltPhoneChange={setAltPhone}
          />
        ) : null}

        {step === 2 ? (
          <>
            <section className="claim-med-bills" aria-labelledby="claim-med-bills-title">
              <div className="claim-med-bills__head">
                <span className="claim-med-bills__icon" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 2h6l4 4v14a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 8h6M9 12h6M9 16h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <h2 id="claim-med-bills-title" className="claim-med-bills__title">
                  Medical Bills
                </h2>
              </div>
              {bills.length > 0 ? (
                <ul className="claim-med-bill-list" aria-label="Saved bills">
                  {bills.map((b) => {
                    const clinic = b.clinicName.trim() || "—";
                    const date = b.billDate || "—";
                    return (
                      <li key={b.localId} className="claim-med-bill-card">
                        <div className="claim-med-bill-card__row">
                          <button
                            type="button"
                            className="claim-med-bill-card__tap"
                            aria-label={`Edit bill ${b.billNumber.trim() || "—"}`}
                            onClick={() => openEditBill(b)}
                          >
                            <span className="claim-med-bill-card__ic" aria-hidden>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M9 2h6l4 4v14a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z"
                                  stroke="currentColor"
                                  strokeWidth="1.75"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M9 8h6M9 12h6M9 16h4"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                            <span className="claim-med-bill-card__body">
                              <span className="claim-med-bill-card__title">
                                Bill #{b.billNumber.trim() || "—"}
                              </span>
                              <span className="claim-med-bill-card__sub">
                                {clinic} • {date}
                              </span>
                            </span>
                            <span className="claim-med-bill-card__amt">₹{formatInrInteger(b.billAmount)}</span>
                          </button>
                          <button
                            type="button"
                            className="claim-med-bill-card__remove"
                            aria-label={`Remove bill ${b.billNumber.trim() || "—"}`}
                            onClick={() => void confirmRemoveBill(b.localId)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M18 6L6 18M6 6l12 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <button type="button" className="claim-add-card" onClick={openAddBill}>
                <span className="claim-add-card__plus" aria-hidden>
                  +
                </span>
                Add Medical Bill
              </button>
            </section>
            {bills.length > 0 ? (
              <section className="claim-ro-card" aria-labelledby="claim-step2-docs-title">
                <h2 id="claim-step2-docs-title" className="visually-hidden">
                  Claim documents
                </h2>
                <ClaimStep2Documents
                  files={claimExtraFiles}
                  requiredPayments={requiredPaymentsAnnotated}
                  requiredReports={requiredReportsAnnotated}
                  uploading={claimDocUploading}
                  onUploadCategory={(refType, category) => openClaimDocFilePicker(refType, category)}
                  onUploadGeneral={(bucket) => {
                    const ref = claimBucketToRefType(bucket);
                    const docType = bucket === "payment" ? "PAYMENT" : bucket === "report" ? "REPORT" : "OTHER";
                    openClaimDocFilePicker(ref, docType);
                  }}
                  onRemoveFile={removeClaimLevelDoc}
                  onEditFileServices={editClaimDocServices}
                />
              </section>
            ) : null}
            {claimDocUploading && step === 2 ? (
              <div className="claim-step2-upload-overlay" aria-live="polite" aria-busy="true">
                Uploading…
              </div>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <div className="claim-ro">
            <section className="claim-ro-card" aria-labelledby="claim-ro-patient-title">
              <div className="claim-ro-card__head">
                <span className="claim-ro-card__icon" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <h2 id="claim-ro-patient-title" className="claim-ro-card__title">
                  User details
                </h2>
              </div>
              <dl className="claim-ro-dl">
                <div className="claim-ro-dl__row">
                  <dt>User name</dt>
                  <dd>{selectedMember?.name ?? "—"}</dd>
                </div>
                <div className="claim-ro-dl__row">
                  <dt>Phone number</dt>
                  <dd>{phone.trim() || "—"}</dd>
                </div>
                <div className="claim-ro-dl__row">
                  <dt>Email address</dt>
                  <dd>{email.trim() || "—"}</dd>
                </div>
                <div className="claim-ro-dl__row">
                  <dt>Alternate phone number</dt>
                  <dd>{altPhone.trim() || "—"}</dd>
                </div>
                {selectedBank ? (
                  <>
                    <div className="claim-ro-dl__row">
                      <dt>Account holder</dt>
                      <dd>{selectedBank.accountHolderName.trim() || "—"}</dd>
                    </div>
                    <div className="claim-ro-dl__row">
                      <dt>Bank name</dt>
                      <dd>{selectedBank.bankName.trim() || "—"}</dd>
                    </div>
                    <div className="claim-ro-dl__row">
                      <dt>Account number</dt>
                      <dd>****{bankAccountTail(selectedBank)}</dd>
                    </div>
                    <div className="claim-ro-dl__row">
                      <dt>IFSC code</dt>
                      <dd>{selectedBank.ifscCode.trim() || "—"}</dd>
                    </div>
                    {selectedBank.branch?.trim() ? (
                      <div className="claim-ro-dl__row">
                        <dt>Branch</dt>
                        <dd>{selectedBank.branch.trim()}</dd>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="claim-ro-dl__row">
                    <dt>Bank details</dt>
                    <dd>—</dd>
                  </div>
                )}
              </dl>
            </section>

            <section
              className="claim-ro-card claim-ro-card--medical-bills"
              aria-labelledby="claim-ro-bills-title"
            >
              <div className="claim-ro-bills-card__header">
                <div className="claim-ro-card__head claim-ro-card__head--medical-bills">
                  <span className="claim-ro-card__icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 2h6l4 4v14a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 8h6M9 12h6M9 16h4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <h2 id="claim-ro-bills-title" className="claim-ro-card__title">
                    Medical Bills
                  </h2>
                </div>
                <div className="claim-ro-bills-card__divider" aria-hidden />
              </div>
              {bills.length === 0 ? (
                <p className="claim-ro-empty">No bills added yet.</p>
              ) : (
                <ul className="claim-ro-bill-list">
                  {bills.map((b, idx) => (
                    <li key={b.localId} className="claim-ro-bill">
                      <span className="claim-ro-bill__badge" aria-hidden>
                        {idx + 1}
                      </span>
                      <div className="claim-ro-bill__body">
                        <div className="claim-ro-bill__title">Bill #{b.billNumber.trim() || "—"}</div>
                        <div className="claim-ro-bill__sub">
                          {b.clinicName.trim() || "—"} · {b.billDate || "—"}
                        </div>
                      </div>
                      <div className="claim-ro-bill__amt">₹{formatInrInteger(b.billAmount)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="claim-ro-card" aria-labelledby="claim-ro-docs-title">
              <div className="claim-ro-card__head">
                <span className="claim-ro-card__icon" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 7a2 2 0 012-2h4l2 2h10a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <h2 id="claim-ro-docs-title" className="claim-ro-card__title">
                  Supporting documents
                </h2>
              </div>
              <ul className="claim-ro-doc-list">
                <li className="claim-ro-doc-row">
                  <span className="claim-ro-doc-row__icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="claim-ro-doc-row__label">Bill images (scans)</span>
                  <span
                    className={`claim-ro-pill${overviewBillImageCount > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                  >
                    {overviewBillImageCount} file{overviewBillImageCount === 1 ? "" : "s"}
                  </span>
                </li>
                <li className="claim-ro-doc-row">
                  <span className="claim-ro-doc-row__icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <span className="claim-ro-doc-row__label">Payment receipts</span>
                  <span
                    className={`claim-ro-pill${overviewDocCounts.payment > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                  >
                    {overviewDocCounts.payment} file{overviewDocCounts.payment === 1 ? "" : "s"}
                  </span>
                </li>
                <li className="claim-ro-doc-row">
                  <span className="claim-ro-doc-row__icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="claim-ro-doc-row__label">Medical reports</span>
                  <span
                    className={`claim-ro-pill${overviewDocCounts.reports > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                  >
                    {overviewDocCounts.reports} file{overviewDocCounts.reports === 1 ? "" : "s"}
                  </span>
                </li>
                <li className="claim-ro-doc-row">
                  <span className="claim-ro-doc-row__icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.2-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="claim-ro-doc-row__label">Other documents</span>
                  <span
                    className={`claim-ro-pill${overviewDocCounts.other > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                  >
                    {overviewDocCounts.other} file{overviewDocCounts.other === 1 ? "" : "s"}
                  </span>
                </li>
              </ul>
            </section>

            <section className="claim-ro-total" aria-labelledby="claim-ro-total-title">
              <div>
                <h2 id="claim-ro-total-title" className="claim-ro-total__label">
                  Total claim amount
                </h2>
                <p className="claim-ro-total__amt">₹{formatInrNumber(claimTotal)}</p>
              </div>
              <span className="claim-ro-total__rupee" aria-hidden>
                ₹
              </span>
            </section>

            <div className="claim-ro-notice" role="note">
              <span className="claim-ro-notice__icon" aria-hidden>
                i
              </span>
              <p>
                Once submitted, your claim will be reviewed by our team. You will be notified about the status updates via
                SMS and email.
              </p>
            </div>
          </div>
        ) : null}
      </main>

      <div className="claim-new-page__bottom-chrome">
        {step === 1 ? (
          <div className="claim-new-page__agree">
            <input
              id="claim-terms-agree"
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => {
                if (e.target.checked) {
                  setOpdTermsSheet({ open: true, variant: "step1" });
                } else {
                  setTermsChecked(false);
                }
              }}
            />
            <p className="claim-new-page__agree-copy">
              <label htmlFor="claim-terms-agree" className="claim-new-page__agree-inline-label">
                I agree to the
              </label>{" "}
              <button
                type="button"
                className="link"
                onClick={(e) => {
                  e.preventDefault();
                  setOpdTermsSheet({ open: true, variant: "browse" });
                }}
              >
                Terms &amp; Conditions
              </button>{" "}
              <label htmlFor="claim-terms-agree" className="claim-new-page__agree-inline-label">
                for OPD claim reimbursement.
              </label>
            </p>
          </div>
        ) : null}
        <div className="claim-footer">
          <button type="button" className="claim-footer__back" onClick={() => void onBack()}>
            Back
          </button>
          {step === 1 ? (
            <button
              type="button"
              className="claim-footer__primary"
              disabled={!canStep1Continue}
              onClick={() => setStep1ImportantNoteOpen(true)}
            >
              Continue
            </button>
          ) : null}
          {step === 2 ? (
            <button
              type="button"
              className="claim-footer__primary"
              disabled={bills.length === 0 || !step2DocumentsValid}
              onClick={() => setStep(3)}
              title={!step2DocumentsValid ? "Upload required documents for all service types" : undefined}
            >
              Review Claim
            </button>
          ) : null}
          {step === 3 ? (
            <button
              type="button"
              className="claim-footer__primary"
              disabled={bills.length === 0 || submitting}
              onClick={() => void submitClaim()}
            >
              {submitting ? "Submitting…" : "Submit claim"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Gate: General T&C */}
      {gate === "terms" ? (
        <div className="claim-overlay" role="dialog" aria-modal>
          <div className="claim-sheet claim-sheet--opd-terms">
            <div className="claim-sheet__head">
              <h2 className="claim-sheet__title">General Terms &amp; Conditions for OPD Claims</h2>
              <button type="button" className="claim-sheet__close" aria-label="Close" onClick={() => navigate(returnPath)}>
                ×
              </button>
            </div>
            <div
              ref={gateTermsScroll.scrollRef}
              className="claim-sheet__body claim-sheet__body--terms"
              onScroll={gateTermsScroll.onScroll}
            >
              <ClaimOpdGeneralTermsBody />
            </div>
            <div className="claim-sheet__footer">
              <button
                type="button"
                className="claim-sheet__btn-black"
                style={{ flex: 1 }}
                disabled={!gateTermsScroll.scrolledToEnd}
                onClick={() => setGate("note")}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Gate: Important note */}
      {gate === "note" ? (
        <div className="claim-overlay" role="dialog" aria-modal>
          <div className="claim-sheet">
            <div className="claim-sheet__head">
              <h2 className="claim-sheet__title">Important Note:</h2>
              <button type="button" className="claim-sheet__close" aria-label="Close" onClick={() => navigate(returnPath)}>
                ×
              </button>
            </div>
            <div className="claim-sheet__body claim-sheet__body--terms">
              <ClaimImportantNoteBody />
            </div>
            <div className="claim-sheet__footer">
              <button
                type="button"
                className="claim-sheet__btn-black"
                style={{ flex: 1 }}
                onClick={() => {
                  sessionStorage.setItem(CLAIMS_DISCLOSURES_GATE_SESSION_KEY, "1");
                  setGate("done");
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 1: after main Continue — Important Note, then Continue → Bills (step 2) */}
      {step1ImportantNoteOpen && step === 1 ? (
        <div
          className="claim-overlay claim-overlay--step1-important-note"
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-step1-important-title"
          onClick={closeStep1ImportantNote}
        >
          <div className="claim-sheet claim-sheet--opd-terms" onClick={(e) => e.stopPropagation()}>
            <div className="claim-sheet__head">
              <h2 id="claim-step1-important-title" className="claim-sheet__title">
                Important Note:
              </h2>
              <button type="button" className="claim-sheet__close" aria-label="Close" onClick={closeStep1ImportantNote}>
                ×
              </button>
            </div>
            <div className="claim-sheet__body claim-sheet__body--terms">
              <ClaimImportantNoteBody />
            </div>
            <div className="claim-sheet__footer">
              <button
                type="button"
                className="claim-sheet__btn-black"
                style={{ flex: 1 }}
                onClick={onStep1ImportantNoteContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Patient picker (same sheet pattern as {@link AddressBottomSheet}) */}
      {memberSheetOpen ? (
        <dialog
          className="addr-sheet-dialog"
          open
          aria-modal="true"
          aria-labelledby="claim-member-sheet-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMemberSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMemberSheetOpen(false);
          }}
        >
          <section className="addr-sheet">
            <header className="addr-sheet__header">
              <h2 id="claim-member-sheet-title" className="addr-sheet__title">
                Select user
              </h2>
              <button
                type="button"
                className="addr-sheet__close"
                aria-label="Close"
                onClick={() => setMemberSheetOpen(false)}
              >
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
              {canAddFamilyMember
                ? "Choose who this claim is for, or add a family member."
                : "Choose who this claim is for."}
            </p>
            {members.length === 0 ? (
              <p className="addr-sheet__empty">No saved users yet.</p>
            ) : (
              <ul className="addr-sheet__list" role="radiogroup" aria-label="Users">
                {members.map((m) => {
                  const inputId = `claim-member-${m.id}`;
                  const inactive = !m.isSubscribed;
                  return (
                    <li key={m.id} className="addr-sheet__item-wrap">
                      <label
                        htmlFor={inputId}
                        className={`addr-sheet__item${memberId === m.id ? " addr-sheet__item--selected" : ""}${inactive ? " addr-sheet__item--inactive" : ""}`}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          className="addr-sheet__radio"
                          name="claim-member-sheet"
                          checked={memberId === m.id}
                          disabled={inactive}
                          onChange={() => onMemberChange(m.id)}
                        />
                        <span className="addr-sheet__item-body">
                          <span className="addr-sheet__tag">{memberLocTag(m)}</span>
                          {inactive ? (
                            <span className="addr-sheet__inactive-pill">{MEMBER_NOT_ACTIVATED_LABEL}</span>
                          ) : null}
                          {m.memberKind === "primary" ? (
                            <span className="addr-sheet__primary-pill" aria-label="Primary member">
                              Primary
                            </span>
                          ) : null}
                          <p className="addr-sheet__lines">{m.name}</p>
                          {m.phone?.trim() ? (
                            <p className="addr-sheet__meta">{m.phone.trim()}</p>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {canAddFamilyMember ? (
              <div className="addr-sheet__actions">
                <button type="button" className="addr-sheet__add-btn" onClick={goAddMember}>
                  <span className="addr-sheet__add-ic" aria-hidden="true">
                    +
                  </span>
                  <span>Add family member</span>
                </button>
              </div>
            ) : null}
          </section>
        </dialog>
      ) : null}

      {/* Bank picker (same sheet pattern as {@link AddressBottomSheet}) */}
      {bankSheetOpen ? (
        <dialog
          className="addr-sheet-dialog"
          open
          aria-modal="true"
          aria-labelledby="claim-bank-sheet-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBankSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setBankSheetOpen(false);
          }}
        >
          <section className="addr-sheet">
            <header className="addr-sheet__header">
              <h2 id="claim-bank-sheet-title" className="addr-sheet__title">
                Your bank accounts
              </h2>
              <button
                type="button"
                className="addr-sheet__close"
                aria-label="Close"
                onClick={() => setBankSheetOpen(false)}
              >
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
            <p className="addr-sheet__hint">Choose where reimbursement should be credited.</p>
            {banks.length === 0 ? (
              <p className="addr-sheet__empty">No bank accounts on file yet.</p>
            ) : (
              <ul className="addr-sheet__list" role="radiogroup" aria-label="Bank accounts">
                {banks.map((b) => {
                  const inputId = `claim-bank-${b.id}`;
                  const tail = bankAccountTail(b);
                  return (
                    <li key={b.id} className="addr-sheet__item-wrap">
                      <label
                        htmlFor={inputId}
                        className={`addr-sheet__item${bankId === b.id ? " addr-sheet__item--selected" : ""}`}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          className="addr-sheet__radio"
                          name="claim-bank-sheet"
                          checked={bankId === b.id}
                          onChange={() => {
                            setBankId(b.id);
                            setBankSheetOpen(false);
                          }}
                        />
                        <span className="addr-sheet__item-body">
                          <span className="addr-sheet__tag">{b.bankName}</span>
                          <p className="addr-sheet__lines">
                            {b.accountHolderName} · ****{tail}
                          </p>
                          <p className="addr-sheet__meta">
                            {b.ifscCode}
                            {b.branch?.trim() ? ` · ${b.branch.trim()}` : ""}
                          </p>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="addr-sheet__actions">
              <button type="button" className="addr-sheet__add-btn" onClick={goAddBank}>
                <span className="addr-sheet__add-ic" aria-hidden="true">
                  +
                </span>
                <span>Add bank account</span>
              </button>
            </div>
          </section>
        </dialog>
      ) : null}

      {/* Add bill */}
      {billSheetOpen ? (
        <div className="claim-overlay claim-overlay--bill-form" role="dialog" aria-modal>
          <div className="claim-sheet claim-sheet--bill-form" onClick={(e) => e.stopPropagation()}>
            <div className="claim-sheet__handle" aria-hidden />
            <div className="claim-sheet__head">
              <h2 className="claim-sheet__title">{editingBillLocalId ? "Edit Medical Bill" : "Add Medical Bill"}</h2>
              <button type="button" className="claim-sheet__close" aria-label="Close" onClick={closeBillSheet}>
                ×
              </button>
            </div>
            <div className="claim-sheet__body claim-new-page__sheet-pbf">
              <section
                key={`bill-form-${billSheetKey}-${editingBillLocalId ?? "new"}`}
                className="pbf-card"
                aria-label="Bill details"
              >
                <div className="pbf-field">
                  <ClaimBillFieldLabel htmlFor="claim-bill-no" required>
                    Bill number
                  </ClaimBillFieldLabel>
                  <input
                    id="claim-bill-no"
                    className="pbf-input"
                    autoComplete="off"
                    placeholder="Enter bill number"
                    value={billDraft.billNumber}
                    onChange={(e) => setBillDraft((b) => ({ ...b, billNumber: e.target.value }))}
                  />
                </div>
                <div className="pbf-field">
                  <ClaimBillFieldLabel htmlFor="claim-bill-date" required>
                    Bill date
                  </ClaimBillFieldLabel>
                  <input
                    id="claim-bill-date"
                    className="pbf-input"
                    type="date"
                    max={maxBillDate}
                    value={billDraft.billDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBillDraft((b) => ({
                        ...b,
                        billDate: clampLocalDateToMax(v, maxBillDate),
                      }));
                    }}
                  />
                </div>
                <div className="pbf-field">
                  <ClaimBillFieldLabel htmlFor="claim-bill-amt" required>
                    Bill amount
                  </ClaimBillFieldLabel>
                  <input
                    id="claim-bill-amt"
                    className="pbf-input"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Enter bill amount (₹)"
                    value={billDraft.billAmount}
                    onChange={(e) => setBillDraft((b) => ({ ...b, billAmount: e.target.value }))}
                  />
                </div>
                <div className="pbf-field">
                  <ClaimBillFieldLabel htmlFor="claim-clinic" required>
                    Clinic / hospital name
                  </ClaimBillFieldLabel>
                  <input
                    id="claim-clinic"
                    className="pbf-input"
                    autoComplete="off"
                    placeholder="Enter clinic or hospital name"
                    value={billDraft.clinicName}
                    onChange={(e) => setBillDraft((b) => ({ ...b, clinicName: e.target.value }))}
                  />
                </div>
                <div className="pbf-field">
                  <ClaimBillFieldLabel htmlFor="claim-clinic-addr" required>
                    Clinic address
                  </ClaimBillFieldLabel>
                  <input
                    id="claim-clinic-addr"
                    className="pbf-input"
                    autoComplete="street-address"
                    placeholder="Enter clinic address"
                    value={billDraft.clinicAddress}
                    onChange={(e) => setBillDraft((b) => ({ ...b, clinicAddress: e.target.value }))}
                  />
                </div>
                <div className="pbf-field">
                  <ClaimBillFieldLabel htmlFor="claim-doctor">Doctor name</ClaimBillFieldLabel>
                  <input
                    id="claim-doctor"
                    className="pbf-input"
                    autoComplete="name"
                    placeholder="Enter doctor name"
                    value={billDraft.doctorName}
                    onChange={(e) => setBillDraft((b) => ({ ...b, doctorName: e.target.value }))}
                  />
                </div>
                <div className="pbf-field">
                  <ClaimBillFieldLabel htmlFor="claim-doctor-reg">Doctor registration number</ClaimBillFieldLabel>
                  <input
                    id="claim-doctor-reg"
                    className="pbf-input"
                    autoComplete="off"
                    placeholder="Enter doctor registration number"
                    value={billDraft.doctorReg}
                    onChange={(e) => setBillDraft((b) => ({ ...b, doctorReg: e.target.value }))}
                  />
                </div>
                <div className="pbf-field">
                  <ClaimBillUploadHeading required>Bill images</ClaimBillUploadHeading>
                  <div className="claim-bill-upload-stack">
                    <label className="claim-upload claim-upload--pbf">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        hidden
                        disabled={billUploading || !billDraft.billNumber.trim()}
                        onChange={(e) => void onPickBillFiles(e.target.files)}
                      />
                      {billUploading ? "Uploading…" : "＋ Upload"}
                    </label>
                    {billDraft.billFiles.length > 0 ? (
                      <div className="claim-thumb-row" aria-label="Uploaded files">
                        {billDraft.billFiles.map((f) => (
                          <ClaimBillFileThumb
                            key={f.id}
                            file={f}
                            onRemove={() =>
                              setBillDraft((b) => ({
                                ...b,
                                billFiles: b.billFiles.filter((x) => x.id !== f.id),
                              }))
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
            <div className="claim-sheet__footer">
              <button
                type="button"
                className="claim-sheet__btn-primary"
                style={{ flex: 1 }}
                disabled={!canSaveBillDraft}
                onClick={submitBillDraftToReview}
              >
                {editingBillLocalId ? "Update Bill" : "Save Bill"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* patient_app `showBillReviewTermsBottomSheet` — disclaimer before service types (new bill only) */}
      {billReviewDisclaimerOpen ? (
        <div
          className="claim-overlay claim-overlay--bill-disclaimer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-bill-disclaimer-title"
        >
          <div className="claim-sheet claim-sheet--bill-disclaimer" onClick={(e) => e.stopPropagation()}>
            <div className="claim-sheet__head">
              <h2 id="claim-bill-disclaimer-title" className="claim-sheet__title">
                Review Your Submission
              </h2>
              <button
                type="button"
                className="claim-sheet__close"
                aria-label="Close"
                onClick={() => setBillReviewDisclaimerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="claim-sheet__body claim-sheet__body--terms">
              <div className="claim-terms-box">{BILL_REVIEW_DISCLAIMER}</div>
            </div>
            <div className="claim-sheet__footer">
              <button
                type="button"
                className="claim-sheet__btn-black"
                style={{ flex: 1 }}
                onClick={onBillReviewDisclaimerAgree}
              >
                I Agree
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* patient_app `showBillServiceTypesBottomSheet` */}
      {serviceSheetOpen ? (
        <div className="claim-overlay claim-overlay--claim-service-types" role="dialog" aria-modal>
          <div className="claim-sheet claim-sheet--service-types" onClick={(e) => e.stopPropagation()}>
            <div className="claim-sheet__head">
              <h2 className="claim-sheet__title">Select Service Type(s)</h2>
              <button
                type="button"
                className="claim-sheet__close"
                aria-label="Close"
                onClick={() => setServiceSheetOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="claim-sheet__divider" aria-hidden />
            <div className="claim-sheet__body">
              {serviceTypesCatalog.length === 0 ? (
                <p className="claim-sheet__empty">No service types available</p>
              ) : (
                <div className="claim-chips">
                  {serviceTypesCatalog.map((t) => {
                    const on = serviceDraftSelection.some((x) => x.id === t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`claim-chip${on ? " claim-chip--on" : ""}`}
                        onClick={() => toggleServiceInDraft(t)}
                      >
                        {t.value}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {serviceDraftSelection.length > 0 ? (
              <div className="claim-sheet__footer claim-sheet__footer--split">
                <button type="button" className="claim-sheet__btn-muted" onClick={() => setServiceDraftSelection([])}>
                  Clear All
                </button>
                <button
                  type="button"
                  className="claim-sheet__btn-primary"
                  onClick={() => void finishServiceSelection()}
                >
                  Apply
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {claimDocServiceSheetOpen && claimDocPending ? (
        <div className="claim-overlay claim-overlay--claim-service-types" role="dialog" aria-modal>
          <div className="claim-sheet claim-sheet--service-types" onClick={(e) => e.stopPropagation()}>
            <div className="claim-sheet__head">
              <h2 className="claim-sheet__title">Select Service Type(s)</h2>
              <button
                type="button"
                className="claim-sheet__close"
                aria-label="Close"
                onClick={() => {
                  setClaimDocServiceSheetOpen(false);
                  setClaimDocPending(null);
                  setClaimDocServiceSelection([]);
                }}
              >
                ×
              </button>
            </div>
            <div className="claim-sheet__divider" aria-hidden />
            <div className="claim-sheet__body">
              {allBillServiceTypes.length === 0 ? (
                <p className="claim-sheet__empty">No service types available</p>
              ) : (
                <div className="claim-chips">
                  {allBillServiceTypes.map((t) => {
                    const on = claimDocServiceSelection.some((x) => x.id === t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`claim-chip${on ? " claim-chip--on" : ""}`}
                        onClick={() => toggleClaimDocService(t)}
                      >
                        {t.value}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {claimDocServiceSelection.length > 0 ? (
              <div className="claim-sheet__footer claim-sheet__footer--split">
                <button
                  type="button"
                  className="claim-sheet__btn-muted"
                  onClick={() => setClaimDocServiceSelection([])}
                >
                  Clear All
                </button>
                <button type="button" className="claim-sheet__btn-primary" onClick={applyClaimDocServices}>
                  Apply
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* General OPD T&C: opened from step-1 agree checkbox / Terms link */}
      {opdTermsSheet.open ? (
        <div
          className="claim-overlay claim-overlay--opd-terms"
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-opd-terms-sheet-title"
          onClick={closeOpdTermsSheet}
        >
          <div className="claim-sheet claim-sheet--opd-terms" onClick={(e) => e.stopPropagation()}>
            <div className="claim-sheet__head">
              <h2 id="claim-opd-terms-sheet-title" className="claim-sheet__title">
                General Terms &amp; Conditions for OPD Claims
              </h2>
              <button type="button" className="claim-sheet__close" aria-label="Close" onClick={closeOpdTermsSheet}>
                ×
              </button>
            </div>
            <div
              ref={opdTermsScroll.scrollRef}
              className="claim-sheet__body claim-sheet__body--terms"
              onScroll={opdTermsScroll.onScroll}
            >
              <ClaimOpdGeneralTermsBody />
            </div>
            <div className="claim-sheet__footer">
              <button
                type="button"
                className="claim-sheet__btn-black"
                style={{ flex: 1 }}
                disabled={!opdTermsScroll.scrolledToEnd}
                onClick={onOpdTermsSheetContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
