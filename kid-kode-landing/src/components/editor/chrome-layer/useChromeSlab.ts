'use client';

// PRISM EDITOR CHROME LAYER — DOM-side hook (UI-FIDELITY-2 W1).
//
// Attach to any chrome surface element:
//
//   const slab = useChromeSlab({ material: 'glass', radius: 16, accent: 1 });
//   <div ref={slab.ref} className="ds-glass ds-edge--metal …">
//
// At tier t2 with the GPU layer live, the element gets `.ds-slab-hosted`
// (materials.css suppresses its CSS background/frost/keyline — layout, text,
// shadow, and input all stay DOM) and the registered slab renders the REAL
// surface in the unified canvas behind it. Below t2 — or before the layer has
// ever come up — the hook is inert and the v1 Chrome-Arc CSS stands,
// per INV-9: same geometry, lighter physics, never broken.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { detectChromeTier } from '@/components/editor/design-system/tier';
import {
  getChromeSlabRegistry,
  type ChromeSlabHandle,
  type ChromeSlabOptions,
} from './registry';

export interface UseChromeSlabResult {
  /** Attach to the surface element. */
  ref: (el: HTMLElement | null) => void;
  /** Live style updates (e.g. accent on active state). */
  update: (patch: Partial<ChromeSlabOptions>) => void;
}

const HOST_CLASS = 'ds-slab-hosted';

export function useChromeSlab(options: ChromeSlabOptions): UseChromeSlabResult {
  const handleRef = useRef<ChromeSlabHandle | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;
  // Pending patches applied before the slab exists (e.g. accent set pre-t2).
  const pendingRef = useRef<Partial<ChromeSlabOptions>>({});

  const attach = useCallback((el: HTMLElement) => {
    const registry = getChromeSlabRegistry();
    const handle = registry.register(el, { ...optsRef.current, ...pendingRef.current });
    handleRef.current = handle;
    el.classList.add(HOST_CLASS);

    const onEnter = () => handle.setHover(true);
    const onLeave = () => {
      handle.setHover(false);
      handle.setPress(false);
    };
    const onDown = () => handle.setPress(true);
    const onUp = () => handle.setPress(false);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    (el as HTMLElement & { __slabCleanup?: () => void }).__slabCleanup = () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.classList.remove(HOST_CLASS);
      handle.release();
    };
  }, []);

  const detach = useCallback(() => {
    const el = elRef.current as (HTMLElement & { __slabCleanup?: () => void }) | null;
    el?.__slabCleanup?.();
    if (el) delete el.__slabCleanup;
    handleRef.current = null;
  }, []);

  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (elRef.current === el) return;
      detach();
      elRef.current = el;
      if (!el) return;
      if (detectChromeTier() !== 't2') return; // inert below t2 — CSS look stands

      const registry = getChromeSlabRegistry();
      if (registry.layerActive) {
        attach(el);
        return;
      }
      // Layer not up yet (canvas booting): poll briefly, attach when live.
      let alive = true;
      const tick = () => {
        if (!alive || elRef.current !== el) return;
        if (registry.layerActive) {
          attach(el);
        } else {
          setTimeout(tick, 250);
        }
      };
      setTimeout(tick, 250);
      (el as HTMLElement & { __slabPollStop?: () => void }).__slabPollStop = () => {
        alive = false;
      };
    },
    [attach, detach],
  );

  useEffect(() => () => detach(), [detach]);

  const update = useCallback((patch: Partial<ChromeSlabOptions>) => {
    Object.assign(pendingRef.current, patch);
    handleRef.current?.update(patch);
  }, []);

  return useMemo(() => ({ ref, update }), [ref, update]);
}
