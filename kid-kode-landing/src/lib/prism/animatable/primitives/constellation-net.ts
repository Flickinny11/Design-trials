// constellation-net — a living constellation: drifting star motes linked by
// hairline light wherever they near each other, the net breathing as the stars
// wander. CATALOG primitive (hard / particles, subject:'empty', time-driven,
// duration Infinity).
//
// TECHNIQUE — the particles.js / three-nebula "constellation" staple, premium
// take (DESIGN-REFERENCES §3 TSL/WebGPU particles + §9 Noise & Procedural
// Generation — deterministic Lissajous drift in lieu of a noise field, so seek()
// is pure). The catalog rig has NO async compute hook (the §3 GPU-compute path
// for millions of particles is out of scope), so star motes use the P0-fixed
// instanced-sprite mechanism (embers.ts / gravity-well.ts): a THREE.Sprite
// carrying a PointsNodeMaterial whose positionNode + colorNode read per-star
// instanced attributes, the color a TSL radial falloff (soft round core, killed
// to EXACT zero before the quad edge so no square rim shows at any DPR). No
// DataTexture, no GLSL — r184 THREE.Points renders 1px on both backends and its
// .map never samples pointUV, so visible motes MUST be instanced quads.
//
// LINKS — a pool of instanced thin line-quads (a single InstancedMesh of a unit
// quad). Each seek the closure recomputes which mote PAIRS sit within
// `linkDistance`, capped at MAX_LINKS for cost, and for each near pair composes
// a per-link matrix (midpoint translation, +X aligned to the endpoint delta,
// scale = [length, thickness, 1]) plus a per-link brightness attribute =
// linkBrightness × (1 − d/threshold) so closer pairs glow brighter. The quad's
// MeshBasicNodeMaterial reads that instanced brightness × a TSL soft cross/end
// falloff, additively blended — hairline light, never a hard rectangle. Links
// beyond threshold collapse to zero scale + zero brightness (cost-free, dark).
// The net VISIBLY reforms as the motes drift: the live pair set changes frame to
// frame, which is exactly the "breathing" the brief asks for.
//
// COLOR — Observatory-Brass world: motes are bone-white→ice cores with a faint
// brass-accent minority (a deterministic index hash picks ~1-in-5 brass stars).
// Links are a cool bone-white. NO purple. Bright cores, soft falloff so the net
// reads luminous against the dark graphite rig backdrop.
//
// DETERMINISM — every per-star frequency/phase/amplitude/tint derives from an
// index hash (no Math.random, EVER); seek(t) is a pure function of t, so two
// instances seeked identically match and re-seeking a t reproduces the frame.
//
// DISTINCT FROM NEIGHBORS:
//   • fireflies     — unlinked wanderers (no links at all); ours is defined by
//                     its DYNAMIC proximity links.
//   • flocking/murmuration — velocity-matching flocks, no links.
//   • spring-lattice — a FIXED grid topology of springs; ours has NO fixed
//                     topology — links form and dissolve purely by live proximity
//                     as the motes wander, so the connectivity graph is dynamic.
//
// volumetric:false implicitly — single instanced sprite/quad pass, never a
// slab-stack (the volumetric slab look is killed catalog-wide).

import {
  Sprite,
  InstancedMesh,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  Matrix4,
  Quaternion,
  Vector3,
  AdditiveBlending,
  DynamicDrawUsage,
} from 'three';
import { PointsNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec3, vec4, float, exp, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type PrimitiveDefinition } from '../contract';

// Fixed build-time pools. `starCount` is a control but we allocate to the max so
// the attributes never reallocate; unused stars are parked far away AND excluded
// from the draw via sprite.count. Link count is capped for 60fps-class cost.
const MAX_STARS = 80;
// Pair-pool cap (cost ceiling). Comfortably holds the default + typical sweeps
// uncapped; if a generous reach over-connects, the closure keeps the NEAREST
// pairs (brightest links) and prunes the dimmest, so the net never flicker-clips.
const MAX_LINKS = 512;
const FIELD = 1.9; // half-extent of the drift field (keeps the system in-frame)
const HIDDEN_Y = -1000; // park unused stars far below view

/** Deterministic 0..1 hash from a single seed (the classic fract(sin) hash). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  // Structural: rebuilds the live population at the pin (sparse 30 → dense 80).
  { id: 'starCount', label: 'Stars', type: 'knob', min: 24, max: MAX_STARS, step: 1, default: 60 },
  // Proximity threshold: at frozen positions, larger = strictly more pairs link.
  { id: 'linkDistance', label: 'Link Reach', type: 'fader', min: 0.3, max: 1.2, step: 0.01, default: 0.6 },
  // Drift rate: at the pinned t a faster speed has evolved the standing layout
  // to a visibly different state (rate made visible on the frozen frame).
  { id: 'driftSpeed', label: 'Drift', type: 'knob', min: 0.05, max: 1.5, step: 0.01, default: 0.45 },
  // Link glow: scales the additive hairline brightness at the pin.
  { id: 'linkBrightness', label: 'Link Glow', type: 'knob', min: 0.2, max: 2.6, step: 0.01, default: 1.3 },
  { id: 'coreColor', label: 'Star core', type: 'color', default: '#eaf2ff' }, // bone→ice
  { id: 'brassColor', label: 'Brass accent', type: 'color', default: '#e8b873' },
] as const;

export const constellationNetPrimitive: PrimitiveDefinition = {
  name: 'constellation-net',
  label: 'Constellation Net',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A living constellation — drifting star motes linked by hairline light when they near each other, the net breathing as stars wander.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'constellation-net', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-star deterministic constants, cached once ────────────────────
      // Lissajous-ish drift: each star orbits a base point on index-seeded
      // frequencies/phases/amplitudes — organic, never gridlike.
      const baseX = new Float32Array(MAX_STARS);
      const baseY = new Float32Array(MAX_STARS);
      const baseZ = new Float32Array(MAX_STARS);
      const freqX = new Float32Array(MAX_STARS);
      const freqY = new Float32Array(MAX_STARS);
      const freqZ = new Float32Array(MAX_STARS);
      const phX = new Float32Array(MAX_STARS);
      const phY = new Float32Array(MAX_STARS);
      const phZ = new Float32Array(MAX_STARS);
      const ampX = new Float32Array(MAX_STARS);
      const ampY = new Float32Array(MAX_STARS);
      const ampZ = new Float32Array(MAX_STARS);
      const isBrass = new Uint8Array(MAX_STARS); // ~1-in-5 brass-accent minority
      const twinklePh = new Float32Array(MAX_STARS); // gentle per-star brightness phase
      for (let i = 0; i < MAX_STARS; i++) {
        baseX[i] = (hash1(i * 1.13 + 0.7) - 0.5) * FIELD * 1.6;
        baseY[i] = (hash1(i * 2.07 + 3.1) - 0.5) * FIELD * 1.4;
        baseZ[i] = (hash1(i * 3.71 + 5.9) - 0.5) * FIELD * 0.7;
        // Slow distinct per-axis drift rates (low Hz) — lazy wandering.
        freqX[i] = 0.13 + hash1(i * 4.21 + 1.4) * 0.34;
        freqY[i] = 0.11 + hash1(i * 5.33 + 2.6) * 0.3;
        freqZ[i] = 0.09 + hash1(i * 6.47 + 8.2) * 0.24;
        phX[i] = hash1(i * 7.19 + 0.2) * Math.PI * 2;
        phY[i] = hash1(i * 8.53 + 4.8) * Math.PI * 2;
        phZ[i] = hash1(i * 9.31 + 7.3) * Math.PI * 2;
        ampX[i] = 0.22 + hash1(i * 10.7 + 1.1) * 0.34;
        ampY[i] = 0.2 + hash1(i * 11.3 + 6.5) * 0.32;
        ampZ[i] = 0.12 + hash1(i * 12.9 + 2.2) * 0.2;
        isBrass[i] = hash1(i * 13.7 + 9.4) < 0.2 ? 1 : 0;
        twinklePh[i] = hash1(i * 14.1 + 3.3) * Math.PI * 2;
      }

      // ── Star geometry: one billboard quad + per-star instanced attributes ─
      const starPositions = new Float32Array(MAX_STARS * 3);
      const starColors = new Float32Array(MAX_STARS * 3);
      const starPosAttr = new InstancedBufferAttribute(starPositions, 3);
      const starColAttr = new InstancedBufferAttribute(starColors, 3);
      starPosAttr.setUsage(DynamicDrawUsage);
      starColAttr.setUsage(DynamicDrawUsage);

      const starGeo = new BufferGeometry();
      starGeo.setIndex([0, 1, 2, 0, 2, 3]);
      starGeo.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
          3,
        ),
      );
      starGeo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
      // Attached by name so tests/tools can discover the live buffers; the
      // material reads them via instancedBufferAttribute() nodes.
      starGeo.setAttribute('instancePosition', starPosAttr);
      starGeo.setAttribute('instanceColor', starColAttr);

      // Star look: TSL radial falloff × per-star instanced color (premultiplied
      // brightness). d: 0 at quad center → 1 at edge midpoint. Gaussian core
      // (k=-3.2, the embers luminous-halo constant) killed to EXACT zero before
      // the edge so no square rim can ever show.
      const d = uv().sub(0.5).mul(2).length();
      const glow = exp(d.mul(d).mul(-3.2));
      const rim = smoothstep(float(0.72), float(0.96), d).oneMinus();
      const starTint = instancedBufferAttribute(starColAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const starMat = new PointsNodeMaterial({
        size: 0.085,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      starMat.positionNode = instancedBufferAttribute(starPosAttr);
      starMat.colorNode = vec4(starTint.mul(glow.mul(rim)), float(1));

      const stars = new Sprite(starMat);
      stars.geometry = starGeo;
      stars.count = MAX_STARS; // live count narrows this in seek()
      stars.frustumCulled = false; // instances extend beyond the unit quad
      stars.name = 'constellation-stars';
      target.object.add(stars);

      // ── Link geometry: a unit quad spanning x∈[0,1] (a segment from its own
      // origin to +X), y∈[-0.5,0.5] (thickness). Per-link matrices map this base
      // segment onto each endpoint pair; a per-link instanced brightness drives
      // the additive glow. ──────────────────────────────────────────────────
      const linkGeo = new BufferGeometry();
      linkGeo.setIndex([0, 1, 2, 0, 2, 3]);
      linkGeo.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0]),
          3,
        ),
      );
      linkGeo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
      const linkBright = new Float32Array(MAX_LINKS * 3); // brightness as vec3 tint
      const linkBrightAttr = new InstancedBufferAttribute(linkBright, 3);
      linkBrightAttr.setUsage(DynamicDrawUsage);
      linkGeo.setAttribute('instanceLink', linkBrightAttr);

      // Link look: soft falloff across the thickness (uv.y) AND a gentle taper at
      // the two ends (uv.x) so links read as hairline filaments, not bars. The
      // per-link instanced brightness (cool bone-white, scaled by proximity ×
      // linkBrightness) rides in the tint; additive blending makes brightness an
      // alpha-like glow.
      const cross = smoothstep(float(0.5), float(0.0), uv().y.sub(0.5).abs());
      const ux = uv().x;
      const ends = smoothstep(float(0.0), float(0.12), ux).mul(
        smoothstep(float(1.0), float(0.88), ux),
      );
      const linkTint = instancedBufferAttribute(linkBrightAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };
      const linkMat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      linkMat.colorNode = vec4(linkTint.mul(cross.mul(ends)), float(1));

      const links = new InstancedMesh(linkGeo, linkMat, MAX_LINKS);
      links.instanceMatrix.setUsage(DynamicDrawUsage);
      links.frustumCulled = false;
      links.name = 'constellation-links';
      target.object.add(links);

      // ── Reusable scratch + live color caches ─────────────────────────────
      const mat4 = new Matrix4();
      const quat = new Quaternion();
      const pos = new Vector3();
      const scl = new Vector3();
      const dir = new Vector3();
      const X_AXIS = new Vector3(1, 0, 0);
      const ZERO_MAT = new Matrix4().makeScale(0, 0, 0); // a degenerate (dark) link
      const linkBaseColor = new Color('#cfe0ff'); // cool bone-white filament

      const coreC = new Color();
      const brassC = new Color();
      let lastCore = '';
      let lastBrass = '';
      const LINK_THICKNESS = 0.012; // hairline (world units)

      // Candidate-pair scratch (preallocated, no per-frame GC). Worst case is
      // every unordered pair of the live stars; we keep at most MAX_LINKS of the
      // NEAREST. `candA/candB` index the pair, `candD` its distance.
      const MAX_PAIRS = (MAX_STARS * (MAX_STARS - 1)) / 2;
      const candA = new Int16Array(MAX_PAIRS);
      const candB = new Int16Array(MAX_PAIRS);
      const candD = new Float32Array(MAX_PAIRS);
      const candOrder = new Int32Array(MAX_PAIRS); // sorted index when over cap

      /** Drifted world position of star i at time t (Lissajous about its base). */
      const starAt = (i: number, t: number): [number, number, number] => {
        const x = baseX[i] + Math.sin(t * freqX[i] + phX[i]) * ampX[i];
        const y = baseY[i] + Math.sin(t * freqY[i] + phY[i]) * ampY[i];
        const z = baseZ[i] + Math.sin(t * freqZ[i] + phZ[i]) * ampZ[i];
        return [x, y, z];
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_STARS, Math.round(num(params.starCount, 60))));
          const linkDist = num(params.linkDistance, 0.78);
          // driftSpeed scales the clock that feeds the Lissajous paths, so at a
          // pinned t a faster speed has carried every mote further along its
          // path → a visibly different STANDING layout on the frozen frame
          // (rate control made statically visible — the W4 liveness rule).
          const driftSpeed = num(params.driftSpeed, 0.45);
          const linkBrightness = num(params.linkBrightness, 1.3);
          const coreHex = str(params.coreColor, '#eaf2ff');
          const brassHex = str(params.brassColor, '#e8b873');
          if (coreHex !== lastCore) {
            coreC.set(coreHex);
            lastCore = coreHex;
          }
          if (brassHex !== lastBrass) {
            brassC.set(brassHex);
            lastBrass = brassHex;
          }

          const dt = t * driftSpeed;
          stars.count = count;

          // ── Place + light the live stars ──────────────────────────────────
          for (let i = 0; i < count; i++) {
            const [x, y, z] = starAt(i, dt);
            starPositions[i * 3] = x;
            starPositions[i * 3 + 1] = y;
            starPositions[i * 3 + 2] = z;

            // Gentle deterministic twinkle so the field shimmers (never to zero —
            // a rest state at t=0 stays clearly lit, not black).
            const tw = 0.78 + 0.22 * (Math.sin(dt * 1.7 + twinklePh[i]) * 0.5 + 0.5);
            const c = isBrass[i] ? brassC : coreC;
            // HDR-ish core lift so mote centers clip toward white under additive
            // blending — bright cores against the dark rig.
            const lum = tw * 1.35;
            starColors[i * 3] = c.r * lum;
            starColors[i * 3 + 1] = c.g * lum;
            starColors[i * 3 + 2] = c.b * lum;
          }
          // Park unused stars far below view (dark) so the buffers stay fully
          // deterministic for a given t.
          for (let i = count; i < MAX_STARS; i++) {
            starPositions[i * 3] = 0;
            starPositions[i * 3 + 1] = HIDDEN_Y;
            starPositions[i * 3 + 2] = 0;
            starColors[i * 3] = 0;
            starColors[i * 3 + 1] = 0;
            starColors[i * 3 + 2] = 0;
          }
          starPosAttr.needsUpdate = true;
          starColAttr.needsUpdate = true;

          // ── Rebuild the proximity link set from the live positions ─────────
          // Collect every unordered pair within linkDist, then (if the count
          // exceeds the pool cap) keep the NEAREST MAX_LINKS — so a generous
          // reach densifies the net but the brightest filaments are always the
          // ones shown, never a scan-order clip that flickers. The pair set
          // CHANGES as motes drift → the breathing net.
          const distSq = linkDist * linkDist;
          let nc = 0;
          for (let a = 0; a < count; a++) {
            const ax = starPositions[a * 3];
            const ay = starPositions[a * 3 + 1];
            const az = starPositions[a * 3 + 2];
            for (let b = a + 1; b < count; b++) {
              const dx = starPositions[b * 3] - ax;
              const dy = starPositions[b * 3 + 1] - ay;
              const dz = starPositions[b * 3 + 2] - az;
              const dSq = dx * dx + dy * dy + dz * dz;
              if (dSq >= distSq) continue;
              candA[nc] = a;
              candB[nc] = b;
              candD[nc] = Math.sqrt(dSq);
              nc++;
            }
          }

          // Decide which candidates render: all of them if under the cap, else
          // the nearest MAX_LINKS (stable, deterministic sort by distance then
          // pair index so re-seeking a t reproduces the exact link set).
          let drawN = nc;
          if (nc > MAX_LINKS) {
            for (let i = 0; i < nc; i++) candOrder[i] = i;
            const order = candOrder.subarray(0, nc);
            order.sort((i, j) => {
              const dd = candD[i] - candD[j];
              if (dd !== 0) return dd;
              const aa = candA[i] - candA[j];
              if (aa !== 0) return aa;
              return candB[i] - candB[j];
            });
            drawN = MAX_LINKS;
          } else {
            for (let i = 0; i < nc; i++) candOrder[i] = i;
          }

          let li = 0;
          for (; li < drawN; li++) {
            const k = candOrder[li];
            const a = candA[k];
            const b = candB[k];
            const dlen = candD[k];
            const ax = starPositions[a * 3];
            const ay = starPositions[a * 3 + 1];
            const az = starPositions[a * 3 + 2];

            // Orient the base segment (origin→+X, unit length) onto a→b:
            // translate to endpoint a, rotate +X to the delta, scale to length.
            pos.set(ax, ay, az);
            dir.set(
              starPositions[b * 3] - ax,
              starPositions[b * 3 + 1] - ay,
              starPositions[b * 3 + 2] - az,
            );
            if (dlen > 1e-6) dir.multiplyScalar(1 / dlen);
            quat.setFromUnitVectors(X_AXIS, dir);
            scl.set(Math.max(dlen, 1e-5), LINK_THICKNESS, 1);
            mat4.compose(pos, quat, scl);
            links.setMatrixAt(li, mat4);

            // Brightness ∝ (1 − d/threshold): nearer pairs glow brighter.
            const prox = 1 - dlen / linkDist;
            const g = linkBrightness * prox;
            linkBright[li * 3] = linkBaseColor.r * g;
            linkBright[li * 3 + 1] = linkBaseColor.g * g;
            linkBright[li * 3 + 2] = linkBaseColor.b * g;
          }
          // Collapse the remaining link slots to a degenerate (zero-scale, dark)
          // pose so they cost nothing and never render a stray rectangle.
          for (let i = li; i < MAX_LINKS; i++) {
            links.setMatrixAt(i, ZERO_MAT);
            linkBright[i * 3] = 0;
            linkBright[i * 3 + 1] = 0;
            linkBright[i * 3 + 2] = 0;
          }
          links.instanceMatrix.needsUpdate = true;
          linkBrightAttr.needsUpdate = true;
        },
        dispose: () => {
          target.object.remove(stars);
          target.object.remove(links);
          starGeo.dispose();
          starMat.dispose();
          linkGeo.dispose();
          linkMat.dispose();
          links.dispose();
        },
      };
    },
  ),
};
