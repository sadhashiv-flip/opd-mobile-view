import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchPatientProfile, updatePatientProfileImage, type ProfileDisplay } from "@/api/patientProfile";
import { requestProfileDeletion } from "@/api/patientProfileDelete";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { DeleteAccountModal } from "@/components/profile";
import { InfoGrid, type InfoGridItem } from "@/components/profile/page/InfoGrid";
import { ProfileCard } from "@/components/profile/page/ProfileCard";
import { ProfileHeader } from "@/components/profile/page/ProfileHeader";
import { ProfileNavList, type ProfileNavItem } from "@/components/profile/page/ProfileNavList";
import { ProfilePhotoSourceSheet } from "@/components/profile/page/ProfilePhotoSourceSheet";
import {
  formatProfileDob,
  formatProfilePhone,
  initialsFromName,
} from "@/components/profile/page/profilePageUtils";
import accountAddressBookSvg from "@/assets/icons/patient-app/hub/account_management/address_book.svg";
import accountFamilyAccountsSvg from "@/assets/icons/patient-app/hub/account_management/family_account.svg";
import accountSubscriptionsSvg from "@/assets/icons/patient-app/hub/account_management/subscriptions.svg";
import helpFaqSvg from "@/assets/icons/patient-app/hub/help_and_support/faq.svg";
import helpPrivacyAndPoliciesSvg from "@/assets/icons/patient-app/hub/help_and_support/privacy_policy.svg";
import helpTandCSvg from "@/assets/icons/patient-app/hub/help_and_support/terms_and_conditions.svg";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { clearClientStorageOnUnauthorized } from "@/lib/authStorage";
import "./ProfilePage.css";

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

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

function IconEnvelope() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildPersonalInfoItems(profile: ProfileDisplay): InfoGridItem[] {
  const rows: InfoGridItem[] = [
    {
      key: "name",
      icon: <IconUser />,
      label: "Full Name",
      value: profile.name,
    },
  ];

  const dob = formatProfileDob(profile.dob);
  if (dob) {
    rows.push({
      key: "dob",
      icon: <IconCalendar />,
      label: "Date of Birth",
      value: dob,
    });
  }

  if (profile.bloodGroup) {
    rows.push({
      key: "blood",
      icon: <IconDroplet />,
      label: "Blood Group",
      value: profile.bloodGroup,
      valueTone: "blood",
    });
  }

  const phone = formatProfilePhone(profile.phone);
  if (phone) {
    rows.push({
      key: "phone",
      icon: <IconPhone />,
      label: "Mobile Number",
      value: phone,
      valueTone: "contact",
    });
  }

  if (profile.email) {
    rows.push({
      key: "email",
      icon: <IconEnvelope />,
      label: "Email Address",
      value: profile.email,
      valueTone: "contact",
    });
  }

  return rows;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [profileImageBusy, setProfileImageBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const prof = await fetchPatientProfile();
      setProfile(prof);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load profile";
      setError(msg);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const infoItems = useMemo(() => (profile ? buildPersonalInfoItems(profile) : []), [profile]);

  const accountNavItems: ProfileNavItem[] = useMemo(
    () => [
      {
        key: "address",
        title: "Saved Address",
        to: ROUTES.profileAddress,
        iconSrc: accountAddressBookSvg,
      },
      {
        key: "subscriptions",
        title: "Subscriptions",
        to: ROUTES.profileSubscriptions,
        iconSrc: accountSubscriptionsSvg,
      },
      {
        key: "members",
        title: "Members",
        to: ROUTES.profileMembers,
        iconSrc: accountFamilyAccountsSvg,
      },
    ],
    [],
  );

  const supportNavItems: ProfileNavItem[] = useMemo(
    () => [
      {
        key: "faq",
        title: "FAQs",
        to: ROUTES.servicesHelpTab,
        iconSrc: helpFaqSvg,
      },
      {
        key: "terms",
        title: "Terms & Conditions",
        to: ROUTES.servicesHelpTab,
        iconSrc: helpTandCSvg,
      },
      {
        key: "privacy",
        title: "Privacy Policy",
        to: ROUTES.servicesHelpTab,
        iconSrc: helpPrivacyAndPoliciesSvg,
      },
    ],
    [],
  );

  const handleProfilePhotoPicked = useCallback(
    async (file: File) => {
      setProfileImageBusy(true);
      try {
        const next = await updatePatientProfileImage(file);
        setProfile(next);
        toast.success("Profile photo updated.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update profile photo");
      } finally {
        setProfileImageBusy(false);
      }
    },
    [toast],
  );

  const handleLogout = useCallback(() => {
    clearClientStorageOnUnauthorized();
    toast.success("You have been logged out.");
    navigate(ROUTES.login, { replace: true });
  }, [navigate, toast]);

  return (
    <div className="profile-page">
      <header className="profile-page__top">
        <Link to={ROUTES.dashboard} className="profile-page__back" aria-label="Back to home">
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
              <div className="profile-page__skeleton profile-page__skeleton--avatar" />
              <div className="profile-page__skeleton-col">
                <div className="profile-page__skeleton profile-page__skeleton--line lg" />
                <div className="profile-page__skeleton profile-page__skeleton--line sm" />
              </div>
            </div>
            <div className="profile-page__skeleton profile-page__skeleton--sheet" />
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
              profileImage={profile.image}
              initials={initialsFromName(profile.name)}
              empId={profile.empId}
              onChangeProfilePhoto={() => setPhotoSheetOpen(true)}
              profileImageBusy={profileImageBusy}
            />

            <ProfileCard title="Personal Information" titleId="profile-personal-info-title">
              <InfoGrid items={infoItems} />
            </ProfileCard>

            <ProfileCard title="Account & Settings" titleId="profile-account-settings-title">
              <ProfileNavList items={accountNavItems} />
            </ProfileCard>

            <ProfileCard title="Support" titleId="profile-support-title">
              <ProfileNavList items={supportNavItems} />
            </ProfileCard>

            <button type="button" className="profile-page__logout-btn" onClick={handleLogout}>
              <IconLogout />
              Logout
            </button>

            {/* <button
              type="button"
              className="profile-page__delete-link"
              onClick={() => setDeleteAccountOpen(true)}
            >
              Delete account
            </button> */}
          </>
        ) : null}
      </main>

      <ProfilePhotoSourceSheet
        open={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onPicked={(file) => void handleProfilePhotoPicked(file)}
      />

      <DeleteAccountModal
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirmDelete={async (feedback) => {
          try {
            await requestProfileDeletion({ feedback });
            setDeleteAccountOpen(false);
            clearClientStorageOnUnauthorized();
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

