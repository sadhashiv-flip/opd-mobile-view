import { resolveProfileImageUrl } from "@/api/patientProfile";
import { useCachedProfileAvatar } from "@/hooks/useCachedProfileAvatar";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function isImageAlreadyLoaded(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

/**
 * Dashboard header avatar — mirrors patient-app `ProfileAvatarThumb`:
 * photo when available; initials only while the photo loads; profile icon when no photo / on error.
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

  const assignPhotoRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !photoUrl) return;
      if (isImageAlreadyLoaded(img)) {
        setLoaded(true);
        setFailed(false);
      }
    },
    [photoUrl],
  );

  const showPhoto = photoUrl != null && !failed;
  const showInitialsPlaceholder = showPhoto && !loaded;
  const buttonClass = className ? `profile-avatar-thumb ${className}` : "profile-avatar-thumb";
  const photoClass = loaded
    ? "profile-avatar-thumb__photo profile-avatar-thumb__photo--ready"
    : "profile-avatar-thumb__photo";

  return (
    <button
      type="button"
      className={buttonClass}
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
            ref={assignPhotoRef}
            className={photoClass}
            src={photoUrl}
            alt=""
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </span>
      ) : (
        <span
          className="profile-avatar-thumb__ring profile-avatar-thumb__ring--initials"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <span
            className="profile-avatar-thumb__initials profile-avatar-thumb__initials--static"
            style={{ fontSize: size * 0.34 }}
          >
            {initials}
          </span>
        </span>
      )}
    </button>
  );
}
