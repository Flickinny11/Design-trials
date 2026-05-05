import { Group } from 'three';

// Map a PrismGraph to a THREE scene tree: one Group per hub, populated via
// per-node createNode() modules. The bundle's app.js wires this together
// with the loader cache, font atlas, and primitives library.

export function adaptGraphToScene(graph, ctx) {
  const groups = new Map();
  for (const hub of graph.hubs) {
    const group = new Group();
    group.name = 'hub:' + hub.hubId;
    groups.set(hub.hubId, group);
  }
  for (const node of graph.nodes) {
    const parent = groups.get(node.parentHubId);
    if (!parent) continue;
    try {
      const mod = ctx.modules.get(node.nodeId);
      if (!mod || typeof mod.default !== 'function') continue;
      const obj = mod.default({ ...node }, ctx);
      if (obj) {
        const sp = node.scenePosition || {};
        if (sp.x != null) obj.position.set(sp.x ?? 0, sp.y ?? 0, sp.z ?? 0);
        if (sp.rotationXYZ) obj.rotation.set(sp.rotationXYZ.x ?? 0, sp.rotationXYZ.y ?? 0, sp.rotationXYZ.z ?? 0);
        if (sp.scaleXYZ) obj.scale.set(sp.scaleXYZ.x ?? 1, sp.scaleXYZ.y ?? 1, sp.scaleXYZ.z ?? 1);
        parent.add(obj);
      }
    } catch (e) { console.error('[adapter] node', node.nodeId, e); }
  }
  return groups;
}
