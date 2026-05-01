import { useEffect, useState } from "react";

/** Debounce a value (e.g. search text) for async/filter work — aligns with Flutter search debounce (~200ms). */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = globalThis.setTimeout(() => setDebounced(value), ms);
    return () => globalThis.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
