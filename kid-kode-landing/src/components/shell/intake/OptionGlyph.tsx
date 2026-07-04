'use client';

// PRISM SHELL — OPTION GLYPHS (SHELL W2, DL5/DL11/DL14)
//
// The custom 3D geometric objects that stand in for each Decision Card option.
// NO icon pack (DL5): every glyph is a small composition of premium.ts
// materials — machined metal, chrome, smoked glass — with a single red signal
// accent (DL14). Pure geometry; the parent canvas owns lighting, layout, and
// the hover/press physics.

import * as THREE from 'three';
import type { PremiumMaterials } from '../showpiece/premium-materials';

/** All glyph keys the deck references (intake-model.ts). */
export type GlyphKey =
  | 'grid'
  | 'cart'
  | 'quill'
  | 'portal'
  | 'key'
  | 'stack'
  | 'coin'
  | 'spark'
  | 'cloud'
  | 'bolt'
  | 'graph'
  | 'gear'
  | 'monolith'
  | 'orb'
  | 'wave';

export function OptionGlyph({ glyph, m }: { glyph: string; m: PremiumMaterials }) {
  switch (glyph as GlyphKey) {
    case 'grid':
      return (
        <group>
          {[-0.28, 0.28].map((x) =>
            [-0.28, 0.28].map((y) => (
              <mesh key={`${x},${y}`} material={m.chrome} position={[x, y, 0]}>
                <boxGeometry args={[0.4, 0.4, 0.16]} />
              </mesh>
            )),
          )}
          <mesh material={m.redJewel} position={[0, 0, 0.16]}>
            <sphereGeometry args={[0.12, 20, 20]} />
          </mesh>
        </group>
      );
    case 'cart':
      return (
        <group rotation={[0.1, -0.3, 0]}>
          <mesh material={m.gunmetal} position={[0, 0.05, 0]}>
            <boxGeometry args={[0.9, 0.5, 0.5]} />
          </mesh>
          <mesh material={m.chrome} position={[-0.28, -0.4, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.1, 20]} />
          </mesh>
          <mesh material={m.chrome} position={[0.28, -0.4, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.1, 20]} />
          </mesh>
          <mesh material={m.redHot} position={[0.5, 0.32, 0]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.5, 0.08, 0.08]} />
          </mesh>
        </group>
      );
    case 'quill':
      return (
        <group rotation={[0, 0, -0.5]}>
          <mesh material={m.chrome} position={[0, 0.1, 0]}>
            <boxGeometry args={[0.16, 0.9, 0.08]} />
          </mesh>
          <mesh material={m.gunmetal} position={[0, -0.42, 0]}>
            <coneGeometry args={[0.12, 0.28, 4]} />
          </mesh>
          <mesh material={m.redJewel} position={[0, -0.56, 0.02]}>
            <sphereGeometry args={[0.08, 16, 16]} />
          </mesh>
        </group>
      );
    case 'portal':
      return (
        <group rotation={[0.2, 0, 0]}>
          <mesh material={m.chrome} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.11, 20, 40]} />
          </mesh>
          <mesh material={m.redJewel}>
            <sphereGeometry args={[0.22, 24, 24]} />
          </mesh>
        </group>
      );
    case 'key':
      return (
        <group rotation={[0.1, -0.2, 0.3]}>
          <mesh material={m.chrome} rotation={[0, 0, Math.PI / 2]} position={[0, 0.3, 0]}>
            <torusGeometry args={[0.24, 0.08, 16, 32]} />
          </mesh>
          <mesh material={m.steel} position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.7, 16]} />
          </mesh>
          <mesh material={m.redHot} position={[0.16, -0.44, 0]}>
            <boxGeometry args={[0.2, 0.1, 0.1]} />
          </mesh>
        </group>
      );
    case 'stack':
      return (
        <group rotation={[0.32, 0, 0]}>
          {[-0.26, 0, 0.26].map((y, i) => (
            <mesh key={y} material={i === 1 ? m.brushed : m.chrome} position={[0, y, 0]}>
              <cylinderGeometry args={[0.46, 0.46, 0.16, 40]} />
            </mesh>
          ))}
          <mesh material={m.redJewel} position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
          </mesh>
        </group>
      );
    case 'coin':
      return (
        <group rotation={[1.0, 0.3, 0]}>
          <mesh material={m.brushed}>
            <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
          </mesh>
          <mesh material={m.redJewel} position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.04, 32]} />
          </mesh>
        </group>
      );
    case 'spark':
      return (
        <group>
          <mesh material={m.redHot}>
            <octahedronGeometry args={[0.42, 0]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <mesh key={i} material={m.chrome} position={[Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0]}>
                <boxGeometry args={[0.28, 0.06, 0.06]} />
              </mesh>
            );
          })}
        </group>
      );
    case 'cloud':
      return (
        <group>
          <mesh material={m.chrome} position={[-0.3, -0.05, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
          </mesh>
          <mesh material={m.chrome} position={[0.3, -0.05, 0]}>
            <sphereGeometry args={[0.34, 24, 24]} />
          </mesh>
          <mesh material={m.brushed} position={[0, 0.16, 0.06]}>
            <sphereGeometry args={[0.36, 24, 24]} />
          </mesh>
          <mesh material={m.redJewel} position={[0, -0.02, 0.34]}>
            <sphereGeometry args={[0.1, 16, 16]} />
          </mesh>
        </group>
      );
    case 'bolt':
      return (
        <group rotation={[0, 0, 0]}>
          <mesh material={m.redHot} position={[0.08, 0.24, 0]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.18, 0.55, 0.12]} />
          </mesh>
          <mesh material={m.redHot} position={[-0.08, -0.24, 0]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.18, 0.55, 0.12]} />
          </mesh>
          <mesh material={m.gunmetal} position={[0, 0, -0.06]}>
            <cylinderGeometry args={[0.5, 0.5, 0.06, 6]} />
          </mesh>
        </group>
      );
    case 'graph':
      return (
        <group rotation={[0.1, -0.2, 0]}>
          {[0.3, 0.55, 0.85].map((h, i) => (
            <mesh key={h} material={m.chrome} position={[(i - 1) * 0.34, -0.45 + h / 2, 0]}>
              <boxGeometry args={[0.22, h, 0.22]} />
            </mesh>
          ))}
          <mesh material={m.redJewel} position={[0.34, 0.12, 0.14]}>
            <sphereGeometry args={[0.12, 20, 20]} />
          </mesh>
        </group>
      );
    case 'gear':
      return (
        <group rotation={[0.2, 0, 0]}>
          <mesh material={m.gunmetal} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.18, 40]} />
          </mesh>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} material={m.chrome} position={[Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0]} rotation={[0, 0, a]}>
                <boxGeometry args={[0.2, 0.12, 0.18]} />
              </mesh>
            );
          })}
          <mesh material={m.redJewel} position={[0, 0, 0.11]}>
            <sphereGeometry args={[0.14, 20, 20]} />
          </mesh>
        </group>
      );
    case 'monolith':
      return (
        <group rotation={[0, -0.3, 0]}>
          <mesh material={m.chrome} position={[0, 0.1, 0]}>
            <boxGeometry args={[0.42, 1.0, 0.22]} />
          </mesh>
          <mesh material={m.redJewel} position={[0, -0.5, 0.14]}>
            <boxGeometry args={[0.5, 0.12, 0.12]} />
          </mesh>
        </group>
      );
    case 'orb':
      return (
        <group>
          <mesh material={m.smokedGlass}>
            <sphereGeometry args={[0.5, 40, 40]} />
          </mesh>
          <mesh material={m.redHot}>
            <sphereGeometry args={[0.18, 20, 20]} />
          </mesh>
        </group>
      );
    case 'wave':
      return (
        <group rotation={[0.3, 0, 0]}>
          <mesh material={m.chrome}>
            <torusKnotGeometry args={[0.34, 0.09, 80, 12, 2, 3]} />
          </mesh>
          <mesh material={m.redJewel} position={[0, 0, 0.3]}>
            <sphereGeometry args={[0.1, 16, 16]} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh material={m.chrome}>
          <icosahedronGeometry args={[0.44, 0]} />
        </mesh>
      );
  }
}
