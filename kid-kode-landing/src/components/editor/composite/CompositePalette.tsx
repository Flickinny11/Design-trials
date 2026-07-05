'use client';

// CompositePalette — the in-canvas, ZERO-DOM control bar for /composite-lab. Worn-
// alloy chips (the chassis vocabulary) on two rows:
//   ROW 1 (library + view + binding demo) — instantiate a composite SUBGRAPH (nav /
//          footer / card), toggle galaxy ⇄ canvas, ADD / REMOVE PAGE (binding demo).
//   ROW 2 (P-5 composition, spec §6) — drop free PANE / CUBE atoms, switch the
//          interaction MODE (SELECT / MOVE / CONNECT), toggle SNAP + GRID, and the
//          saved (user-grown) templates the user re-instantiates.

import { useWornMaps } from '@/components/editor/chassis/materials';
import { CompositeChip } from './CompositeChip';
import { CompositeText } from './CompositeText';
import { useCompositeStore } from './use-composite-store';

const ROW1_Y = -5.2;
const ROW2_Y = -6.3;

export function CompositePalette() {
  const maps = useWornMaps();
  const instantiate = useCompositeStore((s) => s.instantiateComposite);
  const viewMode = useCompositeStore((s) => s.viewMode);
  const setView = useCompositeStore((s) => s.setView);
  const addHub = useCompositeStore((s) => s.addHub);
  const removeHub = useCompositeStore((s) => s.removeHub);
  const hubs = useCompositeStore((s) => s.hubs);

  const editorMode = useCompositeStore((s) => s.editorMode);
  const setEditorMode = useCompositeStore((s) => s.setEditorMode);
  const snapEnabled = useCompositeStore((s) => s.snapEnabled);
  const showGrid = useCompositeStore((s) => s.showGrid);
  const toggleSnap = useCompositeStore((s) => s.toggleSnap);
  const toggleGrid = useCompositeStore((s) => s.toggleGrid);
  const userTemplates = useCompositeStore((s) => s.userTemplates);
  const instantiateUserTemplate = useCompositeStore((s) => s.instantiateUserTemplate);

  return (
    <group>
      {/* ── ROW 1 — composite library + view + binding demo ── */}
      <group position={[0, ROW1_Y, 0]}>
        <CompositeText position={[-5.7, 0.62, 0]} fontSize={0.13} letterSpacing={0.16} anchorX="left" variant="bright">
          COMPOSITE LIBRARY
        </CompositeText>
        <CompositeChip maps={maps.sapphire} position={[-5.2, 0, 0]} onClick={() => instantiate('nav-header')} label="NAV" size={0.5} />
        <CompositeChip maps={maps.bronze} position={[-4.1, 0, 0]} onClick={() => instantiate('footer')} label="FOOTER" size={0.5} />
        <CompositeChip maps={maps.emerald} position={[-3.0, 0, 0]} onClick={() => instantiate('card')} label="CARD" size={0.5} />
        <CompositeChip maps={maps.gunmetal} position={[-1.3, 0, 0]} onClick={() => setView('galaxy')} active={viewMode === 'galaxy'} label="GALAXY" tint="#aebfd2" size={0.5} />
        <CompositeChip maps={maps.gunmetal} position={[-0.2, 0, 0]} onClick={() => setView('canvas')} active={viewMode === 'canvas'} label="CANVAS" tint="#cfe0ee" size={0.5} />
        <CompositeChip maps={maps.emerald} position={[1.5, 0, 0]} onClick={() => addHub()} label="ADD PAGE" tint="#a9e6c4" size={0.5} />
        <CompositeChip maps={maps.oxblood} position={[2.6, 0, 0]} onClick={() => { const last = hubs[hubs.length - 1]; if (last) removeHub(last.hubId); }} label="REMOVE PAGE" tint="#e29aa6" size={0.5} />
      </group>

      {/* ── ROW 2 — P-5 composition (atoms · mode · snap/grid · saved) ── */}
      <group position={[0, ROW2_Y, 0]}>
        <CompositeText position={[-5.7, 0.5, 0]} fontSize={0.13} letterSpacing={0.16} anchorX="left" variant="bright">
          COMPOSITION
        </CompositeText>
        {/* atoms */}
        <CompositeChip maps={maps.sapphire} position={[-5.2, 0, 0]} onClick={() => instantiate('pane')} label="+ PANE" tint="#bcd9ff" size={0.5} />
        <CompositeChip maps={maps.gunmetal} position={[-4.1, 0, 0]} onClick={() => instantiate('cube')} label="+ CUBE" tint="#cfd8e2" size={0.5} />
        {/* interaction mode */}
        <CompositeChip maps={maps.bronze} position={[-2.6, 0, 0]} onClick={() => setEditorMode('select')} active={editorMode === 'select'} label="SELECT" tint="#e6c79a" size={0.5} />
        <CompositeChip maps={maps.emerald} position={[-1.5, 0, 0]} onClick={() => setEditorMode('move')} active={editorMode === 'move'} label="MOVE" tint="#a9e6c4" size={0.5} />
        <CompositeChip maps={maps.sapphire} position={[-0.4, 0, 0]} onClick={() => setEditorMode('connect')} active={editorMode === 'connect'} label="CONNECT" tint="#a9d6ff" size={0.5} />
        {/* snapping */}
        <CompositeChip maps={maps.gunmetal} position={[1.1, 0, 0]} onClick={toggleSnap} active={snapEnabled} label="SNAP" tint={snapEnabled ? '#a9e6c4' : '#7d8a99'} size={0.5} />
        <CompositeChip maps={maps.gunmetal} position={[2.2, 0, 0]} onClick={toggleGrid} active={showGrid} label="GRID" tint={showGrid ? '#cfe0ee' : '#7d8a99'} size={0.5} />
        {/* saved (user-grown) templates → re-instantiate as subgraphs (§6.4) */}
        {userTemplates.slice(-3).map((t, i) => (
          <CompositeChip key={t.templateId} maps={maps.emerald} position={[3.7 + i * 1.1, 0, 0]} onClick={() => instantiateUserTemplate(t.templateId)} label={t.name.toUpperCase()} tint="#9fe7c4" size={0.5} />
        ))}
      </group>
    </group>
  );
}
