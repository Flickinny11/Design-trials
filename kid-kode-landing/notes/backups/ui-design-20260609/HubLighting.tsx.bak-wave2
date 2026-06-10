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

// Shadow-camera frustum + map params for the single key caster. Kept modest
// (1024 map, a frustum that comfortably wraps the assembled content) so the
// soft shadow reads cleanly without restructuring the legacy look.
function ShadowCasterDirectional({
  color,
  intensity,
  position,
}: {
  color: string;
  intensity: number;
  position: [number, number, number];
}) {
  return (
    <directionalLight
      color={color}
      intensity={intensity}
      position={position}
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-bias={-0.0005}
      shadow-camera-near={0.1}
      shadow-camera-far={60}
      shadow-camera-left={-15}
      shadow-camera-right={15}
      shadow-camera-top={15}
      shadow-camera-bottom={-15}
    />
  );
}

function LightObject({ light, isKeyCaster = false }: { light: PrismLight; isKeyCaster?: boolean }) {
  const color = light.color ?? '#ffffff';
  const intensity = light.intensity ?? 1;
  const pos: [number, number, number] = light.position
    ? [light.position.x, light.position.y, light.position.z]
    : [0, 5, 5];
  // The designated key directional light casts soft shadows so assembled meshes
  // drop a shadow onto the receiver; all other lights stay non-casting (safe
  // legacy look, single caster = no double shadows / perf blowup).
  if (isKeyCaster && (light.type === 'directional' || light.type === 'rim')) {
    return <ShadowCasterDirectional color={color} intensity={intensity} position={pos} />;
  }
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

  // Designate exactly one key caster: the first directional/rim light in the
  // list (LEGACY_LIGHTS' 'key' for an unspecified hub). A single caster keeps
  // the legacy look stable while still producing one soft cast shadow.
  const keyCasterId = lights.find((l) => l.type === 'directional' || l.type === 'rim')?.id;

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      {lights.map((l) => (
        <LightObject key={l.id} light={l} isKeyCaster={l.id === keyCasterId} />
      ))}
      {hasSpec && spec?.envMapUrl == null && (
        <Environment preset="studio" environmentIntensity={envIntensity} />
      )}
    </>
  );
}
