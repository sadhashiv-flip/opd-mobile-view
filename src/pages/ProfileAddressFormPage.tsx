import { useJsApiLoader } from "@react-google-maps/api";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppBackChevron } from "@/components/navigation/AppBackChevron";
import {
  createPatientAddress,
  fetchAllPatientAddresses,
  updatePatientAddress,
  type PatientAddressRecord,
} from "@/api/patientAddress";
import { ROUTES } from "@/constants";
import { AddressMapPicker } from "@/components/address/AddressMapPicker";
import {
  googleMapsGeocodeSearch,
  googleMapsReverseGeocode,
  viewboxToLatLngBoundsLiteral,
} from "@/lib/googleMapsGeocode";
import {
  nominatimReverse,
  nominatimSearchSuggestions,
  type NominatimSuggestion,
} from "@/lib/nominatimGeocode";
import { useToast } from "@/hooks/useToast";
import { getBrowserCurrentPosition } from "@/lib/browserGeolocation";
import { safeReturnPath } from "@/lib/safeReturnPath";
import "./ProfileManagePage.css";
import "./ProfileAddressFormPage.css";

const TAG_OPTIONS = ["HOME", "WORK", "OTHER"] as const;
const DEFAULT_LOCATION = "17.375705128961926,78.5000828281045";

function parseLocation(loc: string): { lat: number; lng: number } {
  const parts = loc.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    const lat = Number.parseFloat(parts[0] ?? "");
    const lng = Number.parseFloat(parts[1] ?? "");
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return parseLocation(DEFAULT_LOCATION);
}

function recordToForm(a: PatientAddressRecord) {
  const tagUp = a.tag.trim().toUpperCase();
  const tagNorm = (TAG_OPTIONS as readonly string[]).includes(tagUp) ? tagUp : "HOME";
  return {
    line1: a.line1,
    line2: a.line2 ?? "",
    landmark: a.landmark ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    location: a.location.trim() || DEFAULT_LOCATION,
    tag: tagNorm,
    name: a.name.trim() || a.tag.trim() || tagNorm,
    setPrimary: a.isPrimary,
  };
}

type ProfileAddressFormInnerProps = Readonly<{
  useGoogleMaps: boolean;
  mapsJsLoaded: boolean;
  mapsLoadError?: Error;
  /** Set when Google calls <code>window.gm_authFailure</code> (referrer, billing, API, etc.) */
  mapsAuthFailed: boolean;
}>;

function ProfileAddressFormInner({
  useGoogleMaps,
  mapsJsLoaded,
  mapsLoadError,
  mapsAuthFailed,
}: ProfileAddressFormInnerProps) {
  const { addressId } = useParams<{ addressId: string }>();
  const isEdit = Boolean(addressId);
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const toast = useToast();
  const returnTo = useMemo(
    () => safeReturnPath((routerLocation.state as { returnTo?: unknown } | null)?.returnTo),
    [routerLocation.state],
  );

  const handleBack = useCallback(() => {
    navigate(returnTo ?? ROUTES.profileAddress, { replace: true });
  }, [navigate, returnTo]);

  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchSeqRef = useRef(0);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mapViewboxRef = useRef<string | null>(null);
  const reverseTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );
  const addLocationInitRef = useRef(false);

  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [tag, setTag] = useState<string>("HOME");
  const [name, setName] = useState("HOME");
  const [setPrimary, setSetPrimary] = useState(false);

  const { lat, lng } = useMemo(() => parseLocation(location), [location]);

  const nominatimCountryCodes =
    import.meta.env.VITE_NOMINATIM_COUNTRY_CODES?.trim() || "in";
  const geocodeWithGoogle =
    useGoogleMaps && mapsJsLoaded && !mapsAuthFailed;

  const applyReverseGeocode = useCallback(
    (nLat: number, nLng: number) => {
      const reverse = geocodeWithGoogle
        ? googleMapsReverseGeocode(nLat, nLng)
        : nominatimReverse(nLat, nLng);
      return reverse.then((s) => {
        if (!s) return;
        if (s.line1.trim()) setLine1(s.line1.trim());
        if (s.city.trim()) setCity(s.city.trim());
        if (s.state.trim()) setState(s.state.trim());
        if (s.postcode.trim()) setPincode(s.postcode.trim());
      });
    },
    [geocodeWithGoogle],
  );

  useEffect(() => {
    if (!addressId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchAllPatientAddresses();
        if (cancelled) return;
        const found = list.find((a) => a.id === addressId);
        if (!found) {
          toast.error("Address not found.");
          navigate(ROUTES.profileAddress);
          return;
        }
        const f = recordToForm(found);
        setLine1(f.line1);
        setLine2(f.line2);
        setLandmark(f.landmark);
        setCity(f.city);
        setState(f.state);
        setPincode(f.pincode);
        setLocation(f.location);
        setTag(f.tag);
        setName(f.name);
        setSetPrimary(f.setPrimary);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load address");
          navigate(ROUTES.profileAddress);
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressId, navigate, toast]);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    const requestId = ++searchSeqRef.current;
    setSuggestionsLoading(true);
    const timer = globalThis.setTimeout(() => {
      const vb = mapViewboxRef.current ?? undefined;
      const run = geocodeWithGoogle
        ? googleMapsGeocodeSearch(q, {
            boundsLiteral: vb
              ? viewboxToLatLngBoundsLiteral(vb)
              : undefined,
            country: nominatimCountryCodes,
          })
        : nominatimSearchSuggestions(q, 8, {
            viewbox: vb,
            countrycodes: nominatimCountryCodes,
          });
      run
        .then((rows) => {
          if (requestId !== searchSeqRef.current) return;
          setSuggestions(rows);
        })
        .catch(() => {
          if (requestId !== searchSeqRef.current) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (requestId !== searchSeqRef.current) return;
          setSuggestionsLoading(false);
        });
    }, 320);
    return () => {
      globalThis.clearTimeout(timer);
      searchSeqRef.current += 1;
    };
  }, [searchQ, nominatimCountryCodes, geocodeWithGoogle]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = searchWrapRef.current;
      if (el && !el.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    return () => {
      if (reverseTimerRef.current != null) {
        globalThis.clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = null;
      }
    };
  }, []);

  const handlePinFromMap = useCallback(
    (nLat: number, nLng: number) => {
      setLocation(`${nLat},${nLng}`);
      if (reverseTimerRef.current != null) {
        globalThis.clearTimeout(reverseTimerRef.current);
      }
      reverseTimerRef.current = globalThis.setTimeout(() => {
        reverseTimerRef.current = null;
        applyReverseGeocode(nLat, nLng).catch(() => {});
      }, 450);
    },
    [applyReverseGeocode],
  );

  /** patient-app `AddAddressController.onInit` → `_getCurrentLocation` on add only. */
  useEffect(() => {
    if (isEdit || addLocationInitRef.current) return;
    addLocationInitRef.current = true;

    let cancelled = false;
    void (async () => {
      const current = await getBrowserCurrentPosition();
      if (cancelled) return;
      const pos = current ?? parseLocation(DEFAULT_LOCATION);
      handlePinFromMap(pos.lat, pos.lng);
    })();

    return () => {
      cancelled = true;
    };
  }, [handlePinFromMap, isEdit]);

  const selectSuggestion = useCallback((s: NominatimSuggestion) => {
    setLocation(`${s.lat},${s.lon}`);
    if (s.line1.trim()) setLine1(s.line1.trim());
    if (s.city.trim()) setCity(s.city.trim());
    if (s.state.trim()) setState(s.state.trim());
    if (s.postcode.trim()) setPincode(s.postcode.trim());
    setSearchQ("");
    setSuggestions([]);
    setSuggestionsLoading(false);
    searchSeqRef.current += 1;
  }, []);

  const canSubmit = useMemo(() => {
    const base =
      line1.trim().length > 0 &&
      city.trim().length > 0 &&
      state.trim().length > 0 &&
      pincode.trim().length > 0;
    if (tag === "OTHER") {
      return base && name.trim().length > 0;
    }
    return base;
  }, [line1, city, state, pincode, tag, name]);

  const buildPayload = useCallback(() => {
    return {
      line_1: line1.trim(),
      line_2: line2.trim() || null,
      landmark: landmark.trim() || null,
      city: city.trim(),
      state: state.trim(),
      area: null as string | null,
      pincode: pincode.trim(),
      location: location.trim() || `${lat},${lng}`,
      tag: tag.trim() || "HOME",
      name:
        tag === "OTHER"
          ? name.trim()
          : (tag.trim() || "HOME"),
      isPrimary: setPrimary,
    };
  }, [line1, line2, landmark, city, state, pincode, location, lat, lng, tag, name, setPrimary]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (isEdit && addressId) {
        await updatePatientAddress(addressId, payload);
        toast.success("Address updated.");
      } else {
        await createPatientAddress(payload);
        toast.success("Address added.");
      }
      navigate(returnTo ?? ROUTES.profileAddress, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save address");
    } finally {
      setSubmitting(false);
    }
  }, [addressId, buildPayload, canSubmit, isEdit, navigate, returnTo, submitting, toast]);

  let submitButtonText = "Add address";
  if (submitting) submitButtonText = "Saving…";
  else if (isEdit) submitButtonText = "Update address";

  const searchQueryOk = searchQ.trim().length >= 2;
  const showSuggestionsPanel =
    suggestions.length > 0 || (searchQueryOk && !suggestionsLoading);

  if (loadingInit) {
    return (
      <div className="profile-manage-page">
        <header className="profile-manage-page__top">
          <button
            type="button"
            onClick={handleBack}
            className="app-back-btn profile-manage-page__back"
            aria-label="Back"
          >
            <AppBackChevron size={22} />
          </button>
          <h1 className="profile-manage-page__title">{isEdit ? "Edit address" : "Add address"}</h1>
          <span className="profile-manage-page__spacer" aria-hidden />
        </header>
        <div className="paf-main" style={{ paddingTop: 48 }}>
          <p className="profile-manage-page__intro">Loading address…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-manage-page">
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={handleBack}
          className="app-back-btn profile-manage-page__back"
          aria-label="Back"
        >
          <AppBackChevron size={22} />
        </button>
        <h1 className="profile-manage-page__title">{isEdit ? "Edit address" : "Add address"}</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="paf-main">
        <div
          className={`paf-search${showSuggestionsPanel ? " paf-search--open" : ""}`}
          ref={searchWrapRef}
        >
          <input
            id="paf-search-input"
            type="search"
            className="paf-search__input"
            placeholder="Search place or address"
            value={searchQ}
            autoComplete="off"
            autoCorrect="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchQueryOk && (suggestionsLoading || showSuggestionsPanel)}
            aria-controls="paf-suggestions-list"
            onChange={(e) => setSearchQ(e.target.value)}
          />
          {suggestionsLoading ? (
            <div className="paf-search__loading" aria-live="polite">
              Searching…
            </div>
          ) : null}
          {showSuggestionsPanel ? (
            <section
              id="paf-suggestions-list"
              className="paf-suggestions-panel"
              aria-label="Place suggestions"
            >
              {suggestions.length > 0 ? (
                <ul className="paf-suggestions">
                  {suggestions.map((s, idx) => (
                    <li key={`${s.lat},${s.lon},${idx}`} className="paf-suggestions__li">
                      <button
                        type="button"
                        className="paf-suggestions__item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(s)}
                      >
                        <span className="paf-suggestions__title">{s.displayName}</span>
                        {(s.city || s.state) && (
                          <span className="paf-suggestions__meta">
                            {[s.city, s.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="paf-suggestions paf-suggestions--empty">
                  No matches. Try another phrase.
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div className="paf-map-wrap">
          <AddressMapPicker
            useGoogleMaps={useGoogleMaps}
            mapsLoaded={mapsJsLoaded}
            mapsLoadError={mapsLoadError}
            mapsAuthFailed={mapsAuthFailed}
            lat={lat}
            lng={lng}
            zoom={16}
            onPinSettled={handlePinFromMap}
            onViewBoxChange={(vb) => {
              mapViewboxRef.current = vb;
            }}
          />
        </div>

        <div className="paf-form-grid">
          <div className="paf-field">
            <label className="paf-label" htmlFor="paf-line1">
              Line-1
            </label>
            <input
              id="paf-line1"
              className="paf-input"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
            />
          </div>
          <div className="paf-field">
            <label className="paf-label" htmlFor="paf-line2">
              Line-2
            </label>
            <input
              id="paf-line2"
              className="paf-input"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
            />
          </div>
          <div className="paf-field paf-field--full">
            <label className="paf-label" htmlFor="paf-landmark">
              Landmark
            </label>
            <input
              id="paf-landmark"
              className="paf-input"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
            />
          </div>
          <div className="paf-field">
            <label className="paf-label" htmlFor="paf-city">
              City
            </label>
            <input
              id="paf-city"
              className="paf-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="paf-field">
            <label className="paf-label" htmlFor="paf-state">
              State
            </label>
            <input
              id="paf-state"
              className="paf-input"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <div className="paf-field">
            <label className="paf-label" htmlFor="paf-pin">
              Pincode
            </label>
            <input
              id="paf-pin"
              className="paf-input"
              inputMode="numeric"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
            />
          </div>
          <div className="paf-field">
            <label className="paf-label" htmlFor="paf-tag">
              Tag
            </label>
            <select
              id="paf-tag"
              className="paf-select"
              value={tag}
              onChange={(e) => {
                const t = e.target.value;
                setTag(t);
                if (t === "OTHER") {
                  if (tag !== "OTHER") setName("");
                } else {
                  setName(t);
                }
              }}
            >
              {TAG_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {tag === "OTHER" ? (
            <div className="paf-field paf-field--full">
              <label className="paf-label" htmlFor="paf-name">
                Label name
              </label>
              <input
                id="paf-name"
                className="paf-input"
                placeholder="e.g. Parents' home, Gym"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}
          {/* <label className="paf-field paf-field--full paf-check-row">
            <input
              type="checkbox"
              checked={setPrimary}
              onChange={(e) => setSetPrimary(e.target.checked)}
            />
            <span className="paf-label">Set as primary address</span>
          </label> */}
        </div>

        {/* <p className="paf-hint">
          Location string sent to API: {location.trim() || `${lat},${lng}`}
        </p> */}

        <button
          type="button"
          className="paf-submit"
          disabled={!canSubmit || submitting}
          onClick={() => void handleSubmit()}
        >
          {submitButtonText}
        </button>
      </main>
    </div>
  );
}

function ProfileAddressFormWithScript({ apiKey }: Readonly<{ apiKey: string }>) {
  const [mapsAuthFailed, setMapsAuthFailed] = useState(false);
  const [gmFailureHookReady, setGmFailureHookReady] = useState(false);
  const region = import.meta.env.VITE_GOOGLE_MAPS_REGION?.trim() || "in";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    language: "en",
    region,
  });

  useLayoutEffect(() => {
    type WinGm = Window & { gm_authFailure?: () => void };
    const w = globalThis as unknown as WinGm;
    w.gm_authFailure = () => setMapsAuthFailed(true);
    setGmFailureHookReady(true);
    return () => {
      delete w.gm_authFailure;
    };
  }, []);

  const mapsReadyForUi = isLoaded && gmFailureHookReady;

  return (
    <ProfileAddressFormInner
      useGoogleMaps
      mapsJsLoaded={mapsReadyForUi}
      mapsLoadError={loadError}
      mapsAuthFailed={mapsAuthFailed}
    />
  );
}

export function ProfileAddressFormPage() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (apiKey) {
    return <ProfileAddressFormWithScript apiKey={apiKey} />;
  }
  return (
    <ProfileAddressFormInner
      useGoogleMaps={false}
      mapsJsLoaded={false}
      mapsAuthFailed={false}
    />
  );
}
