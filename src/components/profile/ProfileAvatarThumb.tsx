import { HomeProfileIcon } from "@/assets/icons/react";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { useCachedProfileAvatar } from "@/hooks/useCachedProfileAvatar";
import { useEffect, useMemo, useState } from "react";
import "./ProfileAvatarThumb.css";

type ProfileAvatarThumbProps = Readonly<{
  size?: number;
  onPress?: () => void;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}>;

function profilePhotoUrl(imagePath: string | null): string | null {
  if (imagePath == null) return null;
  const value = imagePath.trim();
  if (!value || value.toLowerCase() === "null") return null;
  if (value.startsWith("blob:")) return value;
  return resolveProfileImageUrl(value);
}

/**
 * Dashboard header avatar — mirrors patient-app `ProfileAvatarThumb`:
 * local/blob → photo; server path → photo (initials while loading, icon on error); else profile icon.
 */
export function ProfileAvatarThumb({
  size = 40,
  onPress,
  className,
  "aria-label": ariaLabel = "Profile",
  disabled = false,
}: ProfileAvatarThumbProps) {
  const { imagePath, initials } = useCachedProfileAvatar();
  const photoUrl = useMemo(() => profilePhotoUrl(imagePath), [imagePath]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [photoUrl]);

  const showPhoto = photoUrl != null && !failed;
  const showInitialsPlaceholder = showPhoto && !loaded;
  const iconSize = Math.round(size * 0.5);

  const photoClass = loaded
    ? "profile-avatar-thumb__photo profile-avatar-thumb__photo--ready"
    : "profile-avatar-thumb__photo";

  return (
    <button
      type="button"
      className={className ? `profile-avatar-thumb ${className}` : "profile-avatar-thumb"}
      style={{ width: size, height: size }}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onPress}
    >
      {showPhoto ? (
        <span
          className="profile-avatar-thumb__ring"
          style={{ width: size, height: size }}
        >
          {showInitialsPlaceholder ? (
            <span
              className="profile-avatar-thumb__initials"
              style={{ fontSize: size * 0.34 }}
              aria-hidden
            >
              {initials}
            </span>
          ) : null}
          <img
            className={photoClass}
            src={photoUrl}
            alt=""
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </span>
      ) : (
        <HomeProfileIcon
          className="profile-avatar-thumb__icon"
          width={iconSize}
          height={iconSize}
        />
      )}
    </button>
  );
}
