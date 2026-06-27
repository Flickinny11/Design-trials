'use client';

// PRISM EDITOR INTEGRATION — I-1 shell glass vocabulary.
//
// The editor shell reuses the SAME founder-approved transmission-glass recipe as
// /toolbar-chassis (GlassPane) + /keyframe-editor + the P-1/P-6 panes: a real
// MeshPhysicalMaterial with transmission=1, refracting the shared studio IBL.
// Docks are built from buildPaneGeometry (the P-1 Pane primitive) so the editor
// chrome MATCHES the labs by construction — never flat, never DOM.

import * as THREE from 'three';
import type { PrimitiveParams } from '@/components/editor/primitive/primitive-schema';

/** A PrimitiveParams literal for a flat glass dock pane (no cutouts). The Pane
 *  primitive's buildPaneGeometry consumes exactly these fields. */
export function dockPaneParams(
  width: number,
  height: number,
  opts: { depth?: number; cornerRadius?: number; bevel?: number; segments?: number } = {},
): PrimitiveParams {
  return {
    width,
    height,
    depth: opts.depth ?? 0.4,
    cornerRadius: opts.cornerRadius ?? 0.34,
    bevel: opts.bevel ?? 0.05,
    radius: 0.5,
    segments: opts.segments ?? 24,
    cutouts: [],
  };
}

/** The approved liquid-glass transmission material (verbatim recipe from the
 *  chassis GlassPane / P-1 glass-clear). `tone` shifts the smoke tint:
 *  'clear' = barely tinted (far attenuation), 'smoke' = deeper editorial smoke. */
export function makeDockGlass(tone: 'clear' | 'smoke' = 'clear'): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial();
  mat.transmission = 1;
  mat.thickness = 0.7;
  mat.ior = 1.5;
  mat.roughness = tone === 'smoke' ? 0.085 : 0.055;
  mat.metalness = 0;
  mat.clearcoat = 1;
  mat.clearcoatRoughness = tone === 'smoke' ? 0.22 : 0.17;
  mat.envMapIntensity = 1.05;
  mat.specularIntensity = 0.7;
  mat.transparent = true;
  mat.color = new THREE.Color('#ffffff');
  mat.attenuationColor = new THREE.Color(tone === 'smoke' ? '#9fb6cc' : '#dbe8f2');
  mat.attenuationDistance = tone === 'smoke' ? 0.7 : 1.8;
  mat.needsUpdate = true;
  return mat;
}

/** Dormant "unbuilt graph" seed material — the galaxy-state node sphere (the
 *  same emissive liquid-glass seed look the P-6 library DormantNode uses). */
export function makeDormantSeed(selected = false): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: selected ? '#3a567a' : '#1d2c42',
    emissive: '#15314e',
    emissiveIntensity: 0.5,
    roughness: 0.35,
    metalness: 0.2,
    transmission: 0.5,
    thickness: 0.5,
    ior: 1.4,
    clearcoat: 0.6,
  });
}
