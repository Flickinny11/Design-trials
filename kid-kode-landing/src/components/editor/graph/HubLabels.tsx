'use client';

// HubLabels — renders each hub's title as REAL MSDF letterforms (UI-FIDELITY-2:
// editor-chrome canvas2D labels → MSDF). The retired version drew 'bold 96px
// Inter' through ctx.fillText into a CanvasTexture'd Sprite; this one builds a
// Prism TextObject (src/lib/prism/text/) from the SAME core Inter atlas pair
// the editor already warms (/prism-assets/font-inter.msdf.{png,json}), via the
// shared font-registry cache (criterion 27). Placement matches the sprite
// version: hovering above the hub center, billboarded to the camera each
// frame, drawn over the scene (depthTest off). Until the atlas resolves the
// component renders nothing — there is no canvas2D fallback.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 4.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import type { EditorHubView } from '@/lib/prism-graph/view-model';
import type { TextSpec } from '@/lib/prism-graph/types';
import { createTextObject } from '@/lib/prism/text/text-object';
import type { LoadedFontAtlas } from '@/lib/prism/text/contract';
import { peekTextAtlas, resolveTextAtlas } from '@/lib/prism/runtime/shared/text-atlas';
// Wave-2E Chrome-Arc retint — label fill comes from the frozen DS tokens.
import { DS } from '@/components/editor/design-system';

interface HubCenter {
  x: number;
  y: number;
  z: number;
}

// Label metrics — sprite-parity: the retired canvas drew 96px glyphs into a
// 1024×256 texture scaled to 40×10 world units, so the em height here is
// 96 × (10 / 256) = 3.75 scene units, lifted 60 units above the hub center.
const LABEL_FONT_SIZE = 3.75;
const LABEL_LIFT_Y = 60;
// Inter 400 is the core-baked weight (the legacy atlas pair). 700 would route
// through the on-demand API bake — not worth a network bake for hub captions.
const LABEL_FONT_FAMILY = 'Inter';
const LABEL_FONT_WEIGHT = 400;

/** TextSpec for one hub title. The MSDF outline band (soft dark rim) replaces
 *  the canvas shadowBlur pass, and the low-intensity hub-color glow replaces
 *  the hub-tinted under-pass the canvas drew beneath the 0.92-alpha bone fill.
 *  decompose:'line' keeps it to one mesh per title (no per-glyph animation). */
function makeHubLabelSpec(title: string, hubColor: string): TextSpec {
  return {
    content: title.toUpperCase(),
    fontFamily: LABEL_FONT_FAMILY,
    fontSize: LABEL_FONT_SIZE,
    fontWeight: LABEL_FONT_WEIGHT,
    letterSpacing: 0,
    lineHeight: 1,
    align: 'center',
    fill: { kind: 'solid', color: DS.textHi },
    outline: { color: DS.ink, width: 0.6 },
    glow: { color: hubColor, intensity: 0.25 },
    opacity: 0.92,
    decompose: 'line',
  };
}

/** One hub's label: a TextObject billboarded to the camera. Extracted per-item
 *  so the build/dispose lifecycle and the useFrame hook live with the item. */
function HubLabel({
  hub,
  center,
  atlas,
}: {
  hub: EditorHubView;
  center: HubCenter;
  atlas: LoadedFontAtlas;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // FINISH F-4 (advocate MUST-FIX) — "you are here" suppression. The title
  // draws with depthTest OFF, and a galaxy fly-in keeps its destination hub
  // centred, so the ACTIVE hub's billboarded title hung clipped under the
  // top bar for the whole approach (the mobile fly-in "ghost"). The active
  // hub's name already lives in the TopBar breadcrumb + the lit rail pill —
  // fade ITS in-scene title out and let the other five carry wayfinding.
  const isActive = useGraphEditorStore((s) => s.activeHubId === hub.id);

  const handle = useMemo(() => {
    // lit:false — hue-faithful unlit routing so the DS bone fill renders
    // exactly as authored (the editor's night HDRI tints every lit surface).
    const h = createTextObject(makeHubLabelSpec(hub.name, hub.color), atlas, { lit: false });
    // Sprite-parity render flags: the retired Sprite drew with depthTest off
    // (labels always read over hulls/nodes) and toneMapped off (hue-faithful
    // DS bone). depthWrite is already off on the MSDF unit material.
    for (const unit of h.units) {
      const mat = unit.material as THREE.Material;
      mat.depthTest = false;
      mat.toneMapped = false;
    }
    return h;
  }, [hub.name, hub.color, atlas]);

  // Dispose unit geometries + materials on unmount/rebuild. The atlas texture
  // is registry-owned and shared — TextObject.dispose() never touches it.
  useEffect(() => () => handle.dispose(), [handle]);

  // Billboard: Sprites faced the camera for free; the mesh group copies the
  // camera quaternion each frame for the same always-readable behavior.
  //
  // FINISH F-4 (advocate MUST-FIX) — distance-LOD fade. The label draws with
  // depthTest OFF 60 units above the hub, so flying INTO a hub left its title
  // pinned huge over the whole scene for the entire approach (the mobile
  // fly-in "ghost"). Fade the title out as the camera closes on the hub
  // (full ≥ 160u, gone ≤ 60u) so the dive reads clean; the overview
  // (~320u) is untouched.
  useFrame(({ camera }) => {
    const g = groupRef.current;
    if (!g) return;
    g.quaternion.copy(camera.quaternion);
    // Two fade terms compose: (a) active-hub suppression (above); (b) a
    // distance LOD so a close pass over a NON-active hub never blows its
    // title up over the scene (full ≥ 160u, gone ≤ 60u; overview ≈ 320u).
    const d = camera.position.distanceTo(g.position);
    const distT = THREE.MathUtils.clamp((d - 60) / (160 - 60), 0, 1);
    const target = isActive ? 0 : 0.92 * distT;
    // Ease toward the target (~0.5s at 60fps) so suppression reads as a
    // dissolve, never a pop.
    for (const unit of handle.units) {
      const mat = unit.material as THREE.Material & { opacity: number };
      const next = mat.opacity + (target - mat.opacity) * 0.14;
      if (Math.abs(next - mat.opacity) > 0.0005) {
        mat.transparent = true;
        mat.opacity = next;
      }
    }
    const first = handle.units[0]?.material as (THREE.Material & { opacity: number }) | undefined;
    g.visible = (first?.opacity ?? target) > 0.01;
  });

  return (
    <group ref={groupRef} position={[center.x, center.y + LABEL_LIFT_Y, center.z]}>
      <primitive object={handle.object} />
    </group>
  );
}

export default function HubLabels({
  hubs,
  hubCenters,
}: {
  hubs: EditorHubView[];
  hubCenters: Record<string, HubCenter>;
}) {
  // Atlas readiness — same shape as GraphScene's fontAtlas warmup gate: sync
  // cache peek first (warm registry mounts labels immediately), else resolve
  // async and flip state when the atlas lands. Until then: render nothing.
  const [atlas, setAtlas] = useState<LoadedFontAtlas | null>(
    () => peekTextAtlas(LABEL_FONT_FAMILY, LABEL_FONT_WEIGHT) ?? null,
  );
  useEffect(() => {
    if (atlas) return;
    let cancelled = false;
    resolveTextAtlas(LABEL_FONT_FAMILY, LABEL_FONT_WEIGHT)
      .then((a) => {
        if (!cancelled) setAtlas(a);
      })
      .catch((err) => {
        console.warn('[HubLabels] Inter MSDF atlas resolve failed:', (err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [atlas]);

  if (!atlas) return null;

  return (
    <>
      {hubs.map((hub) => {
        const center = hubCenters[hub.id];
        if (!center) return null;
        return <HubLabel key={hub.id} hub={hub} center={center} atlas={atlas} />;
      })}
    </>
  );
}
