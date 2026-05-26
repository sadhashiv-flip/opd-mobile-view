import { NavigationType, useNavigationType } from "react-router-dom";

/** True when this route entry was reached via browser/history back (not a forward navigation). */
export function useHistoryBackEntry(): boolean {
  return useNavigationType() === NavigationType.Pop;
}
