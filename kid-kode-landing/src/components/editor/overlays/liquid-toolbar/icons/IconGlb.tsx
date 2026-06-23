'use client';

// IconGlb — mounts a tool's GENERATED bespoke 3D icon GLB (ic-<id>.glb, wave 1)
// on the button face (spec IC-1). The GLB already carries the icon's COLOR
// (IC-2: colored enamel/metal/gemstone, baked by Tripo), so we keep its baked
// material and route its baseColor texture into a subtle emissive so the colors
// glow + pop under the toolbar lighting and respond to hover (IC-3 animated).
// Idle motion (a gentle sway) keeps it alive; hover (via IconStateContext)
// brightens + lifts it. ZERO emoji / Lucide / line-drawings — these are real 3D
// objects with depth, gradients and shadows (IC-5).

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useToolGlb, iconUrl } from '../glb';
import { useIconState, ICON_S } from './kit';

export function IconGlb({ id }: { id: string; accent?: string }) {
  const prepared = useToolGlb(iconUrl(id), ICON_S * 1.5, 'none');
  const { hovered, active } = useIconState();
  const grp = useRef<THREE.Group>(null);
  const phase = useMemo(() => (Math.sin(id.length * 12.9 + id.charCodeAt(0)) * 0.5 + 0.5) * 6.28, [id]);

  // Route baseColor → emissive so the icon self-illuminates with its own colors
  // (vivid against the metal coin); animate intensity on hover (IC-3).
  useMemo(() => {
    for (const m of prepared.materials) {
      m.emissive = new THREE.Color(0xffffff);
      if ((m as THREE.MeshStandardMaterial).map) m.emissiveMap = (m as THREE.MeshStandardMaterial).map;
      m.emissiveIntensity = 0.12;
      m.toneMapped = true;
      m.needsUpdate = true;
    }
  }, [prepared.materials]);

  useFrame((s, dt) => {
    const o = grp.current;
    if (!o) return;
    const t = s.clock.elapsedTime + phase;
    const lit = hovered || active;
    // gentle idle sway + a touch more life while hovered
    o.rotation.y = Math.sin(t * 0.7) * (lit ? 0.6 : 0.4);
    o.rotation.x = Math.sin(t * 0.45 + 0.6) * 0.12;
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.05));
    const targetS = lit ? 1.12 : 1.0;
    const cur = o.scale.x + (targetS - o.scale.x) * k;
    o.scale.setScalar(cur);
    const ei = lit ? (hovered ? 0.55 : 0.32) : 0.12;
    for (const m of prepared.materials) m.emissiveIntensity += (ei - m.emissiveIntensity) * k;
  });

  return (
    <group ref={grp}>
      <primitive object={prepared.object} />
    </group>
  );
}
