import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, generatePath, useLocation, useNavigate } from "react-router-dom";
import {
  deletePatientAddress,
  fetchAllPatientAddresses,
  formatAddressCityLine,
  formatAddressFull,
  formatAddressTagLabel,
  setPatientAddressPrimary,
  type PatientAddressRecord,
} from "@/api/patientAddress";
import { DeleteAddressConfirmModal } from "@/components/address/DeleteAddressConfirmModal";
import { useAppConfirm } from "@/components/dialog/AppConfirmDialog";
import { ROUTES } from "@/constants";
import { clearSelectedAddress } from "@/constants/selectedAddressStorage";
import { useToast } from "@/hooks/useToast";
import "./ProfileManagePage.css";
import "./ProfileAddressPage.css";

function HomeTagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkTagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20V8l8-4 8 4v12M9 20v-5h6v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LocationTagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.5 7-10a7 7 0 10-14 0c0 5.5 7 10 7 10z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TagIcon({ tag }: Readonly<{ tag: string }>) {
  const t = tag.trim().toUpperCase();
  if (t === "HOME") return <HomeTagIcon />;
  if (t === "WORK") return <WorkTagIcon />;
  return <LocationTagIcon />;
}

function VerifiedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l2.4 4.8 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.6l5.4-.8L12 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type AddressBookCardProps = Readonly<{
  address: PatientAddressRecord;
  busy: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
}>;

function AddressBookCard({ address, busy, onSetPrimary, onDelete }: AddressBookCardProps) {
  const isPrimary = address.isPrimary;
  const cityLine = formatAddressCityLine(address);
  const fullAddress = formatAddressFull(address);

  return (
    <article
      className={`addr-book-card${isPrimary ? " addr-book-card--primary" : ""}`}
    >
      <header className="addr-book-card__header">
        <span
          className={`addr-book-card__icon${isPrimary ? " addr-book-card__icon--primary" : ""}`}
          aria-hidden
        >
          <TagIcon tag={address.tag} />
        </span>
        <div className="addr-book-card__head-text">
          <div className="addr-book-card__title-row">
            <span className="addr-book-card__tag">{formatAddressTagLabel(address.tag)}</span>
            {isPrimary ? <span className="addr-book-card__primary-pill">Primary</span> : null}
          </div>
          {cityLine ? <p className="addr-book-card__city">{cityLine}</p> : null}
        </div>
      </header>
      <div className="addr-book-card__body">
        <p className="addr-book-card__address">{fullAddress || "—"}</p>
        <div className="addr-book-card__actions">
          {!isPrimary ? (
            <button
              type="button"
              className="addr-book-chip addr-book-chip--warn"
              disabled={busy}
              onClick={onSetPrimary}
            >
              <span className="addr-book-chip__icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2l2.2 6.7H21l-5.5 4 2.1 6.6L12 15.8 6.4 19.3l2.1-6.6L3 8.7h6.8L12 2z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Set Primary
            </button>
          ) : null}
          <Link
            to={generatePath(ROUTES.profileAddressEdit, { addressId: address.id })}
            className="addr-book-chip addr-book-chip--info"
            aria-label="Edit address"
          >
            <span className="addr-book-chip__icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 16.5V20h3.5L17.5 10 14 6.5 4 16.5zM14 6.5l2-2 3.5 3.5-2 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Edit
          </Link>
          <button
            type="button"
            className="addr-book-chip addr-book-chip--danger"
            disabled={busy}
            onClick={onDelete}
          >
            <span className="addr-book-chip__icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Delete
          </button>
          {isPrimary ? (
            <span className="addr-book-card__verified" aria-label="Primary address">
              <VerifiedIcon />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProfileAddressPage() {
  const toast = useToast();
  const appConfirm = useAppConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const [list, setList] = useState<PatientAddressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientAddressRecord | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchAllPatientAddresses();
      setList(data);
      if (data.length === 0) clearSelectedAddress();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load addresses");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath);
    } else {
      navigate(ROUTES.profile);
    }
  }, [location.state, navigate]);

  const goAddAddress = useCallback(() => {
    navigate(ROUTES.profileAddressAdd);
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const a = deleteTarget;
    setBusyId(a.id);
    try {
      await deletePatientAddress(a.id);
      setDeleteTarget(null);
      toast.success("Address removed.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusyId(null);
    }
  }, [deleteTarget, load, toast]);

  const handleSetPrimary = useCallback(
    (address: PatientAddressRecord) => {
      if (address.isPrimary) return;
      void (async () => {
        const tagLabel = formatAddressTagLabel(address.tag);
        const linePreview = address.line1.trim() || formatAddressFull(address);
        const ok = await appConfirm({
          title: "Set primary address?",
          message: `Use your ${tagLabel} address at ${linePreview} as the default for deliveries and bookings?`,
          confirmLabel: "Set as primary",
          cancelLabel: "Cancel",
        });
        if (!ok) return;
        setBusyId(address.id);
        try {
          await setPatientAddressPrimary(address.id);
          toast.success("Primary address updated.");
          await load();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not update primary");
        } finally {
          setBusyId(null);
        }
      })();
    },
    [appConfirm, load, toast],
  );

  let mainContent: ReactNode;
  if (loading && list.length === 0) {
    mainContent = (
      <div className="addr-book-loading" aria-busy="true">
        <span className="addr-book-loading__spinner" />
        <p className="addr-book-loading__text">Loading addresses...</p>
      </div>
    );
  } else if (!loading && error) {
    mainContent = (
      <div className="addr-book-error">
        <p className="addr-book-error__text">{error}</p>
        <button type="button" className="addr-book-error__retry" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  } else if (!loading && !error && list.length === 0) {
    mainContent = (
      <div className="addr-book-empty">
        <div className="addr-book-empty__illus" aria-hidden>
          <span className="addr-book-empty__dot addr-book-empty__dot--1" />
          <span className="addr-book-empty__dot addr-book-empty__dot--2" />
          <span className="addr-book-empty__dot addr-book-empty__dot--3" />
          <span className="addr-book-empty__pin">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s7-4.5 7-10a7 7 0 10-14 0c0 5.5 7 10 7 10z"
                fill="currentColor"
                fillOpacity="0.15"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="11" r="2.5" fill="currentColor" />
            </svg>
            <span className="addr-book-empty__pin-badge" />
          </span>
        </div>
        <h2 className="addr-book-empty__title">No addresses yet</h2>
        <p className="addr-book-empty__subtitle">
          Add your first address to get started
          <br />
          with quick deliveries and appointments.
        </p>
        <button type="button" className="addr-book-empty__cta" onClick={goAddAddress}>
          <span className="addr-book-empty__cta-icon" aria-hidden>
            +
          </span>
          Add Address
        </button>
      </div>
    );
  } else {
    mainContent = (
      <ul className="addr-book-list">
        {list.map((a) => (
          <li key={a.id}>
            <AddressBookCard
              address={a}
              busy={busyId !== null}
              onSetPrimary={() => handleSetPrimary(a)}
              onDelete={() => setDeleteTarget(a)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="profile-manage-page addr-book-page">
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={handleBack}
          className="profile-manage-page__back"
          aria-label="Back"
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
        </button>
        <h1 className="profile-manage-page__title addr-book-page__title">My Addresses</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="addr-book-page__main">{mainContent}</main>

      <footer className="addr-book-page__footer">
        <button type="button" className="addr-book-page__add-new" onClick={goAddAddress}>
          <span className="addr-book-page__add-new-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Add New Address
        </button>
      </footer>

      <DeleteAddressConfirmModal
        open={deleteTarget !== null}
        tag={deleteTarget ? formatAddressTagLabel(deleteTarget.tag) : ""}
        addressPreview={deleteTarget ? deleteTarget.line1 : null}
        confirming={deleteTarget !== null && busyId === deleteTarget.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
