'use client';
// ORRERY No.7 — PHASE2 SIGNATURE (SC-V-O1..O3): the working 3D orrery complication.
//
// A miniature solar system rendered in real 3D on the Celestia hub: an emissive
// sun at centre with photoreal PBR planet spheres orbiting on tilted rings (real
// depth — planets pass BEHIND the sun, not a flat graphic). Spin time and the
// planets orbit; a time-scrub control (drag, or window.__ORRERY__) drives the
// whole system so it reads as a clockwork model of the heavens. Renders only in
// preview-app on s4-celestia; tears down cleanly elsewhere. The dial-art orrery on
// the Atelier watch is the same motif (SC-V-O3).
import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  Group, Mesh, SphereGeometry, TorusGeometry, MeshStandardMaterial, AdditiveBlending,
  Color, Vector2, DoubleSide, BackSide,
} from 'three';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

const CELESTIA_HUB = 's4-celestia';
const CENTER: [number, number, number] = [0, 0.35, 0.4];
const TILT = -0.5; // look down on the orbital plane → 3D ellipses

interface PlanetDef { color: string; metalness: number; roughness: number; emissive?: string; r: number; size: number; speed: number; phase: number; }
const PLANETS: PlanetDef[] = [
  { color: '#caa15a', metalness: 1, roughness: 0.35, r: 1.05, size: 0.15, speed: 0.62, phase: 0.4 },   // brass
  { color: '#d7dde6', metalness: 0.25, roughness: 0.5, r: 1.62, size: 0.24, speed: 0.41, phase: 2.1 }, // marble
  { color: '#7db1d6', metalness: 0.2, roughness: 0.3, emissive: '#16334d', r: 2.25, size: 0.2, speed: 0.29, phase: 4.0 }, // ice world
  { color: '#2c2f37', metalness: 0.9, roughness: 0.25, r: 2.95, size: 0.17, speed: 0.2, phase: 5.2 },  // obsidian
];

export function OrreryComplicationRig({ previewMode }: { previewMode: boolean }) {
  const { gl, camera } = useThree();
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const active = previewMode && activeHubId === CELESTIA_HUB;

  const timeRef = useRef(0);
  const speedRef = useRef(1);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const planetRefs = useRef<(Group | null)[]>([]);
  const sunRef = useRef<Mesh>(null);

  // geometry/material pools (disposed on unmount via React)
  const sunGeo = useMemo(() => new SphereGeometry(0.34, 48, 48), []);
  const sunMat = useMemo(() => new MeshStandardMaterial({ color: new Color('#ffd27a'), emissive: new Color('#ffba4d'), emissiveIntensity: 2.4, roughness: 0.4, metalness: 0 }), []);
  const glowGeo = useMemo(() => new SphereGeometry(0.62, 32, 32), []);
  const glowMat = useMemo(() => new MeshStandardMaterial({ color: new Color('#ffcf80'), emissive: new Color('#ffb347'), emissiveIntensity: 1.1, transparent: true, opacity: 0.32, side: BackSide, blending: AdditiveBlending, depthWrite: false }), []);
  const planetGeos = useMemo(() => PLANETS.map((p) => new SphereGeometry(p.size, 40, 40)), []);
  const planetMats = useMemo(() => PLANETS.map((p) => new MeshStandardMaterial({ color: new Color(p.color), metalness: p.metalness, roughness: p.roughness, emissive: new Color(p.emissive ?? '#000000'), emissiveIntensity: p.emissive ? 0.5 : 0, envMapIntensity: 1.3 })), []);
  const ringGeos = useMemo(() => PLANETS.map((p) => new TorusGeometry(p.r, 0.006, 8, 160)), []);
  const ringMat = useMemo(() => new MeshStandardMaterial({ color: new Color('#caa15a'), emissive: new Color('#7a5a22'), emissiveIntensity: 0.6, metalness: 1, roughness: 0.4, transparent: true, opacity: 0.5, side: DoubleSide }), []);

  // window control hook (SC-V-O2) + drag-to-scrub
  useEffect(() => {
    if (!active) return;
    (window as unknown as { __ORRERY__?: unknown }).__ORRERY__ = {
      get time() { return timeRef.current; },
      get speed() { return speedRef.current; },
      setSpeed: (s: number) => { speedRef.current = s; },
      scrub: (d: number) => { timeRef.current += d; },
      setTime: (t: number) => { timeRef.current = t; },
    };
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => { dragging.current = true; lastX.current = e.clientX; };
    const onMove = (e: PointerEvent) => { if (!dragging.current) return; const dx = e.clientX - lastX.current; lastX.current = e.clientX; timeRef.current += dx * 0.012; };
    const onUp = () => { dragging.current = false; };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      delete (window as unknown as { __ORRERY__?: unknown }).__ORRERY__;
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [active, gl]);

  useFrame((_s, dt) => {
    if (!active) return;
    if (!dragging.current) timeRef.current += Math.min(dt, 1 / 30) * speedRef.current * 0.6;
    const t = timeRef.current;
    for (let i = 0; i < PLANETS.length; i++) {
      const g = planetRefs.current[i]; if (!g) continue;
      const p = PLANETS[i];
      const a = t * p.speed + p.phase;
      g.position.set(Math.cos(a) * p.r, 0, Math.sin(a) * p.r); // orbit in X-Z (tilted by parent)
      g.rotation.y += dt * 0.6; // planet spin
    }
    if (sunRef.current) sunRef.current.rotation.y += dt * 0.15;
  });

  if (!active) return null;
  return (
    <group position={CENTER} rotation={[TILT, 0, 0]}>
      {/* sun + additive glow shell */}
      <mesh ref={sunRef} geometry={sunGeo} material={sunMat} />
      <mesh geometry={glowGeo} material={glowMat} />
      {/* orbital rings (tilted with the group → read as 3D ellipses) */}
      {PLANETS.map((_, i) => (
        <mesh key={`ring-${i}`} geometry={ringGeos[i]} material={ringMat} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      {/* planets */}
      {PLANETS.map((_, i) => (
        <group key={`planet-${i}`} ref={(el) => { planetRefs.current[i] = el; }}>
          <mesh geometry={planetGeos[i]} material={planetMats[i]} castShadow />
        </group>
      ))}
    </group>
  );
}
