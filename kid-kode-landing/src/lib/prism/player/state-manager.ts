// Reactive key→value state store. Used by nodes for shared state (theme,
// notifications-enabled, heroCtaClicks, …). subscribe() returns an off() handle.

export interface StateManager {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  subscribe<T = unknown>(key: string, handler: (value: T) => void): () => void;
  snapshot(): Record<string, unknown>;
}

export function createStateManager(
  initial: Record<string, unknown> = {},
): StateManager {
  const store = new Map<string, unknown>(Object.entries(initial));
  const listeners = new Map<string, Set<(v: unknown) => void>>();

  return {
    get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    set<T>(key: string, value: T) {
      const prev = store.get(key);
      if (prev === value) return;
      store.set(key, value);
      const set = listeners.get(key);
      if (!set) return;
      for (const h of Array.from(set)) {
        try {
          h(value as unknown);
        } catch (e) {
          console.error(`[state] listener for "${key}" threw:`, e);
        }
      }
    },
    subscribe<T>(key: string, handler: (value: T) => void) {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      const wrapped = (v: unknown) => handler(v as T);
      set.add(wrapped);
      return () => set!.delete(wrapped);
    },
    snapshot() {
      return Object.fromEntries(store);
    },
  };
}
