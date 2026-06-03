import { ROUTES } from "@/constants";
import { OTP_LEN } from "@/constants/otp";
import {
  createPatientMember,
  fetchPatientMemberById,
  updatePatientMember,
  type SaveMemberPayload,
} from "@/api/patientMember";
import { requestMemberPhoneOtp } from "@/api/patientMemberOtp";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useToast } from "@/hooks/useToast";
import { getWebFcmToken } from "@/lib/fcmToken";
import "./AddFamilyMemberPage.css";

const MIN_PHONE_LEN = 10;

function digitsOnlyPhone(s: string): string {
  return s.replaceAll(/\D/g, "");
}

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

/** API / display: feet.zeroPaddedInches (e.g. 3.02 = 3 ft 2 in, 5.05 = 5 ft 5 in). */
const HEIGHT_FEET_OPTIONS = Array.from({ length: 8 }, (_, i) => String(i + 1));
const HEIGHT_INCH_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i));

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
    inch = Math.min(11, Math.max(0, inch));
    return { feet: ft, inches: String(inch) };
  }
  const whole = /^(\d+)$/.exec(t);
  if (whole) return { feet: whole[1], inches: "0" };
  return { feet: "", inches: "" };
}

function combineHeightFtInToApi(feet: string, inches: string): string {
  const f = feet.trim();
  if (!f) return "";
  const i = Math.min(11, Math.max(0, Number.parseInt(inches, 10) || 0));
  return `${f}.${String(i).padStart(2, "0")}`;
}

function SelectChevron() {
  return (
    <span className="afm-chevron" aria-hidden="true">
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

export function ProfileMembersAddPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const mod = useProfileModuleGates();
  const { memberId } = useParams<{ memberId?: string }>();
  const isEdit = Boolean(memberId?.trim());

  const [submitting, setSubmitting] = useState(false);
  const [loadingMember, setLoadingMember] = useState(isEdit);

  const [relationship, setRelationship] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [language, setLanguage] = useState("");
  const [isBloodPressure, setIsBloodPressure] = useState<"yes" | "no">("no");
  const [isDiabetic, setIsDiabetic] = useState<"yes" | "no">("no");
  const [baselinePhone, setBaselinePhone] = useState("");
  const [memberOtp, setMemberOtp] = useState("");
  const [otpUnlocked, setOtpUnlocked] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const otpSentForPhoneRef = useRef<string | null>(null);

  const phoneNorm = phone.trim();
  const phoneDigits = digitsOnlyPhone(phone);
  const baselineDigits = digitsOnlyPhone(baselinePhone);
  const needsMemberOtp =
    phoneDigits.length > 0 && (!isEdit || phoneDigits !== baselineDigits);

  const canSave = useMemo(() => {
    const base =
      name.trim().length > 0 &&
      relationship.trim().length > 0 &&
      dob.trim().length > 0 &&
      gender.trim().length > 0 &&
      bloodGroup.trim().length > 0 &&
      language.trim().length > 0;
    if (!base) return false;
    if (!needsMemberOtp) return true;
    return otpUnlocked && memberOtp.trim().length >= OTP_LEN;
  }, [
    name,
    relationship,
    dob,
    gender,
    bloodGroup,
    language,
    needsMemberOtp,
    otpUnlocked,
    memberOtp,
  ]);

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
      setGender((m.gender ?? "").trim().toLowerCase());
      setPhone(m.phone ?? "");
      const hp = parseHeightApiToParts(m.height);
      setHeightFeet(hp.feet);
      setHeightInches(hp.inches);
      setWeight(m.weight ?? "");
      setBloodGroup(m.bloodGroup ?? "");
      setLanguage(m.language ?? "");
      setIsBloodPressure(m.isBloodPressure ?? "no");
      setIsDiabetic(m.isDiabetic ?? "no");
      const loadedPhone = (m.phone ?? "").trim();
      setBaselinePhone(loadedPhone);
      setMemberOtp("");
      setOtpUnlocked(false);
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
    setPhone(value);
    const nextDigits = digitsOnlyPhone(value);
    if (nextDigits !== otpSentForPhoneRef.current) {
      setOtpUnlocked(false);
      setMemberOtp("");
      otpSentForPhoneRef.current = null;
    }
  };

  const sendMemberOtp = async () => {
    const key = phoneDigits;
    if (key.length < MIN_PHONE_LEN) {
      toast.error(`Enter at least ${MIN_PHONE_LEN} digits for the phone number.`);
      return;
    }
    setSendingOtp(true);
    try {
      const fcm_token = await getWebFcmToken();
      await requestMemberPhoneOtp(key, fcm_token);
      otpSentForPhoneRef.current = key;
      setOtpUnlocked(true);
      setMemberOtp("");
      toast.success("OTP sent to this number.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  useEffect(() => {
    if (!isEdit) {
      setBaselinePhone("");
    }
  }, [isEdit]);

  const save = async () => {
    if (!canSave || submitting || loadingMember) return;
    setSubmitting(true);
    try {
      const payload: SaveMemberPayload = {
        name: name.trim(),
        relationship: relationship.trim(),
        dob: dob.trim(),
        gender: gender.trim().toLowerCase(),
        height: combineHeightFtInToApi(heightFeet, heightInches),
        weight: weight.trim(),
        isBloodPressure,
        isDiabetic,
        bloodGroup: bloodGroup.trim(),
        language: language.trim(),
        phone: phoneNorm.length ? phoneNorm : null,
        code: needsMemberOtp ? memberOtp.trim() || null : null,
      };
      if (isEdit && memberId?.trim()) {
        await updatePatientMember(memberId.trim(), payload);
        toast.success("Member updated.");
      } else {
        await createPatientMember(payload);
        toast.success("Member added.");
      }
      if (!isEdit && location.state?.returnPath) {
        navigate(location.state.returnPath, { state: location.state.returnState });
      } else {
        navigate(ROUTES.profileMembers);
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

  const pageTitle = useMemo(() => {
    if (isEdit) return "Edit member";
    return "Add member";
  }, [isEdit]);
  const saveLabel = useMemo(() => {
    if (submitting) return "Saving…";
    if (isEdit) return "Save changes";
    return "Save and continue";
  }, [submitting, isEdit]);

  const sendOtpButtonLabel = useMemo(() => {
    if (sendingOtp) return "Sending…";
    if (otpUnlocked) return "Resend OTP";
    return "Send OTP";
  }, [sendingOtp, otpUnlocked]);

  const otpHintText = useMemo(() => {
    if (otpUnlocked) {
      return `Enter the ${OTP_LEN}-digit OTP sent to this number.`;
    }
    return "Tap Send OTP to receive a code on this number.";
  }, [otpUnlocked]);

  return (
    <div className="afm-page">
      <header className="afm-top">
        <Link
          to={backPath}
          {...(backState === undefined ? {} : { state: backState })}
          className="app-back-btn afm-back"
          aria-label={hasFlowReturn ? "Back" : "Back to members"}
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
          <p className="afm-note" style={{ marginTop: 8 }}>
            Loading member…
          </p>
        ) : null}
        <form
          className="afm-form"
          aria-label={isEdit ? "Edit member form" : "Add member form"}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="afm-input">
            <span className="visually-hidden">Relationship</span>
            <select
              className="afm-input__control afm-select"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              required
            >
              <option value="" disabled>
                Relationship
              </option>
              <option value="Self">Self</option>
              <option value="Spouse">Spouse</option>
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Son">Son</option>
              <option value="Daughter">Daughter</option>
              <option value="Sibling">Sibling</option>
              <option value="Other">Other</option>
            </select>
            <SelectChevron />
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Name</span>
            <input
              className="afm-input__control"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Date of birth</span>
            <input
              type="date"
              className="afm-input__control"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Gender</span>
            <select
              className="afm-input__control afm-select"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
            >
              <option value="" disabled>
                Gender
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <SelectChevron />
          </label>

          <div className="afm-input afm-phone-block">
            <label>
              <span className="visually-hidden">Phone number</span>
              <input
                className="afm-input__control"
                placeholder="Phone number (optional)"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            {needsMemberOtp ? (
              <>
                <button
                  type="button"
                  className="afm-send-otp"
                  disabled={
                    sendingOtp || phoneDigits.length < MIN_PHONE_LEN || loadingMember
                  }
                  onClick={() => void sendMemberOtp()}
                >
                  {sendOtpButtonLabel}
                </button>
                <p className="afm-otp-hint">{otpHintText}</p>
                <label>
                  <span className="visually-hidden">OTP code</span>
                  <input
                    className="afm-input__control"
                    placeholder="OTP code"
                    value={memberOtp}
                    onChange={(e) =>
                      setMemberOtp(digitsOnlyPhone(e.target.value).slice(0, OTP_LEN))
                    }
                    inputMode="numeric"
                    maxLength={OTP_LEN}
                    disabled={!otpUnlocked || loadingMember}
                    autoComplete="one-time-code"
                  />
                </label>
              </>
            ) : null}
          </div>

          <div className="afm-input afm-height-block">
            <fieldset className="afm-height-fieldset">
              <legend className="afm-height-block__title">Height</legend>
              <div className="afm-height-row">
              <div className="afm-height-field">
                <label className="visually-hidden" htmlFor="afm-height-ft">
                  Feet
                </label>
                <select
                  id="afm-height-ft"
                  className="afm-input__control afm-select"
                  value={heightFeet}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      setHeightFeet(v);
                      setHeightInches((prev) => prev || "0");
                    } else {
                      setHeightFeet("");
                      setHeightInches("");
                    }
                  }}
                >
                  <option value="">Ft</option>
                  {HEIGHT_FEET_OPTIONS.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft} ft
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              <div className="afm-height-field">
                <label className="visually-hidden" htmlFor="afm-height-in">
                  Inches
                </label>
                <select
                  id="afm-height-in"
                  className="afm-input__control afm-select"
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                  disabled={!heightFeet}
                >
                  <option value="">In</option>
                  {HEIGHT_INCH_OPTIONS.map((inch) => (
                    <option key={inch} value={inch}>
                      {inch} in
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </div>
            </fieldset>
          </div>

          <label className="afm-input">
            <span className="visually-hidden">Weight (kg)</span>
            <input
              className="afm-input__control"
              placeholder="Weight in kg (e.g. 70)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
            />
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Blood group</span>
            <select
              className="afm-input__control afm-select"
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
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Language</span>
            <select
              className="afm-input__control afm-select"
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
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Blood pressure</span>
            <select
              className="afm-input__control afm-select"
              value={isBloodPressure}
              onChange={(e) => setIsBloodPressure(e.target.value as "yes" | "no")}
            >
              <option value="no">Blood pressure — No</option>
              <option value="yes">Blood pressure — Yes</option>
            </select>
            <SelectChevron />
          </label>

          <label className="afm-input">
            <span className="visually-hidden">Diabetes</span>
            <select
              className="afm-input__control afm-select"
              value={isDiabetic}
              onChange={(e) => setIsDiabetic(e.target.value as "yes" | "no")}
            >
              <option value="no">Diabetes — No</option>
              <option value="yes">Diabetes — Yes</option>
            </select>
            <SelectChevron />
          </label>

          {isEdit ? (
            <p className="afm-note">Changes are saved with PATCH member.</p>
          ) : (
            <p className="afm-note">Submitted with POST member using the same fields as the app API.</p>
          )}
        </form>
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

      <HomeBottomNav />
    </div>
  );
}
