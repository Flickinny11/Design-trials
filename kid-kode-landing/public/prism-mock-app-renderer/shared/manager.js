// Hub manager — manages active hub THREE.Group, mount/unmount lifecycle.

export function createHubManager({ scene }) {
  const hubs = new Map();
  let active = null;
  return {
    register(hubId, group) { hubs.set(hubId, group); },
    activate(hubId) {
      const next = hubs.get(hubId);
      if (!next) return false;
      if (active && active !== next) scene.remove(active);
      scene.add(next);
      active = next;
      return true;
    },
    deactivate() {
      if (active) { scene.remove(active); active = null; }
    },
    get active() { return active; },
  };
}
