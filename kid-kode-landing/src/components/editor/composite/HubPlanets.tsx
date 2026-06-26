'use client';

// HubPlanets — the app's HUB nodes (= pages) rendered as a small glowing planet
// column to the left of the nav. They are the BINDING SOURCE OF TRUTH the nav tabs
// mirror (spec §4.2): a reviewer adds a page → a planet appears here → a tab appears
// on the nav. Each planet is a real backing NODE (tagged userData so the authorship
// probe counts it; hubToNode gives it a sphere meshPrimitive).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CompositeText } from './CompositeText';
import { hubPlanetPos, type LabHub } from './composite-schema';

function Planet({ hub, index, onPick }: { hub: LabHub; index: number; onPick: (hubId: string) => void }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#9fd8ff'),
        metalness: 0.1,
        roughness: 0.3,
        transmission: 0.6,
        ior: 1.4,
        thickness: 0.6,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        attenuationColor: new THREE.Color('#bfe3ea'),
        attenuationDistance: 0.8,
        emissive: new THREE.Color('#1d3346'),
        emissiveIntensity: 0.4,
        transparent: true,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const [x, y, z] = hubPlanetPos(index);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.userData.prismCompositeMember = true;
    g.userData.prismNodeId = hub.hubId;
    g.userData.prismRole = 'hub-page';
    g.userData.prismDormant = false;
  }, [hub.hubId]);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.3 + index;
  });

  return (
    <group position={[x, y, z]}>
      <group
        ref={ref}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
        onClick={(e) => { e.stopPropagation(); onPick(hub.hubId); }}
      >
        <mesh material={mat}>
          <sphereGeometry args={[0.32, 32, 32]} />
        </mesh>
      </group>
      <CompositeText position={[0.56, 0, 0]} fontSize={0.16} letterSpacing={0.03} anchorX="left" variant="engraved">
        {hub.title}
      </CompositeText>
    </group>
  );
}

export function HubPlanets({ hubs, onPick }: { hubs: LabHub[]; onPick: (hubId: string) => void }) {
  const headerPos = hubPlanetPos(-1.2);
  return (
    <group>
      <CompositeText position={[headerPos[0] - 0.2, headerPos[1], headerPos[2]]} fontSize={0.18} letterSpacing={0.16} anchorX="left" variant="bright">
        PAGES
      </CompositeText>
      {hubs.map((h, i) => (
        <Planet key={h.hubId} hub={h} index={i} onPick={onPick} />
      ))}
    </group>
  );
}
