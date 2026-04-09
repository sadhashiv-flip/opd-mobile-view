import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type ManageLinkItem = Readonly<{
  to: string;
  title: string;
  meta: string | null;
}>;

type SettingsListProps = Readonly<{
  manageOpen: boolean;
  onManageOpenChange: (open: boolean) => void;
  manageLinks: readonly ManageLinkItem[];
  accountOpen: boolean;
  onAccountOpenChange: (open: boolean) => void;
  accountActions: ReactNode;
}>;

function Chevron({ open }: Readonly<{ open: boolean }>) {
  return (
    <span
      className={`profile-page__disclosure-chevron${open ? " profile-page__disclosure-chevron--open" : ""}`}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function SettingsList({
  manageOpen,
  onManageOpenChange,
  manageLinks,
  accountOpen,
  onAccountOpenChange,
  accountActions,
}: SettingsListProps) {
  return (
    <div className="profile-page__settings-stack">
      <div
        className={`profile-page__disclosure${manageOpen ? " profile-page__disclosure--open" : ""}`}
      >
        <button
          type="button"
          className="profile-page__disclosure-trigger"
          aria-expanded={manageOpen}
          id="profile-manage-trigger"
          onClick={() => onManageOpenChange(!manageOpen)}
        >
          <span className="profile-page__disclosure-trigger-text">Manage</span>
          <Chevron open={manageOpen} />
        </button>
        <section
          className="profile-page__disclosure-panel"
          aria-labelledby="profile-manage-trigger"
          aria-hidden={!manageOpen}
          {...(manageOpen ? {} : { inert: true as const })}
        >
          <div className="profile-page__disclosure-panel-inner">
            <ul className="profile-page__manage-compact">
              {manageLinks.map((row) => (
                <li key={row.to}>
                  <Link to={row.to} className="profile-page__manage-compact-row">
                    <span className="profile-page__manage-compact-main">
                      <span className="profile-page__manage-compact-title">{row.title}</span>
                      {row.meta ? (
                        <span className="profile-page__manage-compact-meta">{row.meta}</span>
                      ) : null}
                    </span>
                    <span className="profile-page__manage-compact-chevron" aria-hidden>
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div
        className={`profile-page__disclosure${accountOpen ? " profile-page__disclosure--open" : ""}`}
      >
        <button
          type="button"
          className="profile-page__disclosure-trigger"
          aria-expanded={accountOpen}
          id="profile-account-trigger"
          onClick={() => onAccountOpenChange(!accountOpen)}
        >
          <span className="profile-page__disclosure-trigger-text">Account</span>
          <Chevron open={accountOpen} />
        </button>
        <section
          className="profile-page__disclosure-panel"
          aria-labelledby="profile-account-trigger"
          aria-hidden={!accountOpen}
          {...(accountOpen ? {} : { inert: true as const })}
        >
          <div className="profile-page__disclosure-panel-inner profile-page__disclosure-panel-inner--account">
            {accountActions}
          </div>
        </section>
      </div>
    </div>
  );
}
