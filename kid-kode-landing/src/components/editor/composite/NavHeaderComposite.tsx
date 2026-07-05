'use client';

// NavHeaderComposite — the REALIZED (canvas) nav header SUBGRAPH (spec §4.1): a base
// pane node + a title pane node (stacked) + N tab pane nodes (one per page) + a
// dropdown node (liquid-glass). Every piece is a real backing NODE, stacked in 3D.
//
// The tabs are the BOUND VIEW over the hub set (spec §4.2): they come from
// `compositeMembers(composite, hubs)` which derives one tab per resolved NavTab.
// Add a hub (auto-add ON) → one more tab member → one more tab pane here, with zero
// wiring. Never hardcoded.

import { useMemo } from 'react';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { CompositeMemberMesh } from './CompositeMemberMesh';
import { DropdownNode } from './DropdownNode';
import { compositeMembers, type CompositeSchema, type LabHub } from './composite-schema';

export interface NavHeaderCompositeProps {
  composite: CompositeSchema;
  hubs: LabHub[];
  maps: Record<string, WornMaps>;
  selected: boolean;
  onSelect: (compositeId: string) => void;
  /** WORLD root (effectiveRoot) — overrides composite.root when stacked (P-5 §6.1). */
  worldRoot?: { x: number; y: number; z: number };
}

export function NavHeaderComposite({ composite, hubs, maps, selected, onSelect, worldRoot }: NavHeaderCompositeProps) {
  const members = useMemo(() => compositeMembers(composite, hubs), [composite, hubs]);

  const base = members.find((m) => m.role === 'nav-base');
  const title = members.find((m) => m.role === 'nav-title');
  const dropdown = members.find((m) => m.role === 'nav-dropdown');
  const tabs = members.filter((m) => m.role === 'nav-tab');
  const menuItems = members.filter((m) => m.role === 'nav-menu-item');

  const r = worldRoot ?? composite.root;
  return (
    <group position={[r.x, r.y, r.z]}>
      {base && <CompositeMemberMesh member={base} compositeId={composite.compositeId} maps={maps} selected={selected} onSelect={onSelect} />}
      {title && <CompositeMemberMesh member={title} compositeId={composite.compositeId} maps={maps} selected={false} onSelect={onSelect} />}
      {tabs.map((t) => (
        <CompositeMemberMesh key={t.memberId} member={t} compositeId={composite.compositeId} maps={maps} selected={false} onSelect={onSelect} interactive />
      ))}
      {dropdown && (
        <DropdownNode
          dropdown={dropdown}
          menuItems={menuItems}
          compositeId={composite.compositeId}
          maps={maps}
          selected={false}
          onSelect={onSelect}
        />
      )}
    </group>
  );
}
