'use client';

// FaceGlyph — a small ABSTRACT engraved mark on a cube's front face, giving each
// function its own identity without any emoji / Lucide / icon-font (banned). Each
// glyph is composed from thin primitive bars / rings / dots in a dark satin
// material that sits just proud of the worn-alloy face and catches the rim light.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { FaceGlyph as GlyphKind } from './chassis-config';

const GS = 0.12; // glyph half-extent
const TH = 0.014; // bar thickness (in-plane)
const DEPTH = 0.01; // proud depth off the face

const MARK_MAT = new THREE.MeshStandardMaterial({
  color: '#0c1016',
  roughness: 0.5,
  metalness: 0.2,
  emissive: '#0c1016',
  emissiveIntensity: 0.0,
});

// A thin in-plane bar centered at (x,y), length `len`, rotated `rot` (radians).
function bar(key: string, x: number, y: number, len: number, rot = 0, w = TH) {
  return (
    <mesh key={key} position={[x, y, 0]} rotation={[0, 0, rot]} material={MARK_MAT}>
      <boxGeometry args={[len, w, DEPTH]} />
    </mesh>
  );
}

// A thin ring (torus) of radius r centered at (x,y).
function ring(key: string, x: number, y: number, r: number, tube = TH * 0.7) {
  return (
    <mesh key={key} position={[x, y, 0]} material={MARK_MAT}>
      <torusGeometry args={[r, tube, 8, 24]} />
    </mesh>
  );
}

// A small filled dot.
function dot(key: string, x: number, y: number, r = TH) {
  return (
    <mesh key={key} position={[x, y, 0]} material={MARK_MAT}>
      <cylinderGeometry args={[r, r, DEPTH, 12]} />
    </mesh>
  );
}

function buildGlyph(kind: GlyphKind): React.ReactNode[] {
  const g = GS;
  switch (kind) {
    case 'plus': // Add
      return [bar('h', 0, 0, g * 1.8), bar('v', 0, 0, g * 1.8, Math.PI / 2)];
    case 'move': // Transform — 4-way cross with caps
      return [
        bar('h', 0, 0, g * 1.9),
        bar('v', 0, 0, g * 1.9, Math.PI / 2),
        bar('cl', -g * 0.95, 0, g * 0.5, Math.PI / 2),
        bar('cr', g * 0.95, 0, g * 0.5, Math.PI / 2),
        bar('ct', 0, g * 0.95, g * 0.5),
        bar('cb', 0, -g * 0.95, g * 0.5),
      ];
    case 'group': // Selection — square outline
      return [
        bar('t', 0, g, g * 2),
        bar('b', 0, -g, g * 2),
        bar('l', -g, 0, g * 2, Math.PI / 2),
        bar('r', g, 0, g * 2, Math.PI / 2),
      ];
    case 'layers': // Elements — stacked bars
      return [bar('a', 0, g * 0.7, g * 1.9), bar('b', 0, 0, g * 1.9), bar('c', 0, -g * 0.7, g * 1.9)];
    case 'image': // Image — frame + dot
      return [
        bar('t', 0, g, g * 2),
        bar('b', 0, -g, g * 2),
        bar('l', -g, 0, g * 2, Math.PI / 2),
        bar('r', g, 0, g * 2, Math.PI / 2),
        dot('sun', g * 0.4, g * 0.4, TH * 1.4),
      ];
    case 'cube': // 3D Object — two offset squares (iso illusion)
      return [
        bar('t', -g * 0.3, g * 0.7, g * 1.4),
        bar('b', -g * 0.3, -g * 0.7, g * 1.4),
        bar('l', -g, 0, g * 1.4, Math.PI / 2),
        bar('r', g * 0.4, 0, g * 1.4, Math.PI / 2),
        bar('d1', g * 0.55, g * 0.55, g * 0.8, Math.PI / 4),
        bar('d2', g * 0.55, -g * 0.55, g * 0.8, -Math.PI / 4),
      ];
    case 'palette': // Background — ring + 3 dots
      return [ring('o', 0, 0, g * 0.95), dot('d1', -g * 0.3, g * 0.2), dot('d2', g * 0.3, g * 0.1), dot('d3', 0, -g * 0.35)];
    case 'sparkle': // Change Artifact — 4-point star
      return [
        bar('v', 0, 0, g * 2, Math.PI / 2),
        bar('h', 0, 0, g * 2),
        bar('d1', 0, 0, g * 1.1, Math.PI / 4, TH * 0.6),
        bar('d2', 0, 0, g * 1.1, -Math.PI / 4, TH * 0.6),
      ];
    case 'code': // Prompt Edit — chevrons < >
      return [
        bar('l1', -g * 0.6, g * 0.4, g * 1.1, Math.PI / 4),
        bar('l2', -g * 0.6, -g * 0.4, g * 1.1, -Math.PI / 4),
        bar('r1', g * 0.6, g * 0.4, g * 1.1, -Math.PI / 4),
        bar('r2', g * 0.6, -g * 0.4, g * 1.1, Math.PI / 4),
      ];
    case 'text': // Text — capital T
      return [bar('top', 0, g, g * 1.9), bar('stem', 0, -g * 0.1, g * 1.9, Math.PI / 2)];
    case 'wand': // Animation — diagonal wand + star tip
      return [bar('w', 0, -g * 0.2, g * 2.1, Math.PI / 4), dot('t1', g * 0.7, g * 0.7, TH * 1.2), bar('s1', g * 0.7, g * 0.7, g * 0.6), bar('s2', g * 0.7, g * 0.7, g * 0.6, Math.PI / 2)];
    case 'link': // Function — two interlocking rings
      return [ring('a', -g * 0.4, 0, g * 0.7), ring('b', g * 0.4, 0, g * 0.7)];
    case 'bulb': // Lighting — circle + base
      return [ring('o', 0, g * 0.25, g * 0.85), bar('b1', 0, -g * 0.75, g * 0.8), bar('b2', 0, -g, g * 0.6)];
    case 'hammer': // Build — handle + head
      return [bar('handle', g * 0.1, -g * 0.2, g * 1.9, Math.PI / 2.6), bar('head', -g * 0.3, g * 0.75, g * 1.3, Math.PI / 9, TH * 2.2)];
    default:
      return [dot('d', 0, 0, TH * 1.5)];
  }
}

export function FaceGlyph({ glyph, z }: { glyph: GlyphKind; z: number }) {
  const marks = useMemo(() => buildGlyph(glyph), [glyph]);
  return <group position={[0, 0, z]}>{marks}</group>;
}
