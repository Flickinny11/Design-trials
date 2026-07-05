'use client';

// PRISM SHELL — LIVE PRESENCE OVERLAY (SHELL W7, decision E, spec §6.9.2)
//
// A DOM overlay OVER the engine preview (I0-respecting: shell DOM above the
// engine container, never inside the WebGPU scene) that draws each remote
// collaborator's live cursor, editing badge, and camera-mode ghost. Ephemeral
// — driven entirely by the collab store's presence map, which expires stale
// actors locally. pointer-events:none so it never steals input from the engine.

import { colorForSeed, useCollabStore, useOthers } from '@/lib/shell/collab-store';

export default function PresenceLayer() {
  const others = useOthers();
  const status = useCollabStore((s) => s.status);
  if (status !== 'live' || others.length === 0) return null;

  return (
    <div className="bw1-presence" aria-hidden>
      {others.map((p) => {
        const tint = colorForSeed(p.actor.colorSeed);
        const initials = p.actor.displayName.trim().slice(0, 1).toUpperCase();
        return (
          <div key={p.actor.actorId} className="bw1-presence-actor">
            {p.cursor ? (
              <div
                className="bw1-cursor"
                style={{
                  left: `${Math.min(100, Math.max(0, p.cursor.x * 100))}%`,
                  top: `${Math.min(100, Math.max(0, p.cursor.y * 100))}%`,
                  ['--pp-cursor' as string]: tint,
                }}
              >
                <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
                  <path
                    d="M1 1L1 17L5.2 13.2L8 20L11 18.6L8.2 12L14 12L1 1Z"
                    fill={tint}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth="1"
                  />
                </svg>
                <span className="bw1-cursor-label" style={{ background: tint }}>
                  {p.actor.displayName}
                  {p.editingNodeId ? <em className="bw1-cursor-editing">editing</em> : null}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Small "who's here" chip stack. Shows self implicitly via the store's
 *  connection; used both in the TopBar and the presence badge. */
export function PresenceCount() {
  const others = useOthers();
  const status = useCollabStore((s) => s.status);
  if (status !== 'live') return null;
  return (
    <span className="bw1-presence-count" title={`${others.length} other collaborator(s) live`}>
      <span className="bw1-presence-dot" aria-hidden />
      {others.length + 1} live
    </span>
  );
}
