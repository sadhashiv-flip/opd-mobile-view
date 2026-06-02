import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchBankDetailsPage, type PatientBankRecord } from "@/api/patientBankDetails";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { MEMBER_NOT_ACTIVATED_LABEL } from "@/lib/gymMemberDisplay";
import { fetchPatientProfile } from "@/api/patientProfile";
import {
  areBillChecklistRequirementsMet,
  buildBillChecklistSlots,
  countChecklistFilesForKinds,
  createReimbursement,
  fetchReimbursementMultiDocumentTypes,
  fetchReimbursementServiceTypes,
  parseReimbursementMultiDocumentTypes,
  partitionChecklistFilesForCreate,
  toReimbursementCreateClaimServiceType,
  type CreateReimbursementBillPayload,
  type MultiDocumentTypeRow,
  type ReimbursementCreateBillFileWithServices,
  type ReimbursementServiceType,
  type ReimbursementUploadFileRecord,
} from "@/api/patientReimbursement";
import { uploadReimbursementBillDocumentId } from "@/api/patientUpload";
import { ROUTES } from "@/constants";
import { CLAIMS_DISCLOSURES_GATE_SESSION_KEY } from "@/constants/appSessionStorageKeys";
import { CLAIM_CHECKLIST_ESCROW_STORAGE_KEY } from "@/constants/claimsChecklistEscrow";
import { useAppConfirm } from "@/components/dialog/AppConfirmDialog";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useTermsScrollGate } from "@/hooks/useTermsScrollGate";
import { useToast } from "@/hooks/useToast";
import type { ClaimBillChecklistLocationState } from "@/pages/ClaimBillChecklistPage";
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

/** Same rules as saving a bill from the review sheet (without toast). */
function isBillDraftPersistable(d: DraftBill): boolean {
  if (!d.billNumber.trim() || !d.billDate || !d.billAmount.trim() || !d.clinicName.trim() || !d.clinicAddress.trim()) {
    return false;
  }
  if (!d.billFiles.length) return false;
  if (!d.serviceTypes.length) return false;
  const rows = d.multiDocChecklist?.rows ?? [];
  if (rows.length > 0) {
    const slots = buildBillChecklistSlots(rows);
    if (!areBillChecklistRequirementsMet(slots, d.checklistFilesBySlot)) return false;
  }
  return true;
}

function writeChecklistEscrow(billsSnapshot: readonly DraftBill[], billDraftSnapshot: DraftBill): void {
  try {
    globalThis.sessionStorage?.setItem(
      CLAIM_CHECKLIST_ESCROW_STORAGE_KEY,
      JSON.stringify({ bills: [...billsSnapshot], billDraft: { ...billDraftSnapshot } }),
    );
  } catch {
    /* quota / private mode */
  }
}

function readChecklistEscrow(): { bills: DraftBill[]; billDraft: DraftBill } | null {
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
    return { bills: o.bills as DraftBill[], billDraft: o.billDraft as DraftBill };
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
  /** When set, “Save bill” on review replaces this row instead of appending. */
  const editingBillLocalIdRef = useRef<string | null>(null);
  const [serviceTypesCatalog, setServiceTypesCatalog] = useState<ReimbursementServiceType[]>([]);

  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);
  const [billSheetOpen, setBillSheetOpen] = useState(false);
  /** patient_app `showBillReviewTermsBottomSheet` — short disclaimer before service types (new bills only). */
  const [billReviewDisclaimerOpen, setBillReviewDisclaimerOpen] = useState(false);
  const [multiDocLoading, setMultiDocLoading] = useState(false);
  const [billDraft, setBillDraft] = useState<DraftBill>(emptyDraftBill);
  const billDraftRef = useRef(billDraft);
  billDraftRef.current = billDraft;
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [serviceDraftSelection, setServiceDraftSelection] = useState<ReimbursementServiceType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [billUploading, setBillUploading] = useState(false);
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
        }
      | null
      | undefined;

    if (st?.restoreClaimBillEscrow) {
      const escrow = readChecklistEscrow();
      if (escrow) {
        setBills(escrow.bills);
        setBillDraft(escrow.billDraft);
        setStep(2);
        setBillSheetOpen(true);
        setBillReviewDisclaimerOpen(false);
        setServiceSheetOpen(false);
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
      if (escrow) {
        const mergedForRow: DraftBill =
          escrow.billDraft.localId === done.localBillId
            ? { ...escrow.billDraft, checklistFilesBySlot: { ...files } }
            : escrow.billDraft;
        setBillDraft(mergedForRow);
        let nextBills = [...escrow.bills];
        const idx = nextBills.findIndex((x) => x.localId === done.localBillId);
        if (idx >= 0) {
          nextBills[idx] = { ...nextBills[idx], checklistFilesBySlot: { ...files } };
        } else if (mergedForRow.localId === done.localBillId && isBillDraftPersistable(mergedForRow)) {
          if (!nextBills.some((x) => x.localId === mergedForRow.localId)) {
            nextBills.push(mergedForRow);
          }
        }
        setBills(nextBills);
        setBillSheetOpen(false);
        setBillReviewDisclaimerOpen(false);
        setServiceSheetOpen(false);
      } else {
        setBillDraft((b) => {
          if (b.localId !== done.localBillId) return b;
          return { ...b, checklistFilesBySlot: { ...files } };
        });
        setBills((prev) => {
          const idx = prev.findIndex((x) => x.localId === done.localBillId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], checklistFilesBySlot: { ...files } };
            return next;
          }
          const base = billDraftRef.current;
          if (base.localId !== done.localBillId) return prev;
          const merged: DraftBill = { ...base, checklistFilesBySlot: { ...files } };
          if (!isBillDraftPersistable(merged)) return prev;
          if (prev.some((x) => x.localId === merged.localId)) return prev;
          return [...prev, merged];
        });
        setBillSheetOpen(false);
        setBillReviewDisclaimerOpen(false);
        setServiceSheetOpen(false);
      }
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
    editingBillLocalIdRef.current = null;
    setBillReviewDisclaimerOpen(false);
    setServiceSheetOpen(false);
    setBillSheetOpen(false);
  }, []);

  const openAddBill = useCallback(() => {
    editingBillLocalIdRef.current = null;
    setBillDraft(emptyDraftBill());
    setBillReviewDisclaimerOpen(false);
    setServiceSheetOpen(false);
    setBillSheetOpen(true);
  }, []);

  const openEditBill = useCallback((b: DraftBill) => {
    editingBillLocalIdRef.current = b.localId;
    setBillDraft({ ...b });
    setBillReviewDisclaimerOpen(false);
    setServiceSheetOpen(false);
    setBillSheetOpen(true);
  }, []);

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
      const rows = d.multiDocChecklist?.rows ?? [];
      if (rows.length > 0) {
        const slots = buildBillChecklistSlots(rows);
        if (!areBillChecklistRequirementsMet(slots, d.checklistFilesBySlot)) {
          toast.error("Upload required checklist documents before saving this bill");
          return false;
        }
      }
      const replaceId = editingBillLocalIdRef.current;
      editingBillLocalIdRef.current = null;
      setBills((prev) => {
        if (replaceId) {
          return prev.map((x) => (x.localId === replaceId ? d : x));
        }
        return [...prev, d];
      });
      return true;
    },
    [toast],
  );

  const closeBillFlowSheets = useCallback(() => {
    setServiceSheetOpen(false);
    setBillReviewDisclaimerOpen(false);
    setBillSheetOpen(false);
  }, []);

  const finishServiceSelection = useCallback(async () => {
    if (!serviceDraftSelection.length) {
      toast.error("Select at least one service type");
      return;
    }
    const keys = serviceDraftSelection.map((s) => s.key.trim()).filter(Boolean);
    if (!keys.length) {
      toast.error("Service type keys missing for this selection");
      return;
    }
    setMultiDocLoading(true);
    try {
      const raw = await fetchReimbursementMultiDocumentTypes(keys);
      const root = raw as { message?: unknown };
      const msg =
        typeof root?.message === "string" && root.message.trim() ? root.message.trim() : null;
      const rows = parseReimbursementMultiDocumentTypes(raw);
      const base = billDraftRef.current;
      const next: DraftBill = {
        ...base,
        serviceTypes: [...serviceDraftSelection],
        multiDocChecklist: { rows, message: msg },
      };
      setBillDraft(next);
      if (rows.length > 0) {
        setServiceSheetOpen(false);
        const returnTo = `${location.pathname}${location.search}`;
        const state: ClaimBillChecklistLocationState = {
          returnTo,
          billNumber: next.billNumber.trim(),
          localBillId: next.localId,
          multiDocRows: rows,
          apiMessage: msg,
          initialFilesBySlot: next.checklistFilesBySlot,
          claimReturnPath: returnPath,
          serviceTypesCatalog: serviceTypesCatalog,
          billServiceTypeKeys: next.serviceTypes.map((s) => s.key.trim()).filter(Boolean),
          billSummary: {
            billDate: next.billDate,
            billAmount: next.billAmount.trim(),
            clinicName: next.clinicName.trim(),
            fileCount: next.billFiles.length,
          },
        };
        writeChecklistEscrow(billsRef.current, next);
        navigate(ROUTES.claimBillChecklist, { state });
        return;
      }
      const replaceId = editingBillLocalIdRef.current;
      if (persistBillDraft(next)) {
        closeBillFlowSheets();
        toast.success(replaceId ? "Bill updated" : "Bill added");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load document checklist");
    } finally {
      setMultiDocLoading(false);
    }
  }, [
    serviceDraftSelection,
    toast,
    location.pathname,
    location.search,
    navigate,
    returnPath,
    serviceTypesCatalog,
    persistBillDraft,
    closeBillFlowSheets,
  ]);

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
          recs.push(await uploadReimbursementBillDocumentId(files[i], billNo));
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
    if (editingBillLocalIdRef.current) {
      openServiceTypesSheet();
      return;
    }
    setBillReviewDisclaimerOpen(true);
  }, [billDraft, serviceTypesCatalog.length, openServiceTypesSheet, toast]);

  const onBillReviewDisclaimerAgree = useCallback(() => {
    setBillReviewDisclaimerOpen(false);
    setServiceDraftSelection([]);
    setServiceSheetOpen(true);
  }, []);

  const claimTotal = useMemo(
    () =>
      bills.reduce((sum, b) => {
        const n = Number(String(b.billAmount).replace(/,/g, ""));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [bills],
  );

  const overviewDocCounts = useMemo(() => {
    let payment = 0;
    let reports = 0;
    let other = 0;
    for (const b of bills) {
      payment += countChecklistFilesForKinds(b, ["payment"]);
      reports += countChecklistFilesForKinds(b, ["prescription", "report"]);
      other += countChecklistFilesForKinds(b, ["support", "legacy"]);
    }
    return { payment, reports, other };
  }, [bills]);

  const overviewBillImageCount = useMemo(
    () => bills.reduce((acc, b) => acc + b.billFiles.length, 0),
    [bills],
  );

  const submitClaim = useCallback(async () => {
    const m = selectedMember;
    if (!m || !bankId) {
      toast.error("Select patient and bank");
      return;
    }
    const uid = memberNumericId(m);
    if (uid == null) {
      toast.error("Patient id missing for selected member");
      return;
    }
    const bid = Number(bankId);
    if (!Number.isFinite(bid)) {
      toast.error("Invalid bank account");
      return;
    }
    const alt = parseDigits(altPhone);
    const paymentFiles: ReimbursementCreateBillFileWithServices[] = [];
    const reportFiles: ReimbursementCreateBillFileWithServices[] = [];
    const otherFiles: ReimbursementCreateBillFileWithServices[] = [];
    for (const b of bills) {
      const part = partitionChecklistFilesForCreate({
        multiDocRows: b.multiDocChecklist?.rows ?? [],
        checklistFilesBySlot: b.checklistFilesBySlot,
      });
      paymentFiles.push(...part.payment);
      reportFiles.push(...part.report);
      otherFiles.push(...part.other);
    }

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
  }, [selectedMember, bankId, altPhone, bills, claimTotal, navigate, returnPath, toast]);

  const onOpdTermsSheetContinue = useCallback(() => {
    setOpdTermsSheet((prev) => {
      if (!prev.open) return prev;
      if (prev.variant === "step1") {
        setStep1ImportantNoteOpen(true);
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
      toast.error("Please complete patient, bank, and contact details before continuing");
      setStep1ImportantNoteOpen(false);
      return;
    }
    setTermsChecked(true);
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
      toast.success("Bill removed");
    },
    [confirm, toast],
  );

  const canSaveBillDraft = useMemo(() => isBillDraftFormComplete(billDraft), [billDraft]);

  const onBack = useCallback(() => {
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
      navigate(returnPath);
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
    navigate,
    returnPath,
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
              {n === 1 ? "Patient" : n === 2 ? "Bills" : "Review"}
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
        <h1 className="claims-screen-header__title">Add New Claim</h1>
        <span style={{ width: 44 }} aria-hidden />
      </header>

      <main className={`claim-new-page__main${step === 3 ? " claim-new-page__main--review" : ""}`}>
        {stepper}

        {step === 1 ? (
          <>
            <h2 className="claim-new-page__section-heading">Patient</h2>
            <section className="pbf-card" aria-label="Patient selection">
              <div className="pbf-field">
                <span className="pbf-label" id="claim-member-label">
                  Select patient
                </span>
                <button
                  type="button"
                  className="hcp-loc"
                  aria-labelledby="claim-member-label"
                  aria-label="Choose patient"
                  onClick={() => setMemberSheetOpen(true)}
                >
                  <span className="hcp-loc__pin" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
                        fill="#FF541E"
                      />
                      <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
                    </svg>
                  </span>
                  <span className="hcp-loc__title">
                    {selectedMember ? memberLocTag(selectedMember) : "PATIENT"}
                  </span>
                  <span className="hcp-loc__sep" aria-hidden="true">
                    |
                  </span>
                  <span className="hcp-loc__addr">
                    {selectedMember ? selectedMember.name : "Choose saved patient"}
                  </span>
                  <span className="hcp-loc__chev" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
            </section>

            <h2 className="claim-new-page__section-heading">Contact details</h2>
            <section className="pbf-card" aria-label="Contact details">
              <div className="pbf-field">
                <label className="pbf-label" htmlFor="claim-phone">
                  Phone number
                </label>
                <input
                  id="claim-phone"
                  className="pbf-input"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="pbf-field">
                <label className="pbf-label" htmlFor="claim-email">
                  Email address
                </label>
                <input
                  id="claim-email"
                  className="pbf-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="pbf-field">
                <label className="pbf-label" htmlFor="claim-alt-phone">
                  Alternate phone (optional)
                </label>
                <input
                  id="claim-alt-phone"
                  className="pbf-input"
                  inputMode="numeric"
                  placeholder="Enter alternate phone"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value)}
                />
              </div>
            </section>

            <h2 className="claim-new-page__section-heading">Bank details</h2>
            <section className="pbf-card" aria-label="Bank account">
              <div className="pbf-field">
                <span className="pbf-label" id="claim-bank-label">
                  Select bank
                </span>
                <button
                  type="button"
                  className="hcp-loc"
                  aria-labelledby="claim-bank-label"
                  aria-label="Choose bank account"
                  onClick={() => setBankSheetOpen(true)}
                >
                  <span className="hcp-loc__pin" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
                        fill="#FF541E"
                      />
                      <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
                    </svg>
                  </span>
                  <span className="hcp-loc__title">
                    {selectedBank ? `****${bankAccountTail(selectedBank)}` : "BANK"}
                  </span>
                  <span className="hcp-loc__sep" aria-hidden="true">
                    |
                  </span>
                  <span className="hcp-loc__addr">
                    {selectedBank
                      ? `${selectedBank.bankName} · ${selectedBank.accountHolderName}`
                      : "Choose saved account"}
                  </span>
                  <span className="hcp-loc__chev" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
            </section>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="claim-new-page__section-heading">Medical bills</h2>
            <button type="button" className="claim-add-card" onClick={openAddBill}>
              <span style={{ fontSize: 22 }} aria-hidden>
                ⊕
              </span>
              Add Medical Bill
            </button>
            {bills.length > 0 ? (
              <ul className="claim-review-block-list" aria-label="Saved bills">
                {bills.map((b) => (
                  <li key={b.localId} className="claim-review-block">
                    <div className="claim-review-block__head">
                      <div className="claim-review-block__intro">
                        <p className="claim-review-block__label">Bill number</p>
                        <p className="claim-review-block__bill-no">#{b.billNumber.trim() || "—"}</p>
                        {b.clinicName.trim() ? (
                          <p className="claim-review-block__clinic">{b.clinicName.trim()}</p>
                        ) : null}
                      </div>
                      <div className="claim-review-block__actions">
                        <button
                          type="button"
                          className="claim-review-block__exit"
                          aria-label="Edit this bill"
                          onClick={() => openEditBill(b)}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M12 15h8M16 5l3 3-9.5 9.5-4 1 1-4L16 5z"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="claim-review-block__exit claim-review-block__exit--danger"
                          aria-label="Remove this bill"
                          onClick={() => void confirmRemoveBill(b.localId)}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M18 6L6 18M6 6l12 12"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <dl className="claim-review-block__facts">
                      <div className="claim-review-block__fact">
                        <dt>Amount</dt>
                        <dd>₹{formatInrInteger(b.billAmount)}</dd>
                      </div>
                      <div className="claim-review-block__fact">
                        <dt>Date</dt>
                        <dd>{b.billDate || "—"}</dd>
                      </div>
                      <div className="claim-review-block__fact claim-review-block__fact--wide">
                        <dt>Service types</dt>
                        <dd>{b.serviceTypes.map((s) => s.value.trim() || s.key).join(", ") || "—"}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : null}
            {bills.length > 0 ? (
              <section className="claim-ro-card claim-step2-docs" aria-labelledby="claim-step2-docs-title">
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
                  <h2 id="claim-step2-docs-title" className="claim-ro-card__title">
                    Supporting documents
                  </h2>
                </div>
                <ul className="claim-ro-doc-list">
                  <li className="claim-ro-doc-row">
                    <span className="claim-ro-doc-row__label">Bill images (scans)</span>
                    <span
                      className={`claim-ro-pill${overviewBillImageCount > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                    >
                      {overviewBillImageCount} file{overviewBillImageCount === 1 ? "" : "s"}
                    </span>
                  </li>
                  <li className="claim-ro-doc-row">
                    <span className="claim-ro-doc-row__label">Payment receipts</span>
                    <span
                      className={`claim-ro-pill${overviewDocCounts.payment > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                    >
                      {overviewDocCounts.payment} file{overviewDocCounts.payment === 1 ? "" : "s"}
                    </span>
                  </li>
                  <li className="claim-ro-doc-row">
                    <span className="claim-ro-doc-row__label">Medical reports</span>
                    <span
                      className={`claim-ro-pill${overviewDocCounts.reports > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                    >
                      {overviewDocCounts.reports} file{overviewDocCounts.reports === 1 ? "" : "s"}
                    </span>
                  </li>
                  <li className="claim-ro-doc-row">
                    <span className="claim-ro-doc-row__label">Other documents</span>
                    <span
                      className={`claim-ro-pill${overviewDocCounts.other > 0 ? " claim-ro-pill--accent" : " claim-ro-pill--muted"}`}
                    >
                      {overviewDocCounts.other} file{overviewDocCounts.other === 1 ? "" : "s"}
                    </span>
                  </li>
                </ul>
                <p className="claim-step2-docs__hint">
                  Edit a bill and open the document checklist to upload or remove supporting files.
                </p>
              </section>
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
                  Patient details
                </h2>
              </div>
              <dl className="claim-ro-dl">
                <div className="claim-ro-dl__row">
                  <dt>Patient name</dt>
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
          <button type="button" className="claim-footer__back" onClick={onBack}>
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
              disabled={bills.length === 0}
              onClick={() => setStep(3)}
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

      {/* Step 1: after T&amp;C Continue — Important Note, then Continue → Bills (step 2) */}
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
                Select patient
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
              <p className="addr-sheet__empty">No saved patients yet.</p>
            ) : (
              <ul className="addr-sheet__list" role="radiogroup" aria-label="Patients">
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
              <h2 className="claim-sheet__title">Add Medical Bill</h2>
              <button type="button" className="claim-sheet__close" aria-label="Close" onClick={closeBillSheet}>
                ×
              </button>
            </div>
            <div className="claim-sheet__body claim-new-page__sheet-pbf">
              <section className="pbf-card" aria-label="Bill details">
                <div className="pbf-field">
                  <label className="pbf-label" htmlFor="claim-bill-no">
                    Bill number
                  </label>
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
                  <label className="pbf-label" htmlFor="claim-bill-date">
                    Bill date
                  </label>
                  <input
                    id="claim-bill-date"
                    className="pbf-input"
                    type="date"
                    value={billDraft.billDate}
                    onChange={(e) => setBillDraft((b) => ({ ...b, billDate: e.target.value }))}
                  />
                </div>
                <div className="pbf-field">
                  <label className="pbf-label" htmlFor="claim-bill-amt">
                    Bill amount
                  </label>
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
                  <label className="pbf-label" htmlFor="claim-clinic">
                    Clinic / hospital name
                  </label>
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
                  <label className="pbf-label" htmlFor="claim-clinic-addr">
                    Clinic address
                  </label>
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
                  <label className="pbf-label" htmlFor="claim-doctor">
                    Doctor name (optional)
                  </label>
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
                  <label className="pbf-label" htmlFor="claim-doctor-reg">
                    Doctor registration number (optional)
                  </label>
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
                  <p className="claim-new-page__upload-heading">Bill images</p>
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
                          <div key={f.id} className="claim-thumb" title={f.id}>
                            <span className="claim-thumb__label">File</span>
                            <button
                              type="button"
                              className="claim-thumb__remove"
                              aria-label="Remove"
                              onClick={() =>
                                setBillDraft((b) => ({
                                  ...b,
                                  billFiles: b.billFiles.filter((x) => x.id !== f.id),
                                }))
                              }
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
            </div>
            <div className="claim-sheet__footer">
              <button
                type="button"
                className="claim-sheet__btn-primary"
                style={{ flex: 1 }}
                disabled={!canSaveBillDraft}
                onClick={submitBillDraftToReview}
              >
                Save Bill
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
                  disabled={multiDocLoading}
                  onClick={() => void finishServiceSelection()}
                >
                  {multiDocLoading ? "Loading…" : "Apply"}
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
