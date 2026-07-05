'use client';

// PRISM EDITOR INTEGRATION — I-2: the REAL toolbar, DOCKED.
//
// This is the committed /toolbar-chassis toolbar mounted into the editor's top
// dock band — LITERALLY its pieces: the milled transmission GlassPane, the 14
// worn-alloy CubeButtons (FaceGlyph engraved marks + hover-spin see-through),
// laid out by the chassis LAYOUT. It matches the approved glass look by
// construction because it IS that glass.
//
// Two adaptations for the editor (both additive, lab untouched):
//   • Section labels render via CompositeText (MSDF) instead of the lab's Troika
//     <Text> — Troika raw ShaderMaterials do not compile on the WebGPU renderer
//     the /editor canvas uses (P-3 finding); MSDF is the WebGPU-native path.
//   • Each cube's onSelect dispatches a REAL operation on the live app graph /
//     scene (editor-toolbar-actions) — CREATE adds a node that appears in galaxy
//     + canvas (INV-0.3), SCENE relights/repaints, etc.
//
// The toolbar is editor CHROME (not a graph node) — it is NOT tagged
// prismEditorNode, so the node-authorship gate correctly ignores it.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { GlassPane } from '@/components/editor/chassis/GlassPane';
import { CubeButton } from '@/components/editor/chassis/CubeButton';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { LAYOUT, FRONT_Z, type PlacedButton } from '@/components/editor/chassis/chassis-config';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { makeGlowTexture } from './editor-shell-glass';
import { runToolbarAction } from './editor-toolbar-actions';

// One shared soft-glow lobe behind the pane → the transmission glass reads
// luminous (the same chassis/dock trick the I-1 docks use).
const GLOW_TEX = makeGlowTexture();

// Dock placement: the chassis pane (≈13.5 × 3.55u) sits in the top band, in
// front of the viewport (z), so the glass refracts the graph + backdrop behind.
const DOCK_POS: [number, number, number] = [0, 5.9, 1.0];
const LABEL_FONT = 0.3;

/** Headless-verification probes (editor chrome — window exemption, same as the
 *  other editor-shell probes). Lets the behavioral pass invoke a toolbar
 *  function directly AND resolve each cube's world center for a trusted click. */
function ToolbarProbe({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_EDITOR_TOOLBAR_FN__ = (id: string) => runToolbarAction(id);
    w.__PRISM_EDITOR_TOOLBAR_POS__ = () => {
      const g = groupRef.current;
      if (!g) return [];
      g.updateWorldMatrix(true, true);
      return LAYOUT.buttons.map((b) => {
        const v = new THREE.Vector3(b.x, b.y, FRONT_Z);
        g.localToWorld(v);
        return { id: b.fn.id, label: b.fn.label, world: [v.x, v.y, v.z] as [number, number, number] };
      });
    };
    w.__PRISM_EDITOR_TOOLBAR_LIST__ = () => LAYOUT.buttons.map((b) => ({ id: b.fn.id, label: b.fn.label, section: b.sectionId }));
    void scene; // referenced so the hook subscribes to the scene
  }
  return null;
}

export function EditorToolbarDock() {
  const maps = useWornMaps();
  const groupRef = useRef<THREE.Group | null>(null);

  const glowGeo = useMemo(() => new THREE.PlaneGeometry(LAYOUT.paneW * 1.1, LAYOUT.paneH * 1.5), []);
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: GLOW_TEX,
        transparent: true,
        toneMapped: false,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const onSelect = (btn: PlacedButton) => {
    runToolbarAction(btn.fn.id);
  };

  return (
    <group
      ref={(g) => {
        groupRef.current = g;
        if (g) g.userData.prismEditorToolbar = true;
      }}
      position={DOCK_POS}
    >
      {/* soft glow behind the glass */}
      <mesh geometry={glowGeo} material={glowMat} position={[0, 0, -1.3]} />

      {/* the REAL milled glass pane (one cutout per button) */}
      <GlassPane />

      {/* the 14 worn-alloy cube buttons, chassis layout, click-wired to the graph */}
      {LAYOUT.buttons.map((b) => (
        <CubeButton
          key={b.fn.id}
          btn={b}
          maps={maps[b.textureKey]}
          onHover={() => {}}
          onSelect={onSelect}
        />
      ))}

      {/* engraved section labels (MSDF — WebGPU-native, not Troika) */}
      {LAYOUT.labels.map((l) => (
        <CompositeText
          key={l.sectionId}
          position={[l.x, l.y, FRONT_Z + 0.02]}
          fontSize={LABEL_FONT}
          variant="engraved"
          anchorX="center"
        >
          {l.text}
        </CompositeText>
      ))}

      <ToolbarProbe groupRef={groupRef} />
    </group>
  );
}
