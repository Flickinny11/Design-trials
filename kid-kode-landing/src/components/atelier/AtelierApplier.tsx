'use client';
// ORRERY No.7 — Atelier applier mount (F5.1).
// A headless R3F node mounted once inside the preview-app scene. It watches the
// configurator store and writes the chosen finishes onto the mounted proxy
// watch parts via their live material handles. Re-applies on every accepted
// change and shortly after (re)mount, so the configured look survives the
// AssembledSceneNode build effect resetting parts to their frozen spec.
import { useEffect } from 'react';
import { TextureLoader } from 'three';
import { useThree } from '@react-three/fiber';
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { applyConfiguratorToScene, applyConfiguratorText, applyConfiguratorReason } from '@/lib/prism/atelier/applier';
import { restoreSavedBuild } from '@/lib/prism/atelier/actions';

// Simple cached texture loader for live material swaps (F5.3).
const _texCache = new Map<string, Promise<import('three').Texture>>();
const _loader = new TextureLoader();
const configuratorLoader = {
  loadTexture(url: string): Promise<import('three').Texture> {
    if (!_texCache.has(url)) _texCache.set(url, _loader.loadAsync(url));
    return _texCache.get(url)!;
  },
};

const ATELIER_HUB_ID = 's6-atelier';

export function AtelierApplier({ previewMode }: { previewMode: boolean }) {
  const scene = useThree((s) => s.scene);

  // Rehydrate a previously saved build once, before the first apply.
  useEffect(() => {
    restoreSavedBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rev = useConfiguratorStore((s) => s.rev);
  const build = useConfiguratorStore((s) => s.build);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const lastReason = useConfiguratorStore((s) => s.lastReason);

  useEffect(() => {
    if (!previewMode || activeHubId !== ATELIER_HUB_ID) return;
    applyConfiguratorToScene(scene, build, configuratorLoader);
    // Cold-load: the atelier text nodes mount asynchronously (variable, ~2-6s after
    // the graph loads). Retry the price/summary write every 600ms until it lands so
    // the readout never lingers on its graph-authored placeholder ("CHF 38,000").
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Chrome controls (buttons + price plaque) sit just in front of the plaque and
    // were casting a ragged low-res shadow crescent onto it. UI chrome must not cast
    // or receive shadows — only the watch does. Disable it on every (re)apply.
    const muteChromeShadows = () => {
      scene.traverse((obj) => {
        const nid = (obj.userData as { nodeId?: string } | undefined)?.nodeId;
        if (!nid || !(nid.startsWith('orr-atelier-btn-') || nid === 'orr-atelier-panel-glass')) return;
        obj.traverse((c) => {
          const m = c as unknown as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
          if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; }
        });
      });
    };
    const tick = () => {
      applyConfiguratorToScene(scene, build, configuratorLoader);
      const wrote = applyConfiguratorText(scene, build);
      muteChromeShadows();
      tries += 1;
      // keep ticking until the price lands AND at least ~5s, so a late AssembledScene
      // rebuild can't re-enable chrome shadows behind us.
      if (tries < 20 && (!wrote || tries < 9)) timer = setTimeout(tick, 600);
    };
    tick();
    return () => { if (timer) clearTimeout(timer); };
    // rev is included so each accepted change re-applies; build is the payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, rev, activeHubId, previewMode]);

  // Constraint feedback changes independently of an accepted build change.
  useEffect(() => {
    if (!previewMode || activeHubId !== ATELIER_HUB_ID) return;
    applyConfiguratorReason(scene, lastReason);
  }, [scene, lastReason, activeHubId, previewMode]);

  return null;
}
