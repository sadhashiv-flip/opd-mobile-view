import { useEffect, useState } from "react";
import { resolveProfileImageUrl, type BmiCategory } from "@/api/patientProfile";
import { bmiToneClass } from "./profilePageUtils";

type ProfileHeaderProps = Readonly<{
  name: string;
  /** Raw `profile.image` from API; resolved inside this component. */
  profileImage: string | null;
  initials: string;
  email: string | null;
  subline: string | null;
  empId: string | null;
  bmiValue: string | null;
  bmiCategory: BmiCategory | null;
  editTo: string;
  onOpenSettings: () => void;
  /** Opens photo source picker (camera / files). */
  onChangeProfilePhoto?: () => void;
  /** While a new profile image is uploading. */
  profileImageBusy?: boolean;
}>;

function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileHeader({
  name,
  profileImage,
  initials,
  email,
  subline,
  empId,
  bmiValue,
  bmiCategory,
  editTo: _editTo,
  onOpenSettings,
  onChangeProfilePhoto,
  profileImageBusy = false,
}: ProfileHeaderProps) {
  const bmiClass = bmiToneClass(bmiCategory);
  const resolvedAvatarUrl = resolveProfileImageUrl(profileImage);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [profileImage]);

  const showAvatarImage = resolvedAvatarUrl != null && !imageFailed;

  return (
    <header className="profile-page__hero-compact" aria-labelledby="profile-name">
      <div className="profile-page__hero-compact-main">
        <div className="profile-page__avatar-block">
          <button
            type="button"
            className="profile-page__avatar-btn"
            aria-label="Update profile photo"
            disabled={profileImageBusy || !onChangeProfilePhoto}
            onClick={() => onChangeProfilePhoto?.()}
          >
            <div className="profile-page__avatar-wrap profile-page__avatar-wrap--sm">
              {showAvatarImage ? (
                <img
                  className="profile-page__avatar profile-page__avatar--sm"
                  src={resolvedAvatarUrl}
                  alt=""
                  decoding="async"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div
                  className="profile-page__avatar profile-page__avatar--sm profile-page__avatar--initials"
                  aria-hidden
                >
                  {initials}
                </div>
              )}
            </div>
            {profileImageBusy ? (
              <span className="profile-page__avatar-busy" aria-hidden />
            ) : null}
          </button>
          {onChangeProfilePhoto && !profileImageBusy ? (
            <span className="profile-page__avatar-edit-badge" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
                <path
                  d="M4.5 19.5h15M4 16l2-2m0 0l7-7 3 3-7 7H6v-3z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : null}
        </div>
        <div className="profile-page__hero-compact-copy">
          <div className="profile-page__hero-compact-title-row">
            <h2 id="profile-name" className="profile-page__name profile-page__name--compact">
              {name}
            </h2>
            {bmiValue ? (
              <span className={`profile-page__bmi-pill ${bmiClass}`}>
                <span className="profile-page__bmi-pill-label">BMI</span>
                <span className="profile-page__bmi-pill-value">{bmiValue}</span>
              </span>
            ) : null}
          </div>
          {email ? (
            <p className="profile-page__hero-email">{email}</p>
          ) : null}
          {subline ? <p className="profile-page__hero-sub">{subline}</p> : null}
          {empId ? <p className="profile-page__hero-emp">ID {empId}</p> : null}
        </div>
      </div>
      <div className="profile-page__hero-actions">
        {/* <Link
          to={editTo}
          className="profile-page__icon-btn"
          aria-label="Edit profile"
        >
          <IconPencil />
        </Link> */}
        <button
          type="button"
          className="profile-page__icon-btn"
          aria-label="Account and settings"
          onClick={onOpenSettings}
        >
          <IconGear />
        </button>
      </div>
    </header>
  );
}
