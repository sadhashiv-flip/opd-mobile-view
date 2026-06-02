import type { ReactNode } from "react";
import { ClaimAttachmentFileRow } from "@/components/claims/ClaimAttachmentFileRow";
import type { ReimbursementCreateBillFileWithServices, RequiredDocRow } from "@/api/patientReimbursement";
import { paymentFileIsGeneral, shouldShowVaccineReportNote, VACCINE_REPORT_NOTE } from "@/lib/claimStep2Validation";

type ClaimDocBucket = "payment" | "report" | "other";

type ClaimStep2Files = Readonly<{
  payment: readonly ReimbursementCreateBillFileWithServices[];
  report: readonly ReimbursementCreateBillFileWithServices[];
  other: readonly ReimbursementCreateBillFileWithServices[];
}>;

type Props = Readonly<{
  files: ClaimStep2Files;
  requiredPayments: readonly RequiredDocRow[];
  requiredReports: readonly RequiredDocRow[];
  uploading: boolean;
  onUploadCategory: (refType: "PAYMENT" | "REPORT", category: string) => void;
  onUploadGeneral: (refType: ClaimDocBucket) => void;
  onRemoveFile: (refType: ClaimDocBucket, fileId: string) => void;
  onEditFileServices: (refType: ClaimDocBucket, fileId: string) => void;
}>;

function capitalizeWord(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function SectionTitle({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="claim-step2-section-title">
      <span className="claim-step2-section-title__icon" aria-hidden>
        {icon}
      </span>
      <h3 className="claim-step2-section-title__text">{title}</h3>
    </div>
  );
}

function DocCategoryCard({
  title,
  files,
  onUpload,
  onRemove,
  onEditServices,
  filter,
}: {
  title: string;
  files: readonly ReimbursementCreateBillFileWithServices[];
  onUpload: () => void;
  onRemove: (fileId: string) => void;
  onEditServices: (fileId: string) => void;
  filter?: (f: ReimbursementCreateBillFileWithServices) => boolean;
}) {
  const visible = filter ? files.filter(filter) : files;
  return (
    <div className="claim-step2-upload-card">
      <div className="claim-step2-upload-card__head">
        <span className="claim-step2-upload-card__title">{title}</span>
        <button type="button" className="claim-step2-upload-chip" onClick={onUpload}>
          + Upload
        </button>
      </div>
      {visible.length > 0 ? (
        <div className="claim-step2-attach-list">
          {visible.map((f) => {
            const stLine = f.service_types.map((s) => s.value.trim() || s.key).filter(Boolean).join(", ");
            return (
              <ClaimAttachmentFileRow
                key={f.id}
                file={f}
                serviceLabel={stLine || "Service types required"}
                onEdit={() => onEditServices(f.id)}
                onRemove={() => onRemove(f.id)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RequiredDocRowCard({
  row,
  refType,
  files,
  onAddFile,
  onRemove,
  onEditServices,
}: {
  row: RequiredDocRow;
  refType: "PAYMENT" | "REPORT";
  files: readonly ReimbursementCreateBillFileWithServices[];
  onAddFile: () => void;
  onRemove: (fileId: string) => void;
  onEditServices: (fileId: string) => void;
}) {
  const required = row.particulars?.required === true;
  const mandateParts = row.claim_type.map((c) => c.value.trim() || c.key).filter(Boolean);
  const categoryFiles = files.filter((f) => (f.document_type ?? "").trim() === row.category.trim());

  return (
    <div className="claim-step2-required-row">
      <p className="claim-step2-required-row__title">
        {capitalizeWord(row.category)}
        {required ? " *" : ""}
      </p>
      {mandateParts.length > 0 ? (
        <p className="claim-step2-required-row__hint">
          {required ? "Mandatory for: " : "Optional for service types: "}
          {mandateParts.join(", ")}
        </p>
      ) : null}
      {shouldShowVaccineReportNote(row, refType) ? (
        <p className="claim-step2-required-row__note">{VACCINE_REPORT_NOTE}</p>
      ) : null}
      {row.missingReports.length > 0 ? (
        <div className="claim-step2-required-row__missing-box" role="status">
          Missing documents: {row.missingReports.map((m) => m.value.trim() || m.key).join(", ")}
        </div>
      ) : null}
      {categoryFiles.length > 0 ? (
        <div className="claim-step2-attach-list">
          {categoryFiles.map((f) => {
            const stLine = f.service_types.map((s) => s.value.trim() || s.key).filter(Boolean).join(", ");
            return (
              <ClaimAttachmentFileRow
                key={f.id}
                file={f}
                serviceLabel={stLine || "Service types required"}
                onEdit={() => onEditServices(f.id)}
                onRemove={() => onRemove(f.id)}
              />
            );
          })}
        </div>
      ) : null}
      <button type="button" className="claim-step2-required-row__add" onClick={onAddFile}>
        + Add file
      </button>
    </div>
  );
}

export function ClaimStep2Documents({
  files,
  requiredPayments,
  requiredReports,
  uploading,
  onUploadCategory,
  onUploadGeneral,
  onRemoveFile,
  onEditFileServices,
}: Props) {
  const hasDynamic = requiredPayments.length > 0 || requiredReports.length > 0;

  if (hasDynamic) {
    return (
      <div className="claim-step2-docs" aria-labelledby="claim-step2-docs-title">
        <SectionTitle
          title="Payment receipts"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
        />
        <p className="claim-step2-docs__hint">
          Upload payment proofs that are separate from the bill.
        </p>
        <DocCategoryCard
          title="General payment uploads"
          files={files.payment}
          filter={paymentFileIsGeneral}
          onUpload={() => onUploadGeneral("payment")}
          onRemove={(id) => onRemoveFile("payment", id)}
          onEditServices={(id) => onEditFileServices("payment", id)}
        />
        {requiredPayments.map((row, idx) => (
          <RequiredDocRowCard
            key={`${row.category}-${idx}`}
            row={row}
            refType="PAYMENT"
            files={files.payment}
            onAddFile={() => onUploadCategory("PAYMENT", row.category)}
            onRemove={(id) => onRemoveFile("payment", id)}
            onEditServices={(id) => onEditFileServices("payment", id)}
          />
        ))}

        <SectionTitle
          title="Reports and prescriptions"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <p className="claim-step2-docs__hint">Upload prescriptions, lab reports, and related documents.</p>
        {requiredReports.map((row, idx) => (
          <RequiredDocRowCard
            key={`${row.category}-${idx}`}
            row={row}
            refType="REPORT"
            files={files.report}
            onAddFile={() => onUploadCategory("REPORT", row.category)}
            onRemove={(id) => onRemoveFile("report", id)}
            onEditServices={(id) => onEditFileServices("report", id)}
          />
        ))}

        <SectionTitle
          title="Supporting documents"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.2-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          }
        />
        <DocCategoryCard
          title="Supporting documents"
          files={files.other}
          onUpload={() => onUploadGeneral("other")}
          onRemove={(id) => onRemoveFile("other", id)}
          onEditServices={(id) => onEditFileServices("other", id)}
        />
        {uploading ? <p className="claim-step2-docs__busy" aria-live="polite">Uploading…</p> : null}
      </div>
    );
  }

  return (
    <div className="claim-step2-docs" aria-labelledby="claim-step2-docs-title">
      <DocCategoryCard
        title="Payment receipts"
        files={files.payment}
        onUpload={() => onUploadGeneral("payment")}
        onRemove={(id) => onRemoveFile("payment", id)}
        onEditServices={(id) => onEditFileServices("payment", id)}
      />
      <DocCategoryCard
        title="Medical reports"
        files={files.report}
        onUpload={() => onUploadGeneral("report")}
        onRemove={(id) => onRemoveFile("report", id)}
        onEditServices={(id) => onEditFileServices("report", id)}
      />
      <DocCategoryCard
        title="Other documents"
        files={files.other}
        onUpload={() => onUploadGeneral("other")}
        onRemove={(id) => onRemoveFile("other", id)}
        onEditServices={(id) => onEditFileServices("other", id)}
      />
      {uploading ? <p className="claim-step2-docs__busy" aria-live="polite">Uploading…</p> : null}
    </div>
  );
}
