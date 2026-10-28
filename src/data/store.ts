/**
 * Minimal external store for useSyncExternalStore. Updates go through an
 * updater that must return a new object (immutable); identical results do
 * not notify, so React bails out cheaply.
 */

export interface Store<T> {
  get(): T;
  set(updater: (prev: T) => T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(updater) {
      const next = updater(state);
      if (Object.is(next, state)) return;
      state = next;
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Human-readable message for any rejection value. */
export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    const s = JSON.stringify(error);
    return s && s !== "{}" ? s : "unknown error";
  } catch {
    return "unknown error";
  }
}
