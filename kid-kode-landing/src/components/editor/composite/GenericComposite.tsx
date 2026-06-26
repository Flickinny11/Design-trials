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
}

const INTERACTIVE_ROLES = new Set(['footer-link', 'card-cta']);

export function GenericComposite({ composite, maps, selected, onSelect }: GenericCompositeProps) {
  const r = composite.root;
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
