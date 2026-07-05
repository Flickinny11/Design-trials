'use client';

// PRISM WORKSPACE COMPLETION — W-2 DATA section (criteria C3).
//
// A node can own a DATA/BACKEND model: a logical NAME, a typed STATE schema
// (fields the node owns, k:type), and a PERSISTENCE binding wired from the
// capability catalog (a db/storage provider — Supabase table, Cloudflare R2
// bucket, …). The binding carries a capability REFERENCE only (INV-W7) — never a
// raw secret — and is validated on select (a status pip). Every edit writes the
// LIVE app graph (dataModel) and round-trips through save/reload. ZERO DOM.
// Editor CHROME.

import { useEffect, useMemo, useRef } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useEditorShellStore } from './use-editor-shell-store';
import { useNodeEditorStore } from './use-node-editor-store';
import { GlassTextField } from './editor-text-field';
import { BrandTile } from './editor-brand-tile';
import { useCapabilityStore } from './use-capability-store';
import type { PrismDataField, IntegrationAuthMethod, FunctionTileValidationStatus } from '@/lib/prism-graph/types';
import type { PlatformDescriptor } from '@/lib/capabilities/provider';

const MAX_PLATFORMS = 3;

function fieldsToCsv(fields: PrismDataField[] | undefined): string {
  return (fields ?? []).map((f) => `${f.name}:${f.type}`).join(', ');
}
function csvToFields(s: string): PrismDataField[] {
  const out: PrismDataField[] = [];
  for (const pair of s.split(',')) {
    const t = pair.trim();
    if (!t) continue;
    const i = t.indexOf(':');
    const name = (i < 0 ? t : t.slice(0, i)).trim();
    const type = (i < 0 ? 'string' : t.slice(i + 1).trim()) || 'string';
    if (name) out.push({ name, type });
  }
  return out;
}
function pipFor(s?: FunctionTileValidationStatus): string {
  switch (s) {
    case 'valid': return '#5fce8e';
    case 'fixed': return '#9ed27a';
    case 'broken': return '#e0795f';
    case 'validating': return '#d9b878';
    default: return '#5a6675';
  }
}
function badgeFor(s?: FunctionTileValidationStatus): string {
  return s === 'valid' ? 'VALID' : s === 'fixed' ? 'BOUND' : s === 'broken' ? 'CHECK' : s === 'validating' ? 'TESTING' : 'UNTESTED';
}

// a small clickable glass chip (bind / validate / resource).
function ActionChip({ position, label, width = 0.7, tint = '#2a4a3a', onClick }: { position: [number, number, number]; label: string; width?: number; tint?: string; onClick: () => void }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a2433', emissive: new THREE.Color(tint), emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.3 }), [tint]);
  return (
    <group position={position}>
      <mesh material={mat} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}>
        <boxGeometry args={[width, 0.2, 0.05]} />
      </mesh>
      <CompositeText position={[0, 0, 0.04]} fontSize={0.062} variant="bright">{label}</CompositeText>
    </group>
  );
}

export function EditorDataTab({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const dataPlatforms = useCapabilityStore((s) => s.dataPlatforms);
  const dataQuery = useCapabilityStore((s) => s.dataQuery);
  const assetsByPlatform = useCapabilityStore((s) => s.assetsByPlatform);
  const focusedFieldId = useNodeEditorStore((s) => s.focusedFieldId);
  const buffer = useNodeEditorStore((s) => s.buffer);

  const dataModel = useGraphSourceStore((s) =>
    selectedId ? s.nodes.find((n) => n.nodeId === selectedId)?.dataModel ?? null : null,
  );

  useEffect(() => {
    if (dataPlatforms.length === 0) void useCapabilityStore.getState().searchDataPlatforms('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastSearched = useRef<string | null>(null);
  useEffect(() => {
    if (focusedFieldId !== 'cap:data-search') return;
    if (lastSearched.current === buffer) return;
    lastSearched.current = buffer;
    void useCapabilityStore.getState().searchDataPlatforms(buffer);
  }, [buffer, focusedFieldId]);

  const persistence = dataModel?.persistence;
  const resources = persistence ? (assetsByPlatform[persistence.platformId] ?? []) : [];

  return (
    <group position={position}>
      {/* model name */}
      <CompositeText position={[-1.3, 3.34, 0.32]} fontSize={0.082} anchorX="left" variant="bright">
        DATA MODEL
      </CompositeText>
      <GlassTextField
        id="cap:data-name"
        label="MODEL NAME"
        value={dataModel?.name ?? ''}
        onCommit={(v) => useCapabilityStore.getState().setDataModelName(v)}
        position={[0, 3.0, 0]}
        width={2.55}
        tint="#d6b8ff"
        placeholder="e.g. signups"
      />

      {/* state fields */}
      <CompositeText position={[-1.3, 2.5, 0.32]} fontSize={0.078} anchorX="left" variant="bright">
        STATE FIELDS
      </CompositeText>
      <GlassTextField
        id="cap:data-fields"
        label="FIELDS (name:type, …)"
        value={fieldsToCsv(dataModel?.fields)}
        onCommit={(v) => useCapabilityStore.getState().setDataFields(csvToFields(v))}
        position={[0, 2.18, 0]}
        width={2.55}
        tint="#9fe7c4"
        placeholder="email:string, createdAt:timestamp"
      />
      {(dataModel?.fields ?? []).slice(0, 3).map((f, i) => (
        <CompositeText key={f.name + i} position={[-1.3, 1.78 - i * 0.18, 0.32]} fontSize={0.062} anchorX="left" variant="engraved">
          {`• ${f.name} : ${f.type}`}
        </CompositeText>
      ))}

      {/* persistence binding */}
      <CompositeText position={[-1.3, 1.0, 0.32]} fontSize={0.078} anchorX="left" variant="bright">
        PERSISTENCE
      </CompositeText>
      {!persistence && (
        <>
          <GlassTextField
            id="cap:data-search"
            label="WIRE A DATABASE / STORAGE"
            value={dataQuery}
            onCommit={(v) => void useCapabilityStore.getState().searchDataPlatforms(v)}
            position={[0, 0.68, 0]}
            width={2.55}
            tint="#9fd0ff"
            placeholder="supabase · cloudflare · airtable…"
            seedEmpty
          />
          {dataPlatforms.slice(0, MAX_PLATFORMS).map((p, i) => {
            const y = 0.28 - i * 0.34;
            const kind = p.category === 'Infra' ? 'bucket' : 'table';
            return (
              <group key={p.platformId}>
                <BrandTile
                  data={{ brandKey: p.brandKey, label: p.platform, subtitle: `${kind} · ${(p.description ?? '').slice(0, 22)}` }}
                  position={[-0.18, y, 0]}
                  width={2.0}
                  onClick={() => void useCapabilityStore.getState().bindPersistence(p as PlatformDescriptor, p.authMethods[0] as IntegrationAuthMethod, kind)}
                />
                <ActionChip position={[1.12, y, 0.2]} label="BIND" width={0.5} onClick={() => void useCapabilityStore.getState().bindPersistence(p as PlatformDescriptor, p.authMethods[0] as IntegrationAuthMethod, kind)} />
              </group>
            );
          })}
        </>
      )}
      {persistence && (
        <>
          <BrandTile
            data={{
              brandKey: persistence.brandKey,
              label: `${persistence.platform} · ${persistence.kind}`,
              subtitle: `${persistence.resource ? persistence.resource + ' · ' : ''}ref ${(persistence.capabilityRef?.refId ?? '').slice(0, 10)}… · NO TOKEN`,
              badge: badgeFor(dataModel?.validation?.status),
            }}
            position={[-0.18, 0.68, 0]}
            width={2.1}
            pip={pipFor(dataModel?.validation?.status)}
          />
          <ActionChip position={[1.18, 0.68, 0.2]} label="X" width={0.2} tint="#5a1f1f" onClick={() => useCapabilityStore.getState().unbindPersistence()} />
          <ActionChip position={[-0.7, 0.36, 0.2]} label="VALIDATE" width={0.9} onClick={() => void useCapabilityStore.getState().validateDataBinding()} />
          {/* pick a concrete resource from the user's saved assets */}
          {resources.slice(0, 3).map((r, i) => (
            <ActionChip
              key={r.id}
              position={[0, 0.04 - i * 0.24, 0.2]}
              label={`${persistence.resource === r.name ? '* ' : ''}${r.name}`.slice(0, 22)}
              width={1.9}
              tint={persistence.resource === r.name ? '#1f6b3f' : '#1a2433'}
              onClick={() => useCapabilityStore.getState().bindPersistenceResource(r.name)}
            />
          ))}
        </>
      )}
    </group>
  );
}
