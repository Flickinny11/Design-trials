// In-memory KV store with async API matching the contract expected by backend
// handlers (§6 example `await ctx.fakeDb.get('key')`).

export interface FakeDb {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  snapshot(): Record<string, unknown>;
}

export function createFakeDb(initial: Record<string, unknown> = {}): FakeDb {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    async get<T>(key: string) { return store.get(key) as T | undefined; },
    async set<T>(key: string, value: T) { store.set(key, value); },
    async delete(key: string) { return store.delete(key); },
    snapshot() { return Object.fromEntries(store); },
  };
}
