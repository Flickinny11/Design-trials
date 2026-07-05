'use client';

// PRISM WORKSPACE COMPLETION — W-2: the in-engine BRANDED TILE primitive (D2).
//
// A reusable, ZERO-DOM action/platform tile rendered in the WebGPU canvas: a
// milled dark slot inset on the dock glass (the GlassTextField idiom) carrying
// the PROVIDER'S REAL brand mark — the official monochrome glyph (parsed from
// brand-assets via SVGLoader → ShapeGeometry, tinted the brand's real accent)
// for vendored brands, or a branded accent monogram chip for the long tail
// (the provider's real color + initials — real brand identity, never a stock
// icon). Beside it: the action/platform label + a sub-label + an optional
// status badge. Click + pointer-down callbacks let the Functions / Integrations
// / Data surfaces attach, drag, reorder, or detach. Editor CHROME — not a graph
// node; window/SVGLoader here is the editor-chrome exemption.

import { useMemo } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { getBrandAsset } from '@/lib/capabilities/brand-assets';

export interface BrandTileData {
  brandKey: string;
  /** Primary line — the action label or platform name. */
  label: string;
  /** Secondary line — platform + category, or any sub-label. */
  subtitle?: string;
  /** Small right-aligned status badge ("Valid", "Auto-fixed", "ref…"). */
  badge?: string;
  /** Badge tint. */
  badgeColor?: string;
}

// ── REAL brand glyph geometry (vendored monochrome marks → in-engine shapes) ──
// Cache by brandKey so the SVG path is parsed once per brand across all tiles.
const glyphCache = new Map<string, { geo: THREE.BufferGeometry; scale: number; cx: number; cy: number } | null>();

function brandGlyph(brandKey: string): { geo: THREE.BufferGeometry; scale: number; cx: number; cy: number } | null {
  const key = (brandKey || '').toLowerCase();
  if (glyphCache.has(key)) return glyphCache.get(key) ?? null;
  const asset = getBrandAsset(brandKey);
  if (!asset.svgPath) {
    glyphCache.set(key, null);
    return null;
  }
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${asset.svgPath}"/></svg>`;
    const data = new SVGLoader().parse(svg);
    const geos: THREE.BufferGeometry[] = [];
    for (const path of data.paths) {
      for (const shape of SVGLoader.createShapes(path)) geos.push(new THREE.ShapeGeometry(shape));
    }
    if (geos.length === 0) {
      glyphCache.set(key, null);
      return null;
    }
    // merge by concatenating positions into one geometry (cheap, no addon util).
    const merged = mergeFlat(geos);
    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const w = bb.max.x - bb.min.x || 1;
    const h = bb.max.y - bb.min.y || 1;
    const scale = 1 / Math.max(w, h);
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const entry = { geo: merged, scale, cx, cy };
    glyphCache.set(key, entry);
    return entry;
  } catch {
    glyphCache.set(key, null);
    return null;
  }
}

// Merge a list of (non-indexed or indexed) ShapeGeometries into one position-only
// BufferGeometry. ShapeGeometry is indexed; expand to non-indexed triangles.
function mergeFlat(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const tris: number[] = [];
  for (const g of geos) {
    const pos = g.getAttribute('position');
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        const v = idx.getX(i);
        tris.push(pos.getX(v), pos.getY(v), 0);
      }
    } else {
      for (let i = 0; i < pos.count; i++) tris.push(pos.getX(i), pos.getY(i), 0);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  return out;
}

const TILE_H = 0.34;
const SLOT_GEO_CACHE = new Map<number, THREE.BufferGeometry>();
function slotGeo(width: number): THREE.BufferGeometry {
  const k = Math.round(width * 100);
  let g = SLOT_GEO_CACHE.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(width, TILE_H, 0.07);
    SLOT_GEO_CACHE.set(k, g);
  }
  return g;
}

/** One branded tile. `glyphSize` ~0.22 is the logo box. */
export function BrandTile({
  data,
  position,
  width = 2.4,
  dim = false,
  highlight = false,
  pip,
  onClick,
  onPointerDown,
}: {
  data: BrandTileData;
  position: [number, number, number];
  width?: number;
  dim?: boolean;
  highlight?: boolean;
  /** Small status pip color (validation: green valid, amber testing, red broken). */
  pip?: string;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const asset = useMemo(() => getBrandAsset(data.brandKey), [data.brandKey]);
  const glyph = useMemo(() => brandGlyph(data.brandKey), [data.brandKey]);
  const accent = asset.accent || '#c9a86a';

  const slotMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: highlight ? '#1b2a3e' : dim ? '#0c1119' : '#0f151f',
      emissive: new THREE.Color(highlight ? accent : '#05070c').multiplyScalar(highlight ? 0.14 : 1),
      roughness: 0.5,
      metalness: 0.25,
    });
    return m;
  }, [highlight, dim, accent]);
  const glyphMat = useMemo(() => new THREE.MeshBasicMaterial({ color: accent, toneMapped: false, side: THREE.DoubleSide }), [accent]);
  const chipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.1, emissive: new THREE.Color(accent).multiplyScalar(0.12) }), [accent]);

  const logoX = -width / 2 + 0.24;
  const textX = -width / 2 + 0.48;
  const glyphScale = 0.26; // logo box span in scene units

  return (
    <group position={position}>
      {/* the inset slot */}
      <mesh
        geometry={slotGeo(width)}
        material={slotMat}
        position={[0, 0, 0.16]}
        onClick={onClick ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
        onPointerDown={onPointerDown ? (e) => { e.stopPropagation(); onPointerDown(e); } : undefined}
      />

      {/* brand mark: REAL glyph (vendored) or accent monogram chip (long tail) */}
      {glyph ? (
        <group position={[logoX, 0, 0.22]}>
          <mesh
            geometry={glyph.geo}
            material={glyphMat}
            scale={[glyphScale * glyph.scale, -glyphScale * glyph.scale, glyphScale * glyph.scale]}
            position={[-glyph.cx * glyphScale * glyph.scale, glyph.cy * glyphScale * glyph.scale, 0]}
          />
        </group>
      ) : (
        <group position={[logoX, 0, 0.21]}>
          <mesh material={chipMat}>
            <boxGeometry args={[0.26, 0.26, 0.04]} />
          </mesh>
          <CompositeText position={[0, 0, 0.04]} fontSize={0.12} variant="bright">
            {(asset.monogram || asset.name.slice(0, 2)).slice(0, 3).toUpperCase()}
          </CompositeText>
        </group>
      )}

      {/* label + sub-label */}
      <CompositeText position={[textX, 0.06, 0.22]} fontSize={0.092} anchorX="left" variant={dim ? 'engraved' : 'bright'}>
        {(data.label || '').slice(0, 26)}
      </CompositeText>
      {data.subtitle && (
        <CompositeText position={[textX, -0.085, 0.22]} fontSize={0.064} anchorX="left" variant="engraved">
          {data.subtitle.slice(0, 34)}
        </CompositeText>
      )}

      {/* status pip (color) + badge text (meaning) */}
      {pip && (
        <mesh position={[width / 2 - 0.12, 0.085, 0.22]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color={pip} toneMapped={false} />
        </mesh>
      )}
      {data.badge && (
        <CompositeText position={[width / 2 - 0.12, -0.06, 0.22]} fontSize={0.058} anchorX="right" variant="engraved">
          {data.badge.slice(0, 16)}
        </CompositeText>
      )}
    </group>
  );
}
