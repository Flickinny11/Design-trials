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
import type { FaceTextureLoaderLike, MeshPrimitiveHandle } from '@/lib/prism/runtime/shared/mesh-primitive';
import { LAYERS, variantOf, totalPrice, type AtelierBuild } from '@/lib/prism/atelier/config';

interface TextHandleLike {
  spec: Record<string, unknown>;
  setSpec: (spec: Record<string, unknown>) => void;
}

interface WithHandle {
  meshPrimitiveHandle?: MeshPrimitiveHandle;
  textHandle?: TextHandleLike;
  nodeId?: string;
}

export const PRICE_NODE_ID = 'orr-atelier-price';
export const SUMMARY_NODE_ID = 'orr-atelier-summary';
export const REASON_NODE_ID = 'orr-atelier-reason';

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
export function applyConfiguratorToScene(root: Object3D, build: AtelierBuild, loader?: FaceTextureLoaderLike): number {
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
      const spec = targets.get(nid)!;
      (handle as MeshPrimitiveHandle).setMaterialSpec(spec);
      // Wire texture maps live (albedo + photoreal normal/roughness — SC-V-A3).
      if (loader) {
        const h = handle as MeshPrimitiveHandle;
        if (spec.baseColorMapUrl !== undefined) h.setColorMap(spec.baseColorMapUrl ?? null, loader);
        if (spec.normalMapUrl !== undefined) {
          h.setNormalMap(spec.normalMapUrl ?? null, loader, spec.normalScale ?? 1);
        }
        if (spec.roughnessMapUrl !== undefined) h.setRoughnessMap(spec.roughnessMapUrl ?? null, loader);
      }
      applied += 1;
    }
  });
  return applied;
}

function setLiveText(root: Object3D, nodeId: string, content: string): boolean {
  let wrote = false;
  root.traverse((obj) => {
    if ((obj.userData as WithHandle | undefined)?.nodeId !== nodeId) return;
    let handle: TextHandleLike | null = null;
    obj.traverse((child) => {
      const h = (child.userData as WithHandle | undefined)?.textHandle;
      if (!handle && h) handle = h;
    });
    if (handle && (handle as TextHandleLike).spec) {
      const th = handle as TextHandleLike;
      th.setSpec({ ...th.spec, content });
      wrote = true;
    }
  });
  return wrote;
}

/** Live-update the price + summary readouts. Returns true once the price node
 *  exists + was written (the caller retries on cold-load until this lands). */
export function applyConfiguratorText(root: Object3D, build: AtelierBuild): boolean {
  const price = totalPrice(build);
  const wrote = setLiveText(root, PRICE_NODE_ID, `CHF ${price.toLocaleString('en-US')}`);
  const pick = (l: Parameters<typeof variantOf>[0]) => variantOf(l, build[l])?.label ?? '';
  const summary = [pick('movement'), pick('case'), pick('dial')].filter(Boolean).join('   ·   ');
  setLiveText(root, SUMMARY_NODE_ID, summary);
  return wrote;
}

/** Live-update the constraint reason line (empty string clears it). */
export function applyConfiguratorReason(root: Object3D, reason: string | null): void {
  // DESIGN LAW §1.3 — no emoji/stock glyphs in the HUD. A typographic em-dash lead-in.
  setLiveText(root, REASON_NODE_ID, reason ? `—  ${reason}` : '');
}
