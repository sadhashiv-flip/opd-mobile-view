import type { ConsultationUploadRefType } from "@/api/patientUpload";
import type { ConsultationAttachmentRow } from "@/api/patientInvoices";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";

type ConsultationAttachIconKind = "image" | "pdf" | "file";

export function consultationAttachmentIconKind(url: string | null, label: string): ConsultationAttachIconKind {
  const raw = `${url ?? ""} ${label}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(raw)) return "image";
  if (/\.pdf(\?|#|$)/i.test(raw)) return "pdf";
  return "file";
}

export function AttachmentKindIcon({ kind }: Readonly<{ kind: ConsultationAttachIconKind }>) {
  if (kind === "image") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
        <path
          d="M21 15l-5-5-4 4-3-3-6 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "pdf") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M14 3v5h5M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

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
}>;

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

  const items = tab === "ATTACHMENT" ? attachments : reports;
  const listItems = listKind === "REPORT" ? reports : attachments;
  const listHeading = listKind === "REPORT" ? "Reports" : "Attachments";
  const uploadBusy = tab === "ATTACHMENT" ? attachmentAddBusy : reportUploadBusy;
  const addDisabled = !refId?.trim() || uploadBusy;
  const rowKeyPrefix = tab === "ATTACHMENT" ? "att" : "rep";

  return (
    <>
      <section className="od-card od-card--attach od-card--attach-managed od-card--attach-tabs" aria-label="Files">
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
        <div className="od-attach-tabs__panel" role="tabpanel">
          <div className="od-attach-tabs__toolbar">
            <button
              type="button"
              className="od-attach-add-btn"
              disabled={addDisabled}
              onClick={() => (tab === "ATTACHMENT" ? onPickAttachments() : onPickReports())}
            >
              {uploadBusy ? "Adding…" : "Add"}
            </button>
          </div>
          <input
            ref={attachmentFileInputRef}
            type="file"
            className="od-attach-file-input"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            multiple
            aria-label="Add consultation attachment"
            onChange={(e) => void onAttachmentFileChange(e)}
          />
          <input
            ref={reportFileInputRef}
            type="file"
            className="od-attach-file-input"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            multiple
            aria-label="Add consultation report"
            onChange={(e) => void onReportFileChange(e)}
          />
          <div className="od-attach-strip">
            <div className="od-attach-strip__icons">
              {items.length === 0 ? (
                <span className="od-attach-strip__empty">No files yet — use Add or open the list</span>
              ) : (
                items.slice(0, 8).map((a, i) => {
                  const k = consultationAttachmentIconKind(a.url, a.label);
                  const hasUrl = Boolean(a.url?.trim());
                  const rows = tab === "ATTACHMENT" ? attachments : reports;
                  return (
                    <button
                      key={`${rowKeyPrefix}-${a.label}-${i}`}
                      type="button"
                      className="od-attach-strip__chip"
                      data-attach-kind={k}
                      title={a.label}
                      disabled={!hasUrl}
                      onClick={() => onPreview(rows, a.url, a.label)}
                    >
                      <AttachmentKindIcon kind={k} />
                    </button>
                  );
                })
              )}
            </div>
            <button type="button" className="od-attach-strip__cta" onClick={() => setListKind(tab)}>
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
                const k = consultationAttachmentIconKind(a.url, a.label);
                const dlgPrefix = listKind === "REPORT" ? "rep" : "att";
                return (
                  <li key={`${dlgPrefix}-dlg-${a.label}-${i}`} className="od-attach-dialog__item">
                    <span className="od-attach-dialog__item-kind" data-attach-kind={k}>
                      <AttachmentKindIcon kind={k} />
                    </span>
                    <div className="od-attach-dialog__item-main">
                      <span className="od-attach-dialog__item-label">{a.label}</span>
                      {a.url ? (
                        <button
                          type="button"
                          className="od-attach-dialog__link od-attach-dialog__link--btn"
                          onClick={() => {
                            onPreview(listItems, a.url, a.label);
                            setListKind(null);
                          }}
                        >
                          View
                        </button>
                      ) : (
                        <span className="od-attach-dialog__muted">No link</span>
                      )}
                    </div>
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
        <ul className="od-attach-list">
          {attachments.map((a, i) => (
            <li key={`${a.label}-${i}`} className="od-attach-item">
              {a.url ? (
                <button
                  type="button"
                  className="od-attach-item__link od-attach-item__link--btn"
                  onClick={() => onPreview(attachments, a.url, a.label)}
                >
                  {a.label}
                </button>
              ) : (
                <span className="od-attach-item__text">{a.label}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!hasAtt) {
    return (
      <section className="od-card od-card--attach" aria-label="Reports">
        <h3 className="od-card__title">Reports</h3>
        <ul className="od-attach-list">
          {reports.map((a, i) => (
            <li key={`rep-${a.label}-${i}`} className="od-attach-item">
              {a.url ? (
                <button
                  type="button"
                  className="od-attach-item__link od-attach-item__link--btn"
                  onClick={() => onPreview(reports, a.url, a.label)}
                >
                  {a.label}
                </button>
              ) : (
                <span className="od-attach-item__text">{a.label}</span>
              )}
            </li>
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
          <ul className="od-attach-list od-attach-list--tab">
            {items.map((a, i) => (
              <li key={`${tab}-${a.label}-${i}`} className="od-attach-item">
                {a.url ? (
                  <button
                    type="button"
                    className="od-attach-item__link od-attach-item__link--btn"
                    onClick={() => onPreview(items, a.url, a.label)}
                  >
                    {a.label}
                  </button>
                ) : (
                  <span className="od-attach-item__text">{a.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
