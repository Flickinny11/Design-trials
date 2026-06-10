'use client';

// HubLabels — renders each hub's title as a Three.Sprite with canvas-rendered
// text, the same vocabulary used by NodeLabels (canvas → CanvasTexture →
// SpriteMaterial → Sprite). Sits above the hub center; subtle so it doesn't
// dominate node labels.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 4.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { EditorHubView } from '@/lib/prism-graph/view-model';
// Wave-2E Observatory Brass retint — label fill comes from the frozen DS tokens.
import { DS } from '@/components/editor/design-system';

interface HubCenter {
  x: number;
  y: number;
  z: number;
}

function makeHubLabelTexture(title: string, color: string): THREE.CanvasTexture {
  const W = 1024;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  ctx.font = 'bold 96px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = color;
  ctx.fillText(title.toUpperCase(), W / 2, H / 2);

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = DS.textHi;
  ctx.globalAlpha = 0.92;
  ctx.fillText(title.toUpperCase(), W / 2, H / 2);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export default function HubLabels({
  hubs,
  hubCenters,
}: {
  hubs: EditorHubView[];
  hubCenters: Record<string, HubCenter>;
}) {
  const sprites = useMemo(() => {
    return hubs.map((hub) => ({
      hub,
      texture: makeHubLabelTexture(hub.name, hub.color),
    }));
  }, [hubs]);

  return (
    <>
      {sprites.map(({ hub, texture }) => {
        const center = hubCenters[hub.id];
        if (!center) return null;
        return (
          <sprite
            key={hub.id}
            position={[center.x, center.y + 60, center.z]}
            scale={[40, 10, 1]}
          >
            <spriteMaterial
              map={texture}
              transparent
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </sprite>
        );
      })}
    </>
  );
}
