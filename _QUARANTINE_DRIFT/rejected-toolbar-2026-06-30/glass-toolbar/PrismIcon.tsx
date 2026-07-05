'use client';

// PrismIcon — 14 bespoke 3D icons, one per canvas-toolbar function. Each is a
// small assembly of real 3D geometry (beveled bodies, faceted gems, glowing
// emissive accents, chromed sub-parts) in premium PBR materials. NOT an icon
// set, NOT emoji, NOT Lucide, NOT a flat engraved mark — each is a miniature
// 3D object meant to be seen suspended inside a glass cube.
//
// Distinguishability rules every icon honors:
//   • Unique silhouette (recognizable even when the cube refracts it)
//   • At least two material types per icon (chrome + anodized, anodized + gem,
//     chrome + emissive…) so each reads as a real composite object
//   • Visible emissive accent (energy pop) so the icon glows through the glass
//   • Sized to fill ~80% of the glass cube (CUBE = 0.5 world units)

import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { FaceGlyph as GlyphKind } from '../chassis/chassis-config';
import {
  ARC_CYAN,
  WARN_AMBER,
  makeAnodized,
  makeChrome,
  makeEmissive,
  makeGem,
} from './glass-toolbar-materials';

const AXIS = { x: '#ff5d5d', y: '#5dffa0', z: '#5d9bff' };

export function PrismIcon({ glyph, color }: { glyph: GlyphKind; color: string }) {
  // Per-instance materials (color varies by section). Memoized + disposed by GC
  // when the icon unmounts; cheap for the 14-button toolbar.
  const mats = useMemo(() => {
    const anodized = makeAnodized(color);
    const chrome = makeChrome();
    const arc = makeEmissive(ARC_CYAN, 2.4);
    const arcSoft = makeEmissive(ARC_CYAN, 1.4);
    const warm = makeEmissive(WARN_AMBER, 2.2);
    const gem = makeGem(color);
    const axisX = makeEmissive(AXIS.x, 1.6);
    const axisY = makeEmissive(AXIS.y, 1.6);
    const axisZ = makeEmissive(AXIS.z, 1.6);
    return { anodized, chrome, arc, arcSoft, warm, gem, axisX, axisY, axisZ };
  }, [color]);

  switch (glyph) {
    // ADD — glowing arc-cyan beveled plus with a soft jewel core. Reads as
    // "create new".
    case 'plus':
      return (
        <group>
          <RoundedBox args={[0.30, 0.085, 0.085]} radius={0.03} smoothness={4} material={mats.arc} />
          <RoundedBox args={[0.085, 0.30, 0.085]} radius={0.03} smoothness={4} material={mats.arc} />
          <mesh material={mats.arcSoft}>
            <icosahedronGeometry args={[0.07, 1]} />
          </mesh>
        </group>
      );

    // 3D OBJECT — faceted octahedral gem with a bright inner core. Reads as a
    // "built object", dimensional and refractive.
    case 'cube':
      return (
        <group>
          <mesh material={mats.gem}>
            <octahedronGeometry args={[0.18, 0]} />
          </mesh>
          <mesh material={mats.arc} scale={0.5}>
            <octahedronGeometry args={[0.18, 0]} />
          </mesh>
        </group>
      );

    // TRANSFORM — precision 3-axis translate gizmo: chrome hub + R/G/B shafts
    // with cone tips. Instantly reads as "move/transform".
    case 'move': {
      const shaft = (rot: [number, number, number], mat: THREE.Material) => (
        <group rotation={rot}>
          <mesh position={[0, 0.11, 0]} material={mat}>
            <cylinderGeometry args={[0.016, 0.016, 0.2, 12]} />
          </mesh>
          <mesh position={[0, 0.24, 0]} material={mat}>
            <coneGeometry args={[0.045, 0.1, 14]} />
          </mesh>
        </group>
      );
      return (
        <group>
          <mesh material={mats.chrome}>
            <icosahedronGeometry args={[0.05, 1]} />
          </mesh>
          {shaft([0, 0, 0], mats.axisY)}
          {shaft([0, 0, -Math.PI / 2], mats.axisX)}
          {shaft([Math.PI / 2, 0, 0], mats.axisZ)}
        </group>
      );
    }

    // SELECTION — three small gems clustered in a triangle, framed by chrome
    // marquee L-brackets at the corners. Reads as "selected items".
    case 'group': {
      const bracket = (px: number, py: number, flipX: boolean, flipY: boolean) => (
        <group position={[px, py, 0]}>
          {/* horizontal arm */}
          <RoundedBox
            args={[0.09, 0.02, 0.02]}
            radius={0.008}
            position={[(flipX ? -1 : 1) * 0.045, 0, 0]}
            material={mats.chrome}
          />
          {/* vertical arm */}
          <RoundedBox
            args={[0.02, 0.09, 0.02]}
            radius={0.008}
            position={[0, (flipY ? -1 : 1) * 0.045, 0]}
            material={mats.chrome}
          />
        </group>
      );
      return (
        <group>
          {/* Triangle of three small accent-color gems */}
          <mesh position={[0, 0.075, 0]} material={mats.anodized}>
            <icosahedronGeometry args={[0.045, 1]} />
          </mesh>
          <mesh position={[-0.08, -0.05, 0]} material={mats.anodized}>
            <icosahedronGeometry args={[0.045, 1]} />
          </mesh>
          <mesh position={[0.08, -0.05, 0]} material={mats.anodized}>
            <icosahedronGeometry args={[0.045, 1]} />
          </mesh>
          {/* Center spark */}
          <mesh position={[0, 0, 0]} material={mats.arc} scale={0.5}>
            <icosahedronGeometry args={[0.04, 1]} />
          </mesh>
          {/* Four chrome marquee L-brackets at the corners */}
          {bracket(-0.16, 0.14, false, false)}
          {bracket(0.16, 0.14, true, false)}
          {bracket(-0.16, -0.14, false, true)}
          {bracket(0.16, -0.14, true, true)}
        </group>
      );
    }

    // ELEMENTS (library) — a stack of three floating tiles, offset on Z, each a
    // thin anodized slab with a glowing edge. Reads as "layered elements".
    case 'layers': {
      const tile = (z: number, scaleXY: number) => (
        <group position={[0, 0, z]}>
          <RoundedBox
            args={[0.30 * scaleXY, 0.20 * scaleXY, 0.025]}
            radius={0.025}
            smoothness={4}
            material={mats.anodized}
          />
          {/* arc-cyan edge piping (top + bottom thin emissive bars) */}
          <mesh position={[0, 0.10 * scaleXY, 0.014]} material={mats.arcSoft}>
            <boxGeometry args={[0.30 * scaleXY * 0.96, 0.012, 0.005]} />
          </mesh>
        </group>
      );
      return (
        <group rotation={[-0.25, 0.35, 0]}>
          {tile(-0.06, 0.95)}
          {tile(0.0, 1.0)}
          {tile(0.06, 1.05)}
        </group>
      );
    }

    // IMAGE — small framed picture: chrome frame, dark anodized interior,
    // two mountain silhouettes + an emissive sun. Reads as "image / photo".
    case 'image': {
      const W = 0.34;
      const H = 0.26;
      const frameT = 0.025;
      return (
        <group>
          {/* outer chrome frame (thin RoundedBox ring made from 4 bars) */}
          <RoundedBox args={[W, frameT, 0.04]} radius={0.008} position={[0, H / 2, 0]} material={mats.chrome} />
          <RoundedBox args={[W, frameT, 0.04]} radius={0.008} position={[0, -H / 2, 0]} material={mats.chrome} />
          <RoundedBox args={[frameT, H, 0.04]} radius={0.008} position={[-W / 2, 0, 0]} material={mats.chrome} />
          <RoundedBox args={[frameT, H, 0.04]} radius={0.008} position={[W / 2, 0, 0]} material={mats.chrome} />
          {/* dark inner panel */}
          <mesh position={[0, 0, -0.005]} material={mats.anodized}>
            <planeGeometry args={[W - frameT * 1.6, H - frameT * 1.6]} />
          </mesh>
          {/* emissive sun (small orb in upper-left) */}
          <mesh position={[-0.07, 0.04, 0.015]} material={mats.warm}>
            <sphereGeometry args={[0.025, 12, 12]} />
          </mesh>
          {/* two mountain triangles (cone profiles, anodized accent) */}
          <mesh position={[-0.02, -0.05, 0.012]} rotation={[0, 0, 0]} material={mats.anodized}>
            <coneGeometry args={[0.06, 0.10, 4]} />
          </mesh>
          <mesh position={[0.06, -0.06, 0.012]} rotation={[0, 0, 0]} material={mats.anodized}>
            <coneGeometry args={[0.05, 0.085, 4]} />
          </mesh>
        </group>
      );
    }

    // BACKGROUND (palette) — oval painter's palette with thumb hole and four
    // paint dollops in distinct colors. Reads as "color/scene paint".
    case 'palette': {
      const dot = (px: number, py: number, c: string) => (
        <mesh position={[px, py, 0.02]}>
          <sphereGeometry args={[0.035, 14, 14]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} roughness={0.4} />
        </mesh>
      );
      return (
        <group>
          {/* palette body (squished ellipse, anodized) */}
          <mesh material={mats.anodized} scale={[1.0, 0.78, 0.35]}>
            <sphereGeometry args={[0.20, 22, 16]} />
          </mesh>
          {/* thumb hole (dark recess) */}
          <mesh position={[-0.10, 0.0, 0.05]}>
            <cylinderGeometry args={[0.035, 0.035, 0.08, 16]} />
            <meshStandardMaterial color="#0a0c12" roughness={0.9} />
          </mesh>
          {/* four paint dollops, distinct hues */}
          {dot(0.05, 0.08, '#ff5d5d')}
          {dot(0.10, -0.02, '#ffd24a')}
          {dot(0.04, -0.10, '#5dffa0')}
          {dot(-0.04, -0.06, '#5d9bff')}
        </group>
      );
    }

    // CHANGE ARTIFACT (sparkle) — radiant 4-point starburst (large) crossed
    // with a smaller 4-point starburst at 45°, bright emissive core. Reads as
    // "transformation / change".
    case 'sparkle': {
      const ray = (rot: number, len: number, thick: number, mat: THREE.Material) => (
        <RoundedBox
          args={[thick, len, thick]}
          radius={thick * 0.4}
          rotation={[0, 0, rot]}
          material={mat}
        />
      );
      return (
        <group>
          {/* core gem */}
          <mesh material={mats.gem}>
            <icosahedronGeometry args={[0.08, 1]} />
          </mesh>
          {/* big 4-point burst */}
          {ray(0, 0.34, 0.04, mats.arc)}
          {ray(Math.PI / 2, 0.34, 0.04, mats.arc)}
          {/* small 4-point burst rotated 45° */}
          {ray(Math.PI / 4, 0.22, 0.025, mats.arcSoft)}
          {ray(-Math.PI / 4, 0.22, 0.025, mats.arcSoft)}
          {/* bright pinpoint center */}
          <mesh material={mats.arc} scale={0.45}>
            <sphereGeometry args={[0.08, 14, 14]} />
          </mesh>
        </group>
      );
    }

    // PROMPT EDIT (code) — angle brackets < > made of chrome bars + a glowing
    // vertical caret between them. Reads as "code / prompt".
    case 'code': {
      const bracket = (mirror: boolean) => {
        const sign = mirror ? -1 : 1;
        return (
          <group position={[sign * 0.12, 0, 0]}>
            <RoundedBox
              args={[0.14, 0.030, 0.05]}
              radius={0.012}
              rotation={[0, 0, sign * 0.65]}
              position={[sign * -0.04, 0.06, 0]}
              material={mats.chrome}
            />
            <RoundedBox
              args={[0.14, 0.030, 0.05]}
              radius={0.012}
              rotation={[0, 0, sign * -0.65]}
              position={[sign * -0.04, -0.06, 0]}
              material={mats.chrome}
            />
          </group>
        );
      };
      return (
        <group>
          {bracket(false)}
          {bracket(true)}
          {/* glowing vertical caret in the middle */}
          <RoundedBox
            args={[0.030, 0.18, 0.04]}
            radius={0.012}
            material={mats.arc}
          />
        </group>
      );
    }

    // TEXT — bold extruded uppercase letter A made of three anodized bars
    // (two legs + a crossbar), with chrome serifs on the feet. Reads as "text".
    case 'text': {
      return (
        <group>
          {/* left leg */}
          <RoundedBox
            args={[0.05, 0.32, 0.07]}
            radius={0.015}
            rotation={[0, 0, 0.32]}
            position={[-0.07, 0, 0]}
            material={mats.anodized}
          />
          {/* right leg */}
          <RoundedBox
            args={[0.05, 0.32, 0.07]}
            radius={0.015}
            rotation={[0, 0, -0.32]}
            position={[0.07, 0, 0]}
            material={mats.anodized}
          />
          {/* crossbar */}
          <RoundedBox
            args={[0.18, 0.04, 0.07]}
            radius={0.012}
            position={[0, -0.02, 0]}
            material={mats.arcSoft}
          />
          {/* chrome serif caps at the feet */}
          <RoundedBox
            args={[0.10, 0.025, 0.07]}
            radius={0.008}
            position={[-0.12, -0.16, 0]}
            material={mats.chrome}
          />
          <RoundedBox
            args={[0.10, 0.025, 0.07]}
            radius={0.008}
            position={[0.12, -0.16, 0]}
            material={mats.chrome}
          />
        </group>
      );
    }

    // ANIMATION (wand) — angled magic wand: cylindrical anodized stick with a
    // chrome ferrule and a 5-point emissive star at the tip. Reads as "magic /
    // animation".
    case 'wand': {
      return (
        <group rotation={[0, 0, -0.55]}>
          {/* shaft */}
          <mesh position={[0, -0.05, 0]} material={mats.anodized}>
            <cylinderGeometry args={[0.022, 0.028, 0.30, 16]} />
          </mesh>
          {/* chrome ferrule (band near the tip) */}
          <mesh position={[0, 0.12, 0]} material={mats.chrome}>
            <cylinderGeometry args={[0.028, 0.028, 0.025, 16]} />
          </mesh>
          {/* star tip: two crossed rounded bars (rotated 36°) + glowing core */}
          <group position={[0, 0.20, 0]}>
            <RoundedBox args={[0.022, 0.16, 0.04]} radius={0.011} material={mats.arc} />
            <RoundedBox args={[0.022, 0.16, 0.04]} radius={0.011} rotation={[0, 0, Math.PI * 0.4]} material={mats.arc} />
            <RoundedBox args={[0.022, 0.16, 0.04]} radius={0.011} rotation={[0, 0, -Math.PI * 0.4]} material={mats.arc} />
            <mesh material={mats.warm}>
              <sphereGeometry args={[0.035, 14, 14]} />
            </mesh>
          </group>
        </group>
      );
    }

    // FUNCTION (link) — two interlocked chain links (torus rings) at 90° to each
    // other, chrome bodies with emissive caps where they cross. Reads as "link
    // / function".
    case 'link': {
      return (
        <group rotation={[0.3, 0, 0]}>
          {/* left ring (vertical) */}
          <mesh position={[-0.06, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.chrome}>
            <torusGeometry args={[0.09, 0.025, 12, 32]} />
          </mesh>
          {/* right ring (vertical, interlocked) */}
          <mesh position={[0.06, 0, 0]} material={mats.anodized}>
            <torusGeometry args={[0.09, 0.025, 12, 32]} />
          </mesh>
          {/* spark at the join */}
          <mesh material={mats.arc} scale={0.5}>
            <sphereGeometry args={[0.06, 14, 14]} />
          </mesh>
        </group>
      );
    }

    // LIGHTING (bulb) — round emissive bulb on a chrome socket, with a faint
    // glowing halo ring around it. Reads as "light".
    case 'bulb': {
      return (
        <group>
          {/* bulb */}
          <mesh position={[0, 0.06, 0]} material={mats.warm}>
            <sphereGeometry args={[0.11, 22, 18]} />
          </mesh>
          {/* socket (chrome cylinder + threaded base) */}
          <mesh position={[0, -0.08, 0]} material={mats.chrome}>
            <cylinderGeometry args={[0.06, 0.05, 0.07, 18]} />
          </mesh>
          <mesh position={[0, -0.14, 0]} material={mats.chrome}>
            <cylinderGeometry args={[0.045, 0.035, 0.05, 18]} />
          </mesh>
          {/* halo ring (very faint emissive torus around the bulb) */}
          <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.warm}>
            <torusGeometry args={[0.16, 0.008, 8, 32]} />
          </mesh>
        </group>
      );
    }

    // BUILD (hammer) — angled hammer: chrome head + anodized handle, with a
    // bright spark at the strike face. Reads unmistakably as "build".
    case 'hammer':
      return (
        <group rotation={[0, 0, -0.5]}>
          <RoundedBox args={[0.26, 0.1, 0.1]} radius={0.03} smoothness={4} position={[0, 0.13, 0]} material={mats.chrome} />
          <mesh position={[0.0, -0.02, 0]} material={mats.anodized}>
            <cylinderGeometry args={[0.028, 0.034, 0.34, 16]} />
          </mesh>
          <mesh position={[-0.12, 0.13, 0.052]} material={mats.arc} scale={0.4}>
            <icosahedronGeometry args={[0.08, 1]} />
          </mesh>
        </group>
      );

    // Fallback — refined faceted gem in the section color (should never render
    // in production; the 14-case switch above covers every FaceGlyph).
    default:
      return (
        <group>
          <mesh material={mats.gem}>
            <octahedronGeometry args={[0.15, 0]} />
          </mesh>
          <mesh material={mats.arc} scale={0.35}>
            <sphereGeometry args={[0.1, 16, 16]} />
          </mesh>
        </group>
      );
  }
}
