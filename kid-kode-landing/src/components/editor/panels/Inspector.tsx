'use client';

// Inspector panel — reads the selected node from the Prism runtime
// bridge (`window.__prism`) exposed by `src/lib/prism/player/boot.ts`.
// Every field rendered here comes from the compiled graph the player
// loaded at mount time, so this component works against any hub.json
// the runtime boots — no mock-app-specific string literals.
//
// Contract (see notes/editor-bridge.md):
//   - Subscribes to `events.on('node-selected', ({ nodeId }) => ...)`.
//     The emitter is `attachSelectEmitter(container, nodeId, events)`
//     in boot.ts, attached to every materialized node container.
//   - Looks up the node definition from `graph.nodes` (a flat array).
//   - Renders intent.caption, transform.{x,y,z,scale}, stateEffects.

import { useEffect, useState } from 'react';

type EventBusShape = {
  on: (event: string, handler: (payload: unknown) => void) => () => void;
};

type NodeShape = {
  nodeId: string;
  subtype?: string;
  parentHubId?: string;
  serviceTag?: string;
  intent?: {
    caption?: string;
    stateEffects?: string[];
  };
  visual?: {
    transform?: {
      x?: number;
      y?: number;
      z?: number;
      width?: number;
      height?: number;
      scale?: number;
    };
  };
};

type GraphShape = {
  nodes: ReadonlyArray<NodeShape>;
};

type BridgeShape = {
  events: EventBusShape;
  graph: GraphShape;
};

function getBridge(): BridgeShape | null {
  if (typeof window === 'undefined') return null;
  const g = globalThis as unknown as { __prism?: BridgeShape };
  return g.__prism ?? null;
}

function fmt(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export default function Inspector() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [node, setNode] = useState<NodeShape | null>(null);

  useEffect(() => {
    let off: (() => void) | null = null;
    let raf = 0;
    let cancelled = false;

    const attach = () => {
      if (cancelled) return;
      const bridge = getBridge();
      if (!bridge) {
        raf = requestAnimationFrame(attach);
        return;
      }
      const handler = (payload: unknown) => {
        if (cancelled) return;
        const { nodeId } =
          (payload as { nodeId?: unknown }) && typeof (payload as { nodeId?: unknown }).nodeId === 'string'
            ? (payload as { nodeId: string })
            : { nodeId: '' };
        if (!nodeId) return;
        const match = bridge.graph.nodes.find((n) => n.nodeId === nodeId) ?? null;
        setSelectedId(nodeId);
        setNode(match);
      };
      const unsubscribe = bridge.events.on('node-selected', handler);
      off = unsubscribe;
    };
    attach();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (off) off();
    };
  }, []);

  if (!selectedId || !node) return null;

  const transform = node.visual?.transform ?? {};
  const caption = node.intent?.caption ?? '';
  const stateEffects = node.intent?.stateEffects ?? [];

  return (
    <div
      data-component="prism-inspector"
      className="absolute z-40 right-0 top-0 bottom-0 w-full md:w-[420px] border-l border-white/10 flex flex-col overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, rgba(14,16,37,0.97) 0%, rgba(8,10,26,0.98) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.55)',
      }}
    >
      <header className="px-5 py-4 border-b border-white/5">
        <div className="text-[9px] font-mono tracking-widest text-white/40">INSPECTOR</div>
        <div
          className="font-display font-bold text-white text-lg leading-tight truncate"
          title={selectedId}
        >
          {selectedId}
        </div>
        {node.subtype ? (
          <div className="text-[10px] font-mono text-white/45 mt-0.5">{node.subtype}</div>
        ) : null}
      </header>

      <section className="px-5 py-4 border-b border-white/5">
        <div className="text-[9px] font-mono tracking-widest text-white/40 mb-1.5">CAPTION</div>
        <div className="text-sm text-white/80 leading-snug">
          {caption || <span className="italic text-white/35">(no intent.caption)</span>}
        </div>
      </section>

      <section className="px-5 py-4 border-b border-white/5">
        <div className="text-[9px] font-mono tracking-widest text-white/40 mb-2">TRANSFORM</div>
        <div className="grid grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">x</div>
            <div className="text-white/90">{fmt(transform.x)}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">y</div>
            <div className="text-white/90">{fmt(transform.y)}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">z</div>
            <div className="text-white/90">{fmt(transform.z)}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">scale</div>
            <div className="text-white/90">{fmt(transform.scale)}</div>
          </div>
        </div>
        {typeof transform.width === 'number' || typeof transform.height === 'number' ? (
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs font-mono">
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">width</div>
              <div className="text-white/90">{fmt(transform.width)}</div>
            </div>
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">height</div>
              <div className="text-white/90">{fmt(transform.height)}</div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="px-5 py-4">
        <div className="text-[9px] font-mono tracking-widest text-white/40 mb-2">STATE EFFECTS</div>
        {stateEffects.length === 0 ? (
          <div className="text-xs italic text-white/35">(none)</div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stateEffects.map((effect) => (
              <li
                key={effect}
                className="text-xs font-mono text-white/85 px-2.5 py-1.5 rounded bg-white/5 border border-white/5"
              >
                {effect}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
