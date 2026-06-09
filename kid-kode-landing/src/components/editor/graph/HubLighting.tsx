'use client';

// HubLighting — drives the VISIBLE editor scene's lights + IBL from the active
// hub's `lightingSpec` (PRISM-CANVAS-EDITOR-SPEC §10). This is what makes the
// Canvas toolbar's Lighting group actually change what the user sees (criterion
// 17): the toolbar writes `hub.lightingSpec`, AssembledSceneContent re-renders,
// and these declarative R3F lights update live.
//
// Safe default (INV-8): a hub with NO lightingSpec renders the exact legacy
// 3-light look the assembled scene used before this wiring, so existing graphs
// are visually unchanged. Only once a user edits lighting does the scene change.
//
// This is the editor (R3F) counterpart to the runtime `lighting-rig.ts`; it maps
// the same `PrismLight[]` schema to declarative lights instead of imperative ones.

import { Environment } from '@react-three/drei';
import type { LightingSpec, PrismHub, PrismLight } from '@/lib/prism-graph/types';

// Matches the pre-wiring hardcoded AssembledSceneContent look exactly, so a hub
// without a lightingSpec is pixel-stable.
const LEGACY_AMBIENT = 0.45;
const LEGACY_LIGHTS: PrismLight[] = [
  { id: 'key', type: 'directional', color: '#e0edff', intensity: 0.8, position: { x: 4, y: 6, z: 8 } },
  { id: 'fill', type: 'directional', color: '#ffdbb8', intensity: 0.25, position: { x: -4, y: -2, z: 5 } },
];

function LightObject({ light }: { light: PrismLight }) {
  const color = light.color ?? '#ffffff';
  const intensity = light.intensity ?? 1;
  const pos: [number, number, number] = light.position
    ? [light.position.x, light.position.y, light.position.z]
    : [0, 5, 5];
  switch (light.type) {
    case 'ambient':
      return <ambientLight color={color} intensity={intensity} />;
    case 'hemisphere':
      return <hemisphereLight color={color} groundColor={light.groundColor ?? '#202028'} intensity={intensity} />;
    case 'point':
      return <pointLight color={color} intensity={intensity} position={pos} distance={light.distance ?? 0} decay={light.decay ?? 2} />;
    case 'spot':
      return (
        <spotLight
          color={color}
          intensity={intensity}
          position={pos}
          distance={light.distance ?? 0}
          angle={light.angle ?? Math.PI / 6}
          penumbra={light.penumbra ?? 0.3}
          decay={light.decay ?? 2}
        />
      );
    case 'directional':
    case 'rim':
    default:
      return <directionalLight color={color} intensity={intensity} position={pos} />;
  }
}

export default function HubLighting({ hub }: { hub: PrismHub | undefined }) {
  const spec: LightingSpec | undefined = hub?.lightingSpec;
  const hasSpec = !!spec;
  const lights = spec?.lights && spec.lights.length > 0 ? spec.lights : LEGACY_LIGHTS;
  const ambientIntensity = spec?.ambientIntensity ?? LEGACY_AMBIENT;
  // Env/IBL is opt-in: a legacy hub (no spec) keeps the assembled scene's
  // env-free look; an authored spec adds the studio IBL at its intensity.
  const envIntensity = spec?.envIntensity ?? 1;

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      {lights.map((l) => (
        <LightObject key={l.id} light={l} />
      ))}
      {hasSpec && spec?.envMapUrl == null && (
        <Environment preset="studio" environmentIntensity={envIntensity} />
      )}
    </>
  );
}
