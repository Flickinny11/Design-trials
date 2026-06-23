'use client';

// IconGlb — mounts a tool's GENERATED bespoke 3D icon GLB (ic-<id>.glb, wave 1)
// on the button face (spec IC-1). Two presentations, both driven by the SAME
// generated GLB geometry (so the form is always the generated object, D1):
//
//  • RAISED (default, most tools): the icon sits proud on the coin face with its
//    baked COLOR (IC-2). Its baseColor texture is routed into a subtle emissive
//    so the colors glow + pop under the toolbar lighting, brightening on hover
//    (IC-3 animated). A gentle idle sway keeps it alive.
//  • ENGRAVED (a few tools, TB-8): the SAME icon GLB is seated as an intaglio —
//    sunk into a dark recessed well cut in the coin face, re-materialed as cut
//    metal. At rest it reads as a shadowed engraving; on HOVER the engraving
//    fills with accent light, rises slightly in the well and sweeps — animating
//    the engraving with photoreal depth + shadow.
//
// ZERO emoji / Lucide / line-drawings — these are real 3D objects (IC-5).

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useToolGlb, iconUrl } from '../glb';
import { useIconState, ICON_S, shade } from './kit';

export function IconGlb({
  id,
  accent = '#d8b46a',
  engraved = false,
}: {
  id: string;
  accent?: string;
  engraved?: boolean;
}) {
  const target = engraved ? ICON_S * 1.15 : ICON_S * 1.6;
  const prepared = useToolGlb(iconUrl(id), target, 'none');
  const { hovered, active } = useIconState();
  const grp = useRef<THREE.Group>(null);
  const phase = useMemo(
    () => (Math.sin(id.length * 12.9 + id.charCodeAt(0)) * 0.5 + 0.5) * 6.28,
    [id],
  );

  // Material setup per presentation (runs once per prepared clone).
  useMemo(() => {
    const ac = new THREE.Color(accent);
    for (const m of prepared.materials) {
      if (engraved) {
        // Re-material the generated symbol as cut metal so it reads as an
        // engraving rather than a floating colored object.
        m.map = null;
        m.color = new THREE.Color(shade(accent, -0.55));
        m.metalness = 0.92;
        m.roughness = 0.42;
        m.emissive = ac.clone();
        m.emissiveIntensity = 0.0;
      } else {
        // Self-illuminate with the icon's own baked colors → vivid + premium.
        m.emissive = new THREE.Color(0xffffff);
        if ((m as THREE.MeshStandardMaterial).map) m.emissiveMap = (m as THREE.MeshStandardMaterial).map;
        m.emissiveIntensity = 0.16;
        m.toneMapped = true;
      }
      m.needsUpdate = true;
    }
  }, [prepared.materials, accent, engraved]);

  useFrame((s, dt) => {
    const o = grp.current;
    if (!o) return;
    const t = s.clock.elapsedTime + phase;
    const lit = hovered || active;
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.05));

    if (engraved) {
      // Engraving animates on hover: rises in the well + sweeps + glows.
      const targetZ = lit ? 0.02 : -0.05; // sunk at rest, lifts toward face on hover
      o.position.z += (targetZ - o.position.z) * k;
      const targetRot = lit ? Math.sin(t * 2.2) * 0.3 : 0;
      o.rotation.z += (targetRot - o.rotation.z) * k;
      const ei = lit ? 0.95 : 0.0;
      for (const m of prepared.materials) m.emissiveIntensity += (ei - m.emissiveIntensity) * k;
    } else {
      o.rotation.y = Math.sin(t * 0.7) * (lit ? 0.6 : 0.4);
      o.rotation.x = Math.sin(t * 0.45 + 0.6) * 0.12;
      const targetS = lit ? 1.12 : 1.0;
      o.scale.setScalar(o.scale.x + (targetS - o.scale.x) * k);
      const ei = lit ? (hovered ? 0.55 : 0.32) : 0.16;
      for (const m of prepared.materials) m.emissiveIntensity += (ei - m.emissiveIntensity) * k;
    }
  });

  return (
    <group>
      {engraved && (
        // Dark recessed well cut into the coin face — the intaglio (faces +Z).
        <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <cylinderGeometry args={[ICON_S * 0.92, ICON_S * 0.86, 0.08, 40]} />
          <meshStandardMaterial color={shade(accent, -0.82)} metalness={0.75} roughness={0.55} />
        </mesh>
      )}
      <group ref={grp} position={[0, 0, engraved ? -0.05 : 0]}>
        <primitive object={prepared.object} />
      </group>
    </group>
  );
}
