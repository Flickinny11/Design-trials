'use client';

// AnimatableStage — a mini R3F/WebGPU scene that mounts one Animatable on a
// host subject and plays it on a TimeDriver (rAF). Used by hover-play tiles
// (mounted only while hovered) and the focused detail preview (always playing).
//
// Synthetic inputs: before each seek the stage writes target.userData.pointer
// ({x,y} in -1..1, orbiting) and target.userData.scroll (0..1) so pointer- and
// scroll-driven primitives visibly animate in the picker.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Group } from 'three';
import { buildSubject } from '@/lib/prism/animatable/subjects';
import type {
  Animatable,
  AnimatableTarget,
  ParamState,
  PrimitiveDefinition,
} from '@/lib/prism/animatable/contract';
import { createPreviewRenderer } from './preview-renderer';

interface StageProps {
  def: PrimitiveDefinition;
  params?: Partial<ParamState>;
  playing: boolean;
  onInstance?: (inst: Animatable) => void;
}

function StageContent({ def, params, playing, onInstance }: StageProps) {
  const scene = useThree((s) => s.scene);
  const elapsed = useRef(0);
  const lastT = useRef(0);
  const instRef = useRef<Animatable | null>(null);
  const targetRef = useRef<AnimatableTarget | null>(null);

  useEffect(() => {
    const { object, subject } = buildSubject(def.subject);
    const target: AnimatableTarget = { object, subject, scene, userData: {} };
    let inst: Animatable | null = null;
    try {
      inst = def.create(target, params);
      inst.seek(0);
    } catch (err) {
      // Surface build errors loudly in console for the functional layer.
      console.error(`[animatable] ${def.name} create() failed:`, err);
    }
    instRef.current = inst;
    targetRef.current = target;
    scene.add(object);
    elapsed.current = 0;
    lastT.current = 0;
    if (inst) onInstance?.(inst);
    return () => {
      try {
        inst?.dispose();
      } catch (err) {
        console.error(`[animatable] ${def.name} dispose() failed:`, err);
      }
      scene.remove(object);
      instRef.current = null;
      targetRef.current = null;
    };
    // Rebuild only when the primitive changes; param tweaks go through setControl.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, scene]);

  useFrame((_, delta) => {
    const inst = instRef.current;
    const target = targetRef.current;
    if (!inst || !target) return;
    const d = inst.duration();
    const dur = Number.isFinite(d) ? Math.max(0.05, d) : 4;
    // Playing advances the clock; paused FREEZES in place (holds the last
    // seeked time) so a paused one-shot shows a visible mid-frame, not the
    // invisible t=0 state.
    let t: number;
    if (playing) {
      elapsed.current += delta;
      t = elapsed.current % dur;
      lastT.current = t;
    } else {
      t = lastT.current;
    }
    const ph = t / dur;
    target.userData.pointer = {
      x: Math.cos(ph * Math.PI * 2),
      y: Math.sin(ph * Math.PI * 2),
    };
    target.userData.scroll = ph;
    try {
      inst.seek(t);
    } catch {
      /* keep the loop alive; error already logged on create */
    }
  });

  return null;
}

export default function AnimatableStage({ def, params, playing, onInstance }: StageProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={createPreviewRenderer as unknown as ComponentProps<typeof Canvas>['gl']}
      camera={{ position: [0, 0, 3.2], fov: 40, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      <directionalLight position={[-4, -2, 2]} intensity={0.5} color="#a978ff" />
      <StageContent def={def} params={params} playing={playing} onInstance={onInstance} />
    </Canvas>
  );
}
