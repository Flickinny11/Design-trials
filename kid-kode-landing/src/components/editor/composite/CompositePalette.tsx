'use client';

// CompositePalette — the in-canvas, ZERO-DOM control bar for /composite-lab. Worn-
// alloy chips (the chassis vocabulary) to: instantiate a composite SUBGRAPH (nav /
// footer / card), toggle galaxy ⇄ canvas, and drive the binding demo (ADD PAGE /
// REMOVE PAGE — add a hub and watch the bound nav grow when auto-add is ON).

import { useWornMaps } from '@/components/editor/chassis/materials';
import { CompositeChip } from './CompositeChip';
import { CompositeText } from './CompositeText';
import { useCompositeStore } from './use-composite-store';

const PALETTE_Y = -5.5;

export function CompositePalette() {
  const maps = useWornMaps();
  const instantiate = useCompositeStore((s) => s.instantiateComposite);
  const viewMode = useCompositeStore((s) => s.viewMode);
  const setView = useCompositeStore((s) => s.setView);
  const addHub = useCompositeStore((s) => s.addHub);
  const removeHub = useCompositeStore((s) => s.removeHub);
  const hubs = useCompositeStore((s) => s.hubs);

  return (
    <group position={[0, PALETTE_Y, 0]}>
      <CompositeText position={[-5.7, 0.66, 0]} fontSize={0.14} letterSpacing={0.16} anchorX="left" variant="bright">
        COMPOSITE LIBRARY
      </CompositeText>

      {/* instantiate templates */}
      <CompositeChip maps={maps.sapphire} position={[-5.2, 0, 0]} onClick={() => instantiate('nav-header')} label="NAV" size={0.56} />
      <CompositeChip maps={maps.bronze} position={[-4.0, 0, 0]} onClick={() => instantiate('footer')} label="FOOTER" size={0.56} />
      <CompositeChip maps={maps.emerald} position={[-2.8, 0, 0]} onClick={() => instantiate('card')} label="CARD" size={0.56} />

      {/* view toggle */}
      <CompositeChip maps={maps.gunmetal} position={[-0.9, 0, 0]} onClick={() => setView('galaxy')} active={viewMode === 'galaxy'} label="GALAXY" tint="#aebfd2" size={0.56} />
      <CompositeChip maps={maps.gunmetal} position={[0.3, 0, 0]} onClick={() => setView('canvas')} active={viewMode === 'canvas'} label="CANVAS" tint="#cfe0ee" size={0.56} />

      {/* binding demo drivers */}
      <CompositeChip maps={maps.emerald} position={[2.2, 0, 0]} onClick={() => addHub()} label="ADD PAGE" tint="#a9e6c4" size={0.56} />
      <CompositeChip maps={maps.oxblood} position={[3.4, 0, 0]} onClick={() => { const last = hubs[hubs.length - 1]; if (last) removeHub(last.hubId); }} label="REMOVE PAGE" tint="#e29aa6" size={0.56} />
    </group>
  );
}
