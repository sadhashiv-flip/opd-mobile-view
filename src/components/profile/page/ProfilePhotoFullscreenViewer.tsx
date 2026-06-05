import { useEffect, useState } from "react";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { getMobileFrameRoot, portalToMobileFrame } from "@/lib/mobileFramePortal";
import "./ProfilePhotoFullscreenViewer.css";

export type ProfilePhotoFullscreenViewerProps = Readonly<{
  open: boolean;
  onClose: () => void;
  profileImage: string | null;
  initials: string;
  name: string;
  onEdit: () => void;
  busy?: boolean;
}>;

function IconBack() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function ProfilePhotoFullscreenViewer({
  open,
  onClose,
  profileImage,
  initials,
  name,
  onEdit,
  busy = false,
}: ProfilePhotoFullscreenViewerProps) {
  const resolvedAvatarUrl = resolveProfileImageUrl(profileImage);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [profileImage]);

  useEffect(() => {
    if (!open) return;
    const frame = getMobileFrameRoot();
    const prev = frame.style.overflow;
    frame.style.overflow = "hidden";
    return () => {
      frame.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const showAvatarImage = resolvedAvatarUrl != null && !imageFailed;

  return portalToMobileFrame(
    <div
      className="profile-photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-photo-viewer-title"
    >
      <header className="profile-photo-viewer__header">
        <button
          type="button"
          className="profile-photo-viewer__back"
          onClick={onClose}
          aria-label="Close profile photo"
        >
          <IconBack />
        </button>
        <h2 id="profile-photo-viewer-title" className="profile-photo-viewer__title">
          {name}
        </h2>
        <span className="profile-photo-viewer__header-spacer" aria-hidden />
      </header>

      <div className="profile-photo-viewer__stage">
        {showAvatarImage ? (
          <img
            className="profile-photo-viewer__image"
            src={resolvedAvatarUrl}
            alt={name}
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="profile-photo-viewer__initials" aria-label={name}>
            {initials}
          </div>
        )}
        {busy ? <span className="profile-photo-viewer__busy" aria-hidden /> : null}
      </div>

      <button
        type="button"
        className="profile-photo-viewer__edit"
        onClick={onEdit}
        disabled={busy}
        aria-label="Update profile photo"
      >
        <IconCamera />
      </button>
    </div>,
  );
}
