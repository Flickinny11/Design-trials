'use client';

// PRISM EDITOR DESIGN SYSTEM — token sheet (/design-system).
// The rendered, screenshot-able contract for Wave 0: every palette ramp,
// surface material, edge, elevation, control, and motion treatment that
// component waves are allowed to use. If a treatment isn't on this sheet,
// it isn't in the system.

import { useEffect } from 'react';
import {
  DS,
  DS_DIFFICULTY,
  RefractionDefs,
  ensureChromeTier,
  useTilt,
} from '@/components/editor/design-system';

const NEUTRALS: [string, string][] = [
  ['void', DS.void],
  ['ink', DS.ink],
  ['charcoal', DS.charcoal],
  ['graphite', DS.graphite],
  ['slate', DS.slate],
  ['steel', DS.steel],
];
const BRASS: [string, string][] = [
  ['100', DS.brass100],
  ['200', DS.brass200],
  ['300', DS.brass300],
  ['400', DS.brass400],
  ['500', DS.brass500],
  ['600', DS.brass600],
  ['700', DS.brass700],
];
const ICE: [string, string][] = [
  ['200', DS.ice200],
  ['300', DS.ice300],
  ['400', DS.ice400],
  ['500', DS.ice500],
];
const STATUS: [string, string][] = [
  ['ok', DS.ok],
  ['warn', DS.warn],
  ['danger', DS.danger],
  ['neutral', DS.neutral],
];

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-14 h-14 rounded-ds-sm ds-elev-1"
        style={{ background: `linear-gradient(165deg, ${hex}, ${hex})` }}
      />
      <span className="ds-kicker">{name}</span>
      <span className="text-[8px] font-mono text-ds-text-low">{hex}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="ds-label text-ds-brass-300">{title}</h2>
      {children}
    </section>
  );
}

function TiltCard() {
  const ref = useTilt<HTMLDivElement>({ max: 4 });
  return (
    <div
      ref={ref}
      className="ds-ceramic ds-edge w-44 h-28 flex items-center justify-center"
      data-demo="tilt"
    >
      <span className="ds-label">pointer tilt</span>
    </div>
  );
}

export default function DesignSystemSheet() {
  useEffect(() => {
    ensureChromeTier();
  }, []);

  return (
    <div
      className="min-h-screen w-full overflow-y-auto px-10 py-8 flex flex-col gap-10"
      style={{ background: 'var(--ds-void)', color: 'var(--ds-text)' }}
      data-component="ds-token-sheet"
    >
      <RefractionDefs />

      {/* Backdrop interest so glass has something to refract on this sheet */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div
          className="absolute -top-24 left-1/4 w-[480px] h-[480px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(205,159,85,0.5), transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-10 w-[420px] h-[420px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(125,159,180,0.55), transparent 70%)' }}
        />
        <div className="star-field absolute inset-0 opacity-50" />
      </div>

      <header className="relative flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <span className="ds-kicker">prism editor · wave 0 · frozen contract</span>
          <h1 className="ds-title ds-title-brass text-[26px]">Observatory Brass — Design Tokens</h1>
        </div>
        <span className="ds-chip ds-chip--brass">no purple · no flat fills</span>
      </header>

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Section title="Palette — graphite housing · brass fittings · ice telemetry">
          <div className="flex flex-wrap gap-4">{NEUTRALS.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}</div>
          <div className="flex flex-wrap gap-4">{BRASS.map(([n, h]) => <Swatch key={n} name={`brass ${n}`} hex={h} />)}</div>
          <div className="flex flex-wrap gap-4">
            {ICE.map(([n, h]) => <Swatch key={n} name={`ice ${n}`} hex={h} />)}
            {STATUS.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}
          </div>
          <div
            className="h-10 rounded-ds-sm ds-elev-1"
            style={{ background: 'var(--ds-grad-brass)' }}
            data-demo="brass-ramp"
          />
        </Section>

        <Section title="Surface materials">
          <div className="grid grid-cols-2 gap-5">
            <div className="ds-glass ds-edge h-36 p-4 flex flex-col justify-between" data-demo="glass">
              <span className="ds-label">frosted glass</span>
              <span className="text-[10px] font-mono text-ds-text-low">frost · chamfer · elev-2</span>
            </div>
            <div className="ds-glass ds-glass--refract ds-edge--brass h-36 p-4 flex flex-col justify-between" data-demo="glass-refract">
              <span className="ds-label text-ds-brass-300">refractive glass (t2)</span>
              <span className="text-[10px] font-mono text-ds-text-low">rim displacement · brass edge</span>
            </div>
            <div className="ds-metal ds-grain ds-edge h-36 p-4 flex flex-col justify-between" data-demo="metal">
              <span className="ds-label">brushed metal</span>
              <span className="text-[10px] font-mono text-ds-text-low">anisotropic streak · grain</span>
            </div>
            <div className="ds-ceramic ds-edge h-36 p-4 flex flex-col justify-between" data-demo="ceramic">
              <span className="ds-label">soft ceramic</span>
              <span className="text-[10px] font-mono text-ds-text-low">matte · chamfer-soft · elev-1</span>
            </div>
          </div>
          <div className="ds-well h-14 px-4 flex items-center" data-demo="well">
            <span className="ds-label">recessed well — carved trough for inputs + viewports</span>
          </div>
        </Section>

        <Section title="Elevation & edges — nothing sits flat">
          <div className="flex items-end gap-6">
            {([0, 1, 2, 3, 4] as const).map((e) => (
              <div
                key={e}
                className={`ds-elev-${e} w-20 rounded-ds-md flex items-center justify-center`}
                style={{
                  height: 56 + e * 10,
                  background: 'var(--ds-grad-ceramic)',
                }}
              >
                <span className="ds-kicker">e{e}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-5">
            <div className="ds-smoked ds-edge w-44 h-20 flex items-center justify-center">
              <span className="ds-kicker">neutral edge</span>
            </div>
            <div className="ds-smoked ds-edge--brass w-44 h-20 flex items-center justify-center">
              <span className="ds-kicker text-ds-brass-300">brass edge (active)</span>
            </div>
            <TiltCard />
          </div>
        </Section>

        <Section title="Machined controls">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="ds-btn ds-btn--primary">Save graph</button>
            <button type="button" className="ds-btn">Rebuild</button>
            <button type="button" className="ds-btn ds-btn--ghost">Clone</button>
            <button type="button" className="ds-btn ds-btn--quiet">Cancel</button>
            <button type="button" className="ds-btn ds-btn--danger">Delete</button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(DS_DIFFICULTY).map(([k]) => (
              <span key={k} className={`ds-chip ${k === 'easy' ? 'ds-chip--ok' : k === 'medium' ? 'ds-chip--brass' : ''}`}>
                {k}
              </span>
            ))}
            <span className="ds-chip ds-chip--ice">frozen</span>
            <span className="ds-chip">neutral</span>
          </div>
          <div className="grid grid-cols-2 gap-5 max-w-xl">
            <input className="ds-input" placeholder="Search primitives…" />
            <select className="ds-select" defaultValue="orbit">
              <option value="orbit">orbit</option>
              <option value="dissolve">dissolve-morph</option>
            </select>
            <input type="range" className="ds-slider" defaultValue={62} />
            <label className="flex items-center gap-3">
              <input type="checkbox" className="ds-toggle" defaultChecked />
              <span className="ds-label">receive lighting</span>
            </label>
          </div>
        </Section>

        <Section title="Type — engraving hierarchy">
          <div className="flex flex-col gap-2">
            <span className="ds-kicker">kicker · mono · 9px · 0.24em</span>
            <span className="ds-label">label · mono · 10px · 0.16em</span>
            <span className="text-[12px] text-ds-text">Body — Inter Tight 12px, bone on graphite.</span>
            <span className="ds-title">Title — Bricolage Grotesque 15px</span>
            <span className="ds-title ds-title-brass text-[22px]">Display brass gradient</span>
          </div>
        </Section>

        <Section title="Motion — lift · sweep · reveal (transform/opacity only)">
          <div className="flex gap-5">
            <div className="ds-ceramic ds-edge ds-lift w-40 h-24 flex items-center justify-center cursor-pointer">
              <span className="ds-kicker">hover lift</span>
            </div>
            <div className="ds-metal ds-grain ds-edge ds-sweep w-40 h-24 flex items-center justify-center cursor-pointer">
              <span className="ds-kicker">specular sweep</span>
            </div>
            <div className="ds-glass ds-edge ds-reveal w-40 h-24 flex items-center justify-center">
              <span className="ds-kicker">eased reveal</span>
            </div>
          </div>
        </Section>
      </div>

      <footer className="relative ds-kicker pb-4">
        tokens.css + materials.css are the single source — component-local hex values are forbidden.
      </footer>
    </div>
  );
}
