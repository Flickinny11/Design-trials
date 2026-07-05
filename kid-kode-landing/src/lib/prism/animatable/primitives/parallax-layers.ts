// parallax-layers — pointer-driven 3D parallax. The card subject's chrome
// children (header, dot, content rows) shift horizontally/vertically by
// depth-scaled amounts opposite the pointer; deeper children move more. MEDIUM /
// pointer primitive. CPU-driven and observable: each child's base position is
// captured at build time, and seek() reads userData.pointer live, offsetting
// each child by (pointer-0.5) * strength * depthIndex (optionally inverted).
// dispose() restores every child to its captured base position.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'strength', label: 'Strength', type: 'knob', min: 0, max: 1.5, step: 0.01, default: 0.5 },
  { id: 'depthSpread', label: 'Depth Spread', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 1 },
  { id: 'invert', label: 'Invert', type: 'toggle', default: false },
] as const;

interface PointerLike {
  x: number;
  y: number;
}

function readPointer(userData: Record<string, unknown>): PointerLike {
  const p = userData.pointer as Partial<PointerLike> | undefined;
  const x = typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
  const y = typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
  return { x, y };
}

interface Layer {
  obj: Object3D;
  baseX: number;
  baseY: number;
  depth: number;
}

/** Collect the card's chrome children (header / dot / rows) as parallax layers,
 *  each tagged with an increasing depth index so deeper children move more. */
function collectLayers(subject: Object3D): Layer[] {
  const layers: Layer[] = [];
  let depthIndex = 1;
  subject.traverse((o) => {
    if (o === subject) return; // the panel itself is the backplate, stays put
    const n = o.name;
    // Tag the meaningful chrome layers (header, dot, individual rows) with a
    // monotonically increasing depth so each successive child parallaxes more.
    if (
      n === 'card-header' ||
      n === 'card-dot' ||
      n.startsWith('glyph-') ||
      // content rows are unnamed children of the 'card-rows' group
      (o.parent != null && o.parent.name === 'card-rows')
    ) {
      layers.push({ obj: o, baseX: o.position.x, baseY: o.position.y, depth: depthIndex });
      depthIndex += 1;
    }
  });
  return layers;
}

export const parallaxLayersPrimitive: PrimitiveDefinition = {
  name: 'parallax-layers',
  label: 'Parallax Layers',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    "Pointer movement shifts the card's chrome layers at different depths for a 3D parallax.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'parallax-layers', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const layers = collectLayers(subject);
      const userData = target.userData;

      const apply = () => {
        const strength = num(params.strength, 0.5);
        const spread = num(params.depthSpread, 1);
        const invert = bool(params.invert, false);
        const sign = invert ? 1 : -1; // chrome shifts OPPOSITE the pointer by default
        const { x, y } = readPointer(userData);
        // Pointer centered at 0.5; clamp the differential so wild driver inputs
        // (e.g. cos/sin during conformance) don't fling layers off-stage.
        const dx = clamp(x - 0.5, -1, 1);
        const dy = clamp(y - 0.5, -1, 1);
        for (const l of layers) {
          const d = l.depth * spread;
          l.obj.position.x = l.baseX + sign * dx * strength * d;
          l.obj.position.y = l.baseY + sign * dy * strength * d;
        }
      };

      return {
        // Purely stateful: driven by live pointer input, not a finite timeline.
        duration: () => Infinity,
        seek: () => {
          apply();
        },
        onParamChange: () => {
          apply();
        },
        dispose: () => {
          for (const l of layers) {
            l.obj.position.x = l.baseX;
            l.obj.position.y = l.baseY;
          }
        },
      };
    },
  ),
};
