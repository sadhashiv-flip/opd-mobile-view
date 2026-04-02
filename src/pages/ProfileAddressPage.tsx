import { useCallback, useEffect, useState } from "react";
import { Link, generatePath, useLocation } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  deletePatientAddress,
  fetchPatientAddresses,
  formatAddressLines,
  setPatientAddressPrimary,
  type PatientAddressRecord,
} from "@/api/patientAddress";
import { DeleteAddressConfirmModal } from "@/components/address/DeleteAddressConfirmModal";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import "./ProfileManagePage.css";
import "./ProfileAddressPage.css";

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16.5V20h3.5L17.5 10 14 6.5 4 16.5zM14 6.5l2-2 3.5 3.5-2 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrimaryCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8 12l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileAddressPage() {
  const toast = useToast();
  const location = useLocation();
  const [list, setList] = useState<PatientAddressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientAddressRecord | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPatientAddresses();
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load addresses");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    (id: string) => {
      setBusyId(id);
      void (async () => {
        try {
          await setPatientAddressPrimary(id);
          toast.success("Primary address updated.");
          await load();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not update primary");
        } finally {
          setBusyId(null);
        }
      })();
    },
    [load, toast],
  );

  return (
    <div className="profile-manage-page">
      <header className="profile-manage-page__top">
        <Link
          to={ROUTES.profile}
          className="profile-manage-page__back"
          aria-label="Back to profile"
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
        <h1 className="profile-manage-page__title">Address</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main">
        <p className="profile-manage-page__intro">
          Saved addresses from your account. Primary is used where a default address is needed.
        </p>

        <div className="profile-address-page__toolbar">
          <Link to={ROUTES.profileAddressAdd} className="profile-address-page__add-btn ">
            + Add address
          </Link>
        </div>

        {loading ? (
          <div className="profile-sub-skeleton" aria-busy="true">
            <div className="profile-sub-skeleton__card" />
            <div className="profile-sub-skeleton__card" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="profile-manage-page__card profile-sub-error">
            <p className="profile-sub-error__text">{error}</p>
            <button type="button" className="profile-manage-page__save" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && list.length === 0 ? (
          <p className="profile-manage-page__hint">No addresses yet. Tap Add address to create one.</p>
        ) : null}

        {!loading && !error && list.length > 0 ? (
          <div className="profile-address-page__grid">
            {list.map((a) => (
              <article key={a.id} className="profile-address-card">
                <div className="profile-address-card__actions">
                  <button
                    type="button"
                    className="profile-address-card__icon-btn profile-address-card__icon-btn--danger"
                    aria-label="Delete address"
                    disabled={busyId === a.id}
                    onClick={() => setDeleteTarget(a)}
                  >
                    <TrashIcon />
                  </button>
                  <Link
                    to={generatePath(ROUTES.profileAddressEdit, { addressId: a.id })}
                    className="profile-address-card__icon-btn"
                    aria-label="Edit address"
                  >
                    <PencilIcon />
                  </Link>
                </div>
                <div className="profile-address-card__body">
                  <p className="profile-address-card__street">{formatAddressLines(a)}</p>
                  <p className="profile-address-card__row">State: {a.state || "—"}</p>
                  <p className="profile-address-card__row">City: {a.city || "—"}</p>
                  <p className="profile-address-card__row">Pincode: {a.pincode || "—"}</p>
                  <span className="profile-address-card__tag">{a.tag}</span>
                </div>
                <div className="profile-address-card__footer">
                  {a.isPrimary ? (
                    <span className="profile-address-card__primary-badge">
                      <PrimaryCheckIcon />
                      Primary
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="profile-address-card__primary-btn"
                      disabled={busyId !== null}
                      onClick={() => handleSetPrimary(a.id)}
                    >
                      Set as Primary
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </main>

      <DeleteAddressConfirmModal
        open={deleteTarget !== null}
        tag={deleteTarget?.tag ?? ""}
        addressPreview={deleteTarget ? formatAddressLines(deleteTarget) : null}
        confirming={deleteTarget !== null && busyId === deleteTarget.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <HomeBottomNav />
    </div>
  );
}
