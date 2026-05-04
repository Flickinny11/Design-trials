// T02 — HubManager activate/deactivate cycles work with THREE.Group.
//
// Spec: §12 (Hub Manager).
//   - activate(hubId) -> sceneRoot.add(hubGroup); activatePrimitivesForHub(hubGroup)
//   - reparent-on-navigate is implicit via Object3D.add()
//   - deactivate -> derived from §8: invoke userData.cleanup() on each
//     descendant.

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  createHubManager,
  disposeHubGroup,
} from '@/lib/prism/runtime/shared/hub-manager';

function makeFakeSceneRoot() {
  return { scene: new THREE.Scene() };
}

describe('createHubManager', () => {
  it('register + activate parents the hub group on sceneRoot.scene', () => {
    const root = makeFakeSceneRoot();
    const mgr = createHubManager(root);
    const hub = new THREE.Group();
    hub.name = 'home';

    mgr.register('home', hub);
    expect(mgr.list()).toEqual(['home']);
    expect(mgr.getActive()).toBeNull();

    mgr.activate('home');
    expect(mgr.getActive()).toBe('home');
    expect(hub.parent).toBe(root.scene);
  });

  it('activating a second hub auto-detaches the first (reparent-on-navigate)', () => {
    const root = makeFakeSceneRoot();
    const mgr = createHubManager(root);
    const a = new THREE.Group();
    const b = new THREE.Group();
    mgr.register('a', a);
    mgr.register('b', b);

    mgr.activate('a');
    expect(a.parent).toBe(root.scene);

    mgr.activate('b');
    expect(b.parent).toBe(root.scene);
    expect(a.parent).not.toBe(root.scene);
    expect(mgr.getActive()).toBe('b');
  });

  it('fires onActivate / onDeactivate hooks', () => {
    const root = makeFakeSceneRoot();
    const onActivate = vi.fn();
    const onDeactivate = vi.fn();
    const mgr = createHubManager(root, { onActivate, onDeactivate });
    const hub = new THREE.Group();

    mgr.register('home', hub);
    mgr.activate('home');
    expect(onActivate).toHaveBeenCalledWith('home', hub);

    mgr.deactivate('home');
    expect(onDeactivate).toHaveBeenCalledWith('home', hub);
    expect(hub.parent).not.toBe(root.scene);
    expect(mgr.getActive()).toBeNull();
  });

  it('deactivate runs userData.cleanup() on every descendant that exposes it', () => {
    const root = makeFakeSceneRoot();
    const mgr = createHubManager(root);
    const hub = new THREE.Group();
    const cleanups = { a: 0, b: 0 };
    const childA = new THREE.Mesh();
    childA.userData.cleanup = () => {
      cleanups.a += 1;
    };
    const childB = new THREE.Mesh();
    childB.userData.cleanup = () => {
      cleanups.b += 1;
    };
    hub.add(childA);
    hub.add(childB);

    mgr.register('home', hub);
    mgr.activate('home');
    mgr.deactivate('home');
    expect(cleanups).toEqual({ a: 1, b: 1 });
  });

  it('disposeHubGroup standalone helper invokes cleanup on all descendants', () => {
    const root = new THREE.Group();
    const child = new THREE.Mesh();
    let n = 0;
    child.userData.cleanup = () => {
      n += 1;
    };
    root.add(child);
    disposeHubGroup(root);
    expect(n).toBe(1);
  });
});
