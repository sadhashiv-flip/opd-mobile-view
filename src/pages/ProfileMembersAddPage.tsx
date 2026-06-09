import { ROUTES } from "@/constants";
import { OTP_LEN } from "@/constants/otp";
import { fetchDependentRelationshipTypes } from "@/api/patientDependentTypes";
import {
  createPatientMember,
  fetchPatientMemberById,
  updatePatientMember,
  type SaveMemberPayload,
} from "@/api/patientMember";
import { requestMemberPhoneOtp } from "@/api/patientMemberOtp";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useToast } from "@/hooks/useToast";
import { getWebFcmToken } from "@/lib/fcmToken";
import { InfoTooltipButton } from "@/components/family/InfoTooltipButton";
import { MaterialIcon } from "@/components/icons/MaterialIcon";
import "./AddFamilyMemberPage.css";

const MIN_PHONE_LEN = 10;
const OTP_RESEND_COOLDOWN_SEC = 30;
const GENDERS = ["Male", "Female", "Other"] as const;
const HEIGHT_FEET_OPTIONS = Array.from({ length: 7 }, (_, i) => String(i + 1));
const HEIGHT_INCH_OPTIONS = Array.from({ length: 13 }, (_, i) => String(i));

const BLOOD_GROUPS = [
  "A +ve",
  "A -ve",
  "B +ve",
  "B -ve",
  "AB +ve",
  "AB -ve",
  "O +ve",
  "O -ve",
  "Unknown",
] as const;

const LANGUAGES = [
  "Tamil",
  "English",
  "Hindi",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Bengali",
  "Marathi",
  "Other",
] as const;

type YesNo = "" | "yes" | "no";
type GenderDisplay = "" | (typeof GENDERS)[number];

function digitsOnlyPhone(s: string): string {
  return s.replaceAll(/\D/g, "");
}

function lettersOnlyName(s: string): string {
  return s.replaceAll(/[^a-zA-Z\s]/g, "");
}

function genderToDisplay(raw: string | null | undefined): GenderDisplay {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "male") return "Male";
  if (t === "female") return "Female";
  if (t === "other") return "Other";
  return "";
}

function genderToApi(display: GenderDisplay): string {
  return display.trim().toLowerCase();
}

function yesNoFromApi(v: "yes" | "no" | null | undefined): YesNo {
  if (v === "yes") return "yes";
  if (v === "no") return "no";
  return "";
}

function parseHeightApiToParts(raw: string | null | undefined): {
  feet: string;
  inches: string;
} {
  const t = (raw ?? "").trim();
  if (!t) return { feet: "", inches: "" };
  const m = /^(\d+)\.(\d{1,2})$/.exec(t);
  if (m) {
    const ft = m[1];
    let inch = Number.parseInt(m[2], 10);
    if (Number.isNaN(inch)) return { feet: "", inches: "" };
    inch = Math.min(12, Math.max(0, inch));
    return { feet: ft, inches: String(inch) };
  }
  const whole = /^(\d+)$/.exec(t);
  if (whole) return { feet: whole[1], inches: "0" };
  return { feet: "", inches: "" };
}

function combineHeightFtInToApi(feet: string, inches: string): string {
  const f = feet.trim();
  if (!f) return "";
  const i = Math.min(12, Math.max(0, Number.parseInt(inches, 10) || 0));
  return `${f}.${String(i).padStart(2, "0")}`;
}

function formatDobDisplay(iso: string): string {
  const t = iso.trim();
  if (!t) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return t;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function RequiredLabel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="afm-label">
      {children}
      <span className="afm-label__req"> *</span>
    </span>
  );
}

function SelectChevron() {
  return (
    <span className="afm-chevron" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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

function CalendarIcon() {
  return (
    <span className="afm-date-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 4V2M16 4V2M4 9h16M6 6h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function genderIconName(gender: (typeof GENDERS)[number]): string {
  if (gender === "Male") return "male";
  if (gender === "Female") return "female";
  return "transgender";
}

function YesNoRadios({
  name,
  value,
  onChange,
}: Readonly<{
  name: string;
  value: YesNo;
  onChange: (next: YesNo) => void;
}>) {
  return (
    <div className="afm-yesno-row" role="radiogroup" aria-label={name}>
      {(["yes", "no"] as const).map((opt) => (
        <label key={opt} className="afm-yesno-option">
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          <span>{opt === "yes" ? "Yes" : "No"}</span>
        </label>
      ))}
    </div>
  );
}

export function ProfileMembersAddPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const mod = useProfileModuleGates();
  const { memberId } = useParams<{ memberId?: string }>();
  const isEdit = Boolean(memberId?.trim());
  const dobPickerRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [loadingMember, setLoadingMember] = useState(isEdit);
  const [relationshipOptions, setRelationshipOptions] = useState<string[]>([]);

  const [relationship, setRelationship] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<GenderDisplay>("");
  const [phone, setPhone] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [language, setLanguage] = useState("");
  const [isBloodPressure, setIsBloodPressure] = useState<YesNo>("");
  const [isDiabetic, setIsDiabetic] = useState<YesNo>("");
  const [baselinePhone, setBaselinePhone] = useState("");
  const [memberOtp, setMemberOtp] = useState("");
  const [otpUnlocked, setOtpUnlocked] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpSentForPhoneRef = useRef<string | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phoneDigits = digitsOnlyPhone(phone);
  const baselineDigits = digitsOnlyPhone(baselinePhone);
  const needsMemberOtp =
    phoneDigits.length === MIN_PHONE_LEN && (!isEdit || phoneDigits !== baselineDigits);
  const showOtpSection = phoneDigits.length === MIN_PHONE_LEN;

  const canSave = useMemo(() => {
    if (name.trim().length < 3) return false;
    if (!relationship.trim()) return false;
    if (!dob.trim()) return false;
    if (!gender) return false;
    if (!heightFeet.trim() || heightInches === "") return false;
    const w = Number.parseFloat(weight.trim());
    if (!weight.trim() || Number.isNaN(w) || w <= 0 || w > 500) return false;
    if (!isBloodPressure || !isDiabetic) return false;
    if (isEdit && (!bloodGroup.trim() || !language.trim())) return false;
    if (phoneDigits.length > 0 && phoneDigits.length !== MIN_PHONE_LEN) return false;
    if (needsMemberOtp) {
      if (!otpUnlocked) return false;
      if (memberOtp.trim().length !== OTP_LEN) return false;
    }
    return true;
  }, [
    name,
    relationship,
    dob,
    gender,
    heightFeet,
    heightInches,
    weight,
    isBloodPressure,
    isDiabetic,
    isEdit,
    bloodGroup,
    language,
    phoneDigits,
    needsMemberOtp,
    otpUnlocked,
    memberOtp,
  ]);

  const clearResendTimer = useCallback(() => {
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, []);

  const startResendCooldown = useCallback(() => {
    clearResendTimer();
    setResendSeconds(OTP_RESEND_COOLDOWN_SEC);
    resendTimerRef.current = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          clearResendTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearResendTimer]);

  useEffect(() => () => clearResendTimer(), [clearResendTimer]);

  useEffect(() => {
    void fetchDependentRelationshipTypes().then(setRelationshipOptions);
  }, []);

  const loadMember = useCallback(async () => {
    const id = memberId?.trim();
    if (!id) {
      setLoadingMember(false);
      return;
    }
    setLoadingMember(true);
    try {
      const m = await fetchPatientMemberById(id);
      if (!m) {
        toast.error("Member not found.");
        navigate(ROUTES.profileMembers);
        return;
      }
      setRelationship(m.relationship ?? "");
      setName(m.name);
      setDob(m.dob ?? "");
      setGender(genderToDisplay(m.gender));
      setPhone(m.phone ?? "");
      const hp = parseHeightApiToParts(m.height);
      setHeightFeet(hp.feet);
      setHeightInches(hp.inches);
      setWeight(m.weight ?? "");
      setBloodGroup(m.bloodGroup ?? "");
      setLanguage(m.language ?? "");
      setIsBloodPressure(yesNoFromApi(m.isBloodPressure));
      setIsDiabetic(yesNoFromApi(m.isDiabetic));
      const loadedPhone = (m.phone ?? "").trim();
      setBaselinePhone(loadedPhone);
      setMemberOtp("");
      setOtpUnlocked(false);
      setResendSeconds(0);
      otpSentForPhoneRef.current = null;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load member");
      navigate(ROUTES.profileMembers);
    } finally {
      setLoadingMember(false);
    }
  }, [memberId, navigate, toast]);

  useEffect(() => {
    if (!memberId?.trim()) {
      setLoadingMember(false);
      return;
    }
    void loadMember();
  }, [loadMember, memberId]);

  useEffect(() => {
    void getWebFcmToken();
  }, []);

  useEffect(() => {
    if (!mod.loaded) return;
    const { dependentAddAllowed, dependentEditAllowed } = mod.planDependents;
    if (isEdit && !dependentEditAllowed) {
      toast.error("Your plan doesn’t allow editing family members.");
      navigate(ROUTES.profileMembers, { replace: true });
      return;
    }
    if (!isEdit && !dependentAddAllowed) {
      toast.error("Your plan doesn’t allow adding family members.");
      navigate(ROUTES.profileMembers, { replace: true });
    }
  }, [
    isEdit,
    mod.loaded,
    mod.planDependents.dependentAddAllowed,
    mod.planDependents.dependentEditAllowed,
    navigate,
    toast,
  ]);

  const onPhoneChange = (value: string) => {
    const next = digitsOnlyPhone(value).slice(0, MIN_PHONE_LEN);
    setPhone(next);
    if (next !== otpSentForPhoneRef.current) {
      setOtpUnlocked(false);
      setMemberOtp("");
      otpSentForPhoneRef.current = null;
      setResendSeconds(0);
      clearResendTimer();
    }
  };

  const sendMemberOtp = async () => {
    const key = phoneDigits;
    if (key.length !== MIN_PHONE_LEN) {
      toast.error(`Enter a valid ${MIN_PHONE_LEN}-digit phone number.`);
      return;
    }
    if (sendingOtp || (otpUnlocked && resendSeconds > 0)) return;
    setSendingOtp(true);
    try {
      const fcm_token = await getWebFcmToken();
      await requestMemberPhoneOtp(key, fcm_token);
      otpSentForPhoneRef.current = key;
      setOtpUnlocked(true);
      setMemberOtp("");
      startResendCooldown();
      toast.success("OTP sent successfully.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const save = async () => {
    if (!canSave || submitting || loadingMember) return;
    setSubmitting(true);
    try {
      const payload: SaveMemberPayload = {
        name: name.trim(),
        relationship: relationship.trim(),
        dob: dob.trim(),
        gender: genderToApi(gender),
        height: combineHeightFtInToApi(heightFeet, heightInches),
        weight: weight.trim(),
        isBloodPressure: isBloodPressure as "yes" | "no",
        isDiabetic: isDiabetic as "yes" | "no",
        bloodGroup: bloodGroup.trim(),
        language: language.trim(),
        phone: phoneDigits.length ? phoneDigits : null,
        code: needsMemberOtp ? memberOtp.trim() || null : null,
      };
      if (isEdit && memberId?.trim()) {
        await updatePatientMember(memberId.trim(), payload);
        toast.success("Member updated.");
        navigate(ROUTES.profileMembers);
      } else {
        await createPatientMember(payload);
        if (location.state?.returnPath) {
          navigate(location.state.returnPath, { state: location.state.returnState });
        } else {
          navigate(ROUTES.profileMembersAddSuccess, { replace: true });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save member");
    } finally {
      setSubmitting(false);
    }
  };

  const addFlowState = location.state as
    | { returnPath?: string; returnState?: unknown }
    | null
    | undefined;
  const flowReturnPath =
    typeof addFlowState?.returnPath === "string" ? addFlowState.returnPath.trim() : "";
  const hasFlowReturn = flowReturnPath.length > 0;
  const backPath = hasFlowReturn ? flowReturnPath : ROUTES.profileMembers;
  const backState = addFlowState?.returnState;

  const pageTitle = isEdit ? "Edit member" : "Add new family member";
  const saveLabel = submitting ? "Saving…" : isEdit ? "Save changes" : "Save and continue";
  const sendOtpButtonLabel = sendingOtp
    ? "Sending…"
    : otpUnlocked
      ? "Resend OTP"
      : "Send OTP";
  const dobDisplay = formatDobDisplay(dob);

  const openDobPicker = () => {
    const el = dobPickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.click();
    }
  };

  return (
    <div className="afm-page">
      <header className="afm-top">
        <Link
          to={backPath}
          {...(backState === undefined ? {} : { state: backState })}
          className="app-back-btn afm-back"
          aria-label={hasFlowReturn ? "Back" : "Back to family accounts"}
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
        <h1 className="afm-title">{pageTitle}</h1>
      </header>

      <main className="afm-main">
        {loadingMember ? (
          <p className="afm-loading">Loading member…</p>
        ) : (
          <form
            className="afm-form"
            aria-label={isEdit ? "Edit member form" : "Add family member form"}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="afm-field">
              <RequiredLabel>Relationship</RequiredLabel>
              <div className="afm-control-wrap">
                <select
                  className={`afm-control afm-control--select${relationship ? "" : " afm-control--placeholder"}`}
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select relationship
                  </option>
                  {relationshipOptions.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </div>

            <div className="afm-field">
              <RequiredLabel>Name</RequiredLabel>
              <input
                className="afm-control"
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(lettersOnlyName(e.target.value))}
                required
                minLength={3}
                autoComplete="name"
              />
            </div>

            <div className="afm-field">
              <RequiredLabel>Date of birth</RequiredLabel>
              <div className="afm-date-wrap">
                <input
                  className={`afm-control afm-control--readonly${dobDisplay ? "" : " afm-control--placeholder"}`}
                  readOnly
                  value={dobDisplay}
                  placeholder="Select date of birth"
                  onClick={openDobPicker}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDobPicker();
                    }
                  }}
                  aria-haspopup="dialog"
                />
                <input
                  ref={dobPickerRef}
                  type="date"
                  className="afm-date-native"
                  value={dob}
                  max={todayIsoDate()}
                  onChange={(e) => setDob(e.target.value)}
                  tabIndex={-1}
                  aria-hidden
                />
                <CalendarIcon />
              </div>
            </div>

            <div className="afm-field">
              <RequiredLabel>Gender</RequiredLabel>
              <div className="afm-gender-row">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={
                      gender === g
                        ? "afm-gender-tile afm-gender-tile--selected"
                        : "afm-gender-tile"
                    }
                    onClick={() => setGender(g)}
                    aria-pressed={gender === g}
                  >
                    <MaterialIcon
                      name={genderIconName(g)}
                      rounded
                      size={26}
                      className="afm-gender-tile__icon"
                    />
                    <span className="afm-gender-tile__label">{g}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="afm-phone-row">
              <div className="afm-field">
                <label className="afm-label">
                  Phone number <span className="afm-label__req">(optional)</span>
                </label>
                <input
                  className="afm-control"
                  placeholder="Phone number (optional)"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={MIN_PHONE_LEN}
                />
              </div>
              <InfoTooltipButton />
            </div>
            <p className="afm-hint">Not required for children</p>

            {showOtpSection && needsMemberOtp ? (
              <div className="afm-otp-block">
                <p className="afm-otp-note">
                  OTP will be sent to this number. Verify OTP before proceeding further.
                </p>
                <button
                  type="button"
                  className="afm-otp-btn"
                  disabled={
                    sendingOtp ||
                    phoneDigits.length !== MIN_PHONE_LEN ||
                    loadingMember ||
                    (otpUnlocked && resendSeconds > 0)
                  }
                  onClick={() => void sendMemberOtp()}
                >
                  {sendOtpButtonLabel}
                </button>
                {otpUnlocked && resendSeconds > 0 ? (
                  <p className="afm-otp-cooldown">Resend available in {resendSeconds}s</p>
                ) : null}
                <div className="afm-field">
                  <RequiredLabel>Enter OTP</RequiredLabel>
                  <input
                    className="afm-control"
                    placeholder={otpUnlocked ? "6-digit OTP" : "Send OTP to enter the code"}
                    value={memberOtp}
                    onChange={(e) =>
                      setMemberOtp(digitsOnlyPhone(e.target.value).slice(0, OTP_LEN))
                    }
                    inputMode="numeric"
                    maxLength={OTP_LEN}
                    readOnly={!otpUnlocked}
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
            ) : null}

            <div className="afm-field">
              <RequiredLabel>Height</RequiredLabel>
              <div className="afm-height-row">
                <div className="afm-control-wrap">
                  <select
                    className={`afm-control afm-control--select${heightFeet ? "" : " afm-control--placeholder"}`}
                    value={heightFeet}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        setHeightFeet(v);
                        if (heightInches === "") setHeightInches("0");
                      } else {
                        setHeightFeet("");
                        setHeightInches("");
                      }
                    }}
                    required
                  >
                    <option value="" disabled>
                      Ft
                    </option>
                    {HEIGHT_FEET_OPTIONS.map((ft) => (
                      <option key={ft} value={ft}>
                        {ft} ft
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
                <div className="afm-control-wrap">
                  <select
                    className={`afm-control afm-control--select${heightInches !== "" ? "" : " afm-control--placeholder"}`}
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    disabled={!heightFeet}
                    required
                  >
                    <option value="" disabled>
                      In
                    </option>
                    {HEIGHT_INCH_OPTIONS.map((inch) => (
                      <option key={inch} value={inch}>
                        {inch} in
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </div>
            </div>

            <div className="afm-field">
              <RequiredLabel>Weight</RequiredLabel>
              <input
                className="afm-control"
                placeholder="Weight in kg (e.g. 70)"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replaceAll(/[^\d.]/g, ""))}
                inputMode="decimal"
                required
              />
            </div>

            <div className="afm-field">
              <RequiredLabel>Blood pressure</RequiredLabel>
              <YesNoRadios
                name="blood-pressure"
                value={isBloodPressure}
                onChange={setIsBloodPressure}
              />
            </div>

            <div className="afm-field">
              <RequiredLabel>Diabetes</RequiredLabel>
              <YesNoRadios name="diabetes" value={isDiabetic} onChange={setIsDiabetic} />
            </div>

            {isEdit ? (
              <>
                <div className="afm-field">
                  <RequiredLabel>Blood group</RequiredLabel>
                  <div className="afm-control-wrap">
                    <select
                      className={`afm-control afm-control--select${bloodGroup ? "" : " afm-control--placeholder"}`}
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Blood group
                      </option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                </div>

                <div className="afm-field">
                  <RequiredLabel>Language</RequiredLabel>
                  <div className="afm-control-wrap">
                    <select
                      className={`afm-control afm-control--select${language ? "" : " afm-control--placeholder"}`}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Language
                      </option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                </div>
              </>
            ) : null}

            <p className="afm-disclaimer">
              Booking and health updates may be sent to the registered mobile number when
              provided.
            </p>
          </form>
        )}
      </main>

      <footer className="afm-footer">
        <button
          type="button"
          className="afm-save"
          onClick={() => void save()}
          disabled={!canSave || submitting || loadingMember}
        >
          {saveLabel}
        </button>
      </footer>
    </div>
  );
}
