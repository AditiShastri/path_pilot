import { useSyncExternalStore } from "react";
import { Provider } from "./models";

export type KeyStore = Partial<Record<Provider, string>>;

const STORAGE_KEY = "ai-key-vault";

// ---- Global store (outside React) ----
let keys: KeyStore = {};
const listeners = new Set<() => void>();

// ✅ stable server snapshot
const EMPTY_SNAPSHOT: KeyStore = {};

function load(): KeyStore {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

// IMPORTANT: initialize only on client
if (typeof window !== "undefined") {
  keys = load();
}

function emit() {
  for (const l of listeners) l();
}

function setAll(next: KeyStore) {
  keys = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emit();
}

export function setKey(provider: Provider, key: string) {
  setAll({ ...keys, [provider]: key });
}

export function removeKey(provider: Provider) {
  const copy = { ...keys };
  delete copy[provider];
  setAll(copy);
}

// ---- React hook ----
export function useKeyVault() {
  const state = useSyncExternalStore<KeyStore>(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => keys,                 // client snapshot
    () => EMPTY_SNAPSHOT       // ✅ cached server snapshot
  );

  return { keys: state, setKey, removeKey };
}
