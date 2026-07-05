'use client';

// KeyframeScene — the R3F scene graph for the Prism Keyframe Editor, in the
// founder-approved chassis language: a thick glass timeline pane with channels
// milled through it, worn-alloy knobs riding the channels, engraved track labels,
// a worn-metal playhead, and the bound node artifact that animates as the timeline
// is scrubbed/played. Studio environment (real refraction), editorial dark
// backdrop, premium studio lighting — matched to /toolbar-chassis.
//
// Isolated WebGL editor-chrome — never the unified three/webgpu graph scene.

import { Suspense, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from '@/components/editor/chassis/StudioEnv';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { GlassTimelinePane } from './GlassTimelinePane';
import { TrackBeds } from './TrackBeds';
import { Playhead } from './Playhead';
import { SubjectNode } from './SubjectNode';
import { TrackKnobs } from './TrackKnobs';
import { TransportControls } from './TransportControls';
import { EngravedTrackLabels, EngravedTitle } from './EngravedTrackLabels';
import { LAYOUT } from './keyframe-config';
import { useKeyframeStore } from './use-keyframe-store';

// Editorial dark backdrop the glass refracts and the milled channels reveal.
// FINISH F-1 — the blue-grey studio wall goes BLACK with a deep signal-red
// bloom (the toolbar's red/black/white language; the smoked pane refracts it).
function Backdrop() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#1b1b21');
    grad.addColorStop(0.5, '#0c0c11');
    grad.addColorStop(1, '#030307');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    const bloom = g.createRadialGradient(32, 300, 8, 32, 300, 300);
    bloom.addColorStop(0, 'rgba(255,42,56,0.13)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom;
    g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -3.8]} raycast={() => null}>
      <planeGeometry args={[46, 26]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// EnvTune — runs AFTER StudioEnv to calm the studio softbox on this wide pane and
// swing its bright lobe toward center-right, off the left-gutter engraved labels
// (the wide timeline puts the labels exactly where the default lobe glares).
function EnvTune() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prevI = scene.environmentIntensity;
    const prevR = scene.environmentRotation?.clone?.();
    scene.environmentIntensity = 0.34;
    if (scene.environmentRotation) scene.environmentRotation.set(0.16, -Math.PI * 0.18, 0);
    return () => {
      scene.environmentIntensity = prevI;
      if (prevR && scene.environmentRotation) scene.environmentRotation.copy(prevR);
    };
  }, [scene]);
  return null;
}

// Drives the play/pause clock: advances the playhead while `playing`.
function ClockDriver() {
  useFrame((_, dt) => {
    const s = useKeyframeStore.getState();
    if (s.playing) s.tick(Math.min(dt, 0.05));
  });
  return null;
}

// Dev/verification probes — editor chrome, window access allowed (not runtime/node).
function SceneProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_KEYFRAME_SCENE__ = scene;
    w.__PRISM_KEYFRAME_STORE__ = () => useKeyframeStore.getState();
    // NODE LAW proof: the selected node holds its own animation data.
    w.__PRISM_KEYFRAME_NODE__ = () => useKeyframeStore.getState().node;
  }
  return null;
}

// Loads the worn-alloy PBR sets, then renders everything that needs them.
function Worn() {
  const maps = useWornMaps();
  return (
    <>
      <TrackBeds gunmetal={maps.gunmetal} />
      <Playhead steel={maps.gunmetal} />
      <TrackKnobs maps={maps} />
      <TransportControls maps={maps.gunmetal} />
      {/* FINISH F-1 — the bound artifact wears the worn signal-red alloy. */}
      <SubjectNode maps={maps.oxblood} />
    </>
  );
}

export function KeyframeScene() {
  const halfW = LAYOUT.paneW / 2;
  return (
    <>
      <SceneProbe />
      <StudioEnv />
      <EnvTune />
      <Backdrop />
      <ClockDriver />

      {/* Premium studio lighting — matched to the chassis: warm key (casts the
          soft shadow), cool fill, raking light for the brushed grain, off-center
          rim spots that do not blow out the engraved label band. */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5.5, 12.5, 6]}
        intensity={2.05}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-halfW - 1}
        shadow-camera-right={halfW + 1}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
      />
      {/* fill + raking lights kept to the RIGHT of center so their glass speculars
          land on the label-free right side (3s–4s), never on the left-gutter
          engraved labels. A dim cool fill from the left lifts the labels without
          a hot spec. */}
      {/* FINISH F-1 — fills go neutral chrome-white; the lavender rim becomes a
          restrained SIGNAL-RED rim so the red/black/white system carries into
          the lighting itself (red edge-light on smoked glass + chrome). */}
      <directionalLight position={[6.5, -1, 6]} intensity={1.0} color="#dfe5ec" />
      <directionalLight position={[4.5, 1.2, 8.5]} intensity={1.05} color="#fff7ec" />
      <directionalLight position={[-8.5, 1.5, 4]} intensity={0.42} color="#c3c9d2" />
      <spotLight position={[11, 6, -1]} angle={0.85} penumbra={1} intensity={48} distance={52} color="#e8edf4" />
      <spotLight position={[-11, -3, -1]} angle={0.85} penumbra={1} intensity={22} distance={52} color="#ff3a44" />

      <Suspense fallback={null}>
        <GlassTimelinePane />
      </Suspense>
      <Suspense fallback={null}>
        <Worn />
      </Suspense>
      <EngravedTrackLabels />
      <EngravedTitle />

      <ContactShadows
        position={[0, -LAYOUT.paneH / 2 - 0.25, 0]}
        opacity={0.5}
        scale={LAYOUT.paneW + 6}
        blur={2.6}
        far={5}
        resolution={1024}
        color="#000308"
      />
    </>
  );
}
