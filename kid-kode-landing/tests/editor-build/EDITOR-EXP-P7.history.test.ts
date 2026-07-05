/**
 * EDITOR-EXP P7 (C32/C33) — temporal edit-history behavior on
 * useGraphSourceStore (zundo).
 *
 * Verifies the load-bearing store-level contract without a browser:
 *   - the temporal store exists with pastStates/futureStates/undo/redo
 *   - a single edit records ONE undo step (after the debounce flush)
 *   - a burst of rapid edits coalesces into ONE undo step (handleSet debounce)
 *   - undo reverts the schema; redo re-applies it
 *   - the metadata log (getHistoryMeta) stays in lockstep with pastStates and
 *     carries the mutator-supplied description
 *   - transient flag flips (markDirty / saveToServer's isDirty) do NOT create
 *     undo steps (partialize + equality)
 *
 * Uses fake timers to drive the 400ms history debounce deterministically.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useGraphSourceStore,
  getHistoryMeta,
  getTemporalStore,
} from "@/stores/useGraphSourceStore";
import type { PrismHub, PrismNode } from "@/lib/prism-graph/types";

const HUB: PrismHub = {
  hubId: "hub-1",
  // minimal hub — extra required fields are tolerated as unknowns by the store
} as unknown as PrismHub;

function makeNode(id: string, caption: string): PrismNode {
  return {
    nodeId: id,
    subtype: "card",
    parentHubId: "hub-1",
    serviceTag: "none",
    visual: {} as PrismNode["visual"],
    intent: { caption } as PrismNode["intent"],
    codeRef: "",
    backendRef: null,
  } as PrismNode;
}

function seed(): void {
  // load() is the real bulk-load path: it runs through runBulkLoad, which
  // PAUSES temporal tracking (so the load is never an undo step) and CLEARS
  // both the zundo history and the metadata log. That gives every test a
  // pristine, lockstepped baseline — exactly what boot does in the app.
  useGraphSourceStore.getState().load({
    schemaVersion: "0.1.0",
    hub: HUB,
    nodes: [makeNode("n1", "Headline"), makeNode("n2", "Orr Arrival Watch")],
    edges: [],
  } as never);
  // Flush any debounce timer left over from a prior test's edits.
  vi.advanceTimersByTime(1000);
  getTemporalStore().getState().clear();
}

beforeEach(() => {
  vi.useFakeTimers();
  seed();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EDITOR-EXP P7 — temporal store surface", () => {
  it("exposes a temporal store with the zundo surface", () => {
    const t = getTemporalStore().getState();
    expect(Array.isArray(t.pastStates)).toBe(true);
    expect(Array.isArray(t.futureStates)).toBe(true);
    expect(typeof t.undo).toBe("function");
    expect(typeof t.redo).toBe("function");
    expect(typeof t.clear).toBe("function");
  });
});

describe("EDITOR-EXP P7 — single edit + debounce coalescing", () => {
  it("records ONE undo step after a single edit (post-debounce)", () => {
    useGraphSourceStore.getState().updateNode("n1", {
      intent: { caption: "Headline v2" } as PrismNode["intent"],
    });
    // before the debounce flush, nothing recorded yet
    expect(getTemporalStore().getState().pastStates.length).toBe(0);
    vi.advanceTimersByTime(500);
    expect(getTemporalStore().getState().pastStates.length).toBe(1);
    expect(getHistoryMeta().length).toBe(1);
  });

  it("coalesces a burst of edits into ONE undo step", () => {
    const upd = useGraphSourceStore.getState().updateNode;
    // 10 rapid edits within the debounce window
    for (let i = 0; i < 10; i += 1) {
      upd("n2", { intent: { caption: `Orr v${i}` } as PrismNode["intent"] });
      vi.advanceTimersByTime(50); // < 400ms each → keeps re-debouncing
    }
    vi.advanceTimersByTime(500); // flush
    expect(getTemporalStore().getState().pastStates.length).toBe(1);
    expect(getHistoryMeta().length).toBe(1);
  });
});

describe("EDITOR-EXP P7 — undo/redo reverts + reapplies schema", () => {
  it("undo restores the pre-edit caption; redo reapplies", () => {
    useGraphSourceStore.getState().updateNode("n1", {
      intent: { caption: "Edited Headline" } as PrismNode["intent"],
    });
    vi.advanceTimersByTime(500);
    expect(
      useGraphSourceStore.getState().nodes.find((n) => n.nodeId === "n1")!
        .intent.caption,
    ).toBe("Edited Headline");

    getTemporalStore().getState().undo(1);
    expect(
      useGraphSourceStore.getState().nodes.find((n) => n.nodeId === "n1")!
        .intent.caption,
    ).toBe("Headline");

    getTemporalStore().getState().redo(1);
    expect(
      useGraphSourceStore.getState().nodes.find((n) => n.nodeId === "n1")!
        .intent.caption,
    ).toBe("Edited Headline");
  });
});

describe("EDITOR-EXP P7 — metadata label + transient exclusion", () => {
  it("labels the step from the mutator (updateNode → Rename)", () => {
    useGraphSourceStore.getState().updateNode("n2", {
      intent: { caption: "Renamed" } as PrismNode["intent"],
    });
    vi.advanceTimersByTime(500);
    const meta = getHistoryMeta();
    expect(meta.length).toBe(1);
    // describeNodePatch maps an intent.caption patch to "Rename <name>".
    expect(meta[0].description.startsWith("Rename")).toBe(true);
    expect(typeof meta[0].timestamp).toBe("number");
  });

  it("does NOT record an undo step for a transient isDirty flip", () => {
    useGraphSourceStore.getState().markDirty(true);
    vi.advanceTimersByTime(500);
    expect(getTemporalStore().getState().pastStates.length).toBe(0);
    expect(getHistoryMeta().length).toBe(0);
  });

  it("strips the per-node dirty flag from tracked state (markNodeDirty alone is no-op for history)", () => {
    useGraphSourceStore.getState().markNodeDirty("n1", true);
    vi.advanceTimersByTime(500);
    expect(getTemporalStore().getState().pastStates.length).toBe(0);
  });
});

describe("EDITOR-EXP P7 — limit", () => {
  it("keeps at most 100 undo steps + meta entries in lockstep", () => {
    const upd = useGraphSourceStore.getState().updateNode;
    for (let i = 0; i < 130; i += 1) {
      upd("n1", { intent: { caption: `c${i}` } as PrismNode["intent"] });
      vi.advanceTimersByTime(500); // flush each as its own step
    }
    const past = getTemporalStore().getState().pastStates.length;
    expect(past).toBeLessThanOrEqual(100);
    expect(getHistoryMeta().length).toBe(past);
  });
});
