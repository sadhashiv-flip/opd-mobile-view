import type { ConsultationUploadRefType } from "@/api/patientUpload";
import type { ConsultationAttachmentRow } from "@/api/patientInvoices";
import {
  AttachmentKindIcon,
  attachmentIconKindFromUrlAndName,
  type AttachmentIconKind,
} from "@/components/attachments/attachmentTypeIcons";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";

/** @deprecated Use {@link attachmentIconKindFromUrlAndName} from `@/components/attachments/attachmentTypeIcons`. */
export function consultationAttachmentIconKind(url: string | null, label: string): AttachmentIconKind {
  return attachmentIconKindFromUrlAndName(url, label);
}

export { AttachmentKindIcon };

export type ConsultationManagedFilesTabsProps = Readonly<{
  attachments: readonly ConsultationAttachmentRow[];
  reports: readonly ConsultationAttachmentRow[];
  refId: string | null;
  onPreview: (rows: readonly ConsultationAttachmentRow[], url: string | null, name: string) => void;
  attachmentFileInputRef: RefObject<HTMLInputElement | null>;
  reportFileInputRef: RefObject<HTMLInputElement | null>;
  attachmentAddBusy: boolean;
  reportUploadBusy: boolean;
  onPickAttachments: () => void;
  onPickReports: () => void;
  onAttachmentFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onReportFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** patient_app `canAddAttachment` — when false, hide Add controls (read-only managed view). */
  canAddAttachments?: boolean;
  canAddReports?: boolean;
  /** Consultation orders: attachments only (no Reports tab). Defaults to reports present or add allowed. */
  showReportsTab?: boolean;
}>;

export function AttachmentListRow({
  rows,
  item,
  index,
  keyPrefix,
  onPreview,
  onAfterPreview,
}: Readonly<{
  rows: readonly ConsultationAttachmentRow[];
  item: ConsultationAttachmentRow;
  index: number;
  keyPrefix: string;
  onPreview: (rows: readonly ConsultationAttachmentRow[], url: string | null, name: string) => void;
  onAfterPreview?: () => void;
}>) {
  const k = attachmentIconKindFromUrlAndName(item.url, item.label);
  const name = item.label?.trim() || "Attachment";
  const hasUrl = Boolean(item.url?.trim());
  return (
    <li key={`${keyPrefix}-${item.label}-${index}`} className="od-attach-item-wrap">
      {hasUrl ? (
        <button
          type="button"
          className="od-attach-item od-attach-item--icon-row od-attach-item__tile"
          onClick={() => {
            onPreview(rows, item.url, item.label);
            onAfterPreview?.();
          }}
          aria-label={`Open ${name}`}
        >
          <span className="od-attach-item__kind" data-attach-kind={k} aria-hidden>
            <AttachmentKindIcon kind={k} />
          </span>
        </button>
      ) : (
        <div className="od-attach-item od-attach-item--icon-row od-attach-item--no-url" aria-label={`${name} (no link)`}>
          <span className="od-attach-item__kind" data-attach-kind={k} aria-hidden>
            <AttachmentKindIcon kind={k} />
          </span>
          <span className="od-attach-item__no-link">No link</span>
        </div>
      )}
    </li>
  );
}

export function ConsultationManagedFilesTabs({
  attachments,
  reports,
  refId,
  onPreview,
  attachmentFileInputRef,
  reportFileInputRef,
  attachmentAddBusy,
  reportUploadBusy,
  onPickAttachments,
  onPickReports,
  onAttachmentFileChange,
  onReportFileChange,
  canAddAttachments = false,
  canAddReports = false,
  showReportsTab = reports.length > 0 || canAddReports,
}: ConsultationManagedFilesTabsProps) {
  const [tab, setTab] = useState<ConsultationUploadRefType>("ATTACHMENT");
  const [listKind, setListKind] = useState<ConsultationUploadRefType | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (listKind != null) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [listKind]);

  const activeTab: ConsultationUploadRefType = showReportsTab ? tab : "ATTACHMENT";
  const items = activeTab === "ATTACHMENT" ? attachments : reports;
  const listItems = listKind === "REPORT" ? reports : attachments;
  const listHeading = listKind === "REPORT" ? "Reports" : "Attachments";
  const uploadBusy = activeTab === "ATTACHMENT" ? attachmentAddBusy : reportUploadBusy;
  const canAddCurrentTab = activeTab === "ATTACHMENT" ? canAddAttachments : canAddReports;
  const addDisabled = !canAddCurrentTab || !refId?.trim() || uploadBusy;
  const rowKeyPrefix = activeTab === "ATTACHMENT" ? "att" : "rep";

  return (
    <>
      <section
        className={`od-card od-card--attach od-card--attach-managed${showReportsTab ? " od-card--attach-tabs" : ""}`}
        aria-label={showReportsTab ? "Files" : "Attachments"}
      >
        {showReportsTab ? (
          <div className="od-attach-tabs" role="tablist" aria-label="Attachments or reports">
            <button
              type="button"
              role="tab"
              className="od-attach-tabs__tab"
              aria-selected={tab === "ATTACHMENT"}
              onClick={() => setTab("ATTACHMENT")}
            >
              Attachments
              {attachments.length > 0 ? (
                <span className="od-attach-tabs__count">{attachments.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              className="od-attach-tabs__tab"
              aria-selected={tab === "REPORT"}
              onClick={() => setTab("REPORT")}
            >
              Reports
              {reports.length > 0 ? <span className="od-attach-tabs__count">{reports.length}</span> : null}
            </button>
          </div>
        ) : (
          <h3 className="od-card__title">Attachments</h3>
        )}
        <div className="od-attach-tabs__panel" role={showReportsTab ? "tabpanel" : undefined}>
          {canAddCurrentTab ? (
            <div className="od-attach-tabs__toolbar">
              <button
                type="button"
                className="od-attach-add-btn"
                disabled={addDisabled}
                onClick={() => (activeTab === "ATTACHMENT" ? onPickAttachments() : onPickReports())}
              >
                {uploadBusy ? "Adding…" : "Add"}
              </button>
            </div>
          ) : null}
          <input
            ref={attachmentFileInputRef}
            type="file"
            className="od-attach-file-input"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            multiple
            aria-label="Add consultation attachment"
            onChange={(e) => void onAttachmentFileChange(e)}
          />
          {showReportsTab ? (
            <input
              ref={reportFileInputRef}
              type="file"
              className="od-attach-file-input"
              accept="image/*,.pdf,.doc,.docx,application/pdf"
              multiple
              aria-label="Add consultation report"
              onChange={(e) => void onReportFileChange(e)}
            />
          ) : null}
          <div className="od-attach-strip">
            <div className="od-attach-strip__icons">
              {items.length === 0 ? (
                <span className="od-attach-strip__empty">No files yet — use Add or open the list</span>
              ) : (
                items.slice(0, 8).map((a, i) => {
                  const k = attachmentIconKindFromUrlAndName(a.url, a.label);
                  const hasUrl = Boolean(a.url?.trim());
                  const rows = activeTab === "ATTACHMENT" ? attachments : reports;
                  const name = a.label?.trim() || "Attachment";
                  return (
                    <button
                      key={`${rowKeyPrefix}-${a.label}-${i}`}
                      type="button"
                      className="od-attach-strip__chip"
                      data-attach-kind={k}
                      title={name}
                      disabled={!hasUrl}
                      aria-label={hasUrl ? `Open ${name}` : `${name} (no link)`}
                      onClick={() => onPreview(rows, a.url, a.label)}
                    >
                      <AttachmentKindIcon kind={k} />
                    </button>
                  );
                })
              )}
            </div>
            <button
              type="button"
              className="od-attach-strip__cta"
              onClick={() => setListKind(showReportsTab ? tab : "ATTACHMENT")}
            >
              {items.length > 0 ? `View list (${items.length})` : "Open list"}
            </button>
          </div>
        </div>
      </section>
      <dialog
        ref={dialogRef}
        className="od-attach-dialog"
        aria-labelledby={dialogTitleId}
        onClose={() => setListKind(null)}
        onCancel={(e) => {
          e.preventDefault();
          setListKind(null);
        }}
      >
        <div className="od-attach-dialog__panel">
          <h2 id={dialogTitleId} className="od-attach-dialog__title">
            {listHeading}
          </h2>
          {listItems.length === 0 ? (
            <p className="od-attach-dialog__empty">Nothing uploaded yet.</p>
          ) : (
            <ul className="od-attach-dialog__list">
              {listItems.map((a, i) => {
                const k = attachmentIconKindFromUrlAndName(a.url, a.label);
                const dlgPrefix = listKind === "REPORT" ? "rep" : "att";
                const name = a.label?.trim() || "Attachment";
                const hasUrl = Boolean(a.url?.trim());
                return (
                  <li key={`${dlgPrefix}-dlg-${a.label}-${i}`} className="od-attach-dialog__item">
                    {hasUrl ? (
                      <button
                        type="button"
                        className="od-attach-dialog__row-tile"
                        aria-label={`Open ${name}`}
                        onClick={() => {
                          onPreview(listItems, a.url, a.label);
                          setListKind(null);
                        }}
                      >
                        <span className="od-attach-dialog__item-kind" data-attach-kind={k}>
                          <AttachmentKindIcon kind={k} />
                        </span>
                      </button>
                    ) : (
                      <div className="od-attach-dialog__row-tile od-attach-dialog__row-tile--disabled">
                        <span className="od-attach-dialog__item-kind" data-attach-kind={k}>
                          <AttachmentKindIcon kind={k} />
                        </span>
                        <span className="od-attach-dialog__muted">No link</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <footer className="od-attach-dialog__footer">
            <button type="button" className="od-attach-dialog__btn" onClick={() => setListKind(null)}>
              Done
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}

export type ConsultationAttachReportsReadOnlyTabsProps = Readonly<{
  attachments: readonly ConsultationAttachmentRow[];
  reports: readonly ConsultationAttachmentRow[];
  onPreview: (rows: readonly ConsultationAttachmentRow[], url: string | null, name: string) => void;
}>;

/** Read-only attachments + reports; attachments-only list when there are no reports (e.g. pharmacy). */
export function ConsultationAttachReportsReadOnlyTabs({
  attachments,
  reports,
  onPreview,
}: ConsultationAttachReportsReadOnlyTabsProps) {
  const [tab, setTab] = useState<ConsultationUploadRefType>("ATTACHMENT");
  const hasAtt = attachments.length > 0;
  const hasRep = reports.length > 0;

  if (!hasAtt && !hasRep) {
    return (
      <section className="od-card od-card--attach" aria-label="Attachments">
        <h3 className="od-card__title">Attachments</h3>
        <p className="od-attach-empty">No attachments</p>
      </section>
    );
  }

  if (!hasRep) {
    return (
      <section className="od-card od-card--attach" aria-label="Attachments">
        <h3 className="od-card__title">Attachments</h3>
        <ul className="od-attach-list od-attach-list--icon-rows">
          {attachments.map((a, i) => (
            <AttachmentListRow
              key={`att-ro-${a.label}-${i}`}
              rows={attachments}
              item={a}
              index={i}
              keyPrefix="att-ro"
              onPreview={onPreview}
            />
          ))}
        </ul>
      </section>
    );
  }

  if (!hasAtt) {
    return (
      <section className="od-card od-card--attach" aria-label="Reports">
        <h3 className="od-card__title">Reports</h3>
        <ul className="od-attach-list od-attach-list--icon-rows">
          {reports.map((a, i) => (
            <AttachmentListRow
              key={`rep-ro-${a.label}-${i}`}
              rows={reports}
              item={a}
              index={i}
              keyPrefix="rep-ro"
              onPreview={onPreview}
            />
          ))}
        </ul>
      </section>
    );
  }

  const items = tab === "ATTACHMENT" ? attachments : reports;
  const emptyMsg = tab === "ATTACHMENT" ? "No attachments" : "No reports";

  return (
    <section className="od-card od-card--attach od-card--attach-tabs" aria-label="Attachments and reports">
      <div className="od-attach-tabs" role="tablist" aria-label="Attachments or reports">
        <button
          type="button"
          role="tab"
          className="od-attach-tabs__tab"
          aria-selected={tab === "ATTACHMENT"}
          onClick={() => setTab("ATTACHMENT")}
        >
          Attachments
          <span className="od-attach-tabs__count">{attachments.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className="od-attach-tabs__tab"
          aria-selected={tab === "REPORT"}
          onClick={() => setTab("REPORT")}
        >
          Reports
          <span className="od-attach-tabs__count">{reports.length}</span>
        </button>
      </div>
      <div className="od-attach-tabs__panel od-attach-tabs__panel--readonly" role="tabpanel">
        {items.length === 0 ? (
          <p className="od-attach-empty od-attach-empty--tab">{emptyMsg}</p>
        ) : (
          <ul className="od-attach-list od-attach-list--tab od-attach-list--icon-rows">
            {items.map((a, i) => (
              <AttachmentListRow
                key={`${tab}-ro-${a.label}-${i}`}
                rows={items}
                item={a}
                index={i}
                keyPrefix={`${tab}-ro`}
                onPreview={onPreview}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
