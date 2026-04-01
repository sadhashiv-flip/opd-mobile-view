import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { changePatientPassword } from "@/api/patientPassword";
import { requestProfileDeletion } from "@/api/patientProfileDelete";
import {
  fetchPatientProfile,
  resolveProfileImageUrl,
  type ProfileDisplay,
} from "@/api/patientProfile";
import {
  ChangePasswordModal,
  DeleteAccountModal,
  ForgotPasswordModal,
} from "@/components/profile";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { clearSession } from "@/lib/authStorage";
import "./ProfilePage.css";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "?";
}

function DetailRow({
  label,
  value,
}: Readonly<{ label: string; value: string | null }>) {
  if (!value) return null;
  return (
    <div className="profile-page__row">
      <span className="profile-page__row-label">{label}</span>
      <span className="profile-page__row-value">{value}</span>
    </div>
  );
}

function formatGender(g: string | null): string | null {
  if (!g) return null;
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}

function formatLabel(s: string | null): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPatientProfile();
      setProfile(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load profile";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const imageUrl = profile ? resolveProfileImageUrl(profile.image) : null;

  return (
    <div className="profile-page">
      <header className="profile-page__top">
        <Link
          to={ROUTES.dashboard}
          className="profile-page__back"
          aria-label="Back to home"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="profile-page__title">Profile</h1>
        <span className="profile-page__top-spacer" aria-hidden />
      </header>

      <main className="profile-page__main">
        {loading ? (
          <div className="profile-page__state" aria-busy="true">
            <div className="profile-page__skeleton profile-page__skeleton--avatar" />
            <div className="profile-page__skeleton profile-page__skeleton--line lg" />
            <div className="profile-page__skeleton profile-page__skeleton--line sm" />
            <div className="profile-page__skeleton profile-page__skeleton--card" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="profile-page__state profile-page__state--error">
            <p className="profile-page__error-text">{error}</p>
            <button type="button" className="profile-page__retry" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && profile && !error ? (
          <>
            <section className="profile-page__hero" aria-labelledby="profile-name">
              <div className="profile-page__avatar-wrap">
                {imageUrl ? (
                  <img
                    className="profile-page__avatar"
                    src={imageUrl}
                    alt={profile.name}
                    decoding="async"
                  />
                ) : (
                  <div
                    className="profile-page__avatar profile-page__avatar--initials"
                    aria-hidden
                  >
                    {initialsFromName(profile.name)}
                  </div>
                )}
              </div>
              <h2 id="profile-name" className="profile-page__name">
                {profile.name}
              </h2>
              {(profile.relationship || profile.phone) && (
                <p className="profile-page__tagline">
                  {[formatLabel(profile.relationship), profile.phone].filter(Boolean).join(" · ")}
                </p>
              )}
            </section>

            <section className="profile-page__card" aria-label="Your details">
              <h3 className="profile-page__card-title">Your details</h3>
              <div className="profile-page__rows">
                <DetailRow label="Phone" value={profile.phone} />
                <DetailRow label="Email" value={profile.email} />
                <DetailRow label="Date of birth" value={profile.dob} />
                <DetailRow label="Age" value={profile.age} />
                <DetailRow label="Gender" value={formatGender(profile.gender)} />
                <DetailRow label="Occupation" value={profile.occupation} />
                <DetailRow label="Blood group" value={profile.bloodGroup} />
                <DetailRow label="Language" value={profile.language} />
                <DetailRow label="Employee ID" value={profile.empId} />
              </div>
            </section>

            <section className="profile-page__account" aria-label="Account">
              <h3 className="profile-page__card-title">Account</h3>
              <button
                type="button"
                className="profile-page__account-btn"
                onClick={() => setChangePasswordOpen(true)}
              >
                Change password
              </button>
              <button
                type="button"
                className="profile-page__account-btn profile-page__account-btn--danger"
                onClick={() => setDeleteAccountOpen(true)}
              >
                Delete account
              </button>
            </section>
          </>
        ) : null}
      </main>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onForgotExternalFlow={() => {
          setChangePasswordOpen(false);
          setForgotPasswordOpen(true);
        }}
        onSubmit={async ({ oldPassword, newPassword, confirmPassword }) => {
          await changePatientPassword({
            current_password: oldPassword,
            new_password: newPassword,
            confirmation_password: confirmPassword,
          });
        }}
      />
      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        onFlowFinished={() => {
          toast.success("Password reset successfully.");
          navigate(ROUTES.dashboard, { replace: true });
        }}
      />
      <DeleteAccountModal
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirmDelete={async (feedback) => {
          try {
            await requestProfileDeletion({ feedback });
            setDeleteAccountOpen(false);
            clearSession();
            toast.success("Your deletion request has been submitted.");
            navigate(ROUTES.login, { replace: true });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not submit deletion request");
            throw e;
          }
        }}
      />

      <HomeBottomNav />
    </div>
  );
}
