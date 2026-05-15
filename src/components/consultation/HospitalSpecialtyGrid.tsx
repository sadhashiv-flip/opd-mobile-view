import type { HospitalSpeciality } from "@/api/hospitalSpecialties";
import { resolveProfileImageUrl } from "@/api/patientProfile";

export type HospitalSpecialtyGridProps = Readonly<{
  specialties: readonly HospitalSpeciality[];
  selectedId: string | null;
  onSelect: (spec: HospitalSpeciality) => void;
}>;

const COLS = 3;

function buildRows(specs: readonly HospitalSpeciality[]): HospitalSpeciality[][] {
  const rows: HospitalSpeciality[][] = [];
  for (let i = 0; i < specs.length; i += COLS) {
    rows.push(specs.slice(i, i + COLS));
  }
  return rows;
}

function SpecialtyTile({
  spec,
  selected,
  onSelect,
}: Readonly<{
  spec: HospitalSpeciality;
  selected: boolean;
  onSelect: (spec: HospitalSpeciality) => void;
}>) {
  const imgUrl = resolveProfileImageUrl(spec.image);
  const letter = spec.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <li className="csp-virtual-grid__cell">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        className={`csp-virtual-tile${selected ? " csp-virtual-tile--selected" : ""}`}
        onClick={() => onSelect(spec)}
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
            <span className="csp-virtual-tile__fallback csp-virtual-tile__fallback--letter">
              {letter}
            </span>
          )}
        </div>
        <div className="csp-virtual-tile__title">{spec.name}</div>
      </button>
    </li>
  );
}

export function HospitalSpecialtyGrid({
  specialties,
  selectedId,
  onSelect,
}: HospitalSpecialtyGridProps) {
  const rows = buildRows(specialties);

  return (
    <div className="csp-virtual-issues" aria-label="Specialities">
      {rows.map((rowSpecs, rowIndex) => (
        <ul key={rowSpecs[0]?.id ?? `h-row-${rowIndex}`} className="csp-virtual-row">
          {Array.from({ length: COLS }, (_, col) => {
            const spec = rowSpecs[col];
            if (!spec) {
              return (
                <li
                  key={`h-pad-${rowIndex}-${col}`}
                  className="csp-virtual-grid__cell csp-virtual-grid__cell--empty"
                  aria-hidden
                />
              );
            }
            return (
              <SpecialtyTile
                key={spec.id}
                spec={spec}
                selected={selectedId === String(spec.id)}
                onSelect={onSelect}
              />
            );
          })}
        </ul>
      ))}
    </div>
  );
}
