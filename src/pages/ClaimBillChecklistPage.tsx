import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  areBillChecklistRequirementsMet,
  buildBillChecklistSlots,
  fetchReimbursementServiceTypes,
  filterServiceTypesCatalogForChecklistSlot,
  type BillChecklistSlot,
  type MultiDocumentTypeRow,
  type ReimbursementCreateBillFileWithServices,
  type ReimbursementServiceType,
  type ReimbursementUploadFileRecord,
  toReimbursementCreateClaimServiceType,
} from "@/api/patientReimbursement";
import { uploadReimbursementChecklistDocumentId } from "@/api/patientUpload";
import { ROUTES } from "@/constants";
import {
  clearClaimChecklistEscrow,
  mergeClaimChecklistEscrowProgress,
  peekClaimChecklistEscrowBills,
} from "@/constants/claimsChecklistEscrow";
import { useAppConfirm } from "@/components/dialog/AppConfirmDialog";
import { useToast } from "@/hooks/useToast";
import "./ClaimsPages.css";

export type ClaimBillChecklistBillSummary = Readonly<{
  billDate: string;
  billAmount: string;
  clinicName: string;
  fileCount: number;
}>;

export type ClaimBillChecklistSavedBill = Readonly<{
  localBillId: string;
  billNumber: string;
  billSummary: ClaimBillChecklistBillSummary;
}>;

type PendingServiceAttach = Readonly<{
  slotId: string;
  file: ReimbursementUploadFileRecord;
}>;

export type ClaimBillChecklistLocationState = Readonly<{
  returnTo: string;
  billNumber: string;
  localBillId: string;
  multiDocRows: readonly MultiDocumentTypeRow[];
  apiMessage: string | null;
  initialFilesBySlot?: Readonly<Record<string, readonly ReimbursementCreateBillFileWithServices[]>>;
  claimReturnPath?: string;
  billSummary?: ClaimBillChecklistBillSummary;
  /** Full catalog for the service-type bottom sheet (per upload). */
  serviceTypesCatalog?: readonly ReimbursementServiceType[];
  /** Keys from the bill’s chosen service types — used when a slot has no `claim_type` list. */
  billServiceTypeKeys?: readonly string[];
  /** All bills saved on step 2 (not only the bill open for this checklist). */
  savedBills?: readonly ClaimBillChecklistSavedBill[];
}>;

function parseEscrowSavedBill(row: Readonly<Record<string, unknown>>): ClaimBillChecklistSavedBill | null {
  const localBillId = String(row.localId ?? "").trim();
  const billNumber = String(row.billNumber ?? "").trim();
  if (!localBillId) return null;
  const billFiles = Array.isArray(row.billFiles) ? row.billFiles : [];
  return {
    localBillId,
    billNumber: billNumber || "—",
    billSummary: {
      billDate: String(row.billDate ?? "").trim() || "—",
      billAmount: String(row.billAmount ?? "").trim() || "0",
      clinicName: String(row.clinicName ?? "").trim(),
      fileCount: billFiles.length,
    },
  };
}

function buildSavedBillsList(
  fromState: readonly ClaimBillChecklistSavedBill[] | undefined,
  current: { localBillId: string; billNumber: string; billSummary: ClaimBillChecklistBillSummary },
): readonly ClaimBillChecklistSavedBill[] {
  const byId = new Map<string, ClaimBillChecklistSavedBill>();
  const order: string[] = [];
  const add = (row: ClaimBillChecklistSavedBill) => {
    const id = row.localBillId.trim();
    if (!id) return;
    if (!byId.has(id)) order.push(id);
    byId.set(id, row);
  };
  for (const row of fromState ?? []) add(row);
  for (const raw of peekClaimChecklistEscrowBills()) {
    const parsed = parseEscrowSavedBill(raw);
    if (parsed) add(parsed);
  }
  add({
    localBillId: current.localBillId,
    billNumber: current.billNumber,
    billSummary: current.billSummary,
  });
  return order.map((id) => byId.get(id)).filter((x): x is ClaimBillChecklistSavedBill => x != null);
}

function normalizeFilesMap(
  raw: Readonly<Record<string, readonly unknown[]>> | undefined,
): Record<string, ReimbursementCreateBillFileWithServices[]> {
  if (!raw) return {};
  const out: Record<string, ReimbursementCreateBillFileWithServices[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!Array.isArray(v) || !v.length) continue;
    const first = v[0];
    if (typeof first === "string") {
      out[k] = (v as string[]).map((id) => ({
        id: id.trim(),
        path: "",
        file_type: "IMG",
        document_type: "",
        ref_type: "BILL",
        service_types: [],
      }));
    } else {
      out[k] = (v as readonly Record<string, unknown>[]).map((row) => {
        const stRaw = row.service_types;
        const service_types: ReturnType<typeof toReimbursementCreateClaimServiceType>[] = [];
        if (Array.isArray(stRaw)) {
          for (const x of stRaw) {
            const o = x as Record<string, unknown>;
            const id = typeof o.id === "number" ? o.id : Number(o.id);
            const key = typeof o.key === "string" ? o.key : "";
            const value = typeof o.value === "string" ? o.value : "";
            const type = typeof o.type === "string" ? o.type : key;
            if (key && value && Number.isFinite(id)) {
              service_types.push({ key, value, id, type });
            }
          }
        }
        return {
          id: String(row.id ?? "").trim(),
          path: String(row.path ?? ""),
          file_type: String(row.file_type ?? "IMG"),
          document_type: String(row.document_type ?? ""),
          ref_type: String(row.ref_type ?? ""),
          service_types,
        };
      });
    }
  }
  return out;
}

function partitionSlots(slots: readonly BillChecklistSlot[]) {
  return {
    payment: slots.filter((s) => s.uploadKind === "payment"),
    rxReport: slots.filter((s) => s.uploadKind === "prescription" || s.uploadKind === "report"),
    support: slots.filter((s) => s.uploadKind === "support"),
    legacy: slots.filter((s) => s.uploadKind === "legacy"),
  };
}

function slotPrimaryLabel(slot: BillChecklistSlot): string {
  if (slot.uploadKind === "prescription") return "Prescription";
  if (slot.uploadKind === "report") return "Report";
  if (slot.uploadKind === "payment") return "Payment files";
  if (slot.uploadKind === "support") return "Supporting documents";
  return slot.sectionTitle;
}

function IconDoc() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconClip() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.2-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stepper() {
  return (
    <div className="claim-bc-stepper" aria-label="Claim steps">
      <div className="claim-bc-step claim-bc-step--done">
        <div className="claim-bc-step__circle">✓</div>
        <span className="claim-bc-step__label">Patient</span>
      </div>
      <div className="claim-bc-step__bar claim-bc-step__bar--active" aria-hidden />
      <div className="claim-bc-step claim-bc-step--active">
        <div className="claim-bc-step__circle">2</div>
        <span className="claim-bc-step__label">Bills</span>
      </div>
      <div className="claim-bc-step__bar" aria-hidden />
      <div className="claim-bc-step">
        <div className="claim-bc-step__circle">3</div>
        <span className="claim-bc-step__label">Review</span>
      </div>
    </div>
  );
}

export function ClaimBillChecklistPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = location.state as ClaimBillChecklistLocationState | null;

  const billNumber = state?.billNumber?.trim() ?? "";
  const localBillId = state?.localBillId?.trim() ?? "";
  const rows = state?.multiDocRows ?? [];
  const returnTo = state?.returnTo?.trim() || ROUTES.claimsNew;

  const [catalog, setCatalog] = useState<ReimbursementServiceType[]>(() => [...(state?.serviceTypesCatalog ?? [])]);
  const billKeySet = useMemo(
    () => new Set((state?.billServiceTypeKeys ?? []).map((k) => k.trim()).filter(Boolean)),
    [state?.billServiceTypeKeys],
  );

  useEffect(() => {
    if (catalog.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchReimbursementServiceTypes();
        if (!cancelled) setCatalog(list);
      } catch {
        if (!cancelled) toast.error("Could not load service types");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog.length, toast]);

  const slots = useMemo(() => buildBillChecklistSlots(rows), [rows]);
  const groups = useMemo(() => partitionSlots(slots), [slots]);
  const supportSlots = useMemo(() => {
    if (groups.support.length > 0) return groups.support;
    if (groups.rxReport.length > 0 || groups.payment.length > 0) {
      const genericSupportSlot: BillChecklistSlot = {
        slotId: "slot:support:generic",
        required: false,
        sectionTitle: "Supporting Documents",
        particularsName: "Supporting Documents",
        particularsKey: "other",
        categoryLabel: "",
        claimLabels: [] as string[],
        claimTypeKeys: [] as string[],
        bullets: [] as string[],
        rowDocumentType: "other",
        uploadKind: "support",
      };
      return [genericSupportSlot];
    }
    return [] as BillChecklistSlot[];
  }, [groups.support, groups.rxReport.length, groups.payment.length]);

  const [filesBySlot, setFilesBySlot] = useState<Record<string, ReimbursementCreateBillFileWithServices[]>>(() =>
    normalizeFilesMap(state?.initialFilesBySlot as Readonly<Record<string, readonly unknown[]>> | undefined),
  );
  const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);

  const [attachQueue, setAttachQueue] = useState<PendingServiceAttach[]>([]);
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"new" | "edit">("new");
  const [sheetContext, setSheetContext] = useState<{ slotId: string; fileId: string } | null>(null);
  const [serviceDraftSelection, setServiceDraftSelection] = useState<ReimbursementServiceType[]>([]);

  useEffect(() => {
    if (serviceSheetOpen) return;
    if (!attachQueue.length) return;
    const [head, ...tail] = attachQueue;
    setAttachQueue(tail);
    setSheetMode("new");
    setSheetContext({ slotId: head.slotId, fileId: head.file.id });
    setServiceDraftSelection([]);
    setServiceSheetOpen(true);
  }, [attachQueue, serviceSheetOpen]);

  useEffect(() => {
    if (!serviceSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [serviceSheetOpen]);

  const canSave = useMemo(() => areBillChecklistRequirementsMet(slots, filesBySlot), [slots, filesBySlot]);

  const sheetSlot = useMemo(
    () => (sheetContext ? slots.find((s) => s.slotId === sheetContext.slotId) ?? null : null),
    [sheetContext, slots],
  );

  const sheetCatalog = useMemo(
    () => filterServiceTypesCatalogForChecklistSlot(catalog, sheetSlot, billKeySet),
    [catalog, sheetSlot, billKeySet],
  );

  useEffect(() => {
    if (!serviceSheetOpen || !sheetContext || sheetMode !== "edit") return;
    const slot = slots.find((s) => s.slotId === sheetContext.slotId) ?? null;
    const list = filesBySlot[sheetContext.slotId] ?? [];
    const file = list.find((f) => f.id === sheetContext.fileId);
    if (!file) return;
    const allowed = filterServiceTypesCatalogForChecklistSlot(catalog, slot, billKeySet);
    const byId = new Map(allowed.map((t) => [t.id, t] as const));
    const byKey = new Map(allowed.map((t) => [t.key.trim(), t] as const));
    const nextSel: ReimbursementServiceType[] = [];
    for (const st of file.service_types) {
      const t = byId.get(st.id) ?? byKey.get(st.key.trim());
      if (t) nextSel.push(t);
    }
    setServiceDraftSelection(nextSel);
  }, [serviceSheetOpen, sheetContext, sheetMode, slots, filesBySlot, catalog, billKeySet]);

  const toggleServiceInDraft = useCallback((t: ReimbursementServiceType) => {
    setServiceDraftSelection((prev) => {
      const on = prev.some((x) => x.id === t.id);
      if (on) return prev.filter((x) => x.id !== t.id);
      return [...prev, t];
    });
  }, []);

  const applyServiceSheet = useCallback(() => {
    if (!sheetContext) return;
    const slot = slots.find((s) => s.slotId === sheetContext.slotId) ?? null;
    const allowed = filterServiceTypesCatalogForChecklistSlot(catalog, slot, billKeySet);
    const allowedIds = new Set(allowed.map((t) => t.id));
    const picked = serviceDraftSelection.filter((t) => allowedIds.has(t.id));
    if (!picked.length) {
      toast.error("Select at least one allowed service type for this file");
      return;
    }
    const payload = picked.map(toReimbursementCreateClaimServiceType);
    setFilesBySlot((prev) => ({
      ...prev,
      [sheetContext.slotId]: (prev[sheetContext.slotId] ?? []).map((f) =>
        f.id === sheetContext.fileId ? { ...f, service_types: payload } : f,
      ),
    }));
    setServiceSheetOpen(false);
    setSheetContext(null);
    toast.success("Service types saved for this file");
  }, [sheetContext, serviceDraftSelection, catalog, slots, billKeySet, toast]);

  const cancelServiceSheet = useCallback(() => {
    if (sheetContext && sheetMode === "new") {
      setFilesBySlot((prev) => ({
        ...prev,
        [sheetContext.slotId]: (prev[sheetContext.slotId] ?? []).filter((f) => f.id !== sheetContext.fileId),
      }));
    }
    setServiceSheetOpen(false);
    setSheetContext(null);
  }, [sheetContext, sheetMode]);

  const reopenServiceSheet = useCallback((slotId: string, file: ReimbursementCreateBillFileWithServices) => {
    setSheetMode("edit");
    setSheetContext({ slotId, fileId: file.id });
    setServiceSheetOpen(true);
  }, []);

  const onPickSlotFiles = useCallback(
    async (slot: BillChecklistSlot, files: FileList | null) => {
      if (!files?.length) return;
      if (!billNumber) {
        toast.error("Bill number missing");
        return;
      }
      setUploadingSlotId(slot.slotId);
      try {
        const metas: ReimbursementUploadFileRecord[] = [];
        for (const f of Array.from(files)) {
          metas.push(await uploadReimbursementChecklistDocumentId(f, billNumber, slot.uploadKind, slot.particularsKey));
        }
        const rowsWithEmptySt: ReimbursementCreateBillFileWithServices[] = metas.map((m) => ({
          ...m,
          service_types: [],
        }));
        setFilesBySlot((prev) => ({
          ...prev,
          [slot.slotId]: [...(prev[slot.slotId] ?? []), ...rowsWithEmptySt],
        }));
        setAttachQueue((q) => [...q, ...metas.map((file) => ({ slotId: slot.slotId, file }))]);
        toast.success("File(s) uploaded — choose service types");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploadingSlotId(null);
      }
    },
    [billNumber, toast],
  );

  const removeFile = useCallback((slotId: string, fileId: string) => {
    setFilesBySlot((prev) => ({
      ...prev,
      [slotId]: (prev[slotId] ?? []).filter((x) => x.id !== fileId),
    }));
  }, []);

  const onBack = useCallback(() => {
    if (localBillId.trim()) {
      mergeClaimChecklistEscrowProgress(localBillId, filesBySlot);
    }
    const echoPath = state?.claimReturnPath?.trim();
    navigate(returnTo, {
      replace: true,
      state: {
        restoreClaimBillEscrow: true as const,
        ...(echoPath ? { returnPath: echoPath } : {}),
      },
    });
  }, [filesBySlot, localBillId, navigate, returnTo, state?.claimReturnPath]);

  /** Step 2 “Add Medical Bill” — open a blank bill sheet (not the in-progress checklist bill). */
  const onAddNewBill = useCallback(() => {
    if (localBillId.trim()) {
      mergeClaimChecklistEscrowProgress(localBillId, filesBySlot);
    }
    const echoPath = state?.claimReturnPath?.trim();
    navigate(returnTo, {
      replace: true,
      state: {
        restoreClaimBillEscrow: true as const,
        openNewBillSheet: true as const,
        ...(echoPath ? { returnPath: echoPath } : {}),
      },
    });
  }, [filesBySlot, localBillId, navigate, returnTo, state?.claimReturnPath]);

  const confirm = useAppConfirm();

  const onDone = useCallback(() => {
    if (!localBillId) {
      clearClaimChecklistEscrow();
      const echoPathEarly = state?.claimReturnPath?.trim();
      navigate(returnTo, {
        replace: true,
        state: echoPathEarly ? { returnPath: echoPathEarly } : {},
      });
      return;
    }
    const echoPath = state?.claimReturnPath?.trim();
    navigate(returnTo, {
      replace: true,
      state: {
        checklistDone: { localBillId, filesBySlot },
        afterChecklistReview: true,
        ...(echoPath ? { returnPath: echoPath } : {}),
      },
    });
  }, [navigate, returnTo, localBillId, filesBySlot, state?.claimReturnPath]);

  const onRemoveBill = useCallback(async () => {
    if (!localBillId) return;
    const ok = await confirm({
      title: "Remove bill?",
      message: "Are you sure you want to remove this bill?",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    toast.success("Bill removed");
    const echoPath = state?.claimReturnPath?.trim();
    navigate(returnTo, {
      replace: true,
      state: {
        restoreClaimBillEscrow: true as const,
        removeBillLocalId: localBillId,
        ...(echoPath ? { returnPath: echoPath } : {}),
      },
    });
  }, [confirm, localBillId, navigate, returnTo, state?.claimReturnPath, toast]);

  const renderFileRow = (slotId: string, f: ReimbursementCreateBillFileWithServices) => {
    const stOk = f.service_types.length > 0;
    const stLine = stOk ? f.service_types.map((st) => st.value.trim() || st.key).join(" · ") : "";
    return (
      <li key={f.id} className="claim-bc-slot__file">
        <div className="claim-bc-slot__file-main">
          <span className="claim-bc-slot__file-id">{f.id.slice(-12)}</span>
          <span className={stOk ? "claim-bc-slot__file-st" : "claim-bc-slot__file-st claim-bc-slot__file-st--warn"}>
            {stOk ? stLine : "Service types required"}
          </span>
        </div>
        <div className="claim-bc-slot__file-actions">
          <button type="button" className="claim-bc-slot__link" onClick={() => reopenServiceSheet(slotId, f)}>
            {stOk ? "Edit" : "Set types"}
          </button>
          <button type="button" className="claim-bc-slot__remove" aria-label="Remove" onClick={() => removeFile(slotId, f.id)}>
            ×
          </button>
        </div>
      </li>
    );
  };

  const renderPaymentSlot = (slot: BillChecklistSlot) => {
    const list = filesBySlot[slot.slotId] ?? [];
    const busy = uploadingSlotId === slot.slotId;
    return (
      <div key={slot.slotId} className="claim-bc-upload-block">
        <div className="claim-bc-upload-row">
          <div className="claim-bc-upload-row__icon" aria-hidden>
            <IconCard />
          </div>
          <div className="claim-bc-upload-row__main">
            <span className="claim-bc-upload-row__title">{slotPrimaryLabel(slot)}</span>
            {list.length > 0 ? <span className="claim-bc-upload-row__meta">{list.length} file(s)</span> : null}
          </div>
          <label className={`claim-bc-btn-upload${busy ? " claim-bc-btn-upload--disabled" : ""}`}>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              disabled={busy}
              onChange={(e) => void onPickSlotFiles(slot, e.target.files)}
            />
            {busy ? "…" : "+ Upload"}
          </label>
        </div>
        {list.length > 0 ? <ul className="claim-bc-slot__files claim-bc-slot__files--flush">{list.map((f) => renderFileRow(slot.slotId, f))}</ul> : null}
      </div>
    );
  };

  const renderSupportSlot = (slot: BillChecklistSlot) => {
    const list = filesBySlot[slot.slotId] ?? [];
    const busy = uploadingSlotId === slot.slotId;
    return (
      <div key={slot.slotId} className="claim-bc-upload-block">
        <div className="claim-bc-upload-row">
          <div className="claim-bc-upload-row__icon" aria-hidden>
            <IconClip />
          </div>
          <div className="claim-bc-upload-row__main">
            <span className="claim-bc-upload-row__title">{slotPrimaryLabel(slot)}</span>
            {list.length > 0 ? <span className="claim-bc-upload-row__meta">{list.length} file(s)</span> : null}
          </div>
          <label className={`claim-bc-btn-upload${busy ? " claim-bc-btn-upload--disabled" : ""}`}>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              disabled={busy}
              onChange={(e) => void onPickSlotFiles(slot, e.target.files)}
            />
            {busy ? "…" : "+ Upload"}
          </label>
        </div>
        {list.length > 0 ? <ul className="claim-bc-slot__files claim-bc-slot__files--flush">{list.map((f) => renderFileRow(slot.slotId, f))}</ul> : null}
      </div>
    );
  };

  const renderDetailedSlot = (slot: BillChecklistSlot) => {
    const list = filesBySlot[slot.slotId] ?? [];
    const busy = uploadingSlotId === slot.slotId;
    const ok = !slot.required || list.length > 0;
    const title = slotPrimaryLabel(slot);
    const missingFile = slot.required && list.length === 0;

    return (
      <div
        key={slot.slotId}
        className={`claim-bc-slot${slot.required ? " claim-bc-slot--required" : ""}${ok ? " claim-bc-slot--ok" : " claim-bc-slot--pending"}`}
      >
        <div className="claim-bc-slot__title-row">
          <h3 className="claim-bc-slot__title">
            {title}
            {slot.required ? <span className="claim-bc-slot__asterisk"> *</span> : null}
          </h3>
        </div>
        {missingFile ? (
          <div className="claim-bc-slot__missing" role="status">
            Upload at least one file, then attach service types.
          </div>
        ) : null}
        <label className={`claim-bc-btn-addfile${busy ? " claim-bc-btn-addfile--disabled" : ""}`}>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => void onPickSlotFiles(slot, e.target.files)}
          />
          {busy ? "Uploading…" : "+ Add file"}
        </label>
        {list.length > 0 ? <ul className="claim-bc-slot__files">{list.map((f) => renderFileRow(slot.slotId, f))}</ul> : null}
      </div>
    );
  };

  const renderLegacySlot = (slot: BillChecklistSlot) => {
    const list = filesBySlot[slot.slotId] ?? [];
    const busy = uploadingSlotId === slot.slotId;
    const ok = !slot.required || list.length > 0;
    return (
      <div key={slot.slotId} className={`claim-bc-slot${ok ? " claim-bc-slot--ok" : " claim-bc-slot--pending"}`}>
        <h3 className="claim-bc-slot__title">{slotPrimaryLabel(slot)}</h3>
        {!ok ? <div className="claim-bc-slot__missing">Upload at least one file to continue.</div> : null}
        <label className={`claim-bc-btn-addfile${busy ? " claim-bc-btn-addfile--disabled" : ""}`}>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => void onPickSlotFiles(slot, e.target.files)}
          />
          {busy ? "Uploading…" : "+ Add file"}
        </label>
        {list.length > 0 ? <ul className="claim-bc-slot__files">{list.map((f) => renderFileRow(slot.slotId, f))}</ul> : null}
      </div>
    );
  };

  if (!state || !billNumber || !localBillId || !rows.length) {
    return (
      <div className="claim-bc-page">
        <header className="claims-screen-header">
          <button type="button" className="claims-screen-header__back" aria-label="Back" onClick={() => navigate(ROUTES.claimsNew)}>
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
        <main className="claim-bc-main">
          <p className="claims-row__meta">Nothing to show. Go back to your claim and open the checklist again.</p>
        </main>
      </div>
    );
  }

  const summary =
    state.billSummary ??
    ({
      billDate: "—",
      billAmount: "0",
      clinicName: "",
      fileCount: 0,
    } satisfies ClaimBillChecklistBillSummary);

  const savedBillsList = buildSavedBillsList(state.savedBills, {
    localBillId,
    billNumber,
    billSummary: summary,
  });

  return (
    <div className="claim-bc-page">
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

      <main className="claim-bc-main">
        <Stepper />

        {state.apiMessage ? <p className="claim-bc-lead">{state.apiMessage}</p> : null}

        <section className="claim-bc-section" aria-labelledby="claim-bc-medical-title">
          <div className="claim-bc-section__head">
            <div className="claim-bc-section__icon" aria-hidden>
              <IconDoc />
            </div>
            <h2 id="claim-bc-medical-title" className="claim-bc-section__title">
              Medical bills
            </h2>
          </div>
          <ul className="claim-bc-bill-list" aria-label="All medical bills">
            {savedBillsList.map((bill) => {
              const isActive = bill.localBillId === localBillId;
              const s = bill.billSummary;
              const displayNo = bill.billNumber.trim() || "—";
              const subLine = s.clinicName.trim()
                ? `${s.clinicName.trim()} · ${s.billDate}`
                : s.billDate;
              return (
                <li
                  key={bill.localBillId}
                  className={`claim-bc-bill-card${isActive ? " claim-bc-bill-card--active" : ""}${isActive ? " claim-bc-bill-card--clickable" : ""}`}
                  {...(isActive
                    ? {
                        role: "button" as const,
                        tabIndex: 0,
                        onClick: onBack,
                        onKeyDown: (e: KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onBack();
                          }
                        },
                      }
                    : {})}
                >
                  <div className="claim-bc-bill-card__top">
                    <div>
                      <div className="claim-bc-bill-card__no">Bill #{displayNo}</div>
                      <div className="claim-bc-bill-card__sub">{subLine}</div>
                    </div>
                    <div className="claim-bc-bill-card__amt-block">
                      <div className="claim-bc-bill-card__amt">₹{s.billAmount}</div>
                      {isActive ? (
                        <button
                          type="button"
                          className="claim-review-block__exit claim-review-block__exit--danger"
                          aria-label="Remove this bill"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onRemoveBill();
                          }}
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
                      ) : null}
                    </div>
                  </div>
                  <p className="claim-bc-bill-card__files">
                    {s.fileCount} bill image{s.fileCount === 1 ? "" : "s"}
                  </p>
                </li>
              );
            })}
          </ul>
          <button type="button" className="claim-bc-outline-add" onClick={onAddNewBill}>
            <span className="claim-bc-outline-add__plus" aria-hidden>
              +
            </span>
            Add Medical Bill
          </button>
        </section>

        {groups.payment.length > 0 ? (
          <section className="claim-bc-section" aria-labelledby="claim-bc-pay-title">
            <div className="claim-bc-section__head">
              <div className="claim-bc-section__icon" aria-hidden>
                <IconCard />
              </div>
              <div>
                <h2 id="claim-bc-pay-title" className="claim-bc-section__title">
                  Payment Receipts
                </h2>
                <p className="claim-bc-section__desc">Upload payment proofs that are separate from the bill.</p>
              </div>
            </div>
            <div className="claim-bc-card-stack">{groups.payment.map((s) => renderPaymentSlot(s))}</div>
          </section>
        ) : null}

        {groups.rxReport.length > 0 ? (
          <section className="claim-bc-section" aria-labelledby="claim-bc-rx-title">
            <div className="claim-bc-section__head">
              <div className="claim-bc-section__icon" aria-hidden>
                <IconDoc />
              </div>
              <div>
                <h2 id="claim-bc-rx-title" className="claim-bc-section__title">
                  Reports & prescriptions
                </h2>
                <p className="claim-bc-section__desc">Upload prescriptions, reports, or payment proofs as required for your service types.</p>
              </div>
            </div>
            <div className="claim-bc-card-stack claim-bc-card-stack--gap">{groups.rxReport.map((s) => renderDetailedSlot(s))}</div>
          </section>
        ) : null}

        {supportSlots.length > 0 ? (
          <section className="claim-bc-section" aria-labelledby="claim-bc-sup-title">
            <div className="claim-bc-section__head">
              <div className="claim-bc-section__icon" aria-hidden>
                <IconClip />
              </div>
              <div>
                <h2 id="claim-bc-sup-title" className="claim-bc-section__title">
                  Supporting Documents
                </h2>
                <p className="claim-bc-section__desc">Upload additional supporting documents such as referral notes, discharge summaries, or other evidence.</p>
              </div>
            </div>
            <div className="claim-bc-card-stack">{supportSlots.map((s) => renderSupportSlot(s))}</div>
          </section>
        ) : null}

        {groups.legacy.length > 0 ? (
          <section className="claim-bc-section" aria-labelledby="claim-bc-leg-title">
            <div className="claim-bc-section__head">
              <div className="claim-bc-section__icon" aria-hidden>
                <IconDoc />
              </div>
              <h2 id="claim-bc-leg-title" className="claim-bc-section__title">
                Other documents
              </h2>
            </div>
            <div className="claim-bc-card-stack claim-bc-card-stack--gap">{groups.legacy.map((s) => renderLegacySlot(s))}</div>
          </section>
        ) : null}
      </main>

      {serviceSheetOpen ? (
        <div
          className="claim-overlay claim-overlay--claim-bc-services"
          role="dialog"
          aria-modal
          aria-labelledby="claim-bc-svc-title"
          onClick={cancelServiceSheet}
        >
          <div className="claim-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="claim-sheet__head">
              <h2 id="claim-bc-svc-title" className="claim-sheet__title">
                Service types for this file
              </h2>
              <button type="button" className="claim-sheet__close" aria-label="Close" onClick={cancelServiceSheet}>
                ×
              </button>
            </div>
            <div className="claim-sheet__body">
              <p className="claim-bc-sheet-hint">
                Only service types that apply to this document are shown. Pick one or more for this file.
              </p>
              {sheetCatalog.length === 0 ? (
                <p className="claim-bc-sheet-empty">No matching service types. Try reloading or check bill service types.</p>
              ) : (
                <div className="claim-chips">
                  {sheetCatalog.map((t) => {
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
            <div className="claim-sheet__footer claim-sheet__footer--split">
              <button type="button" className="claim-sheet__btn-muted" onClick={cancelServiceSheet}>
                Cancel
              </button>
              <button type="button" className="claim-sheet__btn-primary" onClick={applyServiceSheet}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="claim-bc-footer">
        <button type="button" className="claim-bc-footer__back" onClick={onBack}>
          Back
        </button>
        <button type="button" className="claim-bc-footer__primary" disabled={!canSave} onClick={onDone}>
          Review Claim
        </button>
      </footer>
    </div>
  );
}
