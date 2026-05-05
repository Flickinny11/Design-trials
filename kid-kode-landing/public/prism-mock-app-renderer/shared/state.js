export function createStateManager(initial = {}) {
  const store = new Map(Object.entries(initial));
  const listeners = new Map();
  return {
    get(key) { return store.get(key); },
    set(key, value) {
      if (store.get(key) === value) return;
      store.set(key, value);
      const set = listeners.get(key);
      if (!set) return;
      for (const h of Array.from(set)) { try { h(value); } catch (e) { console.error(e); } }
    },
    subscribe(key, handler) {
      let set = listeners.get(key);
      if (!set) { set = new Set(); listeners.set(key, set); }
      set.add(handler);
      return () => set.delete(handler);
    },
    snapshot() { return Object.fromEntries(store); },
  };
}
