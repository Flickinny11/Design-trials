'use client';

// GenericComposite — the REALIZED form of a non-bound composite subgraph (footer /
// card; spec §4.3). Every static member is rendered as a real backing NODE via
// CompositeMemberMesh, stacked in 3D by its root-relative local transform.

import type { WornMaps } from '@/components/editor/chassis/materials';
import { CompositeMemberMesh } from './CompositeMemberMesh';
import type { CompositeSchema } from './composite-schema';

export interface GenericCompositeProps {
  composite: CompositeSchema;
  maps: Record<string, WornMaps>;
  selected: boolean;
  onSelect: (compositeId: string) => void;
  /** WORLD root (effectiveRoot) — overrides composite.root when stacked (P-5 §6.1). */
  worldRoot?: { x: number; y: number; z: number };
}

const INTERACTIVE_ROLES = new Set(['footer-link', 'card-cta', 'prim-pane', 'prim-cube']);

export function GenericComposite({ composite, maps, selected, onSelect, worldRoot }: GenericCompositeProps) {
  const r = worldRoot ?? composite.root;
  return (
    <group position={[r.x, r.y, r.z]}>
      {composite.staticMembers.map((m) => (
        <CompositeMemberMesh
          key={m.memberId}
          member={m}
          compositeId={composite.compositeId}
          maps={maps}
          selected={selected && m.parentMemberId === null}
          onSelect={onSelect}
          interactive={INTERACTIVE_ROLES.has(m.role)}
        />
      ))}
    </group>
  );
}
