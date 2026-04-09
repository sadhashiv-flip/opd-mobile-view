import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAllPatientBankRecords, hasAnyPatientBanks } from "@/api/patientBankDetails";
import { fetchAllPatientAddresses, hasAnySavedAddresses } from "@/api/patientAddress";
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
import { InfoGrid, type InfoGridItem } from "@/components/profile/page/InfoGrid";
import { ProfileCard } from "@/components/profile/page/ProfileCard";
import { ProfileHeader } from "@/components/profile/page/ProfileHeader";
import {
  SettingsList,
  type ManageLinkItem,
} from "@/components/profile/page/SettingsList";
import {
  formatDobAgeGenderLine,
  formatGender,
  formatLabel,
  initialsFromName,
} from "@/components/profile/page/profilePageUtils";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import {
  clearClientStorageOnUnauthorized,
  clearSession,
} from "@/lib/authStorage";
import "./ProfilePage.css";

function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 3h3l1.5 4.5-2 1.5a12 12 0 006 6l1.5-2L21 14.5V18a2 2 0 01-2.2 2A17 17 0 013 5.2 2 2 0 015 3h1.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 20v-1c0-3 2.5-5 7-5s7 2 7 5v1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDroplet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21c4.5-3.5 7-6.5 7-10a7 7 0 10-14 0c0 3.5 2.5 6.5 7 10z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="8"
        width="18"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3a16 16 0 010 18M12 3a16 16 0 000 18"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function buildInfoGridItems(profile: ProfileDisplay): InfoGridItem[] {
  const rows: (InfoGridItem | null)[] = [
    profile.phone
      ? {
          key: "phone",
          icon: <IconPhone />,
          label: "Phone",
          value: profile.phone,
        }
      : null,
    formatDobAgeGenderLine(profile.dob, profile.age)
      ? {
          key: "dob",
          icon: <IconCalendar />,
          label: "Birth",
          value: formatDobAgeGenderLine(profile.dob, profile.age) ?? "",
        }
      : null,
    formatGender(profile.gender)
      ? {
          key: "gender",
          icon: <IconUser />,
          label: "Gender",
          value: formatGender(profile.gender) ?? "",
        }
      : null,
    profile.bloodGroup
      ? {
          key: "blood",
          icon: <IconDroplet />,
          label: "Blood",
          value: profile.bloodGroup,
        }
      : null,
    profile.occupation
      ? {
          key: "occupation",
          icon: <IconBriefcase />,
          label: "Work",
          value: profile.occupation,
        }
      : null,
    formatLabel(profile.language)
      ? {
          key: "language",
          icon: <IconGlobe />,
          label: "Language",
          value: formatLabel(profile.language) ?? "",
        }
      : null,
  ];
  return rows.filter((r): r is InfoGridItem => r != null);
}

export function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const accountAnchorRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<ProfileDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [manageExtras, setManageExtras] = useState({ bank: false, address: false });
  const [manageOpen, setManageOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, banksRes, addrRes] = await Promise.allSettled([
        fetchPatientProfile(),
        fetchAllPatientBankRecords(),
        fetchAllPatientAddresses(),
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

  const infoItems = useMemo(
    () => (profile ? buildInfoGridItems(profile) : []),
    [profile],
  );

  const subline = useMemo(() => {
    if (!profile) return null;
    return formatLabel(profile.relationship);
  }, [profile]);

  const manageLinks: ManageLinkItem[] = useMemo(
    () => [
      {
        to: ROUTES.profileBank,
        title: "Bank details",
        meta: bankSaved ? "Saved on device" : null,
      },
      {
        to: ROUTES.profileAddress,
        title: "Address",
        meta: addressSaved ? "Saved on device" : null,
      },
      {
        to: ROUTES.profileMembers,
        title: "Members",
        meta: "Family & dependents",
      },
      {
        to: ROUTES.profileSubscriptions,
        title: "Subscriptions",
        meta: "Plans & billing",
      },
    ],
    [addressSaved, bankSaved],
  );

  const openAccountSettings = useCallback(() => {
    setAccountOpen(true);
    setManageOpen(false);
    requestAnimationFrame(() => {
      accountAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

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
          <div className="profile-page__state profile-page__state--skeleton" aria-busy="true">
            <div className="profile-page__skeleton-row">
              <div className="profile-page__skeleton profile-page__skeleton--avatar-sm" />
              <div className="profile-page__skeleton-col">
                <div className="profile-page__skeleton profile-page__skeleton--line lg" />
                <div className="profile-page__skeleton profile-page__skeleton--line sm" />
              </div>
            </div>
            <div className="profile-page__skeleton profile-page__skeleton--grid" />
            <div className="profile-page__skeleton profile-page__skeleton--sheet" />
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
            <ProfileHeader
              name={profile.name}
              imageUrl={imageUrl}
              initials={initialsFromName(profile.name)}
              email={profile.email}
              subline={subline}
              empId={profile.empId}
              bmiValue={profile.bmi}
              bmiCategory={profile.bmiCategory}
              editTo={ROUTES.userDetailsPersonal}
              onOpenSettings={openAccountSettings}
            />

            {infoItems.length > 0 ? (
              <ProfileCard ariaLabel="Contact and health details">
                <InfoGrid items={infoItems} />
              </ProfileCard>
            ) : null}

            <div ref={accountAnchorRef}>
              <ProfileCard className="profile-page__sheet--flush">
                <SettingsList
                  manageOpen={manageOpen}
                  onManageOpenChange={setManageOpen}
                  manageLinks={manageLinks}
                  accountOpen={accountOpen}
                  onAccountOpenChange={setAccountOpen}
                  accountActions={
                    <>
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
                    </>
                  }
                />
              </ProfileCard>
            </div>
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
