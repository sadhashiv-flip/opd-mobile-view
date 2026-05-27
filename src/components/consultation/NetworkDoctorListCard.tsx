import type { NetworkListDoctorRow } from "@/api/networkList";
import { MATERIAL_ICON_DIRECTIONS, MaterialIcon } from "@/components/icons/MaterialIcon";
import {
  formatDoctorSpecialtyLine,
  isFemaleGender,
  networkDirectionsUrl,
  resolveConsultationFeeDisplay,
  resolveDoctorAvailabilityLabel,
} from "@/lib/networkDoctorCardUi";
import "./NetworkDoctorListCard.css";

function doctorAvatarInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "DR";
  const stripTitle = (s: string) => s.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s*/i, "").trim();
  let first = stripTitle(parts[0]);
  if (!first && parts.length > 1) first = stripTitle(parts[1]);
  const last = parts.length > 1 ? stripTitle(parts[parts.length - 1]) : "";
  const a = first ? first.charAt(0).toUpperCase() : "";
  const b = last ? last.charAt(0).toUpperCase() : "";
  if (!a && !b) return "DR";
  if (!b) return a;
  if (!a) return b;
  return `${a}${b}`;
}

export type NetworkDoctorListCardProps = Readonly<{
  doctor: NetworkListDoctorRow;
  specialtyLabel: string;
  onBook: () => void;
  /** Vendor doctors — opens profile detail (Dart `openNetworkDoctorDetail`). */
  onViewDetail?: () => void;
}>;

export function NetworkDoctorListCard({
  doctor: d,
  specialtyLabel,
  onBook,
  onViewDetail,
}: NetworkDoctorListCardProps) {
  const specialtyLine = formatDoctorSpecialtyLine(specialtyLabel, d.expLabel);
  const fee = resolveConsultationFeeDisplay(d);
  const availability = resolveDoctorAvailabilityLabel(d);
  const directionsUrl = networkDirectionsUrl(d.networkCoordinates);
  const female = isFemaleGender(d.gender);

  const headInner = (
    <>
        <div className="ndc-doc">
          <div className="ndc-doc__avatar-wrap">
            {d.imageUrl ? (
              <img className="ndc-doc__avatar-img" src={d.imageUrl} alt="" width={45} height={45} />
            ) : (
              <div
                className={`ndc-doc__avatar${female ? " ndc-doc__avatar--female" : " ndc-doc__avatar--male"}`}
                aria-hidden="true"
              >
                <span className="ndc-doc__avatar-initials">{doctorAvatarInitials(d.name)}</span>
                <span className="ndc-doc__avatar-badge" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 4v4M8 6h8M6 10h12v8H6V10z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            )}
          </div>
          <div className="ndc-doc__meta">
            <div className="ndc-doc__name">{d.name}</div>
            {specialtyLine ? <div className="ndc-doc__specialty">{specialtyLine}</div> : null}
          </div>
        </div>
        {onViewDetail ? (
          <span className="ndc-card__chev" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
    </>
  );

  return (
    <article className="ndc-card">
      {onViewDetail ? (
        <button type="button" className="ndc-card__sec ndc-card__sec--head ndc-card__head-btn" onClick={onViewDetail}>
          {headInner}
        </button>
      ) : (
        <div className="ndc-card__sec ndc-card__sec--head">{headInner}</div>
      )}

      {d.networkName ? (
        <div className="ndc-card__sec ndc-card__sec--clinic">
          <span className="ndc-clinic__ic" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 21V7l7-4 7 4v14H5z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <span className="ndc-clinic__name">{d.networkName}</span>
          {directionsUrl ? (
            <a
              className="ndc-clinic__directions"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open directions"
              onClick={(e) => e.stopPropagation()}
            >
              <MaterialIcon
                name={MATERIAL_ICON_DIRECTIONS}
                size={22}
                className="ndc-clinic__directions-icon"
              />
            </a>
          ) : null}
        </div>
      ) : null}

      {fee != null ? (
        <div className="ndc-card__sec ndc-card__sec--fee">
          <span className="ndc-fee__label">Consultation fee</span>
          <span className="ndc-fee__amount">₹ {fee}</span>
        </div>
      ) : null}

      <div className="ndc-card__sec ndc-card__sec--footer">
        {availability ? (
          <div className="ndc-avail">
            <span className="ndc-avail__ic" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
                <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <path
                  d="M9 14l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="ndc-avail__text">{availability}</span>
          </div>
        ) : (
          <span className="ndc-avail ndc-avail--empty" aria-hidden="true" />
        )}
        <button type="button" className="ndc-book" onClick={onBook}>
          Book
        </button>
      </div>
    </article>
  );
}
