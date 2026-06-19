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
  useFrame(({ camera }) => {
    groupRef.current?.quaternion.copy(camera.quaternion);
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
