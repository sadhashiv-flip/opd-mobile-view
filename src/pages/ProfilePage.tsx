import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAllPatientBankRecords, hasAnyPatientBanks } from "@/api/patientBankDetails";
import { fetchPatientAddresses, hasAnySavedAddresses } from "@/api/patientAddress";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { changePatientPassword } from "@/api/patientPassword";
import { requestProfileDeletion } from "@/api/patientProfileDelete";
import {
  fetchPatientProfile,
  resolveProfileImageUrl,
  type BmiCategory,
  type ProfileDisplay,
} from "@/api/patientProfile";
import {
  ChangePasswordModal,
  DeleteAccountModal,
  ForgotPasswordModal,
} from "@/components/profile";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import {
  clearClientStorageOnUnauthorized,
  clearSession,
} from "@/lib/authStorage";
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

function HeroBmi({
  value,
  category,
}: Readonly<{ value: string | null; category: BmiCategory | null }>) {
  if (!value) return null;
  const toneClass = category
    ? `profile-page__bmi-value--${category}`
    : "profile-page__bmi-value--neutral";
  return (
    <p className="profile-page__hero-bmi">
      <span className="profile-page__hero-bmi-label">BMI</span>
      <span className={`profile-page__hero-bmi-value profile-page__bmi-value ${toneClass}`}>
        {value}
      </span>
    </p>
  );
}

function formatGender(g: string | null): string | null {
  if (!g) return null;
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}

function parseAgeYears(ageStr: string | null): number | null {
  if (ageStr == null || ageStr === "") return null;
  const n = Math.trunc(Number(ageStr.trim()));
  if (Number.isNaN(n) || n < 0 || n >= 150) return null;
  return n;
}

function ageFromDob(dob: string | null): number | null {
  if (dob == null || dob.trim() === "") return null;
  const d = new Date(dob.trim());
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    years -= 1;
  }
  if (years < 0 || years >= 130) return null;
  return years;
}

/** e.g. `1994-04-09 (31 Years Old) / Male` */
function formatDobAgeGenderLine(
  dob: string | null,
  age: string | null,
): string | null {
  const years = parseAgeYears(age) ?? ageFromDob(dob);
  const dobTrim = dob?.trim() ?? "";

  let line = dobTrim;
  if (years != null) {
    line += line ? ` (${years} Years Old)` : `(${years} Years Old)`;
  }
 
  return line.length > 0 ? line : null;
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
  const [manageExtras, setManageExtras] = useState({ bank: false, address: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, banksRes, addrRes] = await Promise.allSettled([
        fetchPatientProfile(),
        fetchAllPatientBankRecords(),
        fetchPatientAddresses(),
      ]);

      if (profRes.status === "rejected") {
        const err = profRes.reason;
        throw err instanceof Error ? err : new Error(String(err));
      }
      setProfile(profRes.value);

      const banks = banksRes.status === "fulfilled" ? banksRes.value : [];
      const addresses = addrRes.status === "fulfilled" ? addrRes.value : [];
      setManageExtras({
        bank: hasAnyPatientBanks(banks),
        address: hasAnySavedAddresses(addresses),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load profile";
      setError(msg);
      setProfile(null);
      setManageExtras({ bank: false, address: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const imageUrl = profile ? resolveProfileImageUrl(profile.image) : null;

  const bankSaved = manageExtras.bank;
  const addressSaved = manageExtras.address;

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
              <p className="profile-page__tagline">
                  {profile.email}
                </p>
              {(profile.relationship || profile.phone) && (
                <p className="profile-page__tagline">
                  {[formatLabel(profile.relationship), profile.phone].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="profile-page__tagline">
                  {profile.empId}
                </p>
              <HeroBmi value={profile.bmi} category={profile.bmiCategory} />
            </section>

            <section className="profile-page__card" aria-label="Your details">
              <h3 className="profile-page__card-title">Your details</h3>
              <div className="profile-page__rows">
                <DetailRow
                  label="Date of birth"
                  value={formatDobAgeGenderLine(
                    profile.dob,
                    profile.age,
                  )}
                />
                <DetailRow label="Gender" value={formatGender(profile.gender)} />
                <DetailRow label="Occupation" value={profile.occupation} />
                <DetailRow label="Blood group" value={profile.bloodGroup} />
                <DetailRow label="Language" value={formatGender(profile.language)} />
              </div>
            </section>

            <section className="profile-page__manage" aria-label="Manage">
              <h3 className="profile-page__card-title">Manage</h3>
              <Link to={ROUTES.profileBank} className="profile-page__manage-row">
                <span className="profile-page__manage-row-main">
                  <span className="profile-page__manage-row-title">Bank details</span>
                  {bankSaved ? (
                    <span className="profile-page__manage-row-meta">Saved on this device</span>
                  ) : null}
                </span>
                <span className="profile-page__manage-row-chevron" aria-hidden>
                  ›
                </span>
              </Link>
              <Link to={ROUTES.profileAddress} className="profile-page__manage-row">
                <span className="profile-page__manage-row-main">
                  <span className="profile-page__manage-row-title">Address</span>
                  {addressSaved ? (
                    <span className="profile-page__manage-row-meta">Saved on this device</span>
                  ) : null}
                </span>
                <span className="profile-page__manage-row-chevron" aria-hidden>
                  ›
                </span>
              </Link>
              <Link to={ROUTES.profileMembers} className="profile-page__manage-row">
                <span className="profile-page__manage-row-main">
                  <span className="profile-page__manage-row-title">Members</span>
                  <span className="profile-page__manage-row-meta">Add and view saved members</span>
                </span>
                <span className="profile-page__manage-row-chevron" aria-hidden>
                  ›
                </span>
              </Link>
              <Link to={ROUTES.profileSubscriptions} className="profile-page__manage-row">
                <span className="profile-page__manage-row-main">
                  <span className="profile-page__manage-row-title">Subscriptions</span>
                  <span className="profile-page__manage-row-meta">Plans from your account</span>
                </span>
                <span className="profile-page__manage-row-chevron" aria-hidden>
                  ›
                </span>
              </Link>
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
                className="profile-page__account-btn profile-page__account-btn--logout"
                onClick={() => {
                  clearClientStorageOnUnauthorized();
                  toast.success("You have been logged out.");
                  navigate(ROUTES.login, { replace: true });
                }}
              >
                Log out
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
