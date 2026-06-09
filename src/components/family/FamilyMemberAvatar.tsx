import { resolveProfileImageUrl } from "@/api/patientProfile";
import { memberInitial } from "@/lib/familyMemberDisplay";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./FamilyMemberAvatar.css";

type FamilyMemberAvatarProps = Readonly<{
  name: string;
  image: string | null | undefined;
  variant?: "list" | "detail";
  className?: string;
}>;

function memberPhotoUrl(imagePath: string | null | undefined): string | null {
  if (imagePath == null) return null;
  const value = imagePath.trim();
  if (!value || value.toLowerCase() === "null") return null;
  if (value.startsWith("blob:") || /^https?:\/\//i.test(value)) return value;
  return resolveProfileImageUrl(value);
}

function isImageAlreadyLoaded(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

export function FamilyMemberAvatar({
  name,
  image,
  variant = "list",
  className,
}: FamilyMemberAvatarProps) {
  const photoUrl = useMemo(() => memberPhotoUrl(image), [image]);
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
  const initial = memberInitial(name);
  const rootClass = [
    "family-member-avatar",
    `family-member-avatar--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} aria-hidden>
      {showPhoto ? (
        <>
          {!loaded ? (
            <span className="family-member-avatar__initials">{initial}</span>
          ) : null}
          <img
            ref={assignPhotoRef}
            className={
              loaded
                ? "family-member-avatar__photo family-member-avatar__photo--ready"
                : "family-member-avatar__photo"
            }
            src={photoUrl}
            alt=""
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </>
      ) : (
        <span className="family-member-avatar__initials">{initial}</span>
      )}
    </div>
  );
}
