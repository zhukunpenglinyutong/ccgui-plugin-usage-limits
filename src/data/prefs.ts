/**
 * Preferences backed by ctx.storage: loaded once (sanitized), changed via
 * immutable updaters, written back debounced. Save failures stay visible in
 * the settings section instead of being swallowed.
 */
import { DEFAULT_PREFS, sanitizePrefs, type Prefs } from "../domain/prefs.ts";
import { createStore, errorText, type Store } from "./store.ts";

export const PREFS_KEY = "prefs:v1";
const SAVE_DELAY_MS = 250;

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

export interface PrefsState {
  prefs: Prefs;
  loaded: boolean;
  saveError: string | null;
}

export interface PrefsService {
  store: Store<PrefsState>;
  get(): Prefs;
  load(): Promise<void>;
  update(fn: (p: Prefs) => Prefs): void;
  flush(): Promise<void>;
  dispose(): void;
}

export function createPrefs(storage: KV): PrefsService {
  const store = createStore<PrefsState>({ prefs: DEFAULT_PREFS, loaded: false, saveError: null });
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const save = async (): Promise<void> => {
    timer = null;
    if (!dirty) return;
    dirty = false;
    try {
      await storage.set(PREFS_KEY, store.get().prefs);
      store.set((s) => (s.saveError ? { ...s, saveError: null } : s));
    } catch (error) {
      store.set((s) => ({ ...s, saveError: errorText(error) }));
    }
  };

  return {
    store,
    get: () => store.get().prefs,
    async load() {
      try {
        const raw = await storage.get<unknown>(PREFS_KEY);
        // Edits made before the load resolved win over the stored copy.
        store.set((s) => ({ ...s, prefs: dirty ? s.prefs : sanitizePrefs(raw), loaded: true }));
      } catch (error) {
        store.set((s) => ({ ...s, loaded: true, saveError: errorText(error) }));
      }
    },
    update(fn) {
      store.set((s) => {
        const prefs = fn(s.prefs);
        return prefs === s.prefs ? s : { ...s, prefs };
      });
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    async flush() {
      if (timer) clearTimeout(timer);
      await save();
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (dirty) void save();
    },
  };
}
