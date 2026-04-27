// Simple event bus used by every node's ctx. Emit() is sync; on() returns an
// off() handle. All events flow through one bus so the SHR watchdog can
// observe triggersDownstream declarations vs actual firings.

export type EventHandler = (payload: unknown) => void;

export interface EventBus {
  emit(event: string, payload?: unknown): void;
  on(event: string, handler: EventHandler): () => void;
  once(event: string, handler: EventHandler): () => void;
  _recentEmissions: ReadonlyArray<{
    event: string;
    payload: unknown;
    at: number;
  }>;
}

export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<EventHandler>>();
  const recent: { event: string; payload: unknown; at: number }[] = [];
  const RING = 256;

  const bus: EventBus = {
    emit(event, payload) {
      recent.push({ event, payload, at: Date.now() });
      if (recent.length > RING) recent.splice(0, recent.length - RING);
      const set = listeners.get(event);
      if (!set) return;
      for (const h of Array.from(set)) {
        try {
          h(payload);
        } catch (e) {
          console.error(`[event-bus] handler for "${event}" threw:`, e);
        }
      }
    },
    on(event, handler) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },
    once(event, handler) {
      const off = bus.on(event, (p) => {
        off();
        handler(p);
      });
      return off;
    },
    get _recentEmissions() {
      return recent as ReadonlyArray<{
        event: string;
        payload: unknown;
        at: number;
      }>;
    },
  };
  return bus;
}
