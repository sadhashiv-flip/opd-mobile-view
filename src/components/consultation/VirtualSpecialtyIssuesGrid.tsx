import type { PatientIssue } from "@/api/issues";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { Fragment } from "react";
import { VirtualSpecialtyDoctorStrip } from "@/components/consultation/VirtualSpecialtyDoctorStrip";
import type { SpecialityDoctor } from "@/api/consultationVirtual";

export type VirtualSpecialtyIssuesGridProps = Readonly<{
  issues: readonly PatientIssue[];
  selectedIssueId: string | null;
  selectedRowIndex: number | null;
  doctorsLoad: "idle" | "loading" | "ok" | "error";
  onlineDoctors: readonly SpecialityDoctor[];
  loadingMore: boolean;
  onSelectIssue: (issue: PatientIssue) => void;
}>;

const COLS = 3;

function buildRows(issues: readonly PatientIssue[]): PatientIssue[][] {
  const rows: PatientIssue[][] = [];
  for (let i = 0; i < issues.length; i += COLS) {
    rows.push(issues.slice(i, i + COLS));
  }
  return rows;
}

function IssueTile({
  issue,
  selected,
  onSelect,
}: Readonly<{
  issue: PatientIssue;
  selected: boolean;
  onSelect: (issue: PatientIssue) => void;
}>) {
  const imgUrl = resolveProfileImageUrl(issue.image);
  return (
    <li className="csp-virtual-grid__cell">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        className={`csp-virtual-tile${selected ? " csp-virtual-tile--selected" : ""}`}
        onClick={() => onSelect(issue)}
      >
        <div className="csp-virtual-tile__media" aria-hidden="true">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt=""
              className="csp-virtual-tile__thumb"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="csp-virtual-tile__fallback">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M14 8a2 2 0 10-4 0v2H8a1 1 0 00-1 1v1a1 1 0 001 1h2v2a2 2 0 104 0v-2h2a1 1 0 001-1v-1a1 1 0 00-1-1h-2V8z"
                  fill="currentColor"
                />
                <path
                  d="M7 18h10a2 2 0 002-2v-1H5v1a2 2 0 002 2z"
                  fill="currentColor"
                  opacity="0.85"
                />
              </svg>
            </span>
          )}
        </div>
        <div className="csp-virtual-tile__title">{issue.title}</div>
      </button>
    </li>
  );
}

export function VirtualSpecialtyIssuesGrid({
  issues,
  selectedIssueId,
  selectedRowIndex,
  doctorsLoad,
  onlineDoctors,
  loadingMore,
  onSelectIssue,
}: VirtualSpecialtyIssuesGridProps) {
  const rows = buildRows(issues);

  return (
    <div className="csp-virtual-issues" aria-label="Issues">
      {rows.map((rowIssues, rowIndex) => (
        <Fragment key={rowIssues[0]?.id ?? `row-${rowIndex}`}>
          <ul className="csp-virtual-row">
            {Array.from({ length: COLS }, (_, col) => {
              const issue = rowIssues[col];
              if (!issue) {
                return (
                  <li
                    key={`pad-${rowIndex}-${col}`}
                    className="csp-virtual-grid__cell csp-virtual-grid__cell--empty"
                    aria-hidden
                  />
                );
              }
              return (
                <IssueTile
                  key={issue.id}
                  issue={issue}
                  selected={selectedIssueId === String(issue.id)}
                  onSelect={onSelectIssue}
                />
              );
            })}
          </ul>
          {rowIndex === selectedRowIndex ? (
            <VirtualSpecialtyDoctorStrip
              loading={doctorsLoad === "loading"}
              doctors={onlineDoctors}
            />
          ) : null}
          {rowIndex < rows.length - 1 ? <div className="csp-virtual-row-gap" aria-hidden /> : null}
        </Fragment>
      ))}
      {selectedRowIndex === null && selectedIssueId && doctorsLoad !== "idle" ? (
        <VirtualSpecialtyDoctorStrip
          loading={doctorsLoad === "loading"}
          doctors={onlineDoctors}
        />
      ) : null}
      {loadingMore ? (
        <div className="csp-list-more" aria-busy="true">
          Loading more…
        </div>
      ) : null}
    </div>
  );
}
