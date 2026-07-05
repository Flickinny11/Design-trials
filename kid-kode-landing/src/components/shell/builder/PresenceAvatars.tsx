'use client';

// PRISM SHELL — PRESENCE AVATAR STACK (SHELL W7, decision E)
//
// The TopBar "who's in this room" cluster: one tinted chip per live actor
// (self + others). Reads the collab store only; renders nothing until the room
// is live, so a solo/enterprise-off session shows no multiplayer chrome.

import { colorForSeed, useCollabStore, useOthers } from '@/lib/shell/collab-store';

export default function PresenceAvatars({ selfName }: { selfName: string }) {
  const others = useOthers();
  const status = useCollabStore((s) => s.status);
  const selfActorId = useCollabStore((s) => s.selfActorId);
  if (status !== 'live') return null;

  const chips = [
    { id: selfActorId ?? 'self', name: selfName, seed: hashSeed(selfActorId ?? selfName), self: true },
    ...others.map((p) => ({
      id: p.actor.actorId,
      name: p.actor.displayName,
      seed: p.actor.colorSeed,
      self: false,
    })),
  ];

  return (
    <div className="bw1-avatars" aria-label={`${chips.length} collaborators present`}>
      {chips.slice(0, 5).map((c) => (
        <span
          key={c.id}
          className="bw1-avatar"
          style={{ background: colorForSeed(c.seed) }}
          title={c.self ? `${c.name} (you)` : c.name}
        >
          {c.name.trim().slice(0, 1).toUpperCase()}
        </span>
      ))}
      {chips.length > 5 ? <span className="bw1-avatar bw1-avatar-more">+{chips.length - 5}</span> : null}
    </div>
  );
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
