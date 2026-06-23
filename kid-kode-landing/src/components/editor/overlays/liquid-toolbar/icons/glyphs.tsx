'use client';

// BESPOKE 3D ICON SET — one custom, colored, animated 3D object per toolbar tool.
// All authored from the shared kit so they are coherent. DESIGN LAW B.1 defect
// gate: NO emoji, NO Lucide/line-drawings, NO lightning/box/generic glyphs —
// each is an extruded/composed PBR object with bevels, gradient tones, scene
// shadows and idle motion. A few (text, changeArtifact, build) are ENGRAVED.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  IconRoot,
  IconMat,
  EngravedPlate,
  useExtruded,
  shade,
} from './kit';

// ── 1. TRANSFORM — a 3D move gizmo (three jewel-toned axis arrows) ────────────
function Arrow({ color, rotation }: { color: string; rotation: [number, number, number] }) {
  return (
    <group rotation={rotation}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.68, 16]} />
        <IconMat color={color} emi={0.5} metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <coneGeometry args={[0.15, 0.32, 20]} />
        <IconMat color={color} emi={0.65} metalness={0.6} roughness={0.22} />
      </mesh>
    </group>
  );
}
export function TransformIcon() {
  return (
    <IconRoot motion="sway" seed={1}>
      <mesh>
        <icosahedronGeometry args={[0.12, 0]} />
        <IconMat color="#dfe7f4" emi={0.4} metalness={0.8} roughness={0.2} />
      </mesh>
      <Arrow color="#5fb8ff" rotation={[0, 0, 0]} />
      <Arrow color="#ff7e9a" rotation={[0, 0, -Math.PI / 2]} />
      <Arrow color="#7cf0a0" rotation={[Math.PI / 2, 0, 0]} />
    </IconRoot>
  );
}

// ── 2. SELECTION — four corner brackets breathing around a floating gem ───────
function Bracket({ accent, pos, rot }: { accent: string; pos: [number, number, number]; rot: number }) {
  const geo = useExtruded((s) => {
    s.moveTo(0, 0);
    s.lineTo(0.5, 0);
    s.lineTo(0.5, 0.16);
    s.lineTo(0.16, 0.16);
    s.lineTo(0.16, 0.5);
    s.lineTo(0, 0.5);
    s.lineTo(0, 0);
  }, 0.12, 0.03);
  return (
    <mesh geometry={geo} position={pos} rotation={[0, 0, rot]} castShadow>
      <IconMat color={accent} emi={0.5} metalness={0.5} roughness={0.3} />
    </mesh>
  );
}
export function SelectionIcon({ accent }: { accent: string }) {
  const g = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (g.current) g.current.scale.setScalar(1 + Math.sin(t * 1.8) * 0.06);
    if (gem.current) gem.current.rotation.y = t * 1.2;
  });
  return (
    <IconRoot motion="none" seed={2}>
      <group ref={g}>
        <Bracket accent={accent} pos={[-0.62, 0.62, 0]} rot={Math.PI / 2} />
        <Bracket accent={accent} pos={[0.62, 0.62, 0]} rot={Math.PI} />
        <Bracket accent={accent} pos={[0.62, -0.62, 0]} rot={-Math.PI / 2} />
        <Bracket accent={accent} pos={[-0.62, -0.62, 0]} rot={0} />
      </group>
      <mesh ref={gem}>
        <octahedronGeometry args={[0.26, 0]} />
        <IconMat color={shade(accent, 0.25)} emi={0.8} metalness={0.4} roughness={0.15} />
      </mesh>
    </IconRoot>
  );
}

// ── 3. ADD — a beveled rounded plus with a luminous core ──────────────────────
export function AddIcon({ accent }: { accent: string }) {
  const geo = useExtruded((s) => {
    const a = 0.2, b = 0.6;
    s.moveTo(-a, -b);
    s.lineTo(a, -b); s.lineTo(a, -a); s.lineTo(b, -a); s.lineTo(b, a);
    s.lineTo(a, a); s.lineTo(a, b); s.lineTo(-a, b); s.lineTo(-a, a);
    s.lineTo(-b, a); s.lineTo(-b, -a); s.lineTo(-a, -a); s.lineTo(-a, -b);
  }, 0.26, 0.07);
  return (
    <IconRoot motion="pulse" seed={3} amp={0.8}>
      <mesh geometry={geo} castShadow>
        <IconMat color={accent} emi={0.7} metalness={0.45} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0, 0.2]}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <IconMat color={shade(accent, 0.5)} emi={1.1} metalness={0.2} roughness={0.2} />
      </mesh>
    </IconRoot>
  );
}

// ── 4. LIBRARY / ELEMENTS — a separating stack of rounded plates ──────────────
function Plate({ accent, y, z, tone }: { accent: string; y: number; z: number; tone: number }) {
  const geo = useExtruded((s) => {
    const w = 0.62, h = 0.42, r = 0.12;
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  }, 0.08, 0.03);
  return (
    <mesh geometry={geo} position={[0, y, z]} castShadow>
      <IconMat color={shade(accent, tone)} emi={0.4} metalness={0.5} roughness={0.3} />
    </mesh>
  );
}
export function LibraryIcon({ accent }: { accent: string }) {
  const top = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (top.current) top.current.position.y = 0.34 + Math.sin(s.clock.elapsedTime * 1.5) * 0.07;
  });
  return (
    <IconRoot motion="sway" seed={4} amp={0.5}>
      <Plate accent={accent} y={-0.34} z={-0.14} tone={-0.4} />
      <Plate accent={accent} y={0} z={0} tone={-0.1} />
      <group ref={top}>
        <Plate accent={accent} y={0} z={0.16} tone={0.3} />
      </group>
    </IconRoot>
  );
}

// ── 5. IMAGE — a framed picture with an extruded mountain + sun ───────────────
export function ImageIcon({ accent }: { accent: string }) {
  const frame = useExtruded((s) => {
    const w = 0.66, h = 0.54, r = 0.1;
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
    const iw = 0.5, ih = 0.38;
    const hole = new THREE.Path();
    hole.moveTo(-iw, -ih); hole.lineTo(iw, -ih); hole.lineTo(iw, ih); hole.lineTo(-iw, ih); hole.lineTo(-iw, -ih);
    s.holes.push(hole);
  }, 0.14, 0.04);
  const mtn = useExtruded((s) => {
    s.moveTo(-0.46, -0.34);
    s.lineTo(-0.12, 0.12); s.lineTo(0.06, -0.08); s.lineTo(0.3, 0.22); s.lineTo(0.46, -0.34);
  }, 0.1, 0.02);
  return (
    <IconRoot motion="sway" seed={5} amp={0.6}>
      <mesh geometry={frame} castShadow>
        <IconMat color={accent} emi={0.45} metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh geometry={mtn} position={[0, -0.02, 0.02]} scale={0.9}>
        <IconMat color={shade(accent, -0.25)} emi={0.35} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0.26, 0.18, 0.04]}>
        <sphereGeometry args={[0.1, 18, 18]} />
        <IconMat color={shade(accent, 0.55)} emi={1.0} metalness={0.2} roughness={0.2} />
      </mesh>
    </IconRoot>
  );
}

// ── 6. 3D OBJECT — a faceted crystal (an actual 3D solid) ─────────────────────
export function ObjectIcon({ accent }: { accent: string }) {
  return (
    <IconRoot motion="spin" seed={6} amp={0.6}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.4}
          metalness={0.75}
          roughness={0.18}
          flatShading
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.02}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={shade(accent, 0.6)} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </IconRoot>
  );
}

// ── 7. BACKGROUND — a glossy gradient orb with an orbiting ring ───────────────
export function BackgroundIcon({ accent }: { accent: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ring.current) {
      ring.current.rotation.z = s.clock.elapsedTime * 0.9;
      ring.current.rotation.x = Math.PI * 0.42;
    }
  });
  return (
    <IconRoot motion="sway" seed={7} amp={0.4}>
      <mesh castShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={accent} emissive={shade(accent, -0.3)} emissiveIntensity={0.5} metalness={0.3} roughness={0.12} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[0.74, 0.05, 14, 48]} />
        <IconMat color={shade(accent, 0.4)} emi={0.7} metalness={0.7} roughness={0.2} />
      </mesh>
    </IconRoot>
  );
}

// ── 8. CHANGE ARTIFACT — an ENGRAVED four-point sparkle (magic sigil) ─────────
export function ChangeArtifactIcon({ accent }: { accent: string }) {
  const star = useExtruded((s) => {
    const o = 0.66, i = 0.16;
    s.moveTo(0, o);
    s.lineTo(i, i); s.lineTo(o, 0); s.lineTo(i, -i);
    s.lineTo(0, -o); s.lineTo(-i, -i); s.lineTo(-o, 0); s.lineTo(-i, i);
    s.lineTo(0, o);
  }, 0.2, 0.05);
  const motes = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (motes.current) motes.current.rotation.z = s.clock.elapsedTime * 0.8;
  });
  return (
    <IconRoot motion="none" seed={8}>
      <EngravedPlate geometry={star} accent={accent} recessR={0.72} />
      <group ref={motes}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[Math.cos((k / 3) * 6.283) * 0.78, Math.sin((k / 3) * 6.283) * 0.78, 0.12]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <IconMat color={shade(accent, 0.5)} emi={1.1} metalness={0.2} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </IconRoot>
  );
}

// ── 9. PROMPT EDIT — a command pill with a blinking caret (NO lightning) ──────
export function PromptEditIcon({ accent }: { accent: string }) {
  const pill = useExtruded((s) => {
    const w = 0.7, h = 0.42, r = 0.2;
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  }, 0.16, 0.05);
  const chevron = useExtruded((s) => {
    s.moveTo(-0.18, 0.16); s.lineTo(0.04, 0); s.lineTo(-0.18, -0.16);
    s.lineTo(-0.06, -0.16); s.lineTo(0.16, 0); s.lineTo(-0.06, 0.16);
  }, 0.1, 0.02);
  const caret = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (caret.current) caret.current.emissiveIntensity = 0.4 + (Math.sin(s.clock.elapsedTime * 5) > 0 ? 0.9 : 0);
  });
  return (
    <IconRoot motion="bob" seed={9} amp={0.7}>
      <mesh geometry={pill} castShadow>
        <IconMat color={shade(accent, -0.45)} emi={0.25} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh geometry={chevron} position={[-0.26, 0, 0.12]} scale={0.95}>
        <IconMat color={shade(accent, 0.4)} emi={0.8} metalness={0.4} roughness={0.2} />
      </mesh>
      <mesh position={[0.22, 0, 0.12]}>
        <boxGeometry args={[0.1, 0.34, 0.1]} />
        <meshStandardMaterial ref={caret} color={shade(accent, 0.5)} emissive={accent} emissiveIntensity={0.6} metalness={0.3} roughness={0.2} toneMapped={false} />
      </mesh>
    </IconRoot>
  );
}

// ── 10. TEXT — an ENGRAVED slab-serif 'T' ─────────────────────────────────────
export function TextIcon({ accent }: { accent: string }) {
  const t = useExtruded((s) => {
    s.moveTo(-0.58, 0.62);
    s.lineTo(0.58, 0.62); s.lineTo(0.58, 0.34); s.lineTo(0.16, 0.34);
    s.lineTo(0.16, -0.5); s.lineTo(0.34, -0.62); s.lineTo(-0.34, -0.62);
    s.lineTo(-0.16, -0.5); s.lineTo(-0.16, 0.34); s.lineTo(-0.58, 0.34);
    s.lineTo(-0.58, 0.62);
  }, 0.22, 0.05);
  return (
    <IconRoot motion="none" seed={10}>
      <EngravedPlate geometry={t} accent={accent} recessR={0.74} />
    </IconRoot>
  );
}

// ── 11. ANIMATION — a play triangle riding a motion arc with a traveling spark ─
export function AnimationIcon({ accent }: { accent: string }) {
  const tri = useExtruded((s) => {
    s.moveTo(-0.28, 0.34); s.lineTo(0.34, 0); s.lineTo(-0.28, -0.34); s.lineTo(-0.28, 0.34);
  }, 0.18, 0.04);
  const spark = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (spark.current) {
      const a = (s.clock.elapsedTime * 1.6) % 6.283;
      spark.current.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72 - 0.05, 0.16);
    }
  });
  return (
    <IconRoot motion="sway" seed={11} amp={0.4}>
      <mesh geometry={tri} castShadow>
        <IconMat color={accent} emi={0.7} metalness={0.45} roughness={0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.025, 10, 48]} />
        <IconMat color={shade(accent, -0.2)} emi={0.4} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={spark}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <IconMat color={shade(accent, 0.6)} emi={1.3} metalness={0.1} roughness={0.2} />
      </mesh>
    </IconRoot>
  );
}

// ── 12. FUNCTION — two nodes joined by a link with a traveling pulse ──────────
export function FunctionIcon({ accent }: { accent: string }) {
  const pulse = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (pulse.current) {
      const u = (Math.sin(s.clock.elapsedTime * 2) + 1) / 2;
      pulse.current.position.set(-0.5 + u * 1.0, -0.5 + u * 1.0, 0.16);
    }
  });
  return (
    <IconRoot motion="sway" seed={12} amp={0.5}>
      <mesh rotation={[0, 0, Math.PI / 4]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.18, 16]} />
        <IconMat color={shade(accent, -0.25)} emi={0.35} metalness={0.6} roughness={0.3} />
      </mesh>
      {([[-0.5, -0.5], [0.5, 0.5]] as const).map(([x, y], k) => (
        <mesh key={k} position={[x, y, 0]} castShadow>
          <sphereGeometry args={[0.24, 22, 22]} />
          <IconMat color={accent} emi={0.7} metalness={0.45} roughness={0.2} />
        </mesh>
      ))}
      <mesh ref={pulse}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <IconMat color={shade(accent, 0.6)} emi={1.3} metalness={0.1} roughness={0.2} />
      </mesh>
    </IconRoot>
  );
}

// ── 13. LIGHTING — a glowing bulb with a screw base + breathing brightness ────
export function LightingIcon({ accent }: { accent: string }) {
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (bulb.current) bulb.current.emissiveIntensity = 1.0 + Math.sin(s.clock.elapsedTime * 2.4) * 0.5;
  });
  return (
    <IconRoot motion="sway" seed={13} amp={0.4}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <sphereGeometry args={[0.46, 28, 28]} />
        <meshStandardMaterial ref={bulb} color={shade(accent, 0.4)} emissive={accent} emissiveIntensity={1.1} metalness={0.1} roughness={0.18} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.4, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.3, 20]} />
        <IconMat color="#c2cad6" emi={0.2} metalness={0.95} roughness={0.32} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0, -0.32 - k * 0.08, 0]}>
          <torusGeometry args={[0.21, 0.02, 8, 24]} />
          <IconMat color="#8d97a6" emi={0.1} metalness={0.9} roughness={0.4} />
        </mesh>
      ))}
    </IconRoot>
  );
}

// ── 14. BUILD — an ENGRAVED cog (forge / assembly sigil) ──────────────────────
export function BuildIcon({ accent }: { accent: string }) {
  const gear = useExtruded((s) => {
    const teeth = 8;
    const ro = 0.66, ri = 0.5; // tooth outer / root radius
    for (let k = 0; k < teeth; k++) {
      const a0 = (k / teeth) * Math.PI * 2;
      const a1 = ((k + 0.5) / teeth) * Math.PI * 2;
      const a2 = ((k + 1) / teeth) * Math.PI * 2;
      // root → tooth tip → tooth tip → root (a squared tooth)
      const p = (ang: number, r: number): [number, number] => [Math.cos(ang) * r, Math.sin(ang) * r];
      if (k === 0) s.moveTo(...p(a0, ri));
      const ta = a0 + (a1 - a0) * 0.25;
      const tb = a0 + (a1 - a0) * 0.75;
      s.lineTo(...p(ta, ro));
      s.lineTo(...p(tb, ro));
      s.lineTo(...p(a2, ri));
    }
    // center bore
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.22, 0, Math.PI * 2, true);
    s.holes.push(hole);
  }, 0.2, 0.04);
  return (
    <IconRoot motion="none" seed={14}>
      <EngravedPlate geometry={gear} accent={accent} recessR={0.82} />
    </IconRoot>
  );
}
