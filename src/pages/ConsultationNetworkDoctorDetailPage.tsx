import {
  fetchNetworkDoctorCustomerReviews,
  fetchNetworkDoctorDetail,
  formatPracticeDaysLabel,
  initialPracticeSelection,
  reviewsHasDisplayableData,
  type DoctorPractice,
  type DoctorReviewsSummary,
  type NetworkDoctorCustomerReview,
  type NetworkDoctorDetail,
} from "@/api/networkDoctorDetail";
import type { NetworkListDoctorRow } from "@/api/networkList";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { MATERIAL_ICON_DIRECTIONS, MaterialIcon } from "@/components/icons/MaterialIcon";
import { ROUTES } from "@/constants";
import { writeHospitalVendorBookingContext } from "@/constants/consultationBookingStorage";
import {
  readNetworkDoctorDetailEntry,
  writeNetworkDoctorDetailEntry,
  type NetworkDoctorDetailEntry,
} from "@/constants/networkDoctorDetailStorage";
import { useToast } from "@/hooks/useToast";
import { persistHospitalConsultationSummaryFields } from "@/lib/hospitalConsultationSummary";
import { formatDoctorSpecialtyLine } from "@/lib/networkDoctorCardUi";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import "./ConsultationNetworkDoctorDetailPage.css";

type DetailTab = "profile" | "reviews";

function normalizeBio(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatExperienceLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/experience/i.test(t)) return t;
  return `${t} experience`;
}

function formatReviewDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (!m) return trimmed;
  const dt = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
  if (Number.isNaN(dt.getTime())) return trimmed;
  try {
    const date = dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = dt.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${date} · ${time}`;
  } catch {
    return trimmed;
  }
}

function resolveEntry(
  locationState: unknown,
  paramsDoctorId: string,
): NetworkDoctorDetailEntry | null {
  const fromState = locationState as NetworkDoctorDetailEntry | null;
  if (fromState?.doctor?.id) return fromState;
  const stored = readNetworkDoctorDetailEntry();
  if (stored && (!paramsDoctorId || stored.doctor.id === paramsDoctorId)) return stored;
  return null;
}

function doctorAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
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

export function ConsultationNetworkDoctorDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const params = useParams();
  const specialtyId = typeof params.specialtyId === "string" ? params.specialtyId : "gp";
  const doctorIdParam = typeof params.doctorId === "string" ? params.doctorId : "";

  const entry = useMemo(
    () => resolveEntry(location.state, doctorIdParam),
    [location.state, doctorIdParam],
  );
  const listDoctor = entry?.doctor ?? null;
  const specialtyLabel = entry?.specialtyLabel ?? "";
  const vendorCode = listDoctor?.vendorMeta?.source?.trim() ?? "";

  const [tab, setTab] = useState<DetailTab>("profile");
  const [detail, setDetail] = useState<NetworkDoctorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioNeedsToggle, setBioNeedsToggle] = useState(false);

  const [reviews, setReviews] = useState<readonly NetworkDoctorCustomerReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsFetched, setReviewsFetched] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!listDoctor || !vendorCode) {
      setError("Unable to open doctor details");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await fetchNetworkDoctorDetail(listDoctor.id, vendorCode);
      setDetail(d);
      setSelectedPracticeId(initialPracticeSelection(d, listDoctor.networkId));
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load doctor profile");
      setLoading(false);
    }
  }, [listDoctor, vendorCode]);

  useEffect(() => {
    if (!entry) {
      setError("Doctor information is missing. Go back and try again.");
      setLoading(false);
      return;
    }
    writeNetworkDoctorDetailEntry(entry);
    void loadDetail();
  }, [entry, loadDetail]);

  const loadReviews = useCallback(async () => {
    if (!listDoctor || !vendorCode || reviewsFetched || reviewsLoading) return;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const list = await fetchNetworkDoctorCustomerReviews(listDoctor.id, vendorCode);
      setReviews(list);
      setReviewsFetched(true);
      setReviewsLoading(false);
    } catch (e: unknown) {
      setReviewsError(e instanceof Error ? e.message : "Could not load reviews");
      setReviewsLoading(false);
    }
  }, [listDoctor, vendorCode, reviewsFetched, reviewsLoading]);

  useEffect(() => {
    if (tab === "reviews") void loadReviews();
  }, [tab, loadReviews]);

  const practices = detail?.practices ?? [];
  const multiplePractices = practices.length > 1;

  const showBookBar =
    listDoctor != null && !loading && error == null && selectedPracticeId != null;

  const onBook = useCallback(() => {
    if (!listDoctor || !selectedPracticeId) {
      toast.error("Please select a clinic or hospital to continue");
      return;
    }
    const practice =
      practices.find((p) => p.id === selectedPracticeId) ?? null;
    if (!practice) {
      toast.error("Please select a clinic or hospital to continue");
      return;
    }
    persistHospitalConsultationSummaryFields({
      doctorName: listDoctor.name,
      doctorQualification: listDoctor.degree,
      networkName: practice.name || listDoctor.networkName,
    });
    if (listDoctor.vendorMeta) {
      writeHospitalVendorBookingContext({
        vendorMeta: {
          source: listDoctor.vendorMeta.source,
          price: listDoctor.vendorMeta.price,
          timings: listDoctor.vendorMeta.timings,
          isCashless: listDoctor.vendorMeta.isCashless,
        },
        practiceId: selectedPracticeId,
        network: {
          name: practice.name || listDoctor.networkName,
          displayAddress: practice.fullAddress || listDoctor.networkAddress,
          coordinates: practice.geolocation || listDoctor.networkCoordinates,
        },
        doctor: {
          id: listDoctor.id,
          name: listDoctor.name,
          gender: listDoctor.gender,
          qualification: listDoctor.degree,
        },
      });
    }
    navigate(
      generatePath(ROUTES.consultationHospitalSlots, {
        specialtyId,
        networkId: selectedPracticeId,
        doctorId: listDoctor.id,
      }),
    );
  }, [listDoctor, selectedPracticeId, practices, specialtyId, navigate, toast]);

  const fallbackTo = generatePath(ROUTES.consultationHospitalResults, { specialtyId });

  return (
    <div className="ndp-page">
      <header className="ndp-top">
        <FlowScreenBack className="app-back-btn ndp-back" fallbackTo={fallbackTo} />
        <h1 className="ndp-title">Doctor profile</h1>
      </header>

      {loading ? (
        <div className="ndp-center">Loading…</div>
      ) : error ? (
        <div className="ndp-center">
          <p>{error}</p>
          {listDoctor && vendorCode ? (
            <button type="button" className="ndp-retry" onClick={() => void loadDetail()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : !detail?.name ? (
        <div className="ndp-center">Doctor details not available</div>
      ) : (
        <>
          <div className="ndp-body">
            <div className="ndp-header-wrap">
              <ProfileHeaderCard detail={detail} listDoctor={listDoctor} specialtyLabel={specialtyLabel} />
            </div>

            <div className="ndp-tabs-wrap">
              <div className="ndp-tabs" role="tablist" aria-label="Doctor profile sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "profile"}
                  className={`ndp-tab${tab === "profile" ? " ndp-tab--active" : ""}`}
                  onClick={() => setTab("profile")}
                >
                  <span aria-hidden="true">👤</span>
                  <span>Profile details</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "reviews"}
                  className={`ndp-tab${tab === "reviews" ? " ndp-tab--active" : ""}`}
                  onClick={() => setTab("reviews")}
                >
                  <span aria-hidden="true">★</span>
                  <span>Customer reviews</span>
                  {reviewsFetched && reviews.length > 0 ? (
                    <span className="ndp-tab__badge">{reviews.length}</span>
                  ) : null}
                </button>
              </div>
            </div>

            {tab === "profile" ? (
              <ProfileDetailsPanel
                detail={detail}
                practices={practices}
                multiplePractices={multiplePractices}
                selectedPracticeId={selectedPracticeId}
                onSelectPractice={setSelectedPracticeId}
                bioExpanded={bioExpanded}
                bioNeedsToggle={bioNeedsToggle}
                onBioExpandedChange={setBioExpanded}
                onBioNeedsToggle={setBioNeedsToggle}
              />
            ) : (
              <ReviewsPanel
                loading={reviewsLoading}
                error={reviewsError}
                reviews={reviews}
                onRetry={() => {
                  setReviewsFetched(false);
                  void loadReviews();
                }}
              />
            )}
          </div>

          {showBookBar ? (
            <footer className="ndp-footer">
              <button type="button" className="ndp-book" onClick={onBook}>
                Book Appointment
              </button>
            </footer>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProfileHeaderCard({
  detail,
  listDoctor,
  specialtyLabel,
}: Readonly<{
  detail: NetworkDoctorDetail;
  listDoctor: NetworkListDoctorRow | null;
  specialtyLabel: string;
}>) {
  const experienceLabel = formatExperienceLabel(detail.experience);
  const regNo = detail.registration?.number.trim() ?? "";
  const specialtyLine =
    listDoctor != null
      ? formatDoctorSpecialtyLine(specialtyLabel, listDoctor.expLabel)
      : detail.speciality;

  return (
    <div className="ndp-card ndp-profile">
      {detail.photoUrl ? (
        <img className="ndp-photo" src={detail.photoUrl} alt="" width={88} height={88} />
      ) : (
        <div className="ndp-photo ndp-photo--placeholder" aria-hidden="true">
          <span>{doctorAvatarInitials(detail.name)}</span>
        </div>
      )}
      <div className="ndp-profile__meta">
        <h2 className="ndp-profile__name">{detail.name}</h2>
        {experienceLabel ? <p className="ndp-profile__sub">{experienceLabel}</p> : null}
        {specialtyLine && !experienceLabel ? (
          <p className="ndp-profile__sub">{specialtyLine}</p>
        ) : null}
        {regNo ? <p className="ndp-profile__sub">Reg. no. {regNo}</p> : null}
        {detail.reviews && reviewsHasDisplayableData(detail.reviews) ? (
          <ReviewsSummaryInline reviews={detail.reviews} />
        ) : null}
      </div>
    </div>
  );
}

function ReviewsSummaryInline({ reviews }: Readonly<{ reviews: DoctorReviewsSummary }>) {
  const parts: string[] = [];
  if (reviews.percentage > 0) parts.push(`${reviews.percentage}% recommended`);
  if (reviews.responseCount > 0) parts.push(`${reviews.responseCount} reviews`);
  if (parts.length === 0 && reviews.recommendation > 0) {
    parts.push(`${reviews.recommendation} recommendations`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="ndp-profile__reviews">
      <span aria-hidden="true">★</span>
      <span>{parts.join(" · ")}</span>
    </p>
  );
}

function ProfileDetailsPanel({
  detail,
  practices,
  multiplePractices,
  selectedPracticeId,
  onSelectPractice,
  bioExpanded,
  bioNeedsToggle,
  onBioExpandedChange,
  onBioNeedsToggle,
}: Readonly<{
  detail: NetworkDoctorDetail;
  practices: readonly DoctorPractice[];
  multiplePractices: boolean;
  selectedPracticeId: string | null;
  onSelectPractice: (id: string) => void;
  bioExpanded: boolean;
  bioNeedsToggle: boolean;
  onBioExpandedChange: (v: boolean) => void;
  onBioNeedsToggle: (v: boolean) => void;
}>) {
  const bio = normalizeBio(detail.bio);

  return (
    <div className="ndp-panel">
      {detail.reviews && reviewsHasDisplayableData(detail.reviews) ? (
        <div className="ndp-block">
          <RatingsCard reviews={detail.reviews} />
        </div>
      ) : null}

      {bio ? (
        <div className="ndp-block">
          <h3 className="ndp-section-title">About</h3>
          <div className="ndp-card">
            <p
              ref={(el) => {
                if (!el || bioExpanded) return;
                onBioNeedsToggle(el.scrollHeight > el.clientHeight + 2);
              }}
              className={`ndp-bio${bioExpanded ? "" : " ndp-bio--clamp"}`}
            >
              {bio}
            </p>
            {(bioNeedsToggle || bioExpanded) && (
              <button
                type="button"
                className="ndp-read-more"
                onClick={() => onBioExpandedChange(!bioExpanded)}
              >
                {bioExpanded ? "Read less" : "Read more"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {detail.qualifications.length > 0 ? (
        <TextListSection title="Qualifications" items={detail.qualifications} />
      ) : null}
      {detail.specializations.length > 0 ? (
        <TextListSection title="Specializations" items={detail.specializations} />
      ) : null}
      {detail.languages.length > 0 ? (
        <TextListSection title="Languages" items={detail.languages} />
      ) : null}

      {practices.length > 0 ? (
        <div className="ndp-block">
          <h3 className="ndp-section-title">Clinics &amp; hospitals</h3>
          {multiplePractices ? (
            <p className="ndp-section-hint">
              {selectedPracticeId == null
                ? "Select a clinic or hospital to book an appointment"
                : "Selected clinic is highlighted below"}
            </p>
          ) : null}
          {practices.map((p) => (
            <PracticeCard
              key={p.id}
              practice={p}
              selected={p.id === selectedPracticeId}
              selectable={multiplePractices}
              onSelect={() => onSelectPractice(p.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TextListSection({ title, items }: Readonly<{ title: string; items: readonly string[] }>) {
  return (
    <div className="ndp-block">
      <h3 className="ndp-section-title">{title}</h3>
      {items.map((item) => (
        <p key={item} className="ndp-list-item">
          <span>•</span>
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

function RatingsCard({ reviews }: Readonly<{ reviews: DoctorReviewsSummary }>) {
  return (
    <div className="ndp-card">
      <div className="ndp-ratings-head">
        <span aria-hidden="true">👍</span>
        <span>Ratings &amp; reviews</span>
      </div>
      <div className="ndp-ratings-row">
        {reviews.percentage > 0 ? (
          <div className="ndp-ratings-pct">{reviews.percentage}%</div>
        ) : null}
        <div className="ndp-ratings-copy">
          {reviews.percentage > 0 ? (
            <strong>{reviews.percentage}% patient recommendation</strong>
          ) : null}
          {reviews.recommendation > 0 ? (
            <span>
              {reviews.percentage > 0 ? <br /> : null}
              {reviews.recommendation} patients recommended this doctor
            </span>
          ) : null}
          {reviews.responseCount > 0 ? (
            <span>
              <br />
              Based on {reviews.responseCount} patient reviews
            </span>
          ) : null}
        </div>
      </div>
      {reviews.percentage > 0 ? (
        <div className="ndp-progress" aria-hidden="true">
          <div
            className="ndp-progress__bar"
            style={{ width: `${Math.min(100, Math.max(0, reviews.percentage))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function PracticeCard({
  practice,
  selected,
  selectable,
  onSelect,
}: Readonly<{
  practice: DoctorPractice;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
}>) {
  const daysLabel = practice.timings
    ? formatPracticeDaysLabel(practice.timings.availableDays)
    : "";
  const timingText =
    practice.doctorPracticeTimings ||
    (practice.timings?.hoursLabel
      ? `${practice.timings.hoursLabel}${daysLabel ? ` · ${daysLabel}` : ""}`
      : "");

  const className = [
    "ndp-practice",
    selectable ? "ndp-practice--selectable" : "",
    selected ? "ndp-practice--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <div className="ndp-practice__top">
        {selectable ? (
          <input
            type="radio"
            className="ndp-practice__radio"
            checked={selected}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : null}
        <div className="ndp-practice__name-row">
          {selected && selectable ? (
            <div className="ndp-practice__selected-tag">Selected for booking</div>
          ) : null}
          <p className="ndp-practice__name">{practice.name}</p>
        </div>
        {practice.doctorConsultationFee ? (
          <span className="ndp-practice__fee">{practice.doctorConsultationFee}</span>
        ) : null}
      </div>
      {practice.fullAddress ? (
        <div className="ndp-practice__row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12 22s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span className="ndp-practice__row-text">{practice.fullAddress}</span>
          {practice.directionsUrl ? (
            <a
              className="ndp-directions"
              href={practice.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open directions"
              onClick={(e) => e.stopPropagation()}
            >
              <MaterialIcon name={MATERIAL_ICON_DIRECTIONS} size={20} />
            </a>
          ) : null}
        </div>
      ) : null}
      {timingText ? (
        <div className="ndp-practice__row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="ndp-practice__row-text">{timingText}</span>
        </div>
      ) : null}
    </>
  );

  if (selectable) {
    return (
      <button type="button" className={className} onClick={onSelect}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

function ReviewsPanel({
  loading,
  error,
  reviews,
  onRetry,
}: Readonly<{
  loading: boolean;
  error: string | null;
  reviews: readonly NetworkDoctorCustomerReview[];
  onRetry: () => void;
}>) {
  if (loading) {
    return <div className="ndp-center">Loading reviews…</div>;
  }
  if (error) {
    return (
      <div className="ndp-center">
        <p>{error}</p>
        <button type="button" className="ndp-retry" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (reviews.length === 0) {
    return <div className="ndp-center">No patient reviews yet</div>;
  }
  return (
    <div className="ndp-panel">
      {reviews.map((r) => (
        <div key={`${r.reviewedOn}-${r.reviewText.slice(0, 24)}`} className="ndp-card ndp-review-card">
          <div className="ndp-review-head">
            <span aria-hidden="true">“</span>
            <span className="ndp-review-author">
              {r.anonymous ? "Anonymous patient" : "Verified patient"}
            </span>
            {r.reviewedOn ? (
              <span className="ndp-review-date">{formatReviewDate(r.reviewedOn)}</span>
            ) : null}
          </div>
          <p className="ndp-review-text">{r.reviewText}</p>
        </div>
      ))}
    </div>
  );
}
