import { useEffect, useState } from "react";
import { resolveProfileImageUrl } from "@/api/patientProfile";

type ProfileHeaderProps = Readonly<{
  name: string;
  profileImage: string | null;
  initials: string;
  empId: string | null;
  onViewProfilePhoto?: () => void;
  onChangeProfilePhoto?: () => void;
  profileImageBusy?: boolean;
}>;

function IconCamera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h3l1.5-3h7L17 8h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function ProfileHeader({
  name,
  profileImage,
  initials,
  empId,
  onViewProfilePhoto,
  onChangeProfilePhoto,
  profileImageBusy = false,
}: ProfileHeaderProps) {
  const resolvedAvatarUrl = resolveProfileImageUrl(profileImage);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [profileImage]);

  const showAvatarImage = resolvedAvatarUrl != null && !imageFailed;

  return (
    <header className="profile-page__hero" aria-labelledby="profile-name">
      <div className="profile-page__hero-main">
        <div className="profile-page__avatar-block">
          <button
            type="button"
            className="profile-page__avatar-btn"
            aria-label="View profile photo"
            disabled={profileImageBusy || !onViewProfilePhoto}
            onClick={() => onViewProfilePhoto?.()}
          >
            <div className="profile-page__avatar-wrap">
              {showAvatarImage ? (
                <img
                  className="profile-page__avatar"
                  src={resolvedAvatarUrl}
                  alt=""
                  decoding="async"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="profile-page__avatar profile-page__avatar--initials" aria-hidden>
                  {initials}
                </div>
              )}
            </div>
            {profileImageBusy ? (
              <span className="profile-page__avatar-busy" aria-hidden />
            ) : null}
          </button>
          {onChangeProfilePhoto && !profileImageBusy ? (
            <button
              type="button"
              className="profile-page__avatar-edit-badge"
              aria-label="Update profile photo"
              onClick={() => onChangeProfilePhoto()}
            >
              <IconCamera />
            </button>
          ) : null}
        </div>
        <div className="profile-page__hero-copy">
          <h2 id="profile-name" className="profile-page__name">
            {name}
          </h2>
          {empId ? (
            <p className="profile-page__emp-badge">
              <span className="profile-page__emp-badge-label">EMP ID :</span> {empId}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
