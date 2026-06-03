import {
  profileImagePathFromRaw,
  profileInitialsFromRaw,
} from "@/lib/profileAvatarFromCache";
import {
  loadCachedProfileRaw,
  PROFILE_BODY_STORAGE_KEY,
  PROFILE_CACHE_UPDATED_EVENT,
} from "@/lib/profileCacheStorage";
import { useMemo, useSyncExternalStore } from "react";

export type CachedProfileAvatar = Readonly<{
  imagePath: string | null;
  initials: string;
}>;

function subscribe(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROFILE_BODY_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  globalThis.addEventListener("storage", onStorage);
  globalThis.addEventListener(PROFILE_CACHE_UPDATED_EVENT, onStoreChange);
  return () => {
    globalThis.removeEventListener("storage", onStorage);
    globalThis.removeEventListener(PROFILE_CACHE_UPDATED_EVENT, onStoreChange);
  };
}

/** Primitive snapshot — `useSyncExternalStore` requires stable referential equality between reads. */
function getSnapshot(): string {
  try {
    return localStorage.getItem(PROFILE_BODY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

export function useCachedProfileAvatar(): CachedProfileAvatar {
  const cachedText = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    const raw = cachedText.trim() ? loadCachedProfileRaw() : null;
    return {
      imagePath: profileImagePathFromRaw(raw),
      initials: profileInitialsFromRaw(raw),
    };
  }, [cachedText]);
}
