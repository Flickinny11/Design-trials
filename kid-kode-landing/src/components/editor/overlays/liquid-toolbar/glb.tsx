'use client';

// Generated-GLB plumbing for the liquid-glass toolbar (PRISM-EDITOR-CHROME-SPEC
// D1/TB-1/TB-3/IC-1). Every FORM in the toolbar — the shell, each button, each
// icon — is a Tripo v3.1 photoreal GLB written to
// public/prism-mock/editor/meshes/ (wave 1). This module loads those GLBs and
// prepares them for mounting: clone the cached scene, clone its materials (so
// per-instance emissive can animate without mutating the drei cache), auto-orient
// the disc-normal toward +Z, and scale-to-fit a target world size. The
// liquid-glass transmission, the warp, the hover-spin and the icon glow are
// BEHAVIORS layered on these meshes in the React/R3F code (spec §6).
//
// No DRACO/meshopt decoder is wired in the app runtime, so these are plain GLBs
// (wave 1 optimized them to ~0.75MB / 24k tris each, uncompressed).

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MESH = '/prism-mock/editor/meshes';

export const SHELL_URL = `${MESH}/shell.glb`;
export const btnUrl = (id: string) => `${MESH}/btn-${id}.glb`;
export const iconUrl = (id: string) => `${MESH}/ic-${id}.glb`;

export const TOOL_IDS = [
  'transform', 'selection', 'add', 'library', 'image', 'object3d', 'background',
  'changeArtifact', 'promptEdit', 'text', 'animation', 'function', 'lighting', 'build',
] as const;

/** Eagerly warm the drei GLTF cache for every toolbar form (client only). */
export function preloadToolbarGlbs() {
  if (typeof window === 'undefined') return;
  useGLTF.preload(SHELL_URL);
  for (const id of TOOL_IDS) {
    useGLTF.preload(btnUrl(id));
    useGLTF.preload(iconUrl(id));
  }
}

export interface PreparedGlb {
  object: THREE.Group; // ready to mount: centered, oriented, scaled-to-fit
  materials: THREE.MeshStandardMaterial[]; // per-instance clones (safe to mutate)
  depth: number; // post-scale half-extent along Z (for seating/sink math)
}

type AxisFace = 'auto' | 'none';

/**
 * Load a toolbar GLB and prepare a mountable clone.
 * - `target`: longest-axis world size after scaling (uniform).
 * - `face`: 'auto' rotates the thinnest bbox axis (a disc's normal) to +Z so the
 *   button face points forward and the X-axis spin reveals the rim.
 */
export function useToolGlb(url: string, target: number, face: AxisFace = 'auto'): PreparedGlb {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const scene = gltf.scene.clone(true);
    const materials: THREE.MeshStandardMaterial[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh) return;
      m.castShadow = true;
      m.receiveShadow = false;
      m.userData.glbSource = url; // verification: this mesh's FORM is the GLB
      const src = m.material;
      const clone = (mm: THREE.Material) => {
        const c = mm.clone() as THREE.MeshStandardMaterial;
        materials.push(c);
        return c;
      };
      m.material = Array.isArray(src) ? src.map(clone) : clone(src as THREE.Material);
    });

    // bbox (pre-orient) to find the disc normal + size.
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.sub(center); // re-origin to bbox center

    const inner = new THREE.Group();
    inner.add(scene);
    if (face === 'auto') {
      const dims = [size.x, size.y, size.z];
      const minAxis = dims.indexOf(Math.min(dims[0], dims[1], dims[2]));
      if (minAxis === 0) inner.rotation.y = Math.PI / 2; // X (thin) → Z
      else if (minAxis === 1) inner.rotation.x = -Math.PI / 2; // Y (thin) → Z
      // minAxis === 2 → already facing Z
    }

    const longest = Math.max(size.x, size.y, size.z) || 1;
    const k = target / longest;
    const holder = new THREE.Group();
    holder.add(inner);
    holder.scale.setScalar(k);
    holder.userData.glbSource = url;

    // post-scale Z half-extent (for sink/seat math). After auto-orient the thin
    // axis is Z, so its half-extent = min(size)/2 * k.
    const minExtent = Math.min(size.x, size.y, size.z);
    const depth = (minExtent / 2) * k;

    return { object: holder, materials, depth };
  }, [gltf, target, face]);
}

/**
 * Load the shell GLB and return a geometry scaled-to-fit the rail box
 * [w × h × d] (per-axis, baked into the vertices) so the per-frame liquid warp +
 * the transmission material can be applied to the GENERATED shell form exactly
 * as the prior procedural RoundedBox was. Returns the largest mesh's geometry.
 */
export function useShellGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const gltf = useGLTF(SHELL_URL);
  return useMemo(() => {
    // pick the geometry of the mesh with the most vertices (the shell body).
    let best: THREE.BufferGeometry | null = null;
    let bestN = -1;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh || !m.geometry) return;
      const n = (m.geometry.getAttribute('position')?.count ?? 0);
      if (n > bestN) { bestN = n; best = m.geometry; }
    });
    if (!best && typeof console !== 'undefined') {
      // The shell FORM must be the generated GLB (spec TB-1). If it ever fails to
      // resolve a mesh, make it LOUD rather than silently substituting a box.
      console.warn('[liquid-toolbar] shell.glb resolved no mesh — generated shell missing?');
    }
    const src = (best ?? new THREE.BoxGeometry(1, 1, 1)) as THREE.BufferGeometry;
    const geo = src.clone();
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const size = new THREE.Vector3();
    bb.getSize(size);
    const center = new THREE.Vector3();
    bb.getCenter(center);
    // recenter + per-axis scale-to-fit the rail box (orient longest dim → Y).
    const dims = [size.x, size.y, size.z];
    const longAxis = dims.indexOf(Math.max(dims[0], dims[1], dims[2]));
    const m = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    geo.applyMatrix4(m);
    if (longAxis === 0) geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    else if (longAxis === 2) geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    geo.computeBoundingBox();
    const s2 = new THREE.Vector3();
    geo.boundingBox!.getSize(s2);
    geo.applyMatrix4(
      new THREE.Matrix4().makeScale(
        w / (s2.x || 1),
        h / (s2.y || 1),
        d / (s2.z || 1),
      ),
    );
    geo.computeVertexNormals();
    return geo;
  }, [gltf, w, h, d]);
}
