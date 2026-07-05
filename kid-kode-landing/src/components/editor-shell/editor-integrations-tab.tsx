'use client';

// PRISM WORKSPACE COMPLETION — W-2 INTEGRATIONS section (criteria D3).
//
// Search a platform → ONE-CLICK auth via a chosen method (OAuth 2.1 / MCP / API
// token / CLI) brokered by the active CapabilityProvider's MANAGED auth. Prism
// stores a capability REFERENCE only — never a raw token (INV-W7); the connected
// row shows the opaque ref id + a green lock pip + "no token". Once connected the
// user's saved assets self-populate as addable tiles. Every connect/detach/asset
// write goes to the LIVE app graph (integrationRefs) and round-trips through
// save/reload. ZERO DOM (the provider's own hosted OAuth popup — activated with
// the live Nango path — is the single allowed exception; the offline reference
// path stores the ref directly). Editor CHROME.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useEditorShellStore } from './use-editor-shell-store';
import { useNodeEditorStore } from './use-node-editor-store';
import { GlassTextField } from './editor-text-field';
import { BrandTile } from './editor-brand-tile';
import { useCapabilityStore } from './use-capability-store';
import type { IntegrationAuthMethod, IntegrationAsset } from '@/lib/prism-graph/types';
import type { PlatformDescriptor } from '@/lib/capabilities/provider';

const MAX_PLATFORMS = 3;
const MAX_CONNECTED = 3;
const ROW_H = 0.42;

const METHOD_LABEL: Record<IntegrationAuthMethod, string> = {
  'oauth2.1': 'OAUTH',
  mcp: 'MCP',
  'api-token': 'TOKEN',
  cli: 'CLI',
};

// a small clickable glass method chip (one-click auth). Tagged with userData so
// the headless near-human pass can trusted-click it.
function MethodChip({ position, label, tag, onClick }: { position: [number, number, number]; label: string; tag: string; onClick: () => void }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a2433', emissive: new THREE.Color('#2a4a3a'), emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.3 }), []);
  return (
    <group position={position}>
      <mesh material={mat} userData={{ prismIntMethod: tag }} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}>
        <boxGeometry args={[0.46, 0.18, 0.05]} />
      </mesh>
      <CompositeText position={[0, 0, 0.04]} fontSize={0.062} variant="bright">{label}</CompositeText>
    </group>
  );
}

// a small addable saved-asset tile.
function AssetChip({ position, asset, added, onToggle }: { position: [number, number, number]; asset: IntegrationAsset; added: boolean; onToggle: () => void }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: added ? '#14321f' : '#0d141d', emissive: new THREE.Color(added ? '#1f6b3f' : '#05070c').multiplyScalar(added ? 0.4 : 1), roughness: 0.55, metalness: 0.2 }), [added]);
  return (
    <group position={position}>
      <mesh material={mat} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onToggle(); }}>
        <boxGeometry args={[1.7, 0.2, 0.05]} />
      </mesh>
      <CompositeText position={[-0.8, 0, 0.04]} fontSize={0.06} anchorX="left" variant={added ? 'bright' : 'engraved'}>
        {`${added ? '* ' : '+ '}${asset.name}`.slice(0, 30)}
      </CompositeText>
      <CompositeText position={[0.8, 0, 0.04]} fontSize={0.05} anchorX="right" variant="engraved">
        {(asset.detail ?? asset.kind).slice(0, 12)}
      </CompositeText>
    </group>
  );
}

export function EditorIntegrationsTab({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const platforms = useCapabilityStore((s) => s.intPlatforms);
  const live = useCapabilityStore((s) => s.intLive);
  const intQuery = useCapabilityStore((s) => s.intQuery);
  const connecting = useCapabilityStore((s) => s.connecting);
  const assetsByPlatform = useCapabilityStore((s) => s.assetsByPlatform);
  const focusedFieldId = useNodeEditorStore((s) => s.focusedFieldId);
  const buffer = useNodeEditorStore((s) => s.buffer);

  const refs = useGraphSourceStore((s) => {
    const n = selectedId ? s.nodes.find((x) => x.nodeId === selectedId) : null;
    return n?.integrationRefs ?? EMPTY;
  });
  const ordered = useMemo(() => refs.slice().sort((a, b) => a.order - b.order), [refs]);

  useEffect(() => {
    if (platforms.length === 0) void useCapabilityStore.getState().searchPlatforms('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastSearched = useRef<string | null>(null);
  useEffect(() => {
    if (focusedFieldId !== 'cap:int-search') return;
    if (lastSearched.current === buffer) return;
    lastSearched.current = buffer;
    void useCapabilityStore.getState().searchPlatforms(buffer);
  }, [buffer, focusedFieldId]);

  const connectedIds = new Set(ordered.map((r) => r.platformId));

  return (
    <group position={position}>
      <GlassTextField
        id="cap:int-search"
        label="CONNECT A PLATFORM"
        value={intQuery}
        onCommit={(v) => void useCapabilityStore.getState().searchPlatforms(v)}
        position={[0, 3.05, 0]}
        width={2.55}
        tint="#9fe7c4"
        placeholder="supabase · github · runpod · stripe…"
        seedEmpty
      />
      <CompositeText position={[1.18, 3.34, 0.32]} fontSize={0.062} anchorX="right" variant="engraved">
        {live ? 'LIVE' : 'REF'}
      </CompositeText>

      <CompositeText position={[-1.3, 2.62, 0.32]} fontSize={0.082} anchorX="left" variant="bright">
        PLATFORMS
      </CompositeText>
      {platforms.slice(0, MAX_PLATFORMS).map((p, i) => {
        const y = 2.3 - i * 0.56;
        const methods = p.authMethods.slice(0, 3);
        return (
          <group key={p.platformId}>
            <BrandTile
              data={{ brandKey: p.brandKey, label: p.platform, subtitle: (p.description ?? '').slice(0, 30) }}
              position={[0, y, 0]}
              width={2.5}
              dim={connectedIds.has(p.platformId)}
              pip={connectedIds.has(p.platformId) ? '#5fce8e' : undefined}
            />
            {/* one-click auth method chips */}
            {methods.map((m, mi) => (
              <MethodChip
                key={m}
                position={[-1.05 + mi * 0.52, y - 0.21, 0.2]}
                label={connecting === p.platformId ? '…' : METHOD_LABEL[m]}
                tag={`${p.platformId}:${m}`}
                onClick={() => void useCapabilityStore.getState().connectIntegration(p as PlatformDescriptor, m)}
              />
            ))}
          </group>
        );
      })}

      <CompositeText position={[-1.3, 0.55, 0.32]} fontSize={0.082} anchorX="left" variant="bright">
        {`CONNECTED (${ordered.length})`}
      </CompositeText>
      {ordered.length === 0 && (
        <CompositeText position={[0, 0.25, 0.32]} fontSize={0.066} variant="engraved">
          SEARCH A PLATFORM + ONE-CLICK CONNECT
        </CompositeText>
      )}
      {ordered.slice(0, MAX_CONNECTED).map((r, i) => {
        const avail = assetsByPlatform[r.platformId] ?? [];
        const addedIds = new Set((r.assets ?? []).map((a) => a.id));
        const baseY = 0.2 - i * 0.86;
        return (
          <group key={r.id}>
            <BrandTile
              data={{
                brandKey: r.contentIcon?.brandKey ?? r.platformId,
                label: r.platform,
                subtitle: `${METHOD_LABEL[r.authMethod]} · ref ${(r.capabilityRef?.refId ?? '').slice(0, 12)}… · NO TOKEN`,
              }}
              position={[-0.18, baseY, 0]}
              width={2.1}
              pip="#5fce8e"
            />
            <MiniButton position={[1.18, baseY, 0.2]} kind="x" tint="#e0795f" onClick={() => useCapabilityStore.getState().detachIntegration(r.id)} />
            {/* saved assets (self-populated) — click to add/remove */}
            {avail.slice(0, 2).map((a, ai) => (
              <AssetChip
                key={a.id}
                position={[-0.18, baseY - 0.26 - ai * 0.24, 0.05]}
                asset={a}
                added={addedIds.has(a.id)}
                onToggle={() => {
                  if (addedIds.has(a.id)) useCapabilityStore.getState().removeIntegrationAsset(r.id, a.id);
                  else useCapabilityStore.getState().addIntegrationAsset(r.id, a);
                }}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

// reuse the Functions tab's mini control (▲▼✕) — re-declared locally to avoid a
// cross-file import cycle; same worn-glass idiom.
function MiniButton({ position, kind, tint = '#cdd6e2', onClick }: { position: [number, number, number]; kind: 'x'; tint?: string; onClick: () => void }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#10161f', emissive: new THREE.Color(tint).multiplyScalar(0.05), roughness: 0.55, metalness: 0.3 }), [tint]);
  const sym = useMemo(() => new THREE.MeshBasicMaterial({ color: tint, toneMapped: false }), [tint]);
  void kind;
  return (
    <group position={position}>
      <mesh material={mat} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}>
        <boxGeometry args={[0.18, 0.18, 0.06]} />
      </mesh>
      <group position={[0, 0, 0.05]} rotation={[0, 0, Math.PI / 4]}>
        <mesh material={sym}><boxGeometry args={[0.11, 0.022, 0.01]} /></mesh>
        <mesh material={sym}><boxGeometry args={[0.022, 0.11, 0.01]} /></mesh>
      </group>
    </group>
  );
}

const EMPTY: never[] = [];
