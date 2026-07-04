'use client';

// PRISM SHELL — REAL BRAND MARKS (SHELL W2, DL15)
//
// DL15 is the SOLE exception to DL5's icon ban: where a third-party brand
// appears (integration + deploy tiles), we render the REAL brand mark —
// elegant, premium, COLORED, as a 3D object in brand-guideline colours. These
// are extruded/beveled forms in each brand's actual palette (not the custom
// black/white/red system), so they read as branding. Marks whose official
// silhouette is a simple shape (Vercel's triangle, Supabase's bolt,
// Cloudflare's cloud, Slack's pinwheel, Netlify's prism) are built to that
// silhouette; the remainder use the brand's signature colour + form.

import { useMemo } from 'react';
import * as THREE from 'three';

function useBrandMat(color: string, opts?: { metalness?: number; roughness?: number; emissive?: string }) {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: opts?.metalness ?? 0.3,
        roughness: opts?.roughness ?? 0.28,
        clearcoat: 0.7,
        clearcoatRoughness: 0.22,
        emissive: new THREE.Color(opts?.emissive ?? '#000000'),
        emissiveIntensity: opts?.emissive ? 0.28 : 0,
      }),
    [color, opts?.metalness, opts?.roughness, opts?.emissive],
  );
}

const EXTRUDE = { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 };

function triangleShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, r);
  s.lineTo(r * 0.9, -r * 0.62);
  s.lineTo(-r * 0.9, -r * 0.62);
  s.closePath();
  return s;
}

function boltShape(): THREE.Shape {
  const s = new THREE.Shape();
  // A lightning bolt (Supabase-style).
  s.moveTo(0.1, 0.62);
  s.lineTo(-0.34, 0.02);
  s.lineTo(-0.02, 0.02);
  s.lineTo(-0.1, -0.62);
  s.lineTo(0.34, -0.02);
  s.lineTo(0.02, -0.02);
  s.closePath();
  return s;
}

function BrandTriangle({ color, metal }: { color: string; metal?: boolean }) {
  const mat = useBrandMat(color, metal ? { metalness: 1, roughness: 0.18 } : { metalness: 0.2, roughness: 0.3 });
  const geo = useMemo(() => new THREE.ExtrudeGeometry(triangleShape(0.6), EXTRUDE), []);
  return <mesh geometry={geo} material={mat} rotation={[0.14, -0.3, 0]} />;
}

function SupabaseBolt() {
  const mat = useBrandMat('#3ecf8e', { metalness: 0.2, roughness: 0.24, emissive: '#127a53' });
  const geo = useMemo(() => new THREE.ExtrudeGeometry(boltShape(), EXTRUDE), []);
  return <mesh geometry={geo} material={mat} rotation={[0.12, -0.28, 0]} />;
}

function CloudflareCloud() {
  const mat = useBrandMat('#f38020', { metalness: 0.2, roughness: 0.3, emissive: '#7a3b0d' });
  return (
    <group rotation={[0.12, -0.2, 0]}>
      <mesh material={mat} position={[-0.34, -0.08, 0]}>
        <sphereGeometry args={[0.3, 28, 28]} />
      </mesh>
      <mesh material={mat} position={[0.32, -0.08, 0]}>
        <sphereGeometry args={[0.34, 28, 28]} />
      </mesh>
      <mesh material={mat} position={[0, 0.14, 0.04]}>
        <sphereGeometry args={[0.4, 28, 28]} />
      </mesh>
      <mesh material={mat} position={[0, -0.16, 0]}>
        <boxGeometry args={[0.9, 0.34, 0.5]} />
      </mesh>
    </group>
  );
}

function NetlifyPrism() {
  const mat = useBrandMat('#00ad9f', { metalness: 0.4, roughness: 0.2, emissive: '#046b62' });
  const geo = useMemo(() => new THREE.ExtrudeGeometry(triangleShape(0.58), EXTRUDE), []);
  return (
    <group rotation={[0.1, -0.3, 0]}>
      <mesh geometry={geo} material={mat} rotation={[0, 0, 0.4]} />
    </group>
  );
}

const SLACK_COLORS = ['#36c5f0', '#2eb67d', '#ecb22e', '#e01e5a'];
function SlackPinwheel() {
  const mats = [
    useBrandMat(SLACK_COLORS[0], { metalness: 0.2, roughness: 0.26 }),
    useBrandMat(SLACK_COLORS[1], { metalness: 0.2, roughness: 0.26 }),
    useBrandMat(SLACK_COLORS[2], { metalness: 0.2, roughness: 0.26 }),
    useBrandMat(SLACK_COLORS[3], { metalness: 0.2, roughness: 0.26 }),
  ];
  const bars: { pos: [number, number, number]; rot: number; mat: THREE.Material }[] = [
    { pos: [0, 0.34, 0], rot: 0, mat: mats[0] },
    { pos: [0.34, 0, 0], rot: Math.PI / 2, mat: mats[1] },
    { pos: [0, -0.34, 0], rot: 0, mat: mats[2] },
    { pos: [-0.34, 0, 0], rot: Math.PI / 2, mat: mats[3] },
  ];
  return (
    <group rotation={[0.1, -0.2, 0]}>
      {bars.map((b, i) => (
        <mesh key={i} material={b.mat} position={b.pos} rotation={[0, 0, b.rot]}>
          <capsuleGeometry args={[0.11, 0.42, 8, 16]} />
        </mesh>
      ))}
    </group>
  );
}

function StripeMark() {
  const purple = useBrandMat('#635bff', { metalness: 0.2, roughness: 0.22, emissive: '#2b28a0' });
  const white = useBrandMat('#ffffff', { metalness: 0.1, roughness: 0.3 });
  return (
    <group rotation={[0.1, -0.28, 0]}>
      <mesh material={purple}>
        <boxGeometry args={[0.9, 0.9, 0.24]} />
      </mesh>
      <mesh material={white} position={[-0.02, 0, 0.15]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.12, 0.7, 0.08]} />
      </mesh>
      <mesh material={white} position={[0.16, 0.16, 0.15]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.12, 0.3, 0.08]} />
      </mesh>
    </group>
  );
}

function GitHubMark() {
  const dark = useBrandMat('#1f2328', { metalness: 0.4, roughness: 0.34 });
  const white = useBrandMat('#ffffff', { metalness: 0.1, roughness: 0.34 });
  return (
    <group rotation={[0.1, -0.2, 0]}>
      <mesh material={dark} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.22, 48]} />
      </mesh>
      {/* octocat head */}
      <mesh material={white} position={[0, 0.02, 0.13]}>
        <sphereGeometry args={[0.32, 28, 28]} />
      </mesh>
      {/* ears */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} material={white} position={[x, 0.3, 0.13]} rotation={[0, 0, x < 0 ? 0.5 : -0.5]}>
          <coneGeometry args={[0.1, 0.22, 4]} />
        </mesh>
      ))}
      {/* body */}
      <mesh material={white} position={[0, -0.28, 0.13]}>
        <boxGeometry args={[0.4, 0.2, 0.12]} />
      </mesh>
    </group>
  );
}

function OpenAIKnot() {
  const mat = useBrandMat('#f2f4f6', { metalness: 0.6, roughness: 0.22 });
  return (
    <group rotation={[0.2, -0.2, 0]}>
      <mesh material={mat}>
        <torusKnotGeometry args={[0.4, 0.11, 96, 16, 2, 3]} />
      </mesh>
    </group>
  );
}

function ResendMark() {
  const dark = useBrandMat('#111111', { metalness: 0.5, roughness: 0.3 });
  const white = useBrandMat('#ffffff', { metalness: 0.1, roughness: 0.3 });
  return (
    <group rotation={[0.1, -0.26, 0]}>
      <mesh material={dark}>
        <boxGeometry args={[0.86, 0.86, 0.24]} />
      </mesh>
      <mesh material={white} position={[-0.12, 0, 0.15]}>
        <boxGeometry args={[0.16, 0.56, 0.1]} />
      </mesh>
      <mesh material={white} position={[0.08, 0.14, 0.15]}>
        <boxGeometry args={[0.34, 0.16, 0.1]} />
      </mesh>
      <mesh material={white} position={[0.12, -0.16, 0.15]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.34, 0.14, 0.1]} />
      </mesh>
    </group>
  );
}

function PrismMark() {
  // Our own brand — a signal-red extruded prism.
  const red = useBrandMat('#ff2a38', { metalness: 0.3, roughness: 0.22, emissive: '#7d0f18' });
  const geo = useMemo(() => new THREE.ExtrudeGeometry(triangleShape(0.6), EXTRUDE), []);
  return <mesh geometry={geo} material={red} rotation={[0.14, -0.3, 0]} />;
}

export function BrandMark({ mark }: { mark: string }) {
  switch (mark) {
    case 'stripe':
      return <StripeMark />;
    case 'supabase':
      return <SupabaseBolt />;
    case 'github':
      return <GitHubMark />;
    case 'slack':
      return <SlackPinwheel />;
    case 'openai':
      return <OpenAIKnot />;
    case 'resend':
      return <ResendMark />;
    case 'cloudflare':
      return <CloudflareCloud />;
    case 'netlify':
      return <NetlifyPrism />;
    case 'vercel':
      return <BrandTriangle color="#f2f4f6" metal />;
    case 'prism':
      return <PrismMark />;
    default:
      return <BrandTriangle color="#9aa1ac" />;
  }
}
