import { useCallback, useEffect, useMemo, useState } from "react";
import { generatePath, Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import type { AuthUser } from "@/types/authSession";
import { ROUTES, WELLNESS_SESSION_KIND } from "@/constants";
import {
  WELLNESS_DESCRIPTION,
  WELLNESS_DISCLAIMER_EMERGENCY,
  WELLNESS_DISCLAIMER_HOURS,
  WELLNESS_PAGE_TITLE,
} from "@/constants/wellnessCopy";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { MEMBER_NOT_ACTIVATED_LABEL, memberSubtitleFromDisplay } from "@/lib/gymMemberDisplay";
import { getAuthSession } from "@/lib/authStorage";
import { fetchMentalWellnessTypes, type WellnessTypeOption } from "@/api/wellnessSession";
import { useToast } from "@/hooks/useToast";
import mentalWellnessSvg from "@/assets/icons/patient-app/hub/services/mentalWellness.svg";
import nutritionServicesSvg from "@/assets/icons/patient-app/hub/services/nutritionServices.svg";
import { SearchablePickerField } from "@/components/wellness/SearchablePickerField";
import { WellnessSectionCard } from "@/components/wellness/WellnessSectionCard";
import type { WellnessReviewLocationState } from "@/pages/WellnessSessionReviewPage";
import {
  memberSummaryLine,
  normalizeWellnessPhone10,
  validateWellnessForm,
  WELLNESS_LANGUAGE_OPTIONS,
  type WellnessFormSnapshot,
} from "@/lib/wellnessSessionForm";
import "./WellnessSessionPage.css";
import "./WellnessFlow.css";

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

type RestoreState = Readonly<{ restoreForm?: WellnessFormSnapshot }>;

export function WellnessSessionPage() {
  const { wellnessKind } = useParams<{ wellnessKind: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const isMental = wellnessKind === WELLNESS_SESSION_KIND.mentalWellness;
  const isNutrition = wellnessKind === WELLNESS_SESSION_KIND.nutrition;
  const restore = (location.state as RestoreState | null)?.restoreForm;

  const [authReady, setAuthReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [categories, setCategories] = useState<WellnessTypeOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState(restore?.selectedMemberId ?? "");
  const [name, setName] = useState(restore?.name ?? "");
  const [phone, setPhone] = useState(restore?.phone ?? "");
  const [email, setEmail] = useState(restore?.email ?? "");
  const [serviceArea, setServiceArea] = useState(restore?.serviceArea ?? "");
  const [language, setLanguage] = useState(restore?.language ?? "English");

  const pageTitle = isMental ? WELLNESS_PAGE_TITLE.mental : WELLNESS_PAGE_TITLE.nutrition;
  const heroIcon = isMental ? mentalWellnessSvg : nutritionServicesSvg;
  const description = isMental ? WELLNESS_DESCRIPTION.mental : WELLNESS_DESCRIPTION.nutrition;
  const service = isMental ? "Mental Wellness" : "Diet & Nutrition";

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
    () => categories.map((c) => ({ value: c.value, label: c.label })),
    [categories],
  );

  const languagePickerOptions = useMemo(() => {
    const base = WELLNESS_LANGUAGE_OPTIONS.map((lang) => ({ value: lang, label: lang }));
    const allowed = new Set<string>(WELLNESS_LANGUAGE_OPTIONS);
    if (language.trim() && !allowed.has(language)) {
      return [{ value: language, label: language }, ...base];
    }
    return base;
  }, [language]);

  const applyFieldsForMember = useCallback(
    (member: MemberDisplay | null, user: AuthUser) => {
      if (restore) return;
      const primaryName = displayNameFromUser(user);
      const primaryPhone = normalizeWellnessPhone10(trimStr(user.phone));
      const primaryEmail = trimStr(user.email);
      const primaryLanguage = trimStr(user.language) || "English";

      setName(member?.name?.trim() ? member.name : primaryName);
      const mPhone = normalizeWellnessPhone10(trimStr(member?.phone));
      setPhone(mPhone || primaryPhone);
      const mEmail = trimStr(member?.email);
      setEmail(mEmail || primaryEmail);

      const mLang = trimStr(member?.language);
      setLanguage(mLang || primaryLanguage);
    },
    [restore],
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
        if (restore) return;
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
  }, [sessionUser, toast, restore]);

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
    if (!sessionUser || restore) return;
    applyFieldsForMember(selectedMember, sessionUser);
  }, [selectedMember, sessionUser, applyFieldsForMember, restore]);

  const formSnapshot = useMemo((): WellnessFormSnapshot | null => {
    if (!sessionUser || !wellnessKind) return null;
    if (!isMental && !isNutrition) return null;
    return {
      wellnessKind: isMental ? "mental-wellness" : "nutrition",
      selectedMemberId,
      memberSummaryLine: memberSummaryLine(selectedMember, name),
      name: name.trim(),
      phone: normalizeWellnessPhone10(phone),
      email: email.trim(),
      serviceArea: serviceArea.trim(),
      language: language.trim(),
      patientId: selectedMember?.patientNumericId ?? sessionUser.id,
      service,
    };
  }, [
    sessionUser,
    wellnessKind,
    isMental,
    isNutrition,
    selectedMemberId,
    selectedMember,
    name,
    phone,
    email,
    serviceArea,
    language,
    service,
  ]);

  const canContinue = useMemo(() => {
    if (!formSnapshot) return false;
    return validateWellnessForm(formSnapshot, { categoriesLoaded: categories.length > 0 }) === null;
  }, [formSnapshot, categories.length]);

  const onContinue = useCallback(() => {
    if (!formSnapshot) return;
    const err = validateWellnessForm(formSnapshot, { categoriesLoaded: categories.length > 0 });
    if (err) {
      toast.error(err);
      return;
    }
    const reviewPath = generatePath(ROUTES.servicesWellnessReview, { wellnessKind: wellnessKind! });
    void navigate(reviewPath, { state: { form: formSnapshot } satisfies WellnessReviewLocationState });
  }, [formSnapshot, categories.length, navigate, wellnessKind, toast]);

  if (!wellnessKind || (!isMental && !isNutrition)) {
    return <Navigate to={ROUTES.services} replace />;
  }

  if (authReady && !sessionUser) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return (
    <div className="wellness-session-page wellness-flow-page">
      <header className="wellness-flow-page__header">
        <Link to={ROUTES.services} className="app-back-btn wellness-flow-page__back" aria-label="Back to services">
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
        <h1 className="wellness-flow-page__title">{pageTitle}</h1>
        <span className="wellness-flow-page__header-spacer" aria-hidden />
      </header>

      <main className="wellness-session-page__scroll">
        <div className="wellness-session-page__hero-wrap">
          <div className="wellness-session-page__hero-banner">
            <img src={heroIcon} alt="" className="wellness-session-page__hero-img" draggable={false} />
          </div>
          <p className="wellness-session-page__description">{description}</p>
        </div>

        {membersError ? <p className="wellness-session-page__error">{membersError}</p> : null}

        {!authReady || membersLoading ? (
          <p className="wellness-session-page__loading" aria-busy="true">
            Loading…
          </p>
        ) : (
          <>
            <WellnessSectionCard
              title="Patient details"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                    fill="currentColor"
                  />
                </svg>
              }
            >
              <SearchablePickerField
                label="Family member"
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
                  onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z ]/g, ""))}
                  autoComplete="name"
                />
              </label>

              <label className="wellness-session-page__field">
                <span className="wellness-session-page__label">Mobile number</span>
                <input
                  className="wellness-session-page__input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
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
            </WellnessSectionCard>

            <WellnessSectionCard
              title="Consultation preferences"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
                    fill="currentColor"
                  />
                </svg>
              }
            >
              {isMental ? (
                <SearchablePickerField
                  label="Select category"
                  requiredMark
                  placeholder={categoriesLoading ? "Loading…" : "Select category"}
                  sheetTitle="Select category"
                  searchPlaceholder="Search categories…"
                  options={categoryPickerOptions}
                  value={serviceArea}
                  onChange={setServiceArea}
                  disabled={categoriesLoading}
                  pageSize={8}
                  emptySearchMessage="No categories match your search"
                />
              ) : null}

              <SearchablePickerField
                label="Preferred language"
                placeholder="Select language"
                sheetTitle="Select language"
                searchPlaceholder="Search language…"
                options={languagePickerOptions}
                value={language}
                onChange={setLanguage}
                pageSize={8}
                emptySearchMessage="No language matches your search"
              />
            </WellnessSectionCard>

            <WellnessSectionCard
              title="Important notes"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                    fill="currentColor"
                  />
                </svg>
              }
            >
              <ul className="wellness-session-page__disclaimers">
                <li>{WELLNESS_DISCLAIMER_EMERGENCY}</li>
                <li>{WELLNESS_DISCLAIMER_HOURS}</li>
              </ul>
            </WellnessSectionCard>
          </>
        )}
      </main>

      <footer className="wellness-flow-page__footer">
        <button
          type="button"
          className="wellness-flow-page__cta"
          disabled={!canContinue || membersLoading}
          onClick={onContinue}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
