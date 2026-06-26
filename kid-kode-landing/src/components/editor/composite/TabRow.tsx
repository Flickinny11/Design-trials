'use client';

// TabRow — one editable row of the bound nav binding (spec §4.2.2): a page (or a
// pinned manual item) with worn-cube chips to REORDER (↑ ↓), HIDE/SHOW (pages), or
// REMOVE (manual items), plus RENAME. Rename is a zero-DOM affordance: it cycles the
// label through a small curated set of alternates (typing has no place in a 3D-native
// editor) — enough to prove the bound label is user-overridable and re-derives live.

import { useMemo } from 'react';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { CompositeChip } from './CompositeChip';
import { CompositeText } from './CompositeText';
import { useCompositeStore } from './use-composite-store';

const ALTS = ['Home', 'Start', 'Discover', 'Explore', 'Overview', 'Hello', 'Index'];
function nextLabel(current: string): string {
  const i = ALTS.indexOf(current);
  // pick the next alternate that differs from the current label.
  for (let k = 1; k <= ALTS.length; k++) {
    const cand = ALTS[(i + k + ALTS.length) % ALTS.length];
    if (cand !== current) return cand;
  }
  return 'Start';
}

export interface RowDesc {
  key: string;
  label: string;
  hubId: string | null;
  manualId?: string;
  manual: boolean;
  hidden: boolean;
}

export function TabRow({
  row,
  compositeId,
  maps,
  y,
  halfW,
  labelZ,
  knobZ,
}: {
  row: RowDesc;
  compositeId: string;
  maps: Record<string, WornMaps>;
  y: number;
  halfW: number;
  labelZ: number;
  knobZ: number;
}) {
  const reorderTab = useCompositeStore((s) => s.reorderTab);
  const hideHub = useCompositeStore((s) => s.hideHub);
  const showHub = useCompositeStore((s) => s.showHub);
  const renameTab = useCompositeStore((s) => s.renameTab);
  const removeManualItem = useCompositeStore((s) => s.removeManualItem);

  const chipX = useMemo(() => [halfW - 1.62, halfW - 1.24, halfW - 0.86, halfW - 0.42], [halfW]);
  const sz = 0.26;

  return (
    <group position={[0, y, 0]}>
      <CompositeText position={[-halfW + 0.42, 0, labelZ]} fontSize={0.135} letterSpacing={0.04} anchorX="left" variant={row.hidden ? 'engraved' : 'bright'}>
        {row.hidden ? `( ${row.label} )` : row.label}
      </CompositeText>

      {/* reorder up / down */}
      <CompositeChip maps={maps.gunmetal} position={[chipX[0], 0, knobZ]} onClick={() => reorderTab(compositeId, row.key, -1)} tint="#aebfd2" size={sz} />
      <CompositeChip maps={maps.gunmetal} position={[chipX[1], 0, knobZ]} onClick={() => reorderTab(compositeId, row.key, 1)} tint="#9fb0c4" size={sz} />

      {/* rename (hub tabs only) */}
      {!row.manual && row.hubId && (
        <CompositeChip maps={maps.sapphire} position={[chipX[2], 0, knobZ]} onClick={() => renameTab(compositeId, row.hubId!, nextLabel(row.label))} tint="#a9d6ff" size={sz} />
      )}

      {/* hide / show (hub tabs) or remove (manual items) */}
      {row.manual ? (
        <CompositeChip maps={maps.oxblood} position={[chipX[3], 0, knobZ]} onClick={() => row.manualId && removeManualItem(compositeId, row.manualId)} tint="#e29aa6" size={sz} />
      ) : (
        <CompositeChip
          maps={row.hidden ? maps.emerald : maps.oxblood}
          position={[chipX[3], 0, knobZ]}
          onClick={() => (row.hidden ? showHub(compositeId, row.hubId!) : hideHub(compositeId, row.hubId!))}
          tint={row.hidden ? '#a9e6c4' : '#e29aa6'}
          size={sz}
        />
      )}
    </group>
  );
}
