import 'server-only';

// CANVAS-FINAL — Prism Compose: validate + clamp the LLM's procedural-artifact
// JSON into a safe ArtifactComposeSpec. The model's raw output is NEVER trusted
// or applied verbatim (engine INV-10, contamination-aware): every field is
// validated against the existing schema and clamped to sane ranges; anything
// unrecognized is dropped and a safe default fills in. A parse failure yields a
// neutral fallback element rather than throwing — the Code lane always returns
// a buildable artifact.

import {
  MESH_PRIMITIVE_DEFAULTS,
  type AnimationBinding,
  type AnimationDriverKind,
  type MaterialSpec,
  type MeshPrimitive,
  type MeshPrimitiveKind,
} from '@/lib/prism-graph/types';
import type { ArtifactComposeSpec } from './types';

const KINDS: ReadonlySet<MeshPrimitiveKind> = new Set([
  'cube', 'sphere', 'plane', 'cylinder', 'cone', 'torus', 'capsule',
]);
const DRIVERS: ReadonlySet<AnimationDriverKind> = new Set([
  'time', 'scroll', 'pointer', 'state', 'event',
]);

function num(v: unknown, lo: number, hi: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(hi, Math.max(lo, v));
}

function hexColor(v: unknown): string | undefined {
  if (typeof v === 'string') {
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    // tolerate "rrggbb" without the hash
    if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  }
  // tolerate [r,g,b] / [r,g,b,a] arrays in 0..1 (the LLM sometimes returns these)
  if (Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === 'number')) {
    const to255 = (n: number) => {
      const scaled = n <= 1 ? n * 255 : n; // 0..1 → 0..255, else assume already 0..255
      return Math.max(0, Math.min(255, Math.round(scaled)));
    };
    const hex = (n: number) => to255(n).toString(16).padStart(2, '0');
    return `#${hex(v[0])}${hex(v[1])}${hex(v[2])}`;
  }
  return undefined;
}

function stripFences(raw: string): string {
  // Tolerate ```json … ``` fences and leading prose; grab the first {...} block.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

function fallbackSpec(): ArtifactComposeSpec {
  return {
    meshPrimitive: { kind: 'sphere', params: { ...MESH_PRIMITIVE_DEFAULTS.sphere } },
    materialSpec: { baseColor: '#c8a86a', metalness: 0.6, roughness: 0.35 },
  };
}

export function parseComposeSpec(raw: string): ArtifactComposeSpec {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(stripFences(raw)) as Record<string, unknown>;
  } catch {
    return fallbackSpec();
  }
  if (!obj || typeof obj !== 'object') return fallbackSpec();

  // meshPrimitive
  const mpIn = (obj.meshPrimitive ?? {}) as { kind?: unknown; params?: Record<string, unknown> };
  const kindRaw = typeof mpIn.kind === 'string' ? mpIn.kind.toLowerCase().trim() : '';
  const kind: MeshPrimitiveKind = KINDS.has(kindRaw as MeshPrimitiveKind)
    ? (kindRaw as MeshPrimitiveKind)
    : 'sphere';
  const pIn = (mpIn.params ?? {}) as Record<string, unknown>;
  const params: NonNullable<MeshPrimitive['params']> = {};
  const w = num(pIn.width, 0.05, 3); if (w !== undefined) params.width = w;
  const h = num(pIn.height, 0.05, 3); if (h !== undefined) params.height = h;
  const dp = num(pIn.depth, 0.05, 3); if (dp !== undefined) params.depth = dp;
  const rd = num(pIn.radius, 0.02, 2); if (rd !== undefined) params.radius = rd;
  const tb = num(pIn.tube, 0.01, 1); if (tb !== undefined) params.tube = tb;
  const ln = num(pIn.length, 0.05, 3); if (ln !== undefined) params.length = ln;
  const sg = num(pIn.segments, 1, 96); if (sg !== undefined) params.segments = Math.round(sg);
  const meshPrimitive: MeshPrimitive = { kind, params: Object.keys(params).length ? params : undefined };

  // materialSpec
  const msIn = (obj.materialSpec ?? {}) as Record<string, unknown>;
  const materialSpec: MaterialSpec = {};
  const bc = hexColor(msIn.baseColor); if (bc) materialSpec.baseColor = bc;
  const mt = num(msIn.metalness, 0, 1); if (mt !== undefined) materialSpec.metalness = mt;
  const rg = num(msIn.roughness, 0, 1); if (rg !== undefined) materialSpec.roughness = rg;
  const tr = num(msIn.transmission, 0, 1); if (tr !== undefined) materialSpec.transmission = tr;
  const ior = num(msIn.ior, 1, 2.4); if (ior !== undefined) materialSpec.ior = ior;
  const em = hexColor(msIn.emissive); if (em) materialSpec.emissive = em;
  const ei = num(msIn.emissiveIntensity, 0, 8); if (ei !== undefined) materialSpec.emissiveIntensity = ei;
  const cc = num(msIn.clearcoat, 0, 1); if (cc !== undefined) materialSpec.clearcoat = cc;
  const irid = num(msIn.iridescence, 0, 1); if (irid !== undefined) materialSpec.iridescence = irid;

  // animationBindings (≤1, known driver only)
  let animationBindings: AnimationBinding[] | undefined;
  const abIn = Array.isArray(obj.animationBindings) ? obj.animationBindings : [];
  const first = abIn[0] as { primitive?: unknown; driver?: unknown } | undefined;
  if (first && typeof first.primitive === 'string' && first.primitive.length > 0) {
    const driver: AnimationDriverKind = DRIVERS.has(first.driver as AnimationDriverKind)
      ? (first.driver as AnimationDriverKind)
      : 'time';
    animationBindings = [{ id: 'ab-compose', primitive: first.primitive, driver, order: 0 }];
  }

  return {
    meshPrimitive,
    materialSpec: Object.keys(materialSpec).length ? materialSpec : undefined,
    animationBindings,
  };
}
