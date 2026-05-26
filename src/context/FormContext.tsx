import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

type FormAction<TSteps extends Record<string, unknown>> =
  | Readonly<{
      type: "UPDATE_STEP";
      stepKey: keyof TSteps;
      value: TSteps[keyof TSteps];
    }>
  | Readonly<{
      type: "PATCH_STEP";
      stepKey: keyof TSteps;
      partial: Partial<TSteps[keyof TSteps]>;
    }>
  | Readonly<{ type: "RESET"; initial: TSteps }>
  | Readonly<{ type: "HYDRATE"; steps: TSteps }>;

function formReducer<TSteps extends Record<string, unknown>>(
  state: TSteps,
  action: FormAction<TSteps>,
): TSteps {
  switch (action.type) {
    case "UPDATE_STEP":
      return { ...state, [action.stepKey]: action.value };
    case "PATCH_STEP": {
      const prev = state[action.stepKey];
      const merged =
        prev && typeof prev === "object" && !Array.isArray(prev)
          ? { ...(prev as object), ...action.partial }
          : action.partial;
      return { ...state, [action.stepKey]: merged as TSteps[keyof TSteps] };
    }
    case "RESET":
      return action.initial;
    case "HYDRATE":
      return action.steps;
    default:
      return state;
  }
}

function readPersistedSteps<TSteps extends Record<string, unknown>>(
  storageKey: string,
  fallback: TSteps,
): TSteps {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw?.trim()) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return { ...fallback, ...(parsed as TSteps) };
  } catch {
    return fallback;
  }
}

function writePersistedSteps<TSteps extends Record<string, unknown>>(
  storageKey: string,
  steps: TSteps,
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(steps));
  } catch {
    // ignore quota / private mode
  }
}

export type FormContextValue<TSteps extends Record<string, unknown>> = Readonly<{
  steps: TSteps;
  updateStep: <K extends keyof TSteps>(stepKey: K, value: TSteps[K]) => void;
  patchStep: <K extends keyof TSteps>(
    stepKey: K,
    partial: Partial<TSteps[K]>,
  ) => void;
  resetForm: () => void;
  dispatch: Dispatch<FormAction<TSteps>>;
}>;

const FormContext = createContext<FormContextValue<Record<string, unknown>> | null>(null);

export type FormProviderProps<TSteps extends Record<string, unknown>> = Readonly<{
  children: ReactNode;
  initialSteps: TSteps;
  /** When set, selections survive full page refresh. */
  storageKey?: string;
}>;

export function FormProvider<TSteps extends Record<string, unknown>>({
  children,
  initialSteps,
  storageKey,
}: FormProviderProps<TSteps>) {
  const [steps, dispatch] = useReducer(
    formReducer<TSteps>,
    initialSteps,
    (init) => (storageKey ? readPersistedSteps(storageKey, init) : init),
  );

  useEffect(() => {
    if (!storageKey) return;
    writePersistedSteps(storageKey, steps);
  }, [storageKey, steps]);

  const updateStep = useCallback(<K extends keyof TSteps>(stepKey: K, value: TSteps[K]) => {
    dispatch({ type: "UPDATE_STEP", stepKey, value });
  }, []);

  const patchStep = useCallback(
    <K extends keyof TSteps>(stepKey: K, partial: Partial<TSteps[K]>) => {
      dispatch({ type: "PATCH_STEP", stepKey, partial });
    },
    [],
  );

  const resetForm = useCallback(() => {
    dispatch({ type: "RESET", initial: initialSteps });
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [initialSteps, storageKey]);

  const value = useMemo(
    (): FormContextValue<TSteps> => ({
      steps,
      updateStep,
      patchStep,
      resetForm,
      dispatch,
    }),
    [steps, updateStep, patchStep, resetForm],
  );

  return (
    <FormContext.Provider value={value as FormContextValue<Record<string, unknown>>}>
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext<TSteps extends Record<string, unknown>>(): FormContextValue<TSteps> {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormContext must be used within a FormProvider");
  }
  return ctx as FormContextValue<TSteps>;
}

/** Read + update a single wizard step from the global store. */
export function useFormStep<K extends keyof TSteps, TSteps extends Record<string, unknown>>(
  stepKey: K,
): readonly [TSteps[K], (value: TSteps[K]) => void, (partial: Partial<TSteps[K]>) => void] {
  const { steps, updateStep, patchStep } = useFormContext<TSteps>();
  const setValue = useCallback(
    (value: TSteps[K]) => {
      updateStep(stepKey, value);
    },
    [stepKey, updateStep],
  );
  const patchValue = useCallback(
    (partial: Partial<TSteps[K]>) => {
      patchStep(stepKey, partial);
    },
    [stepKey, patchStep],
  );
  return [steps[stepKey], setValue, patchValue] as const;
}
