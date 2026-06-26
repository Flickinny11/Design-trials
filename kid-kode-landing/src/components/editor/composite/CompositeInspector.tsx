'use client';

// CompositeInspector — the in-canvas, ZERO-DOM editor for the selected composite
// (spec §4.2 / §7). DOGFOODED from the library: a glass Pane primitive + worn-alloy
// CompositeChip buttons (the chassis vocabulary), on WebGPU.
//
// For the BOUND nav header it edits the binding (the live VIEW over the hub set):
//   • AUTO-ADD toggle — ON: new hubs auto-appear; OFF: frozen (§4.2.3).
//   • a tab readout — the resolved tabs, proving auto-populate one-per-hub.
//   • EXPAND MENU — runs the liquid-glass dropdown expand timeline (§3.3 / §4).
//   • (Wave-2 adds per-tab rename / reorder / hide + pin-manual rows.)
//   • REMOVE — delete the whole subgraph.
//
// Labels are MSDF (CompositeText) — WebGPU-safe, never Troika/ShaderMaterial/DOM.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { ClickCatcher } from '@/components/editor/primitive/ClickCatcher';
import { CompositeChip } from './CompositeChip';
import { CompositeText } from './CompositeText';
import { TabRow, type RowDesc } from './TabRow';
import { useCompositeStore } from './use-composite-store';
import { resolveNavTabs } from './composite-schema';

const INSPECTOR_X = 7.7;
const PW = 4.7;
const PH = 10.8;
const PANEL_DEPTH = 0.4;
const FRONT_Z = PANEL_DEPTH / 2;
const LABEL_Z = FRONT_Z - 0.06;
const KNOB_Z = FRONT_Z + 0.04;

function Panel() {
  const geo = useMemo(() => buildPaneGeometry({ width: PW, height: PH, depth: PANEL_DEPTH, cornerRadius: 0.3, bevel: 0.05, radius: 0, segments: 24, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} raycast={() => null}>
      <meshPhysicalMaterial
        transmission={1} thickness={0.6} ior={1.5} roughness={0.06} metalness={0}
        clearcoat={1} clearcoatRoughness={0.18} attenuationColor={'#dbe8f2'} attenuationDistance={1.9}
        envMapIntensity={1.05} specularIntensity={0.7} transparent
      />
    </mesh>
  );
}

export function CompositeInspector() {
  const maps = useWornMaps();
  const selectedId = useCompositeStore((s) => s.selectedId);
  const composite = useCompositeStore((s) => s.composites.find((c) => c.compositeId === s.selectedId));
  const hubs = useCompositeStore((s) => s.hubs);
  const toggleAutoAdd = useCompositeStore((s) => s.toggleAutoAdd);
  const toggleDropdown = useCompositeStore((s) => s.toggleDropdown);
  const addManualItem = useCompositeStore((s) => s.addManualItem);
  const removeComposite = useCompositeStore((s) => s.removeComposite);

  // P-5 composition ops (spec §6.1 / §6.4).
  const stackComposite = useCompositeStore((s) => s.stackComposite);
  const unstack = useCompositeStore((s) => s.unstack);
  const nudgeZLayer = useCompositeStore((s) => s.nudgeZLayer);
  const multiSelect = useCompositeStore((s) => s.multiSelect);
  const toggleMultiSelect = useCompositeStore((s) => s.toggleMultiSelect);
  const clearMultiSelect = useCompositeStore((s) => s.clearMultiSelect);
  const groupSelection = useCompositeStore((s) => s.groupSelection);
  const saveAsTemplate = useCompositeStore((s) => s.saveAsTemplate);

  const isNav = composite?.templateId === 'nav-header';
  const isStacked = !!composite?.parentCompositeId;
  const inMulti = composite ? multiSelect.includes(composite.compositeId) : false;
  const selCount = multiSelect.length;
  // the resolved tabs (visible — for the count readout) and the full editable row
  // list (every hub incl. hidden, so they can be un-hidden, plus pinned manuals).
  const tabs = useMemo(() => (composite?.binding ? resolveNavTabs(hubs, composite.binding) : []), [composite, hubs]);
  const rows: RowDesc[] = useMemo(() => {
    if (!composite?.binding) return [];
    const b = composite.binding;
    return [
      ...hubs.map((h) => ({ key: h.hubId, label: b.renames[h.hubId] ?? h.title, hubId: h.hubId, manual: false, hidden: b.hidden.includes(h.hubId) })),
      ...b.manualItems.map((m) => ({ key: `manual:${m.id}`, label: m.label, hubId: null, manualId: m.id, manual: true, hidden: false })),
    ];
  }, [composite, hubs]);

  // verification map (editor chrome — window access allowed). Exposes the WORLD
  // positions of every in-canvas control so a headless real-pointer pass can drive
  // the dogfooded inspector (project → click), not just call the store API.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_COMPOSITE_INSPECTOR_MAP__ = () => {
      const st = useCompositeStore.getState();
      const c = st.composites.find((x) => x.compositeId === st.selectedId);
      if (!c) return { open: false };
      const isNavC = c.templateId === 'nav-header';
      const rowsC = c.binding
        ? [
            ...st.hubs.map((h) => ({ key: h.hubId, hubId: h.hubId as string | null, manual: false, hidden: c.binding!.hidden.includes(h.hubId), label: c.binding!.renames[h.hubId] ?? h.title })),
            ...c.binding.manualItems.map((m) => ({ key: `manual:${m.id}`, hubId: null as string | null, manual: true, hidden: false, label: m.label })),
          ]
        : [];
      const TOPv = PH / 2 - 0.6;
      const tabsTopv = TOPv - 1.5;
      const rowStepv = 0.58;
      const actionsYv = tabsTopv - (isNavC ? rowsC.length : 0) * rowStepv - 0.7;
      const halfW = PW / 2;
      const chipX = [halfW - 1.62, halfW - 1.24, halfW - 0.86, halfW - 0.42];
      const rowWorld = rowsC.map((r, i) => {
        const y = tabsTopv - i * rowStepv;
        return { key: r.key, label: r.label, hubId: r.hubId, manual: r.manual, hidden: r.hidden, up: [INSPECTOR_X + chipX[0], y, KNOB_Z], down: [INSPECTOR_X + chipX[1], y, KNOB_Z], rename: [INSPECTOR_X + chipX[2], y, KNOB_Z], hideShow: [INSPECTOR_X + chipX[3], y, KNOB_Z] };
      });
      return {
        open: true,
        compositeId: c.compositeId,
        templateId: c.templateId,
        inspectorX: INSPECTOR_X,
        autoAdd: c.binding?.autoAdd ?? null,
        tabCount: c.binding ? resolveNavTabs(st.hubs, c.binding).length : 0,
        controls: isNavC
          ? {
              autoAdd: [INSPECTOR_X - 1.5, actionsYv, KNOB_Z],
              pinItem: [INSPECTOR_X - 0.1, actionsYv, KNOB_Z],
              menu: [INSPECTOR_X + 1.3, actionsYv, KNOB_Z],
              remove: [INSPECTOR_X, -PH / 2 + 0.7, KNOB_Z],
            }
          : { remove: [INSPECTOR_X, -PH / 2 + 0.7, KNOB_Z] },
        composition: {
          stack: [INSPECTOR_X - 1.62, -PH / 2 + 1.96, KNOB_Z],
          unstack: [INSPECTOR_X - 0.54, -PH / 2 + 1.96, KNOB_Z],
          zMinus: [INSPECTOR_X + 0.54, -PH / 2 + 1.96, KNOB_Z],
          zPlus: [INSPECTOR_X + 1.62, -PH / 2 + 1.96, KNOB_Z],
          stacked: !!c.parentCompositeId,
        },
        group: {
          select: [INSPECTOR_X - 1.62, -PH / 2 + 3.62, KNOB_Z],
          group: [INSPECTOR_X - 0.54, -PH / 2 + 3.62, KNOB_Z],
          save: [INSPECTOR_X + 0.54, -PH / 2 + 3.62, KNOB_Z],
          clear: [INSPECTOR_X + 1.62, -PH / 2 + 3.62, KNOB_Z],
          inSet: st.multiSelect.includes(c.compositeId),
          selCount: st.multiSelect.length,
        },
        rows: rowWorld,
      };
    };
    return () => { delete w.__PRISM_COMPOSITE_INSPECTOR_MAP__; };
  }, []);

  if (!composite) return null;

  const TOP = PH / 2 - 0.6;
  const tabsTop = TOP - 1.5;
  const rowStep = 0.58;
  const actionsY = tabsTop - (isNav ? rows.length : 0) * rowStep - 0.7;

  return (
    <group position={[INSPECTOR_X, 0, 0]}>
      <Panel />
      <ClickCatcher width={PW} height={PH} position={[0, 0, FRONT_Z]} />

      <CompositeText position={[0, TOP, LABEL_Z]} fontSize={0.24} letterSpacing={0.05} variant="bright">
        {composite.caption.toUpperCase()}
      </CompositeText>
      <CompositeText position={[0, TOP - 0.4, LABEL_Z]} fontSize={0.12} letterSpacing={0.2} variant="engraved">
        {`${composite.templateId.toUpperCase()} · SUBGRAPH`}
      </CompositeText>

      {isNav && composite.binding && (
        <>
          <CompositeText position={[0, TOP - 0.95, LABEL_Z]} fontSize={0.13} letterSpacing={0.06} variant="engraved">
            {`${tabs.length} TABS · BOUND TO ${hubs.length} PAGES`}
          </CompositeText>

          {/* per-tab editing rows (rename / reorder / hide / pin) */}
          {rows.map((r, i) => (
            <TabRow
              key={r.key}
              row={r}
              compositeId={composite.compositeId}
              maps={maps}
              y={tabsTop - i * rowStep}
              halfW={PW / 2}
              labelZ={LABEL_Z}
              knobZ={KNOB_Z}
            />
          ))}

          {/* global binding controls */}
          <group position={[-1.5, actionsY, 0]}>
            <CompositeChip maps={maps.emerald} position={[0, 0, KNOB_Z]} onClick={() => toggleAutoAdd(composite.compositeId)} active={composite.binding.autoAdd} label="AUTO-ADD" tint={composite.binding.autoAdd ? '#a9e6c4' : '#7d8a99'} size={0.52} />
          </group>
          <group position={[-0.1, actionsY, 0]}>
            <CompositeChip maps={maps.sapphire} position={[0, 0, KNOB_Z]} onClick={() => addManualItem(composite.compositeId)} label="PIN ITEM" tint="#a9d6ff" size={0.52} />
          </group>
          <group position={[1.3, actionsY, 0]}>
            <CompositeChip maps={maps.bronze} position={[0, 0, KNOB_Z]} onClick={() => toggleDropdown(composite.compositeId)} label="MENU" tint="#e6c79a" size={0.52} />
          </group>
        </>
      )}

      {/* ── P-5 GROUP + SAVE-AS-TEMPLATE (spec §6.4) — for any composite ── */}
      <CompositeText position={[0, -PH / 2 + 4.32, LABEL_Z]} fontSize={0.12} letterSpacing={0.14} variant="engraved">
        {selCount > 0 ? `GROUP · ${selCount} SELECTED` : 'GROUP + SAVE TEMPLATE'}
      </CompositeText>
      <group position={[-1.62, -PH / 2 + 3.62, 0]}>
        <CompositeChip maps={maps.sapphire} position={[0, 0, KNOB_Z]} onClick={() => toggleMultiSelect(composite.compositeId)} active={inMulti} label={inMulti ? 'IN SET' : '+ SELECT'} tint={inMulti ? '#a9e6c4' : '#bcd9ff'} size={0.5} />
      </group>
      <group position={[-0.54, -PH / 2 + 3.62, 0]}>
        <CompositeChip maps={maps.emerald} position={[0, 0, KNOB_Z]} onClick={() => groupSelection()} label="GROUP" tint="#9fe7c4" size={0.5} />
      </group>
      <group position={[0.54, -PH / 2 + 3.62, 0]}>
        <CompositeChip maps={maps.bronze} position={[0, 0, KNOB_Z]} onClick={() => saveAsTemplate()} label="SAVE" tint="#e6c79a" size={0.5} />
      </group>
      <group position={[1.62, -PH / 2 + 3.62, 0]}>
        <CompositeChip maps={maps.gunmetal} position={[0, 0, KNOB_Z]} onClick={() => clearMultiSelect()} label="CLEAR" tint="#aebfd2" size={0.5} />
      </group>

      {/* ── P-5 composition: stack / z-layer (spec §6.1) — for any composite ── */}
      <CompositeText position={[0, -PH / 2 + 2.66, LABEL_Z]} fontSize={0.12} letterSpacing={0.16} variant="engraved">
        {isStacked ? `COMPOSE · STACKED z${composite.zLayer ?? 0}` : 'COMPOSE'}
      </CompositeText>
      <group position={[-1.62, -PH / 2 + 1.96, 0]}>
        <CompositeChip maps={maps.sapphire} position={[0, 0, KNOB_Z]} onClick={() => stackComposite(composite.compositeId)} label="STACK" tint="#a9d6ff" size={0.5} />
      </group>
      <group position={[-0.54, -PH / 2 + 1.96, 0]}>
        <CompositeChip maps={maps.gunmetal} position={[0, 0, KNOB_Z]} onClick={() => unstack(composite.compositeId)} active={isStacked} label="UNSTACK" tint={isStacked ? '#cfe0ee' : '#7d8a99'} size={0.5} />
      </group>
      <group position={[0.54, -PH / 2 + 1.96, 0]}>
        <CompositeChip maps={maps.gunmetal} position={[0, 0, KNOB_Z]} onClick={() => nudgeZLayer(composite.compositeId, -1)} label="Z -" tint="#aebfd2" size={0.5} />
      </group>
      <group position={[1.62, -PH / 2 + 1.96, 0]}>
        <CompositeChip maps={maps.gunmetal} position={[0, 0, KNOB_Z]} onClick={() => nudgeZLayer(composite.compositeId, 1)} label="Z +" tint="#cfd8e2" size={0.5} />
      </group>

      <group position={[0, -PH / 2 + 0.7, 0]}>
        <CompositeChip maps={maps.oxblood} position={[0, 0, KNOB_Z]} onClick={() => removeComposite(composite.compositeId)} label="REMOVE" tint="#e29aa6" size={0.52} />
      </group>
    </group>
  );
}
