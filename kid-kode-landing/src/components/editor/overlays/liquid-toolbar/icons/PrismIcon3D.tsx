'use client';

// PrismIcon3D — the 14 bespoke, premium 3D tool icons for the liquid-glass
// toolbar. Each `id` renders a MINIATURE 3D SCULPTURE (beveled / extruded /
// assembled geometry — never a flat glyph), built from a shared PBR material
// kit in a strict RED / BLACK / WHITE palette (founder mandate 2026-07-01):
// polished CHROME (the white), BLACK anodized metal (the black), RED anodized
// metal + RED transmissive gem + RED/white two-tone gradients, plus EMISSIVE red
// accents (toneMapped:false so they bloom THROUGH the surrounding glass cube at
// ~100px rail scale). Identity is carried by each tool's distinct FORM, the brand
// by the red/black/white. Every icon energizes on hover: faster spin, brighter
// glow, a gentle scale-up. `active` holds the icon lit.
//
// Overall extent ~0.30 world units, centered at origin, front-facing +Z.

import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { SIGNAL_RED } from '../config';

const WHITE = new THREE.Color('#ffffff');
const INK = new THREE.Color('#0a0a0d'); // near-black body base

// ── SHARED MATERIAL KIT ───────────────────────────────────────────────────────
// Helper builders, memoized per icon instance at the call sites. Emissive glow
// parts get toneMapped:false so they bypass AgX tonemapping and bloom.

function anodized(accent: string, shade = 0.65): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accent).multiplyScalar(shade),
    metalness: 0.9,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.3,
  });
}

function chrome(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#eef2f6',
    metalness: 1,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.6,
  });
}

/** Black anodized metal — the "black" of the red/black/white system. Dark,
 *  slightly satin, clearcoated so raking studio light still glints its edges. */
function black(shade = 1): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: INK.clone().multiplyScalar(shade),
    metalness: 0.86,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.15,
  });
}

function emissive(color: string | THREE.Color, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#08080d',
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    toneMapped: false,
    roughness: 0.3,
    metalness: 0.4,
  });
}

function gem(accent: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: accent,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.4,
    thickness: 0.5,
    ior: 1.7,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.6,
    toneMapped: false,
    envMapIntensity: 1.5,
  });
}

/** Two-tone vertex-colored metal: lerps `a`→`b` along local Y of the geometry. */
function gradientMat(a: string, b: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.9,
    roughness: 0.2,
    color: '#ffffff',
  });
}

/** Write per-vertex colors lerping colorTop→colorBottom along local Y. */
function paintYGradient(geo: THREE.BufferGeometry, colorBottom: THREE.Color, colorTop: THREE.Color) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const yMin = bb.min.y;
  const yMax = bb.max.y;
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = yMax > yMin ? (pos.getY(i) - yMin) / (yMax - yMin) : 0.5;
    c.copy(colorBottom).lerp(colorTop, t);
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

const lerp = THREE.MathUtils.lerp;

// ── ICON DISPATCH ─────────────────────────────────────────────────────────────

export function PrismIcon3D({
  id,
  accent,
  hovered,
  active,
}: {
  id: string;
  accent: string;
  hovered: boolean;
  active: boolean;
}): JSX.Element {
  switch (id) {
    case 'transform':
      return <TransformIcon accent={accent} hovered={hovered} active={active} />;
    case 'selection':
      return <SelectionIcon accent={accent} hovered={hovered} active={active} />;
    case 'add':
      return <AddIcon accent={accent} hovered={hovered} active={active} />;
    case 'library':
      return <LibraryIcon accent={accent} hovered={hovered} active={active} />;
    case 'image':
      return <ImageIcon accent={accent} hovered={hovered} active={active} />;
    case 'object3d':
      return <Object3DIcon accent={accent} hovered={hovered} active={active} />;
    case 'background':
      return <BackgroundIcon accent={accent} hovered={hovered} active={active} />;
    case 'changeArtifact':
      return <ChangeArtifactIcon accent={accent} hovered={hovered} active={active} />;
    case 'promptEdit':
      return <PromptEditIcon accent={accent} hovered={hovered} active={active} />;
    case 'text':
      return <TextIcon accent={accent} hovered={hovered} active={active} />;
    case 'animation':
      return <AnimationIcon accent={accent} hovered={hovered} active={active} />;
    case 'function':
      return <FunctionIcon accent={accent} hovered={hovered} active={active} />;
    case 'lighting':
      return <LightingIcon accent={accent} hovered={hovered} active={active} />;
    case 'build':
      return <BuildIcon accent={accent} hovered={hovered} active={active} />;
    default:
      return <AddIcon accent={accent} hovered={hovered} active={active} />;
  }
}

type IconProps = { accent: string; hovered: boolean; active: boolean };

// ── transform — 3-axis gizmo: chrome ball hub, 3 anodized arrow-axes + gem rings
// A real translate/rotate gizmo sculpture: three orthogonal beveled arrow shafts
// (X warm, Y the accent, Z chrome) socketed into a polished knuckle, each capped
// with a faceted cone, ringed by an emissive rotation hoop.
function TransformIcon({ accent, hovered, active }: IconProps) {
  const g = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const chromeMat = useMemo(chrome, []);
  const anodX = useMemo(() => anodized(SIGNAL_RED, 0.95), []); // +X shaft — red
  const anodY = useMemo(() => chrome(), []); // +Y shaft — white chrome
  const anodZ = useMemo(() => black(1.5), []); // +Z shaft — black anodized
  const glow = useMemo(() => emissive(accent, hovered ? 2.6 : 1.5), [accent, hovered]);
  const ringMat = useMemo(() => emissive(accent, 1.4), [accent]);
  const gemMat = useMemo(() => gem(accent), [accent]);

  useFrame((s, dt) => {
    const o = g.current;
    if (!o) return;
    const t = s.clock.elapsedTime;
    o.rotation.y = Math.sin(t * 0.5) * 0.18 + t * (hovered ? 0.5 : 0.18);
    o.rotation.x = Math.sin(t * 0.4) * 0.08;
    if (ringsRef.current) ringsRef.current.rotation.z = t * (hovered ? 1.4 : 0.5);
    o.scale.lerp(new THREE.Vector3().setScalar(hovered ? 1.12 : active ? 1.05 : 1), 0.15);
    glow.emissiveIntensity = lerp(glow.emissiveIntensity, (hovered ? 2.8 : 1.5) + (active ? 0.6 : 0), 0.15);
    ringMat.emissiveIntensity = lerp(ringMat.emissiveIntensity, hovered ? 2.4 : 1.4, 0.15);
  });

  // One axis = shaft + cone tip, oriented by parent group rotation.
  const Axis = ({ mat, rot }: { mat: THREE.Material; rot: [number, number, number] }) => (
    <group rotation={rot}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.014, 0.018, 0.13, 18]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position={[0, 0.155, 0]}>
        <coneGeometry args={[0.032, 0.06, 20]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );

  return (
    <group ref={g}>
      {/* polished central knuckle */}
      <mesh>
        <sphereGeometry args={[0.05, 28, 28]} />
        <primitive object={chromeMat} attach="material" />
      </mesh>
      {/* emissive core bleeding through the chrome */}
      <mesh>
        <sphereGeometry args={[0.026, 18, 18]} />
        <primitive object={glow} attach="material" />
      </mesh>
      {/* three orthogonal axes */}
      <Axis mat={anodY} rot={[0, 0, 0]} />
      <Axis mat={anodX} rot={[0, 0, -Math.PI / 2]} />
      <Axis mat={anodZ} rot={[Math.PI / 2, 0, 0]} />
      {/* gem caps on the +X / +Z tips for jewel accents */}
      <mesh position={[0.155, 0, 0]} geometry={useMemo(() => new THREE.OctahedronGeometry(0.022, 0), [])}>
        <primitive object={gemMat} attach="material" />
      </mesh>
      {/* rotation hoops (translate ↔ rotate read) */}
      <group ref={ringsRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.092, 0.006, 14, 40]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.082, 0.005, 14, 40]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ── selection — crosshair marquee: 4 chrome corner brackets floating in front of
// a recessed gem capture-plane, with a crosshair pip. (Verbatim recipe.)
function SelectionIcon({ accent, hovered, active }: IconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cornersRef = useRef<THREE.Group>(null);
  const chromeMat = useMemo(chrome, []);
  const anod = useMemo(() => anodized(accent), [accent]);
  const blackMat = useMemo(() => black(1.3), []);
  const glow = useMemo(() => emissive(accent, hovered ? 2.6 : 1.4), [accent, hovered]);
  const glowWash = useMemo(() => {
    const m = emissive(accent, (hovered ? 2.6 : 1.4) * 0.35);
    m.transparent = true;
    m.opacity = 0.45;
    return m;
  }, [accent, hovered]);
  const gemMat = useMemo(() => gem(accent), [accent]);

  useFrame((s) => {
    const o = groupRef.current;
    if (!o) return;
    const t = s.clock.elapsedTime;
    o.rotation.y = Math.sin(t * 0.5) * 0.12;
    o.rotation.x = Math.sin(t * 0.4) * 0.06;
    if (cornersRef.current) {
      const k = hovered ? 1 : 0.4;
      cornersRef.current.scale.setScalar(1 + Math.sin(t * (hovered ? 4 : 1.6)) * 0.04 * k);
      cornersRef.current.rotation.z = Math.sin(t * 0.8) * 0.03;
    }
    o.scale.lerp(new THREE.Vector3().setScalar(hovered ? 1.12 : 1), 0.15);
    glow.emissiveIntensity = lerp(glow.emissiveIntensity, (hovered ? 2.8 : 1.4) + (active ? 0.6 : 0), 0.15);
    glowWash.opacity = lerp(glowWash.opacity, active ? 0.7 : 0.45, 0.15);
  });

  const cornerGroup = () => (
    <>
      <RoundedBox args={[0.085, 0.022, 0.03]} radius={0.009} smoothness={4} position={[0.03, 0, 0]} material={chromeMat} />
      <RoundedBox args={[0.022, 0.085, 0.03]} radius={0.009} smoothness={4} position={[0, 0.03, 0]} material={chromeMat} />
      <RoundedBox args={[0.07, 0.006, 0.034]} radius={0.003} position={[0.028, 0.012, 0]} material={anod} />
      <RoundedBox args={[0.006, 0.07, 0.034]} radius={0.003} position={[0.012, 0.028, 0]} material={anod} />
      <mesh position={[0.006, 0.006, 0.018]}>
        <sphereGeometry args={[0.012, 20, 20]} />
        <primitive object={glow} attach="material" />
      </mesh>
    </>
  );
  const S = 0.115;

  return (
    <group ref={groupRef}>
      {/* base anchor (grounds the floating brackets) — black anodized plate */}
      <RoundedBox args={[0.26, 0.26, 0.02]} radius={0.03} smoothness={4} position={[0, 0, -0.05]} material={blackMat} />
      {/* recessed gem capture plane */}
      <RoundedBox args={[0.2, 0.2, 0.012]} radius={0.02} smoothness={4} position={[0, 0, -0.01]} material={gemMat} />
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[0.19, 0.19]} />
        <primitive object={glowWash} attach="material" />
      </mesh>
      {/* four corner brackets, floating proud */}
      <group ref={cornersRef}>
        <group position={[-S, -S, 0.04]} rotation-z={0}>{cornerGroup()}</group>
        <group position={[S, -S, 0.04]} rotation-z={Math.PI / 2}>{cornerGroup()}</group>
        <group position={[S, S, 0.04]} rotation-z={Math.PI}>{cornerGroup()}</group>
        <group position={[-S, S, 0.04]} rotation-z={-Math.PI / 2}>{cornerGroup()}</group>
      </group>
      {/* crosshair pip */}
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.018, 0.005, 16, 32]} />
        <primitive object={anod} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.052]}>
        <sphereGeometry args={[0.009, 18, 18]} />
        <primitive object={glow} attach="material" />
      </mesh>
    </group>
  );
}

// ── add — assembled plus with two-tone gradient arms, chrome hub, crystal core,
// emissive pith + arm-tip caps, and a 3D orbiting spark shell. (Verbatim recipe.)
function AddIcon({ accent, hovered, active }: IconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gemRef = useRef<THREE.Mesh>(null);
  const sparksRef = useRef<THREE.Group>(null);
  const armLight = useMemo(() => anodized(accent, 0.78), [accent]);
  const armDark = useMemo(() => anodized(accent, 0.5), [accent]);
  const chromeMat = useMemo(chrome, []);
  const gemMat = useMemo(() => gem(accent), [accent]);
  const pith = useMemo(() => emissive(accent, 2.2), [accent]);
  const tipMat = useMemo(() => emissive(accent, 1.6), [accent]);
  const sparkMat = useMemo(() => emissive(accent, 2.5), [accent]);
  const octo = useMemo(() => new THREE.OctahedronGeometry(0.045, 0), []);
  const icosa = useMemo(() => new THREE.IcosahedronGeometry(0.008, 0), []);

  useFrame((s, dt) => {
    const o = groupRef.current;
    if (!o) return;
    const t = s.clock.elapsedTime;
    const aBoost = active ? 1.25 : 1;
    o.rotation.y = Math.sin(t * 0.5) * 0.18;
    if (gemRef.current) {
      gemRef.current.rotation.y += dt * (hovered ? 2.4 : 0.9);
      gemRef.current.rotation.x += dt * 0.4;
    }
    if (sparksRef.current) sparksRef.current.rotation.y += dt * (hovered ? 1.8 : 0.6);
    pith.emissiveIntensity = lerp(pith.emissiveIntensity, ((hovered ? 3.6 : 2.2) + Math.sin(t * 4) * 0.4) * aBoost, 0.15);
    gemMat.emissiveIntensity = lerp(gemMat.emissiveIntensity, (hovered ? 1.1 : 0.6) * aBoost, 0.15);
    tipMat.emissiveIntensity = lerp(tipMat.emissiveIntensity, 1.6 * aBoost, 0.15);
    o.scale.lerp(new THREE.Vector3().setScalar((hovered ? 1.12 : 1) + (active ? 0.05 : 0)), 0.15);
  });

  return (
    <group ref={groupRef}>
      {/* plus arms — top/right light, bottom/left dark = gradient sweep */}
      <RoundedBox args={[0.085, 0.052, 0.06]} radius={0.022} smoothness={4} position={[0, 0.075, 0]} rotation={[0, 0, Math.PI / 2]} material={armLight} />
      <RoundedBox args={[0.085, 0.052, 0.06]} radius={0.022} smoothness={4} position={[0, -0.075, 0]} rotation={[0, 0, Math.PI / 2]} material={armDark} />
      <RoundedBox args={[0.085, 0.052, 0.06]} radius={0.022} smoothness={4} position={[0.075, 0, 0]} material={armLight} />
      <RoundedBox args={[0.085, 0.052, 0.06]} radius={0.022} smoothness={4} position={[-0.075, 0, 0]} material={armDark} />
      {/* polished hub */}
      <RoundedBox args={[0.07, 0.07, 0.07]} radius={0.02} smoothness={4} material={chromeMat} />
      {/* glowing pith behind the crystal */}
      <mesh position={[0, 0, 0.012]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <primitive object={pith} attach="material" />
      </mesh>
      {/* faceted crystal core */}
      <mesh ref={gemRef} geometry={octo} position={[0, 0, 0.05]} scale={[0.8, 1.15, 0.8]}>
        <primitive object={gemMat} attach="material" />
      </mesh>
      {/* arm-tip caps */}
      {([[0, 0.12], [0, -0.12], [0.12, 0], [-0.12, 0]] as const).map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <sphereGeometry args={[0.012, 16, 16]} />
          <primitive object={tipMat} attach="material" />
        </mesh>
      ))}
      {/* 3D orbit spark shell */}
      <group ref={sparksRef} rotation={[0.5, 0, 0]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          const z = [0.07, 0.0, -0.05][i];
          return (
            <mesh key={i} geometry={icosa} position={[Math.cos(a) * 0.16, Math.sin(a) * 0.16, z]}>
              <primitive object={sparkMat} attach="material" />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ── library — three rotated stacked slabs (chrome→anodized→emissive front-to-back
// gradient) with a bright emissive spine, chrome ridge bars, and a gem chip.
function LibraryIcon({ accent, hovered, active }: IconProps) {
  const g = useRef<THREE.Group>(null);
  const slabFront = useRef<THREE.Mesh>(null);
  const topMat = useRef<THREE.MeshStandardMaterial>(null);
  const spineMat = useRef<THREE.MeshStandardMaterial>(null);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);
  const chromeMat = useMemo(chrome, []);
  const anod = useMemo(() => anodized(accent, 0.55), [accent]);
  const gemMat = useMemo(() => {
    const m = gem(accent);
    m.transmission = 0.9;
    m.thickness = 0.2;
    m.ior = 1.5;
    return m;
  }, [accent]);
  const brightSpine = useMemo(() => accentC.clone().lerp(WHITE, 0.4).getStyle(), [accentC]);

  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.rotation.y = Math.sin(t * 0.5) * 0.18 + (hovered ? Math.sin(t * 2.2) * 0.05 : 0);
    g.current.rotation.x = Math.sin(t * 0.4) * 0.06;
    const targetScale = (hovered ? 1.12 : 1) * (active ? 1.05 : 1);
    g.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
    if (topMat.current) {
      const topBase = 1.6 + Math.sin(t * 1.6) * 0.15;
      topMat.current.emissiveIntensity = lerp(topMat.current.emissiveIntensity, hovered ? 2.6 : topBase, 0.15);
    }
    if (spineMat.current) spineMat.current.emissiveIntensity = lerp(spineMat.current.emissiveIntensity, hovered ? 3.8 : 2.4, 0.15);
    if (slabFront.current) slabFront.current.position.z = 0.04 + (hovered ? 0.012 : 0) * Math.sin(t * 3);
  });

  const Ridges = ({ y }: { y: number }) => (
    <>
      {[0, 1, 2].map((i) => (
        <RoundedBox key={i} args={[0.14, 0.006, 0.004]} radius={0.002} position={[0, y + 0.04 - i * 0.012, 0.014]} material={chromeMat} />
      ))}
    </>
  );

  return (
    <group ref={g}>
      {/* back slab — chrome */}
      <group position={[-0.02, -0.045, -0.06]} rotation={[0, 0.18, 0]}>
        <RoundedBox args={[0.2, 0.13, 0.022]} radius={0.012} smoothness={4} material={chromeMat} />
        <Ridges y={0} />
      </group>
      {/* mid slab — anodized */}
      <group position={[0, 0, -0.015]} rotation={[0, 0.12, 0]}>
        <RoundedBox args={[0.21, 0.135, 0.024]} radius={0.013} smoothness={4} material={anod} />
        <Ridges y={0} />
      </group>
      {/* front slab — emissive (hero), with spine + chip */}
      <group position={[0.02, 0.05, 0.04]} rotation={[0, 0.06, 0]}>
        <RoundedBox ref={slabFront} args={[0.215, 0.14, 0.026]} radius={0.014} smoothness={4}>
          <meshStandardMaterial ref={topMat} color="#0b0b10" emissive={accent} emissiveIntensity={1.6} toneMapped={false} metalness={0.3} roughness={0.4} />
        </RoundedBox>
        <Ridges y={0} />
        <RoundedBox args={[0.018, 0.12, 0.03]} radius={0.006} position={[-0.105, 0, 0.012]}>
          <meshStandardMaterial ref={spineMat} color="#0b0b10" emissive={brightSpine} emissiveIntensity={2.4} toneMapped={false} metalness={0.3} roughness={0.4} />
        </RoundedBox>
        <RoundedBox args={[0.03, 0.03, 0.03]} radius={0.008} position={[0.065, 0.035, 0.03]} material={gemMat} />
      </group>
    </group>
  );
}

// ── image — a metal shadow-box diorama: chrome bezel + dark recess, gradient sky,
// emissive gem sun cresting two extruded mountain ridges, with a glass glint.
function ImageIcon({ accent, hovered, active }: IconProps) {
  const g = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Mesh>(null);
  const sunMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const haloMat = useRef<THREE.MeshStandardMaterial>(null);
  const frameMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);

  const chromeMat = useMemo(() => {
    const m = chrome();
    m.roughness = 0.12;
    m.envMapIntensity = 1.4;
    return m;
  }, []);
  const innerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2e36', metalness: 1, roughness: 0.25 }), []);

  // sky gradient backplate
  const skyGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.19, 0.15, 1, 16);
    // red horizon → black night sky (red/black/white — no orange/blue)
    paintYGradient(geo, new THREE.Color('#07070b'), new THREE.Color(SIGNAL_RED));
    return geo;
  }, []);
  const skyMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#2a0509', emissiveIntensity: 0.4, roughness: 0.6 }), []);

  // mountain ridge extrude (snow-capped two-tone)
  const ridgeGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.095, -0.07);
    shape.lineTo(-0.06, 0.05);
    shape.lineTo(-0.02, 0.0);
    shape.lineTo(0.0, 0.02);
    shape.lineTo(0.04, -0.01);
    shape.lineTo(0.07, 0.075);
    shape.lineTo(0.095, -0.07);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
    geo.center();
    paintYGradient(geo, accentC.clone().multiplyScalar(0.45), new THREE.Color('#eaf2ff'));
    return geo;
  }, [accentC]);
  const ridgeMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.3 }), []);
  const farRidgeMat = useMemo(() => anodized(accent, 0.4), [accent]);
  const sunMatM = useMemo(() => {
    const m = gem(accent);
    m.emissive = accentC.clone().lerp(WHITE, 0.55); // red → white-hot sun (no gold)
    m.emissiveIntensity = 2.2;
    m.roughness = 0.15;
    return m;
  }, [accent, accentC]);
  const haloMatM = useMemo(() => {
    const m = emissive(accent, 0.9);
    m.transparent = true;
    m.opacity = 0.35;
    return m;
  }, [accent]);
  const glintMat = useMemo(() => {
    const m = emissive('#ffffff', 0.5);
    m.transparent = true;
    m.opacity = 0.25;
    return m;
  }, []);
  const frameMatM = useMemo(() => {
    const m = chrome();
    m.emissive = accentC;
    m.emissiveIntensity = 0;
    m.toneMapped = false;
    return m;
  }, [accentC]);

  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    const sp = hovered ? 1.6 : 1;
    g.current.rotation.y = Math.sin(t * 0.6 * sp) * 0.06;
    g.current.rotation.x = Math.sin(t * 0.4 * sp) * 0.03;
    g.current.scale.lerp(new THREE.Vector3().setScalar(hovered ? 1.12 : 1), 0.15);
    if (sunRef.current) sunRef.current.position.y = 0.022 + Math.sin(t * 1.2) * 0.004 * (active ? 0 : 1) + (active ? 0.008 : 0);
    if (sunMat.current) sunMat.current.emissiveIntensity = lerp(sunMat.current.emissiveIntensity, hovered ? 3.6 : 2.2, 0.15);
    if (haloMat.current) haloMat.current.opacity = lerp(haloMat.current.opacity, hovered ? 0.6 : 0.35, 0.15);
    if (frameMat.current) frameMat.current.emissiveIntensity = lerp(frameMat.current.emissiveIntensity, active ? 0.2 + Math.sin(t * 3) * 0.2 : 0, 0.15);
  });

  return (
    <group ref={g}>
      {/* sky backplate */}
      <mesh geometry={skyGeo} position={[0, 0, -0.012]} material={skyMat} />
      {/* sun halo + orb */}
      <mesh position={[0.045, 0.022, -0.005]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial ref={haloMat} color="#08080d" emissive={accent} emissiveIntensity={0.9} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh ref={sunRef} position={[0.045, 0.022, -0.006]}>
        <sphereGeometry args={[0.032, 24, 24]} />
        <primitive object={sunMatM} attach="material" ref={sunMat as never} />
      </mesh>
      {/* far + near ridges */}
      <mesh geometry={ridgeGeo} position={[0, 0, 0.004]} material={ridgeMat} />
      <mesh geometry={ridgeGeo} position={[-0.01, -0.012, 0.016]} scale={[0.82, 0.6, 1]} material={farRidgeMat} />
      {/* frame bezel + inner recess lip */}
      <RoundedBox args={[0.26, 0.22, 0.05]} radius={0.018} smoothness={5}>
        <primitive object={frameMatM} attach="material" ref={frameMat as never} />
      </RoundedBox>
      <RoundedBox args={[0.205, 0.165, 0.052]} radius={0.012} position={[0, 0, 0.002]} material={innerMat} />
      {/* glass glint */}
      <RoundedBox args={[0.06, 0.008, 0.002]} radius={0.004} position={[-0.06, 0.06, 0.028]} rotation={[0, 0, -0.35]} material={glintMat} />
    </group>
  );
}

// ── object3d — a faceted floating cube-cluster: a chrome wireframe-edged cube
// shell wrapping an emissive gem core, with three anodized corner studs and an
// orbiting satellite — reads unmistakably as a 3D object/mesh handle.
function Object3DIcon({ accent, hovered, active }: IconProps) {
  const g = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const satRef = useRef<THREE.Group>(null);
  const chromeMat = useMemo(chrome, []);
  const anod = useMemo(() => anodized(accent, 0.72), [accent]);
  const gemMat = useMemo(() => gem(accent), [accent]);
  const coreMat = useMemo(() => emissive(accent, 2.4), [accent]);
  const satMat = useMemo(() => emissive(accent, 2.6), [accent]);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.18, 0.18, 0.18)), []);
  const icoCore = useMemo(() => new THREE.IcosahedronGeometry(0.058, 0), []);
  const octoSat = useMemo(() => new THREE.OctahedronGeometry(0.018, 0), []);

  // 8 corner stud positions
  const corners = useMemo(() => {
    const c: [number, number, number][] = [];
    for (const x of [-0.09, 0.09]) for (const y of [-0.09, 0.09]) for (const z of [-0.09, 0.09]) c.push([x, y, z]);
    return c;
  }, []);

  useFrame((s, dt) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.rotation.y += dt * (hovered ? 0.9 : 0.35);
    g.current.rotation.x = Math.sin(t * 0.4) * 0.18;
    if (innerRef.current) {
      innerRef.current.rotation.y -= dt * (hovered ? 1.6 : 0.6);
      innerRef.current.rotation.x += dt * 0.4;
    }
    if (satRef.current) satRef.current.rotation.z += dt * (hovered ? 1.8 : 0.7);
    const aBoost = active ? 1.25 : 1;
    coreMat.emissiveIntensity = lerp(coreMat.emissiveIntensity, ((hovered ? 3.6 : 2.4) + Math.sin(t * 3) * 0.3) * aBoost, 0.15);
    satMat.emissiveIntensity = lerp(satMat.emissiveIntensity, 2.6 * aBoost, 0.15);
    g.current.scale.lerp(new THREE.Vector3().setScalar((hovered ? 1.12 : 1) + (active ? 0.05 : 0)), 0.15);
  });

  return (
    <group ref={g}>
      {/* translucent gem cube shell */}
      <mesh>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <primitive object={gemMat} attach="material" />
      </mesh>
      {/* chrome wireframe edges */}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color="#eef2f6" toneMapped={false} />
      </lineSegments>
      {/* emissive gem core (faceted) */}
      <mesh ref={innerRef} geometry={icoCore}>
        <primitive object={coreMat} attach="material" />
      </mesh>
      {/* anodized corner studs */}
      {corners.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.018, 14, 14]} />
          <primitive object={anod} attach="material" />
        </mesh>
      ))}
      {/* orbiting satellite */}
      <group ref={satRef} rotation={[0.5, 0.3, 0]}>
        <mesh geometry={octoSat} position={[0.16, 0, 0]}>
          <primitive object={satMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ── background — a layered scene-world: gradient dome over a chrome horizon ring,
// a tilted anodized ground slab, an orbiting emissive sun with additive halo, and
// twinkling star specks. (Verbatim recipe.)
function BackgroundIcon({ accent, hovered, active }: IconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const orbPivot = useRef<THREE.Group>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const orbMat = useRef<THREE.MeshStandardMaterial>(null);
  const domeMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const starMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);
  const speed = useRef(1);

  const chromeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9edf2', metalness: 1, roughness: 0.08, envMapIntensity: 1.5 }), []);
  const slabMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ color: accentC.clone().multiplyScalar(0.6), metalness: 0.95, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3 });
    return m;
  }, [accentC]);

  const domeGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.135, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.62);
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const yMin = bb.min.y, yMax = bb.max.y;
    const pos = geo.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    const low = accentC.clone().multiplyScalar(0.35);
    const high = accentC.clone().lerp(WHITE, 0.55);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - yMin) / (yMax - yMin);
      c.copy(low).lerp(high, t);
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [accentC]);

  const orbColor = useMemo(() => accentC.clone().lerp(WHITE, 0.3), [accentC]);
  const stars: [number, number, number][] = [[-0.06, 0.1, 0.02], [0.05, 0.115, 0.0], [-0.02, 0.13, -0.01]];

  useFrame((s) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    speed.current = lerp(speed.current, hovered ? 2.4 : 1, 0.12);
    if (orbPivot.current) orbPivot.current.rotation.z = t * 0.35 * speed.current;
    groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.08;
    starMats.current.forEach((m, i) => { if (m) m.emissiveIntensity = 1.0 + Math.sin(t * 2 + i) * 0.6; });
    if (orbMat.current) orbMat.current.emissiveIntensity = lerp(orbMat.current.emissiveIntensity, hovered ? 4.2 : 2.6, 0.12);
    if (domeMat.current) domeMat.current.emissiveIntensity = lerp(domeMat.current.emissiveIntensity, (hovered ? 0.5 : 0.25) + (active ? 0.4 : 0), 0.12);
    const sc = hovered ? 1.12 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.12);
  });

  return (
    <group ref={groupRef}>
      {/* gradient dome */}
      <mesh geometry={domeGeo} position={[0, -0.02, 0]} rotation={[-0.12, 0, 0]}>
        <meshPhysicalMaterial ref={domeMat} vertexColors metalness={0.45} roughness={0.3} clearcoat={1} clearcoatRoughness={0.18} emissive={accent} emissiveIntensity={0.25} side={THREE.DoubleSide} />
      </mesh>
      {/* chrome horizon ring */}
      <mesh position={[0, -0.052, 0]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat}>
        <torusGeometry args={[0.135, 0.012, 16, 64]} />
      </mesh>
      {/* ground slab */}
      <RoundedBox args={[0.2, 0.022, 0.09]} radius={0.011} smoothness={4} position={[0, -0.058, 0.03]} rotation={[-0.18, 0, 0]} material={slabMat} />
      {/* orbiting sun + additive halo */}
      <group ref={orbPivot}>
        <mesh ref={orbRef} position={[0.1, 0.055, 0.045]}>
          <sphereGeometry args={[0.026, 24, 24]} />
          <meshStandardMaterial ref={orbMat} color="#08080d" emissive={orbColor} emissiveIntensity={2.6} toneMapped={false} />
          <mesh>
            <sphereGeometry args={[0.04, 20, 20]} />
            <meshBasicMaterial color={orbColor} transparent opacity={0.18} toneMapped={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </mesh>
      </group>
      {/* star specks */}
      {stars.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial ref={(m) => { starMats.current[i] = m; }} color="#08080d" emissive="#ffffff" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── changeArtifact — an iridescent faceted 4-point morph-star with a phantom
// ghost-star mid-morph, a white-hot sparkle core, spike-tip stars, and a chrome
// collar. Counter-rotating star pair sells the "transformation". (Verbatim.)
function ChangeArtifactIcon({ accent, hovered, active }: IconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mainStar = useRef<THREE.Mesh>(null);
  const ghostStar = useRef<THREE.Mesh>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const e = useRef(0);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);

  const starGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const outer = 0.135, inner = 0.032;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? outer : inner;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.02, bevelSegments: 3, curveSegments: 1 });
    geo.center();
    return geo;
  }, []);

  const gemMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    // no iridescence (that reads as a banned rainbow) — a deep red faceted gem
    // with a red emissive core carries the "transform" energy instead.
    color: accent, metalness: 0, roughness: 0.02, transmission: 0.35, thickness: 0.4, ior: 2.4,
    iridescence: 0,
    emissive: accentC.clone(), emissiveIntensity: 0.35, toneMapped: false,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.7,
    attenuationColor: accentC.clone(), attenuationDistance: 0.5,
  }), [accent, accentC]);
  const ghostMat = useMemo(() => {
    const cool = accentC.clone().lerp(WHITE, 0.5); // morph ghost = red → white (no blue)
    return new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0, roughness: 0.04, transmission: 0.15, thickness: 0.3, ior: 2.2, emissive: cool, emissiveIntensity: 0.8, toneMapped: false, clearcoat: 1, transparent: true, opacity: 0.55 });
  }, [accent, accentC]);
  const chromeMat = useMemo(() => { const m = chrome(); m.roughness = 0.06; m.envMapIntensity = 2; return m; }, []);
  const whiteHot = useMemo(() => accentC.clone().lerp(WHITE, 0.7), [accentC]);
  const haloMat = useMemo(() => { const m = emissive(accent, 2.2); m.transparent = true; m.opacity = 0.25; m.blending = THREE.AdditiveBlending; m.depthWrite = false; return m; }, [accent]);
  const tipMat = useMemo(() => emissive(accent, 3.0), [accent]);
  const octoCore = useMemo(() => new THREE.OctahedronGeometry(0.045, 0), []);
  const octoHalo = useMemo(() => new THREE.OctahedronGeometry(0.07, 0), []);
  const tetGeo = useMemo(() => new THREE.TetrahedronGeometry(0.018, 0), []);

  useFrame((s) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    const energy = hovered ? 1 : 0;
    e.current += (energy - e.current) * 0.1;
    if (active) e.current = Math.max(e.current, 0.4);
    groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.06;
    groupRef.current.position.y = Math.sin(t * 0.8) * 0.004;
    if (mainStar.current) mainStar.current.rotation.z = t * (0.2 + e.current * 0.8);
    if (ghostStar.current) ghostStar.current.rotation.z = Math.PI / 4 - t * (0.2 + e.current * 0.8);
    if (coreMesh.current) coreMesh.current.scale.setScalar(1 + Math.sin(t * 4) * 0.08 + e.current * 0.25);
    if (coreMat.current) coreMat.current.emissiveIntensity = 4.5 + Math.sin(t * 6) * 1.2 + e.current * 3;
    groupRef.current.scale.setScalar(lerp(1, 1.12, e.current));
  });

  return (
    <group ref={groupRef}>
      {/* chrome collar */}
      <mesh position={[0, 0, -0.01]} material={chromeMat}>
        <torusGeometry args={[0.085, 0.008, 12, 36]} />
      </mesh>
      {/* ghost / morph star */}
      <mesh ref={ghostStar} geometry={starGeo} scale={0.82} rotation={[0, 0, Math.PI / 4]} position={[0, 0, -0.03]} material={ghostMat} />
      {/* main iridescent star */}
      <mesh ref={mainStar} geometry={starGeo} rotation={[-0.12, 0, 0]} material={gemMat} />
      {/* sparkle core + additive halo */}
      <mesh ref={coreMesh} geometry={octoCore} position={[0, 0, 0.04]}>
        <meshStandardMaterial ref={coreMat} color="#08080d" emissive={whiteHot} emissiveIntensity={4.5} toneMapped={false} />
      </mesh>
      <mesh geometry={octoHalo} position={[0, 0, 0.04]} material={haloMat} />
      {/* spike-tip stars */}
      {([[0.135, 0], [-0.135, 0], [0, 0.135], [0, -0.135]] as const).map(([x, y], i) => (
        <mesh key={i} geometry={tetGeo} position={[x, y, 0.02]} material={tipMat} />
      ))}
    </group>
  );
}

// ── promptEdit — a faceted prism-pill (opaque crystal) with a chat-pill tail, a
// white input beam entering left, a refracted rainbow spectrum fan exiting right,
// and an accent spark jewel. (Verbatim recipe.)
function PromptEditIcon({ accent, hovered, active }: IconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.Mesh>(null);
  const sparkMat = useRef<THREE.MeshStandardMaterial>(null);
  const beamGroupRef = useRef<THREE.Group>(null);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);

  const gemMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: accent, metalness: 0, roughness: 0.06, transmission: 0, clearcoat: 1, clearcoatRoughness: 0.04,
    ior: 1.6, reflectivity: 0.6, envMapIntensity: 1.4, attenuationColor: accentC.clone(),
  }), [accent, accentC]);

  const facetGeo = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.072, 0);
    geo.scale(1.25, 0.85, 0.7);
    paintYGradient(geo, accentC.clone(), accentC.clone().lerp(WHITE, 0.45));
    return geo;
  }, [accentC]);
  const facetMat = useMemo(() => { const m = chrome(); m.vertexColors = true; m.emissive = accentC.clone(); m.emissiveIntensity = 0.12; return m; }, [accentC]);

  const beamMat = useMemo(() => emissive('#ffffff', 2.2), []);
  const sparkColor = useMemo(() => accentC.clone().lerp(WHITE, 0.5), [accentC]);
  const haloMat = useMemo(() => { const m = emissive(accent, 0.6); m.transparent = true; m.opacity = 0.35; m.blending = THREE.AdditiveBlending; return m; }, [accent]);
  const octoSpark = useMemo(() => new THREE.OctahedronGeometry(0.026, 0), []);

  // dispersion fan kept in-palette: white → red → oxblood (NOT a rainbow)
  const spectrum = useMemo(() => ['#ffffff', '#ff8f95', SIGNAL_RED, '#c01423', '#5c0a12'], []);
  const rodMats = useMemo(() => spectrum.map((c) => emissive(c, 1.8)), [spectrum]);

  useFrame((s, dt) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.18;
    groupRef.current.rotation.x = Math.sin(t * 0.33) * 0.06;
    if (sparkRef.current) { sparkRef.current.rotation.y += dt * (hovered ? 2.4 : 0.8); sparkRef.current.rotation.x += dt * 0.6; }
    const aBoost = active ? 1.2 : 1;
    if (sparkMat.current) sparkMat.current.emissiveIntensity = (2.6 + Math.sin(t * 4) * (hovered ? 0.9 : 0.3)) * aBoost;
    rodMats.forEach((m, i) => { m.emissiveIntensity = lerp(m.emissiveIntensity, (hovered ? 2.8 : 1.8 + Math.sin(t * 3 + i) * 0.15) * aBoost, 0.15); });
    if (beamGroupRef.current) beamGroupRef.current.scale.x = lerp(beamGroupRef.current.scale.x, hovered ? 1.15 : 1, 0.15);
    groupRef.current.scale.lerp(new THREE.Vector3().setScalar(hovered ? 1.1 : 1), 0.15);
  });

  return (
    <group ref={groupRef}>
      {/* prism-pill body */}
      <RoundedBox args={[0.2, 0.13, 0.085]} radius={0.04} smoothness={6} material={gemMat} />
      {/* facet overlay */}
      <mesh geometry={facetGeo} material={facetMat} />
      {/* chat-pill tail */}
      <RoundedBox args={[0.045, 0.045, 0.05]} radius={0.018} smoothness={4} position={[-0.085, -0.075, 0]} rotation={[0, 0, 0.78]} material={gemMat} />
      {/* white input beam */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.16, 0, 0.02]} material={beamMat}>
        <cylinderGeometry args={[0.006, 0.006, 0.1, 12]} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[-0.105, 0, 0.02]} material={beamMat}>
        <coneGeometry args={[0.009, 0.025, 12]} />
      </mesh>
      {/* dispersed spectrum fan */}
      <group ref={beamGroupRef} position={[0.1, 0, 0.02]}>
        {spectrum.map((_, i) => {
          const spread = -0.3 + (i / (spectrum.length - 1)) * 0.6;
          return (
            <group key={i} rotation={[0, 0, spread]}>
              <mesh position={[0.0425, 0, i * 0.004]} material={rodMats[i]}>
                <boxGeometry args={[0.085, 0.006, 0.004]} />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* accent spark + halo */}
      <mesh ref={sparkRef} geometry={octoSpark} position={[0.085, 0.06, 0.045]}>
        <meshStandardMaterial ref={sparkMat} color="#08080d" emissive={sparkColor} emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
      <mesh geometry={octoSpark} position={[0.085, 0.06, 0.045]} scale={1.7} material={haloMat} />
    </group>
  );
}

// ── text — a bold extruded serif capital "A" with a silver→accent vertex
// gradient, an emissive crossbar inlay, an apex gem cap, and a chrome baseline
// slab with an emissive pinstripe. (Verbatim recipe.)
function TextIcon({ accent, hovered, active }: IconProps) {
  const gRoot = useRef<THREE.Group>(null);
  const matCrossbarRef = useRef<THREE.MeshStandardMaterial>(null);
  const matPinstripeRef = useRef<THREE.MeshStandardMaterial>(null);
  const gemRef = useRef<THREE.Mesh>(null);
  const spin = useRef(0);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);

  const aGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.1, -0.12);
    shape.lineTo(-0.018, 0.12);
    shape.lineTo(0.018, 0.12);
    shape.lineTo(0.1, -0.12);
    shape.lineTo(0.062, -0.12);
    shape.lineTo(0.04, -0.05);
    shape.lineTo(-0.04, -0.05);
    shape.lineTo(-0.062, -0.12);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.03, -0.01);
    hole.lineTo(0.03, -0.01);
    hole.lineTo(0, 0.07);
    hole.closePath();
    shape.holes = [hole];
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, steps: 1 });
    geo.translate(0, 0, -0.035);
    paintYGradient(geo, accentC.clone(), new THREE.Color('#eef2f6'));
    return geo;
  }, [accentC]);
  const aMat = useMemo(() => new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.18, clearcoat: 1, color: '#ffffff' }), []);
  const chromeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#dfe6ee', metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4 }), []);
  const gemMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0, roughness: 0.05, transmission: 0, clearcoat: 1, emissive: accentC.clone(), emissiveIntensity: 0.4, toneMapped: false }), [accent, accentC]);
  const octoGem = useMemo(() => new THREE.OctahedronGeometry(0.018, 0), []);

  useFrame((s) => {
    if (!gRoot.current) return;
    const t = s.clock.elapsedTime;
    spin.current = lerp(spin.current, hovered ? 1 : 0, 0.12);
    gRoot.current.rotation.y = Math.sin(t * 0.6) * 0.18 + spin.current * t * 0.5;
    gRoot.current.position.y = Math.sin(t * 1.1) * 0.006;
    const sc = hovered ? 1.12 : 1;
    gRoot.current.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.15);
    const base = active ? 0.25 : 0;
    if (matCrossbarRef.current) matCrossbarRef.current.emissiveIntensity = lerp(matCrossbarRef.current.emissiveIntensity, (hovered ? 3.4 : 1.6) + base, 0.15);
    if (matPinstripeRef.current) matPinstripeRef.current.emissiveIntensity = lerp(matPinstripeRef.current.emissiveIntensity, (hovered ? 2.2 : 1.0) + base, 0.15);
    if (gemRef.current) gemRef.current.rotation.y += 0.02;
  });

  return (
    <group ref={gRoot}>
      <mesh geometry={aGeo} position={[0, 0.01, 0]} material={aMat} />
      {/* crossbar inlay */}
      <RoundedBox args={[0.085, 0.022, 0.018]} radius={0.008} smoothness={4} position={[0, -0.005, 0.04]}>
        <meshStandardMaterial ref={matCrossbarRef} color="#08080d" emissive={accent} emissiveIntensity={1.6} toneMapped={false} />
      </RoundedBox>
      {/* apex cap gem */}
      <mesh ref={gemRef} geometry={octoGem} position={[0, 0.125, 0.02]} material={gemMat} />
      {/* baseline slab + pinstripe */}
      <RoundedBox args={[0.24, 0.022, 0.09]} radius={0.01} smoothness={4} position={[0, -0.135, 0]} material={chromeMat} />
      <RoundedBox args={[0.24, 0.004, 0.002]} radius={0.001} position={[0, -0.135, 0.046]}>
        <meshStandardMaterial ref={matPinstripeRef} color="#08080d" emissive={accent} emissiveIntensity={1.0} toneMapped={false} />
      </RoundedBox>
    </group>
  );
}

// ── animation — a magic wand on a diagonal: chrome shaft + anodized pommel/ferrule,
// a gem-cored emissive star tip with 8 spikes, and a vertex-gradient comet ribbon
// with trail sparks. (Verbatim recipe.)
function AnimationIcon({ accent, hovered, active }: IconProps) {
  const g = useRef<THREE.Group>(null);
  const starGroup = useRef<THREE.Group>(null);
  const ribbonGroup = useRef<THREE.Group>(null);
  const spikeMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const ribbonBoost = useRef(0);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);

  const chromeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, color: '#dfe6ee', envMapIntensity: 1.4 }), []);
  const anod = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.28, clearcoat: 0.7, color: accent, envMapIntensity: 1.1 }), [accent]);
  const gemMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0, roughness: 0.02, transmission: 0.55, thickness: 0.4, clearcoat: 1, ior: 1.8, emissive: accentC.clone(), emissiveIntensity: 0.5, toneMapped: false }), [accent, accentC]);

  const ribbonGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.06, 0.06, 0), new THREE.Vector3(0.1, 0.0, -0.01),
      new THREE.Vector3(0.07, -0.07, 0), new THREE.Vector3(0.0, -0.1, 0.01),
    ]);
    const geo = new THREE.TubeGeometry(curve, 48, 0.012, 10, false);
    const pos = geo.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    const head = accentC.clone(), mid = WHITE.clone(), tail = accentC.clone().multiplyScalar(0.2);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = i / (pos.count - 1);
      if (t < 0.5) c.copy(head).lerp(mid, t * 2); else c.copy(mid).lerp(tail, (t - 0.5) * 2);
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [accentC]);
  const ribbonMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, emissive: accentC.clone(), emissiveIntensity: 1.2, toneMapped: false }), [accentC]);
  const sparkMat = useMemo(() => emissive(accent, 2.2), [accent]);
  const octoCore = useMemo(() => new THREE.OctahedronGeometry(0.034, 0), []);

  const spikes = useMemo(() => {
    const arr: { pos: [number, number, number]; rot: number; long: boolean }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      arr.push({ pos: [Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0], rot: a - Math.PI / 2, long: i % 2 === 0 });
    }
    return arr;
  }, []);

  useFrame((s, dt) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    ribbonBoost.current = lerp(ribbonBoost.current, hovered ? 1 : 0, 0.1);
    if (starGroup.current) starGroup.current.rotation.z += dt * (0.4 + ribbonBoost.current * 1.2);
    g.current.position.y = Math.sin(t * 1.4) * 0.004;
    spikeMats.current.forEach((m) => { if (m) m.emissiveIntensity = (2.6 + Math.sin(t * 3) * 0.4) * (1 + ribbonBoost.current * 0.5); });
    if (coreMat.current) coreMat.current.emissiveIntensity = 3.0 * (1 + ribbonBoost.current * 0.5);
    ribbonMat.emissiveIntensity = lerp(ribbonMat.emissiveIntensity, hovered ? 1.8 : 1.2, 0.12);
    if (ribbonGroup.current) ribbonGroup.current.rotation.z = ribbonBoost.current * Math.sin(t * 2) * 0.1;
    const sc = (hovered ? 1.12 : 1) + (active ? 0.03 : 0);
    g.current.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.12);
  });

  return (
    <group ref={g} rotation={[0, 0, 0.42]}>
      {/* wand shaft + pommel + ferrule */}
      <mesh position={[-0.055, -0.06, 0]} rotation={[0, 0, -0.6]} material={chromeMat}>
        <cylinderGeometry args={[0.012, 0.022, 0.2, 24]} />
      </mesh>
      <mesh position={[-0.1, -0.135, 0]} material={anod}>
        <sphereGeometry args={[0.026, 20, 20]} />
      </mesh>
      <mesh position={[-0.01, 0.015, 0]} rotation={[0, 0, -0.6]} material={anod}>
        <torusGeometry args={[0.026, 0.009, 12, 24]} />
      </mesh>
      {/* star tip */}
      <group ref={starGroup} position={[0.03, 0.06, 0]}>
        <mesh geometry={octoCore} material={gemMat} />
        <mesh>
          <sphereGeometry args={[0.016, 16, 16]} />
          <meshStandardMaterial ref={coreMat} color="#08080d" emissive="#ffffff" emissiveIntensity={3.0} toneMapped={false} />
        </mesh>
        {spikes.map((sp, i) => (
          <mesh key={i} position={sp.pos} rotation={[0, 0, sp.rot]}>
            {sp.long ? <coneGeometry args={[0.012, 0.075, 4]} /> : <coneGeometry args={[0.008, 0.04, 4]} />}
            <meshStandardMaterial ref={(m) => { if (m) spikeMats.current[i] = m; }} color="#08080d" emissive={accent} emissiveIntensity={2.6} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* comet ribbon + trail sparks */}
      <group ref={ribbonGroup}>
        <mesh geometry={ribbonGeo} material={ribbonMat} />
        {([[0.11, -0.02, 0, 0.008], [0.05, -0.085, 0.01, 0.01], [-0.01, -0.11, 0, 0.006]] as const).map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} material={sparkMat}>
            <sphereGeometry args={[r, 12, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── function — a node/logic block: a chrome processor chip with anodized pins,
// an emissive gem core, and two orbiting wired data-nodes connected by glowing
// conduits — reads as a function/logic operator.
function FunctionIcon({ accent, hovered, active }: IconProps) {
  const g = useRef<THREE.Group>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const nodeMat = useMemo(() => emissive(accent, 2.4), [accent]);
  const chromeMat = useMemo(chrome, []);
  const anod = useMemo(() => anodized(accent, 0.7), [accent]);
  const gemMat = useMemo(() => gem(accent), [accent]);
  const conduitMat = useMemo(() => { const m = emissive(accent, 1.6); m.transparent = true; m.opacity = 0.85; return m; }, [accent]);
  const icoNode = useMemo(() => new THREE.IcosahedronGeometry(0.024, 0), []);
  const fx = useMemo(() => new THREE.Color(accent).lerp(WHITE, 0.4), [accent]);

  // pin positions on left + right edges of the chip
  const pins = useMemo(() => {
    const p: { pos: [number, number, number] }[] = [];
    for (const side of [-1, 1]) for (const yy of [-0.04, 0, 0.04]) p.push({ pos: [side * 0.085, yy, 0] });
    return p;
  }, []);

  useFrame((s, dt) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.rotation.y = Math.sin(t * 0.5) * 0.16;
    g.current.rotation.x = Math.sin(t * 0.4) * 0.06;
    if (orbitRef.current) orbitRef.current.rotation.z += dt * (hovered ? 1.8 : 0.7);
    const aBoost = active ? 1.25 : 1;
    if (coreMat.current) coreMat.current.emissiveIntensity = ((hovered ? 3.6 : 2.4) + Math.sin(t * 3) * 0.3) * aBoost;
    nodeMat.emissiveIntensity = lerp(nodeMat.emissiveIntensity, 2.4 * aBoost, 0.15);
    g.current.scale.lerp(new THREE.Vector3().setScalar((hovered ? 1.12 : 1) + (active ? 0.05 : 0)), 0.15);
  });

  return (
    <group ref={g}>
      {/* processor chip body */}
      <RoundedBox args={[0.15, 0.15, 0.05]} radius={0.018} smoothness={4} material={chromeMat} />
      {/* recessed gem face */}
      <RoundedBox args={[0.1, 0.1, 0.052]} radius={0.012} position={[0, 0, 0.002]} material={gemMat} />
      {/* emissive "fx" core gem */}
      <mesh position={[0, 0, 0.04]}>
        <octahedronGeometry args={[0.034, 0]} />
        <meshStandardMaterial ref={coreMat} color="#08080d" emissive={fx} emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      {/* anodized edge pins */}
      {pins.map((pin, i) => (
        <RoundedBox key={i} args={[0.03, 0.018, 0.03]} radius={0.005} position={pin.pos} material={anod} />
      ))}
      {/* orbiting wired data-nodes + conduits */}
      <group ref={orbitRef} rotation={[0.5, 0, 0]}>
        {[0, 1].map((i) => {
          const a = i * Math.PI;
          const x = Math.cos(a) * 0.13, y = Math.sin(a) * 0.13;
          return (
            <group key={i}>
              <mesh geometry={icoNode} position={[x, y, 0]}>
                <primitive object={nodeMat} attach="material" />
              </mesh>
              <mesh position={[x / 2, y / 2, 0]} rotation={[0, 0, a + Math.PI / 2]} material={conduitMat}>
                <cylinderGeometry args={[0.004, 0.004, 0.1, 8]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ── lighting — a radiant sun-lamp: nested emissive core (white center→accent rim
// gradient), chrome equator collar, 12 alternating tapered rays under a tilted
// group, gem tip-jewels, and an additive bloom shell. (Verbatim recipe.)
function LightingIcon({ accent, hovered, active }: IconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreInner = useRef<THREE.MeshStandardMaterial>(null);
  const coreOuter = useRef<THREE.MeshStandardMaterial>(null);
  const bloomShell = useRef<THREE.MeshBasicMaterial>(null);
  const spinSpeed = useRef(0.18);
  const coreOuterMat = useMemo(() => new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.8, toneMapped: false, transparent: true, opacity: 0.55 }), [accent]);
  const collar = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.06, color: '#eef2f6', envMapIntensity: 1.4 }), []);
  const gemAccent = useMemo(() => new THREE.MeshPhysicalMaterial({ transmission: 0.35, thickness: 0.4, roughness: 0.05, metalness: 0, color: accent, emissive: accent, emissiveIntensity: 0.6, clearcoat: 1, toneMapped: false }), [accent]);
  const coneGeo = useMemo(() => new THREE.ConeGeometry(0.018, 0.085, 20), []);
  const icoGem = useMemo(() => new THREE.IcosahedronGeometry(0.012, 0), []);

  const rays = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = i * ((Math.PI * 2) / 12);
      return { angle, pos: [Math.cos(angle) * 0.135, Math.sin(angle) * 0.135, 0] as [number, number, number], even: i % 2 === 0 };
    });
  }, []);

  useFrame((s) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    spinSpeed.current = lerp(spinSpeed.current, hovered ? 0.4 : 0.18, 0.1);
    groupRef.current.rotation.z += spinSpeed.current * 0.05;
    groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.08;
    if (coreInner.current) coreInner.current.emissiveIntensity = (hovered ? 5.2 : 3.4) + Math.sin(t * 2.2) * 0.5 + (active ? 0.4 : 0);
    if (bloomShell.current) bloomShell.current.opacity = (hovered ? 0.2 : 0.1) + Math.sin(t * 2.2) * 0.03;
    if (coreOuter.current) coreOuter.current.emissiveIntensity = lerp(coreOuter.current.emissiveIntensity, hovered ? 2.6 : 1.6, 0.1);
    const sc = hovered ? 1.12 : active ? 1.06 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.1);
  });

  return (
    <group ref={groupRef}>
      {/* nested core */}
      <mesh>
        <sphereGeometry args={[0.072, 48, 48]} />
        <meshStandardMaterial ref={coreInner} color="#ffffff" emissive="#ffffff" emissiveIntensity={3.4} toneMapped={false} roughness={0.25} metalness={0} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.082, 48, 48]} />
        <primitive object={coreOuterMat} attach="material" ref={coreOuter as never} />
      </mesh>
      {/* chrome equator collar */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={collar}>
        <torusGeometry args={[0.085, 0.012, 24, 64]} />
      </mesh>
      {/* radiant rays */}
      <group rotation={[0.34, -0.22, 0]}>
        {rays.map((r, i) => (
          <group key={i}>
            <mesh geometry={coneGeo} position={r.pos} rotation={[0, 0, r.angle - Math.PI / 2]} scale={[1, r.even ? 1 : 0.62, 1]} material={coreOuterMat} />
            {r.even && (
              <mesh geometry={icoGem} position={[Math.cos(r.angle) * 0.205, Math.sin(r.angle) * 0.205, 0]} material={gemAccent} />
            )}
          </group>
        ))}
      </group>
      {/* bloom shell */}
      <mesh>
        <sphereGeometry args={[0.115, 32, 32]} />
        <meshBasicMaterial ref={bloomShell} color={accent} transparent opacity={0.1} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ── build — a diagonal claw hammer: chrome striking head + flared cap, an open-C
// chrome claw fork, an anodized neck wedge + tapered shaft, gem grip rings, a
// chrome pommel, and an emissive impact spark with radiating shards. (Verbatim.)
function BuildIcon({ accent, hovered, active }: IconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const clawGroup = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.Group>(null);
  const sparkCore = useRef<THREE.MeshStandardMaterial>(null);
  const haloMat = useRef<THREE.MeshStandardMaterial>(null);
  const accentC = useMemo(() => new THREE.Color(accent), [accent]);

  const chromeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, color: '#d7dde6', envMapIntensity: 1.6 }), []);
  const anod = useMemo(() => black(1.15), []); // black anodized shaft/neck (chrome head + red grips)
  const gemMat = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 0.9, roughness: 0.2, clearcoat: 1, color: accent }), [accent]);
  const clawGeo = useMemo(() => new THREE.TorusGeometry(0.05, 0.012, 10, 24, Math.PI * 0.62), []);
  const tipGeo = useMemo(() => new THREE.ConeGeometry(0.012, 0.024, 12), []);
  const sparkColor = useMemo(() => accentC.clone().lerp(WHITE, 0.5), [accentC]);
  const shardGeo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const icoSpark = useMemo(() => new THREE.IcosahedronGeometry(0.018, 0), []);
  const shardMat = useMemo(() => emissive(accent, 2.0), [accent]);

  useFrame((s) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    const freq = lerp(1.1, 2.6, hovered ? 1 : 0);
    const amp = hovered ? 0.12 : 0.05;
    groupRef.current.rotation.z = 0.42 + Math.sin(t * freq) * amp + (active ? t * 0.05 : 0) * 0;
    groupRef.current.rotation.x = -0.18;
    groupRef.current.position.y = Math.sin(t * 0.9) * 0.004;
    if (clawGroup.current && hovered) clawGroup.current.rotation.y += 0.012;
    if (sparkRef.current) {
      const pulse = (0.6 + (hovered ? 0.9 : 0.25)) * (0.85 + 0.15 * Math.sin(t * 9));
      sparkRef.current.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.12);
    }
    if (sparkCore.current) sparkCore.current.emissiveIntensity = lerp(sparkCore.current.emissiveIntensity, (hovered ? 3.4 : 1.2) + (active ? 0.6 : 0), 0.12);
    if (haloMat.current) haloMat.current.opacity = lerp(haloMat.current.opacity, hovered ? 1.0 : 0.4, 0.12);
    const sc = hovered ? 1.08 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.12);
  });

  return (
    <group ref={groupRef} rotation={[-0.18, 0, 0.42]}>
      {/* HEAD */}
      <group position={[0, 0.105, 0]}>
        <RoundedBox args={[0.16, 0.062, 0.06]} radius={0.012} smoothness={4} position={[0.02, 0, 0]} material={chromeMat} />
        <RoundedBox args={[0.022, 0.07, 0.07]} radius={0.01} position={[0.108, 0, 0]} material={chromeMat} />
        {/* claw fork: mirrored open-C arcs */}
        <group ref={clawGroup} position={[-0.085, -0.012, 0]}>
          {[0.016, -0.016].map((z, i) => (
            <group key={i} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 2.2]}>
              <mesh geometry={clawGeo} material={chromeMat} />
              <mesh geometry={tipGeo} position={[0.05, 0, 0]} material={chromeMat} />
            </group>
          ))}
        </group>
        {/* eye / neck wedge */}
        <mesh position={[0, -0.04, 0]} material={anod}>
          <cylinderGeometry args={[0.026, 0.032, 0.05, 6]} />
        </mesh>
      </group>
      {/* HANDLE */}
      <group position={[-0.005, -0.07, 0]}>
        <mesh material={anod}>
          <cylinderGeometry args={[0.02, 0.028, 0.2, 20]} />
        </mesh>
        {[-0.05, -0.065, -0.08].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={gemMat}>
            <torusGeometry args={[0.027, 0.005, 10, 24]} />
          </mesh>
        ))}
        <mesh position={[0, -0.105, 0]} material={chromeMat}>
          <sphereGeometry args={[0.026, 20, 20]} />
        </mesh>
      </group>
      {/* SPARK at the strike face */}
      <group ref={sparkRef} position={[0.13, 0.105, 0.02]}>
        <mesh geometry={icoSpark}>
          <meshStandardMaterial ref={sparkCore} color="#08080d" emissive={sparkColor} emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
        {[35, 110, 200, 300].map((deg, i) => (
          <mesh key={i} geometry={shardGeo} scale={[0.006, 0.03, 0.006]} rotation={[0, 0, (deg * Math.PI) / 180]} position={[Math.cos((deg * Math.PI) / 180) * 0.03, Math.sin((deg * Math.PI) / 180) * 0.03, 0]} material={shardMat} />
        ))}
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[0.07, 0.07]} />
          <meshStandardMaterial ref={haloMat} color="#08080d" emissive={accent} emissiveIntensity={1.4} toneMapped={false} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}