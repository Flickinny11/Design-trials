// origami-fold — the surface unfolds from a tight accordion pleat. uv.x is
// divided into K panels; each panel folds about its crease (panel center). At
// phase 0 the panels are folded shut — alternating z up/down (zFold =
// parity * foldDepth, shaped by distance from the crease) and x compressed
// toward each crease. As easeOut(phase) advances (with a slight per-panel
// stagger so creases open in sequence) z -> 0 and x expands back to base, the
// surface lying flat. HARD / displacement / CPU vertex displacement on the
// plane geometry. Observable: a given vertex's z is large early and ~0 at the
// end while its x expands outward. Restores base positions in dispose.
//
// DISTINCT from card-fold (a single-crease scale on the card group, no
// per-vertex displacement): origami-fold is a genuine multi-panel accordion
// authored in geometry — K independent creases folding flat in sequence.

import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'panels', label: 'Panels', type: 'knob', min: 3, max: 10, step: 1, default: 6 },
  { id: 'foldDepth', label: 'Fold Depth', type: 'fader', min: 0.2, max: 1.5, step: 0.05, default: 0.7 },
] as const;

export const origamiFoldPrimitive: PrimitiveDefinition = {
  name: 'origami-fold',
  label: 'Origami Fold',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The surface unfolds from a tight origami pleat — accordion creases opening flat in sequence.',
  create: defineAnimatable(
    { name: 'origami-fold', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as PlaneGeometry) : null;
      const posAttr = geom ? (geom.attributes.position as BufferAttribute) : null;

      // Snapshot base x/z per vertex. baseX drives panel assignment; baseZ is
      // restored in dispose (the plane starts flat at z=0 but we never assume).
      const count = posAttr ? posAttr.count : 0;
      const baseX = new Float32Array(count);
      const baseZ = new Float32Array(count);
      let minX = Infinity;
      let maxX = -Infinity;
      if (posAttr) {
        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          baseX[i] = x;
          baseZ[i] = posAttr.getZ(i);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      const spanX = maxX - minX || 1;

      const apply = (t: number) => {
        if (!posAttr) return;
        const dur = num(params.duration, 1.6);
        const K = Math.round(clamp(num(params.panels, 6), 3, 10));
        const foldDepth = clamp(num(params.foldDepth, 0.7), 0.2, 1.5);
        const ph = phase(t, dur);

        const panelW = spanX / K; // panel width in local x units
        // Per-panel stagger: each panel opens slightly after the previous, so
        // creases unfold left-to-right in sequence. Compress the stagger window
        // so the last panel still fully opens by phase 1.
        const stagger = 0.4; // fraction of the timeline spread across panels

        for (let i = 0; i < count; i++) {
          const x = baseX[i];
          // Normalized position along x in [0, K); integer part = panel index.
          let panelF = ((x - minX) / spanX) * K;
          if (panelF >= K) panelF = K - 1e-6; // clamp the far edge into last panel
          const panelIndex = Math.floor(panelF);
          const parity = panelIndex % 2 === 0 ? 1 : -1;

          // Position within the panel, 0..1, and signed distance from the
          // panel's crease (its center): -1 at left edge .. +1 at right edge.
          const local = panelF - panelIndex; // 0..1
          const fromCreaseSigned = local * 2 - 1; // -1..+1
          const fromCrease = Math.abs(fromCreaseSigned); // 0 at crease, 1 at edge

          // Per-panel eased unfold phase with stagger: earlier panels lead.
          const panelDelay = K > 1 ? (panelIndex / (K - 1)) * stagger : 0;
          const localPhase = clamp((ph - panelDelay) / (1 - stagger), 0, 1);
          const open = ease('easeOut', localPhase); // 0 folded -> 1 flat

          // FOLDED state (open=0): z lifts to parity*foldDepth shaped by the
          // distance from the crease (peak at the panel edge, 0 at the crease),
          // and x is compressed toward the crease. As `open` -> 1 both relax to
          // the flat base.
          const foldAmount = 1 - open; // 1 folded, 0 flat
          const creaseX = minX + (panelIndex + 0.5) * panelW; // panel center in x

          // z: alternating accordion lift, tallest at the panel edges.
          const z = baseZ[i] + parity * foldDepth * fromCrease * foldAmount;

          // x: compress toward the crease while folded; expand back to base x.
          // At foldAmount=1 the vertex sits ~halfway between base x and crease;
          // at foldAmount=0 it returns to base x exactly.
          const x2 = x + (creaseX - x) * 0.5 * foldAmount;

          posAttr.setX(i, x2);
          posAttr.setZ(i, z);
        }
        posAttr.needsUpdate = true;
        if (geom) geom.computeVertexNormals();
      };

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => apply(t),
        dispose: () => {
          if (posAttr) {
            for (let i = 0; i < count; i++) {
              posAttr.setX(i, baseX[i]);
              posAttr.setZ(i, baseZ[i]);
            }
            posAttr.needsUpdate = true;
            if (geom) geom.computeVertexNormals();
          }
        },
      };
    },
  ),
};
