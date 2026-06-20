// ORRERY No.7 — Atelier material applier (F5.1).
// Imperative bridge from the configurator store to the mounted proxy watch:
// for each layer, resolve the chosen variant's MaterialSpec and write it onto
// the part node's live MeshPhysicalNodeMaterial via the same
// `userData.meshPrimitiveHandle.setMaterialSpec` channel the editor's Material
// tab uses (pure uniform writes, no rebuild — spec §3.2/§3.4). Works in
// preview-app where the composed node is frozen, because this is a direct
// imperative write, not a re-render.
import type { Object3D } from 'three';
import type { MaterialSpec } from '@/lib/prism-graph/types';
import type { MeshPrimitiveHandle } from '@/lib/prism/runtime/shared/mesh-primitive';
import { LAYERS, variantOf, type AtelierBuild } from '@/lib/prism/atelier/config';

interface WithHandle {
  meshPrimitiveHandle?: MeshPrimitiveHandle;
  nodeId?: string;
}

const LUME_COLOR: Record<string, string> = {
  blue: '#1ec8ff',
  green: '#5ef08a',
  ice: '#bfe9ff',
};

/** Resolve the per-part MaterialSpec map for a build, incl. the lume overlay. */
export function resolveBuildMaterials(build: AtelierBuild): Map<string, MaterialSpec> {
  const out = new Map<string, MaterialSpec>();
  for (const layer of LAYERS) {
    const v = variantOf(layer.id, build[layer.id]);
    if (!v?.material) continue;
    for (const nid of layer.nodeIds) out.set(nid, v.material);
  }
  // Lume: emissive overlay on hands + indices nodes (composes onto their finish).
  const lume = build.lume;
  if (lume && lume !== 'none' && LUME_COLOR[lume]) {
    const glow = LUME_COLOR[lume];
    const targets = [
      ...(LAYERS.find((l) => l.id === 'hands')?.nodeIds ?? []),
      ...(LAYERS.find((l) => l.id === 'indices')?.nodeIds ?? []),
    ];
    for (const nid of targets) {
      const base = out.get(nid);
      if (!base) continue;
      out.set(nid, { ...base, emissive: glow, emissiveIntensity: 0.9 });
    }
  }
  return out;
}

/**
 * Write the build's materials onto the mounted proxy parts found under `root`.
 * Returns the number of parts updated. Safe to call repeatedly / on any frame.
 */
export function applyConfiguratorToScene(root: Object3D, build: AtelierBuild): number {
  const targets = resolveBuildMaterials(build);
  if (targets.size === 0) return 0;
  let applied = 0;
  root.traverse((obj) => {
    const nid = (obj.userData as WithHandle | undefined)?.nodeId;
    if (!nid || !targets.has(nid)) return;
    let handle: MeshPrimitiveHandle | null = null;
    obj.traverse((child) => {
      const h = (child.userData as WithHandle | undefined)?.meshPrimitiveHandle;
      if (!handle && h) handle = h;
    });
    if (handle) {
      (handle as MeshPrimitiveHandle).setMaterialSpec(targets.get(nid)!);
      applied += 1;
    }
  });
  return applied;
}
