// nav-chrome — the navigation CHROME primitives (§13 NAVIGATION + APP-REALITY
// P8): preconfigured, selectable, droppable, fully-customizable VISUAL nav
// elements — a HEADER bar, a FOOTER, a DROPDOWN menu, and a vertical MENU list.
// Observatory-Brass (brass/gold + ice/steel + charcoal glass — NO purple),
// premium, built entirely from real editable PrismNode members (recolor /
// re-skin / re-text / re-bind / move any member post-place). Text is real MSDF
// (INV-11). Their VISUAL design is Canvas scope; their click TARGETS are bound
// via the Function action / node editor (P7) — these are the chrome, not the
// behaviour. Photoreal surface is procedural PBR + IBL (free) — no fal imagery.
//
// Mobile-aware: every member is an ordinary node, so once placed each carries
// the P5 `responsiveScenePos` device-layout system; the bars are authored at a
// scale that reads on a phone (a header reflows / a footer stacks via device
// overrides). T1 full-fidelity, clean T0 fallback (INV-9).

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition, MaterialSpec, TextSpec } from '@/lib/prism-graph/types';

function pose(x: number, y: number, z: number, s = 1): ScenePosition {
  return { x, y, z, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: s, scaleY: s, scaleZ: s };
}

// Dark machined-glass slab (the bar / panel substrate) + a warm brass variant.
const GLASS: MaterialSpec = {
  baseColor: '#12161d', metalness: 0.28, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.18,
  opacity: 0.9, envMapIntensity: 1.1,
};
const BRASS: MaterialSpec = {
  baseColor: '#c9a86a', metalness: 0.95, roughness: 0.3, clearcoat: 0.4, emissive: '#5a4520', emissiveIntensity: 0.12,
};
const BRASS_LINE: MaterialSpec = { baseColor: '#ddba77', metalness: 0.9, roughness: 0.35, emissive: '#c9a86a', emissiveIntensity: 0.5 };

function bar(localId: string, caption: string, w: number, h: number, p: ScenePosition, mat: MaterialSpec): ClusterMemberTemplate {
  return {
    localId, subtype: 'nav-surface', serviceTag: 'decor', caption, renderMode: 'mesh', pose: p,
    footprint: { width: w, height: h }, meshPrimitive: { kind: 'plane', params: { width: w, height: h } },
    materialSpec: mat, receivesLighting: true, depthLayer: 'foreground-FX',
  };
}
function label(localId: string, caption: string, content: string, p: ScenePosition, opts?: Partial<TextSpec> & { w?: number }): ClusterMemberTemplate {
  const { w, ...textOverrides } = opts ?? {};
  return {
    localId, subtype: 'text', serviceTag: 'decor', caption, renderMode: 'text', pose: p,
    footprint: { width: w ?? 1.2, height: 0.3 },
    textSpec: { content, fontFamily: 'Inter', fontWeight: 500, fontSize: 0.17, align: 'center', fill: { kind: 'solid', color: '#d7dbe6' }, decompose: 'glyph', ...textOverrides },
  };
}
const BRASS_FILL: TextSpec['fill'] = { kind: 'gradient', from: '#f3e2b4', to: '#c9a86a', angleDeg: 12 };

// ── 1. HEADER — a brass app/site header bar ─────────────────────────────────
const NAV_ITEMS = ['Work', 'Studio', 'Journal', 'About'];
const navHeaderBar: ElementClusterDefinition = {
  id: 'nav-header-bar', label: 'Header bar', category: 'navigation',
  caption: 'A premium app header — logo, nav links, and a brass CTA pill on a machined-glass bar.',
  description: 'Site/app header: logo + nav links + CTA on a brass-edged glass bar.',
  members: [
    bar('bar', 'Header glass bar', 7.4, 0.62, pose(0, 0, -0.06), GLASS),
    bar('underline', 'Brass underline', 7.4, 0.018, pose(0, -0.31, -0.04), BRASS_LINE),
    label('logo', 'Logo wordmark', 'PRISM', pose(-3.15, 0, 0.05), { fontSize: 0.26, fontWeight: 800, letterSpacing: 0.04, fill: BRASS_FILL, align: 'left', w: 1.4 }),
    ...NAV_ITEMS.map((t, i) => label(`item-${i}`, `Nav item ${t}`, t, pose(-0.7 + i * 0.95, 0, 0.05), { fontSize: 0.165, fill: { kind: 'solid', color: i === 0 ? '#f3e2b4' : '#c2c8d4' } })),
    bar('cta', 'CTA pill', 1.2, 0.36, pose(3.05, 0, 0.02), BRASS),
    label('cta-text', 'CTA label', 'Get started', pose(3.05, 0, 0.06), { fontSize: 0.14, fontWeight: 600, fill: { kind: 'solid', color: '#241a0c' } }),
  ],
  preview: { camera: { distance: 5.4, polar: Math.PI / 2.1, azimuth: 0 }, frozenPhase: 0.45, tier: 'T1' },
  designRefs: ['PBR clearcoat metal', 'machined-glass chrome', 'kinetic MSDF typography'],
  tier: 'T1', featured: true,
};

// ── 2. FOOTER — a multi-column footer ───────────────────────────────────────
const FOOTER_COLS: { head: string; items: string[] }[] = [
  { head: 'Product', items: ['Editor', 'Runtime', 'Library'] },
  { head: 'Company', items: ['About', 'Careers', 'Press'] },
  { head: 'Legal', items: ['Terms', 'Privacy', 'Status'] },
];
const navFooter: ElementClusterDefinition = {
  id: 'nav-footer', label: 'Footer', category: 'navigation',
  caption: 'A premium footer — brand mark, three link columns, and a baseline on a glass slab.',
  description: 'Multi-column footer: brand + link columns + baseline tagline.',
  members: [
    bar('slab', 'Footer glass slab', 7.4, 1.7, pose(0, 0, -0.06), GLASS),
    bar('hair', 'Top hairline', 7.4, 0.014, pose(0, 0.78, -0.04), BRASS_LINE),
    label('brand', 'Brand mark', 'PRISM', pose(-3.05, 0.5, 0.05), { fontSize: 0.24, fontWeight: 800, fill: BRASS_FILL, align: 'left', w: 1.2 }),
    label('brand-sub', 'Brand line', 'The 3D app builder', pose(-3.05, 0.18, 0.05), { fontSize: 0.12, fill: { kind: 'solid', color: '#8b93a4' }, align: 'left', w: 2 }),
    ...FOOTER_COLS.flatMap((c, ci) => {
      const x = -0.2 + ci * 1.7;
      return [
        label(`h-${ci}`, `Footer head ${c.head}`, c.head, pose(x, 0.55, 0.05), { fontSize: 0.13, fontWeight: 700, letterSpacing: 0.08, fill: { kind: 'solid', color: '#ecd49d' } }),
        ...c.items.map((it, ii) => label(`i-${ci}-${ii}`, `Footer link ${it}`, it, pose(x, 0.22 - ii * 0.28, 0.05), { fontSize: 0.125, fill: { kind: 'solid', color: '#aeb6c8' } })),
      ];
    }),
    label('baseline', 'Baseline', '© 2026 Prism · Designed in the Observatory', pose(0, -0.72, 0.05), { fontSize: 0.11, fill: { kind: 'solid', color: '#6b7385' } }),
  ],
  preview: { camera: { distance: 5.6, polar: Math.PI / 2.1, azimuth: 0 }, frozenPhase: 0.45, tier: 'T1' },
  designRefs: ['machined-glass chrome', 'kinetic MSDF typography'],
  tier: 'T1',
};

// ── 3. DROPDOWN — a trigger + a floating menu panel ─────────────────────────
const DROPDOWN_ITEMS = ['Editor', 'Runtime', 'Library', 'Pricing'];
const navDropdown: ElementClusterDefinition = {
  id: 'nav-dropdown', label: 'Dropdown menu', category: 'navigation',
  caption: 'A nav dropdown — a brass trigger and a floating glass menu panel with selectable items.',
  description: 'Dropdown: a trigger pill + a glass panel of menu items.',
  members: [
    bar('trigger', 'Trigger pill', 1.5, 0.42, pose(0, 1.15, 0.02), BRASS),
    label('trigger-text', 'Trigger label', 'Products  ▾', pose(0, 1.15, 0.06), { fontSize: 0.155, fontWeight: 600, fill: { kind: 'solid', color: '#241a0c' } }),
    bar('panel', 'Menu panel', 1.9, 1.55, pose(0, 0.05, -0.04), GLASS),
    bar('panel-edge', 'Panel brass edge', 1.9, 0.012, pose(0, 0.82, -0.02), BRASS_LINE),
    ...DROPDOWN_ITEMS.map((t, i) => label(`d-${i}`, `Dropdown item ${t}`, t, pose(0, 0.55 - i * 0.32, 0.05), { fontSize: 0.15, fill: { kind: 'solid', color: i === 0 ? '#f3e2b4' : '#c2c8d4' }, align: 'left', w: 1.4 })),
    bar('hilite', 'Active highlight', 1.7, 0.3, pose(0, 0.55, -0.02), { ...BRASS, opacity: 0.16, emissiveIntensity: 0.06 }),
  ],
  preview: { camera: { distance: 3.6, polar: Math.PI / 2.05, azimuth: 0 }, frozenPhase: 0.45, tier: 'T1' },
  designRefs: ['machined-glass chrome', 'kinetic MSDF typography', 'PBR clearcoat metal'],
  tier: 'T1',
};

// ── 4. MENU — a vertical menu / command list ────────────────────────────────
const MENU_ITEMS = ['Home', 'Galaxy', 'Canvas', 'Preview', 'Settings'];
const navMenuList: ElementClusterDefinition = {
  id: 'nav-menu-list', label: 'Menu list', category: 'navigation',
  caption: 'A vertical menu / command list — a glass panel with an active brass row and item glyphs.',
  description: 'Vertical menu: glass panel + active row + 5 items with glyphs.',
  members: [
    bar('panel', 'Menu panel', 1.9, 2.5, pose(0, 0, -0.06), GLASS),
    bar('edge', 'Panel edge', 0.014, 2.5, pose(-0.94, 0, -0.04), BRASS_LINE),
    label('title', 'Menu title', 'MENU', pose(0, 1.0, 0.05), { fontSize: 0.13, fontWeight: 700, letterSpacing: 0.16, fill: { kind: 'solid', color: '#8b93a4' } }),
    bar('active', 'Active row', 1.7, 0.34, pose(0, 0.58, -0.02), { ...BRASS, opacity: 0.18, emissiveIntensity: 0.08 }),
    ...MENU_ITEMS.map((t, i) => label(`m-${i}`, `Menu item ${t}`, t, pose(-0.05, 0.58 - i * 0.34, 0.05), { fontSize: 0.15, fill: { kind: 'solid', color: i === 0 ? '#f3e2b4' : '#c2c8d4' }, align: 'left', w: 1.4 })),
    ...MENU_ITEMS.map((t, i) => ({
      localId: `dot-${i}`, subtype: 'nav-surface', serviceTag: 'decor', caption: `Menu glyph ${t}`, renderMode: 'mesh' as const,
      pose: pose(-0.72, 0.58 - i * 0.34, 0.05), footprint: { width: 0.1, height: 0.1 },
      meshPrimitive: { kind: 'sphere' as const, params: { radius: 0.04 } },
      materialSpec: i === 0 ? BRASS : { baseColor: '#5a6273', metalness: 0.6, roughness: 0.4 }, receivesLighting: true,
    })),
  ],
  preview: { camera: { distance: 4.2, polar: Math.PI / 2.05, azimuth: 0 }, frozenPhase: 0.45, tier: 'T1' },
  designRefs: ['machined-glass chrome', 'kinetic MSDF typography'],
  tier: 'T1',
};

registerElement(navHeaderBar);
registerElement(navFooter);
registerElement(navDropdown);
registerElement(navMenuList);
