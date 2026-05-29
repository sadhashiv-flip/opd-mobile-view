import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import type { AuthUser } from "@/types/authSession";
import { ROUTES, WELLNESS_SESSION_KIND } from "@/constants";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { MEMBER_NOT_ACTIVATED_LABEL, memberSubtitleFromDisplay } from "@/lib/gymMemberDisplay";
import { getAuthSession } from "@/lib/authStorage";
import {
  fetchMentalWellnessTypes,
  postWellnessSession,
  type WellnessTypeOption,
} from "@/api/wellnessSession";
import { useToast } from "@/hooks/useToast";
import mentalWellnessSvg from "@/assets/icons/patient-app/hub/services/mentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/patient-app/hub/services/nutritionServices.svg";
import { SearchablePickerField } from "@/components/wellness/SearchablePickerField";
import "./WellnessSessionPage.css";

const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Kannada",
] as const;

/** Session/API fields may be numbers at runtime despite TS types. */
function trimStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function displayNameFromUser(user: AuthUser): string {
  const combined = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (combined) return combined;
  return trimStr(user.name) || "You";
}

function memberLabel(m: MemberDisplay): string {
  const self = m.memberKind === "primary";
  return self ? `${m.name} (self)` : m.name;
}

function memberDescription(m: MemberDisplay): string {
  return memberSubtitleFromDisplay(m);
}

export function WellnessSessionPage() {
  const { wellnessKind } = useParams<{ wellnessKind: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const isMental = wellnessKind === WELLNESS_SESSION_KIND.mentalWellness;
  const isNutrition = wellnessKind === WELLNESS_SESSION_KIND.nutrition;

  const [authReady, setAuthReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [categories, setCategories] = useState<WellnessTypeOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [language, setLanguage] = useState("English");
  const [submitting, setSubmitting] = useState(false);

  const pageTitle = isMental ? "Mental Wellness" : "Diet & Nutrition";
  const heroIcon = isMental ? mentalWellnessSvg : nutritionServicesSvg;
  const heroHeadline = isMental ? (
    <>
      Your <strong>mental health</strong> matters
    </>
  ) : (
    <>
      Your <strong>nutrition</strong> matters
    </>
  );
  const heroBlurb = isMental
    ? "Enter your details below, and once confirmed, our team will call you within 20 minutes to schedule a session with a specialist."
    : "Enter your details here and we will connect you to a nutritionist.";

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const memberPickerOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: memberLabel(m),
        description: !m.isSubscribed ? MEMBER_NOT_ACTIVATED_LABEL : memberDescription(m),
        disabled: !m.isSubscribed,
      })),
    [members],
  );

  const categoryPickerOptions = useMemo(
    () => categories.map((c) => ({ value: c.value, label: c.value })),
    [categories],
  );

  const languagePickerOptions = useMemo(() => {
    const base = LANGUAGE_OPTIONS.map((lang) => ({ value: lang, label: lang }));
    const allowed = new Set<string>(LANGUAGE_OPTIONS);
    if (language.trim() && !allowed.has(language)) {
      return [{ value: language, label: language }, ...base];
    }
    return base;
  }, [language]);

  const applyFieldsForMember = useCallback(
    (member: MemberDisplay | null, user: AuthUser) => {
      const primaryName = displayNameFromUser(user);
      const primaryPhone = trimStr(user.phone);
      const primaryEmail = trimStr(user.email);
      const primaryLanguage = trimStr(user.language) || "English";

      setName(member?.name?.trim() ? member.name : primaryName);
      const mPhone = trimStr(member?.phone);
      setPhone(mPhone ? mPhone : primaryPhone);
      const mEmail = trimStr(member?.email);
      setEmail(mEmail ? mEmail : primaryEmail);

      if (isMental) {
        const mLang = trimStr(member?.language);
        setLanguage(mLang ? mLang : primaryLanguage);
      }
    },
    [isMental],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getAuthSession();
      if (cancelled) return;
      setSessionUser(session?.user ?? null);
      setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    void (async () => {
      try {
        const list = await fetchAllPatientMembers();
        if (cancelled) return;
        setMembers(list);
        const firstActive =
          list.find((m) => m.memberKind === "primary" && m.isSubscribed) ??
          list.find((m) => m.isSubscribed);
        const initialId = firstActive?.id ?? "";
        setSelectedMemberId((prev) => {
          if (prev) {
            const keep = list.find((m) => m.id === prev);
            if (keep?.isSubscribed) return prev;
          }
          return initialId;
        });
      } catch (e) {
        if (!cancelled) {
          setMembers([]);
          const msg = e instanceof Error ? e.message : "Could not load family members";
          setMembersError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUser, toast]);

  useEffect(() => {
    if (!isMental || !sessionUser) return;
    let cancelled = false;
    setCategoriesLoading(true);
    void (async () => {
      try {
        const opts = await fetchMentalWellnessTypes();
        if (!cancelled) setCategories(opts);
      } catch (e) {
        if (!cancelled) {
          setCategories([]);
          toast.error(e instanceof Error ? e.message : "Could not load categories");
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMental, sessionUser, toast]);

  useEffect(() => {
    if (!sessionUser) return;
    applyFieldsForMember(selectedMember, sessionUser);
  }, [selectedMember, sessionUser, applyFieldsForMember]);

  useEffect(() => {
    if (isMental) setServiceArea("");
  }, [selectedMemberId, isMental]);

  const canSubmit = useMemo(() => {
    if (!sessionUser || submitting) return false;
    if (!selectedMember?.isSubscribed) return false;
    if (!phone.trim()) return false;
    if (!email.trim()) return false;
    if (isMental) {
      if (!serviceArea.trim() || !language.trim()) return false;
    }
    return true;
  }, [sessionUser, submitting, selectedMember, phone, email, isMental, serviceArea, language]);

  const handleSubmit = useCallback(async () => {
    if (!sessionUser || !canSubmit) return;
    const patientId = selectedMember?.patientNumericId ?? sessionUser.id;

    setSubmitting(true);
    try {
      if (isMental) {
        await postWellnessSession({
          phone: phone.trim(),
          email: email.trim(),
          service: "Mental Wellness",
          service_area: serviceArea.trim(),
          language: language.trim(),
          patient_id: patientId,
        });
      } else {
        await postWellnessSession({
          phone: phone.trim(),
          email: email.trim(),
          service: "Diet & Nutrition",
          patient_id: patientId,
        });
      }
      toast.success("Request submitted. Our team will contact you soon.");
      void navigate(ROUTES.services);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }, [
    sessionUser,
    canSubmit,
    selectedMember,
    isMental,
    phone,
    email,
    serviceArea,
    language,
    toast,
    navigate,
  ]);

  if (!wellnessKind || (!isMental && !isNutrition)) {
    return <Navigate to={ROUTES.services} replace />;
  }

  if (authReady && !sessionUser) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return (
    <div className="wellness-session-page">
      <header className="wellness-session-page__header">
        <Link to={ROUTES.services} className="wellness-session-page__back" aria-label="Back to services">
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
        <h1 className="wellness-session-page__title">{pageTitle}</h1>
        <span className="wellness-session-page__header-spacer" aria-hidden />
      </header>

      <main className="wellness-session-page__main">
        <section className="wellness-session-page__hero">
          <div className="wellness-session-page__hero-copy">
            <p className="wellness-session-page__hero-headline">{heroHeadline}</p>
            <p className="wellness-session-page__hero-text">{heroBlurb}</p>
          </div>
          <div className="wellness-session-page__hero-art" aria-hidden>
            <img src={heroIcon} alt="" width={120} height={120} draggable={false} />
          </div>
        </section>

        {membersError ? <p className="wellness-session-page__error">{membersError}</p> : null}

        {!authReady || membersLoading ? (
          <p className="wellness-session-page__loading" aria-busy="true">
            Loading…
          </p>
        ) : (
          <form
            className="wellness-session-page__form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <SearchablePickerField
              label="Select family member"
              requiredMark
              placeholder={members.length === 0 ? "No members" : "Choose a family member"}
              sheetTitle="Family member"
              searchPlaceholder="Search by name…"
              options={memberPickerOptions}
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              disabled={members.length === 0}
              pageSize={8}
              emptySearchMessage="No members match your search"
            />

            <label className="wellness-session-page__field">
              <span className="wellness-session-page__label">Name</span>
              <input
                className="wellness-session-page__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>

            <label className="wellness-session-page__field">
              <span className="wellness-session-page__label">Mobile number</span>
              <input
                className="wellness-session-page__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label className="wellness-session-page__field">
              <span className="wellness-session-page__label">Email address</span>
              <input
                className="wellness-session-page__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            {isMental ? (
              <>
                <SearchablePickerField
                  label="Select category"
                  requiredMark
                  placeholder={categoriesLoading ? "Loading…" : "Choose a category"}
                  sheetTitle="Wellness category"
                  searchPlaceholder="Search categories…"
                  options={categoryPickerOptions}
                  value={serviceArea}
                  onChange={setServiceArea}
                  disabled={categoriesLoading}
                  pageSize={8}
                  emptySearchMessage="No categories match your search"
                />

                <SearchablePickerField
                  label="Preferred language"
                  placeholder="Choose language"
                  sheetTitle="Preferred language"
                  searchPlaceholder="Search language…"
                  options={languagePickerOptions}
                  value={language}
                  onChange={setLanguage}
                  pageSize={8}
                  emptySearchMessage="No language matches your search"
                />
              </>
            ) : null}

            <div className="wellness-session-page__notes">
              <p>
                We do not handle emergencies. For urgent care, contact your doctor or the nearest hospital
                immediately.
              </p>
              <p>Service hours: 9:30 AM – 6:30 PM. Requests after hours are processed the next working day.</p>
            </div>

            <button
              type="submit"
              className="wellness-session-page__submit"
              disabled={!canSubmit}
            >
            
              {submitting ? "Submitting…" : "Continue"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
