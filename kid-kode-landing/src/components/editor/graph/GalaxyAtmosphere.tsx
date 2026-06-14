'use client';

// Galaxy atmosphere — additive depth + glow for the galaxy view (UI-WOW-2 P2).
//
// The monitor saw "flat simple spheres, thin grey orbit lines, empty black."
// Root cause (galaxy recon): under WebGPU the legacy postprocessing composer is
// skipped (no bloom) and drei <Stars> (raw GLSL) is gated off (empty void).
// Rather than risky render-loop surgery for a WebGPU post-bloom pass (this
// canvas also hosts the chrome-slab layer), the cinematic glow here comes from
// ADDITIVE emissive geometry — standard Three materials that work natively
// under WebGPU and self-bloom by accumulation:
//   • GalaxyStarfield — twinkling parallax star points (brass/bone/ice).
//   • GalaxyNebula    — soft additive haze billboards for real 3D depth.
//   • GalaxyOrbitRings— the 3 tilted orrery rings the hubs sit on, drawn as
//                       glowing additive torus bands (were invisible).
//   • SunCorona       — layered additive corona shells so the sun reads as a
//                       star, not a ball.
// Palette: brass / bone / ice / void — NO purple. Tier-aware via `quality`.
// Editor-shell module (window/document allowed; FP-05 scopes to runtime only).

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DS } from '@/components/editor/design-system';

// Mirrors src/lib/useForceGraph.ts:59-60 (the deterministic orrery layout the
// hubs are hashed onto). Kept local + additive; do not change the source.
const GALAXY_RING_RADII = [90, 150, 210] as const;
const GALAXY_RING_TILT = [0.04, -0.18, 0.22] as const;

export type GalaxyQuality = 'low' | 'high';

// ── soft round sprite (radial alpha) — shared by stars + glows ───────────────
let _softSprite: THREE.Texture | null = null;
function softSprite(): THREE.Texture {
  if (_softSprite) return _softSprite;
  if (typeof document === 'undefined') return new THREE.Texture();
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _softSprite = tex;
  return tex;
}

// ── procedural nebula texture (brass↔ice radial clouds, no purple) ───────────
const _nebulaCache: Record<string, THREE.Texture> = {};
function nebulaTexture(hex: string): THREE.Texture {
  if (_nebulaCache[hex]) return _nebulaCache[hex];
  if (typeof document === 'undefined') return new THREE.Texture();
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, s, s);
  const base = new THREE.Color(hex);
  // a few overlapping soft blobs → cloudy structure
  for (let i = 0; i < 14; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12543.183) % 1;
    const px = (Math.abs(x) * 0.7 + 0.15) * s;
    const py = (Math.abs(y) * 0.7 + 0.15) * s;
    const r = (12 + (Math.abs(x * y) % 1) * 46);
    const a = 0.05 + (Math.abs(x + y) % 1) * 0.08;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${(base.r * 255) | 0},${(base.g * 255) | 0},${(base.b * 255) | 0},${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _nebulaCache[hex] = tex;
  return tex;
}

// ── starfield — twinkling parallax points filling the void ───────────────────
export function GalaxyStarfield({ quality = 'high' }: { quality?: GalaxyQuality }) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const count = quality === 'low' ? 900 : 2200;

  const { geometry } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const tints = [DS.brass200, DS.brass100, DS.textHi, DS.ice200, DS.ice300];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // shell distribution between r 280..900 so stars sit behind the hubs
      const r = 280 + Math.pow(Math.random(), 0.6) * 620;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6; // flatten vertically (disc-ish)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      col.set(tints[(Math.random() * tints.length) | 0]).multiplyScalar(0.5 + Math.random() * 0.8);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aphase', new THREE.BufferAttribute(phase, 1));
    return { geometry: g };
  }, [count]);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.006;
    if (matRef.current) {
      // global gentle twinkle on size/opacity
      matRef.current.opacity = 0.82 + Math.sin(state.clock.elapsedTime * 0.9) * 0.08;
    }
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        size={3.1}
        map={softSprite()}
        vertexColors
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

// ── nebula — soft additive haze billboards for true 3D depth ─────────────────
export function GalaxyNebula({ quality = 'high' }: { quality?: GalaxyQuality }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const clouds = useMemo(() => {
    const defs = [
      { hex: DS.brass500, pos: [-260, 70, -340] as [number, number, number], scale: 620, rot: 0.2 },
      { hex: DS.ice500, pos: [320, -120, -300] as [number, number, number], scale: 560, rot: -0.4 },
      { hex: DS.brass400, pos: [40, 180, -460] as [number, number, number], scale: 700, rot: 0.7 },
    ];
    return quality === 'low' ? defs.slice(0, 1) : defs;
  }, [quality]);

  useFrame(() => {
    // billboard the haze toward camera so it always reads as volume, slow drift
    if (!groupRef.current) return;
    groupRef.current.children.forEach((m, i) => {
      m.quaternion.copy(camera.quaternion);
      m.rotation.z += 0; // keep billboard; per-plane spin handled in material rot
      void i;
    });
  });

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} renderOrder={-10}>
          <planeGeometry args={[c.scale, c.scale]} />
          <meshBasicMaterial
            map={nebulaTexture(c.hex)}
            transparent
            opacity={0.5}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── orbit rings — the 3 tilted orrery rings, drawn as glowing torus bands ─────
export function GalaxyOrbitRings({ quality = 'high' }: { quality?: GalaxyQuality }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMats = useRef<THREE.MeshBasicMaterial[]>([]);
  coreMats.current = [];
  const seg = quality === 'low' ? 90 : 140;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    coreMats.current.forEach((m, i) => {
      if (m) m.opacity = 0.16 + 0.08 * Math.sin(t * 0.5 + i * 1.3);
    });
  });

  return (
    <group ref={groupRef}>
      {GALAXY_RING_RADII.map((radius, i) => {
        const tilt = GALAXY_RING_TILT[i];
        const color = i === 1 ? DS.ice300 : DS.brass300;
        return (
          <group key={i} rotation={[Math.PI / 2 + tilt, 0, tilt * 0.6]}>
            {/* bright thin core loop */}
            <mesh>
              <torusGeometry args={[radius, 0.32, 8, seg]} />
              <meshBasicMaterial
                ref={(m) => { if (m) coreMats.current[i] = m; }}
                color={color}
                transparent
                opacity={0.22}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
            {/* soft wide halo band */}
            <mesh>
              <torusGeometry args={[radius, 2.6, 6, seg]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.05}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── sun corona — layered additive shells so the sun reads as a star ──────────
export function SunCorona({ radius }: { radius: number }) {
  const glowRef = useRef<THREE.Sprite>(null);
  useFrame((state) => {
    if (glowRef.current) {
      const p = 1 + Math.sin(state.clock.elapsedTime * 0.7) * 0.05;
      glowRef.current.scale.set(radius * 6.2 * p, radius * 6.2 * p, 1);
    }
  });
  return (
    <group>
      {/* soft volumetric corona shells (BackSide additive) */}
      <mesh>
        <sphereGeometry args={[radius * 1.35, 48, 48]} />
        <meshBasicMaterial color={DS.brass300} transparent opacity={0.18} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.9, 40, 40]} />
        <meshBasicMaterial color={DS.brass200} transparent opacity={0.08} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* big soft glow sprite — the bloom-stand-in halo */}
      <sprite ref={glowRef} scale={[radius * 6.2, radius * 6.2, 1]}>
        <spriteMaterial map={softSprite()} color={DS.brass300} transparent opacity={0.5} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}
