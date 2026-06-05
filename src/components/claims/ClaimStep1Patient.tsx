import type { ReactNode } from "react";
import type { PatientBankRecord } from "@/api/patientBankDetails";
import type { MemberDisplay } from "@/api/patientMember";

type ClaimStep1FieldProps = Readonly<{
  id: string;
  label: string;
  optional?: boolean;
  icon: ReactNode;
  children: ReactNode;
}>;

function ClaimStep1Field({ id, label, optional, icon, children }: ClaimStep1FieldProps) {
  return (
    <div className="pbf-field">
      <label className="pbf-field__label" htmlFor={id}>
        {label}
        {optional ? " (optional)" : " *"}
      </label>
      <div className="pbf-field__control">
        <span className="pbf-field__icon" aria-hidden>
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

type ClaimStep1SectionProps = Readonly<{
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}>;

function ClaimStep1Section({ icon, title, hint, children }: ClaimStep1SectionProps) {
  return (
    <section className="claim-step1-section">
      <div className="claim-step1-section__head">
        <span className="claim-step1-section__icon" aria-hidden>
          {icon}
        </span>
        <div className="claim-step1-section__titles">
          <h2 className="claim-step1-section__title">{title}</h2>
          <p className="claim-step1-section__hint">{hint}</p>
        </div>
      </div>
      <div className="claim-step1-section__body">{children}</div>
    </section>
  );
}

const IconPatient = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const IconContact = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconBank = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 21h18M6 21V9l6-4 6 4v12M10 14h4v7h-4v-7z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconEmail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAltPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M16 3h5v5M4 20L21 3M15 9l6-6M4 20l4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export type ClaimStep1PatientProps = Readonly<{
  selectedMember: MemberDisplay | null;
  selectedBank: PatientBankRecord | null;
  memberTag: string;
  bankAccountTail: string;
  phone: string;
  email: string;
  altPhone: string;
  onOpenMemberSheet: () => void;
  onOpenBankSheet: () => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAltPhoneChange: (value: string) => void;
}>;

export function ClaimStep1Patient({
  selectedMember,
  selectedBank,
  memberTag,
  bankAccountTail,
  phone,
  email,
  altPhone,
  onOpenMemberSheet,
  onOpenBankSheet,
  onPhoneChange,
  onEmailChange,
  onAltPhoneChange,
}: ClaimStep1PatientProps) {
  return (
    <div className="claim-step1">
      <p className="claim-step1-intro">
        Tell us who this claim is for, how we can reach you, and where to send your reimbursement.
      </p>

      <ClaimStep1Section
        icon={<IconPatient />}
        title="User"
        hint="Select the family member this claim is for."
      >
        <button
          type="button"
          className="claim-step1-picker"
          aria-label="Choose user"
          onClick={onOpenMemberSheet}
        >
          <span className="claim-step1-picker__icon" aria-hidden>
            <IconPatient />
          </span>
          <span className="claim-step1-picker__main">
            <span className="claim-step1-picker__label">Who is this claim for?</span>
            <span className="claim-step1-picker__value">
              {selectedMember ? selectedMember.name : "Tap to choose a user"}
            </span>
            {selectedMember ? (
              <span className="claim-step1-picker__meta">{memberTag}</span>
            ) : (
              <span className="claim-step1-picker__meta claim-step1-picker__meta--muted">
                Self or a family member on your plan
              </span>
            )}
          </span>
          <span className="claim-step1-picker__chev" aria-hidden>
            <IconChevron />
          </span>
        </button>
      </ClaimStep1Section>

      <ClaimStep1Section
        icon={<IconContact />}
        title="Contact details"
        hint="We’ll send claim status updates to these details."
      >
        <ClaimStep1Field id="claim-phone" label="Phone number" icon={<IconPhone />}>
          <input
            id="claim-phone"
            className="pbf-input"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
          />
        </ClaimStep1Field>
        <ClaimStep1Field id="claim-email" label="Email address" icon={<IconEmail />}>
          <input
            id="claim-email"
            className="pbf-input"
            type="email"
            autoComplete="email"
            placeholder="your.email@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </ClaimStep1Field>
        <ClaimStep1Field id="claim-alt-phone" label="Alternate phone" optional icon={<IconAltPhone />}>
          <input
            id="claim-alt-phone"
            className="pbf-input"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="Optional backup number"
            value={altPhone}
            onChange={(e) => onAltPhoneChange(e.target.value)}
          />
        </ClaimStep1Field>
      </ClaimStep1Section>

      <ClaimStep1Section
        icon={<IconBank />}
        title="Bank details"
        hint="Reimbursement will be credited to this account."
      >
        <button
          type="button"
          className="claim-step1-picker"
          aria-label="Choose bank account"
          onClick={onOpenBankSheet}
        >
          <span className="claim-step1-picker__icon claim-step1-picker__icon--bank" aria-hidden>
            <IconBank />
          </span>
          <span className="claim-step1-picker__main">
            <span className="claim-step1-picker__label">Payout account</span>
            <span className="claim-step1-picker__value">
              {selectedBank
                ? `${selectedBank.bankName} · ****${bankAccountTail}`
                : "Tap to choose a bank account"}
            </span>
            {selectedBank ? (
              <span className="claim-step1-picker__meta">{selectedBank.accountHolderName}</span>
            ) : (
              <span className="claim-step1-picker__meta claim-step1-picker__meta--muted">
                Add or select a saved account
              </span>
            )}
          </span>
          <span className="claim-step1-picker__chev" aria-hidden>
            <IconChevron />
          </span>
        </button>
      </ClaimStep1Section>
    </div>
  );
}
