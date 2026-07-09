'use client';

// PRISM SHELL — PHASE 0 PROMPT CAPTURE (SHELL W2, spec §3 / E3)
//
// The intake entry: describe the build, optionally seed the Brand Profile from
// a screenshot, a logo, or a live URL (E3). Screenshot/logo seeds are extracted
// client-side (image-seed.ts); the URL seed is a server-side metadata read
// (W2-D3). Extracted hints show as a live brand-seed chip so the user sees the
// seed take effect. Two ways forward: the guided cards, or "skip questions —
// just build" straight to the Brief.

import { useRef, useState } from 'react';
import { useIntakeStore } from '@/lib/shell/intake/intake-store';
import { titleFromPrompt } from '@/lib/shell/intake/intake-model';
import { extractPaletteFromImage } from '@/lib/shell/intake/image-seed';
import { seedFromUrl } from '@/lib/shell/intake-client';
import PrimaryButton3D from './PrimaryButton3D';
import GithubImportPanel from './GithubImportPanel';

export default function PromptCapture() {
  const prompt = useIntakeStore((s) => s.prompt);
  const brandSeed = useIntakeStore((s) => s.brandSeed);
  const seedsUsed = useIntakeStore((s) => s.seedsUsed);
  const githubImport = useIntakeStore((s) => s.githubImport);
  const setGithub = useIntakeStore((s) => s.setGithub);
  const setPrompt = useIntakeStore((s) => s.setPrompt);
  const patchBrandSeed = useIntakeStore((s) => s.patchBrandSeed);
  const addSeed = useIntakeStore((s) => s.addSeed);
  const startCards = useIntakeStore((s) => s.startCards);
  const fastForward = useIntakeStore((s) => s.fastForward);

  const [url, setUrl] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlNote, setUrlNote] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const canProceed = prompt.trim().length > 2;

  async function onImage(kind: 'screenshot' | 'logo', file: File | undefined) {
    if (!file) return;
    const seed = await extractPaletteFromImage(file);
    if (!seed) return;
    patchBrandSeed({ palette: { primary: seed.primary, secondary: seed.secondary, accent: seed.accent } });
    addSeed({ kind, detail: `Palette from uploaded ${kind}` });
  }

  async function onReadUrl() {
    const value = url.trim();
    if (!value || urlBusy) return;
    setUrlBusy(true);
    setUrlNote(null);
    try {
      const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const s = await seedFromUrl(withScheme);
      const patch: Parameters<typeof patchBrandSeed>[0] = {};
      // Prefer og:site_name; fall back to a cleaned <title> for the brand name.
      const cleanTitle = s.title ? s.title.split(/[|–—·—-]/)[0].trim().slice(0, 120) : null;
      const nameHint = s.siteName ?? cleanTitle;
      if (nameHint) patch.name = nameHint;
      if (s.themeColor) {
        patch.palette = {
          primary: s.themeColor,
          secondary: brandSeed.palette?.secondary ?? '#e8ecf2',
          accent: brandSeed.palette?.accent ?? '#ff2a38',
        };
      }
      if (Object.keys(patch).length) patchBrandSeed(patch);
      const bits = [nameHint, s.themeColor ? `theme ${s.themeColor}` : null].filter(Boolean);
      if (bits.length) {
        addSeed({ kind: 'url', detail: `From ${new URL(withScheme).hostname}: ${bits.join(', ')}` });
        setUrlNote(`Seeded ${bits.join(' · ')}`);
      } else {
        setUrlNote('No brand hints found on that page.');
      }
    } catch {
      setUrlNote('Could not read that URL.');
    } finally {
      setUrlBusy(false);
    }
  }

  const seedPalette = brandSeed.palette;
  const seedName = brandSeed.name || (prompt.trim() ? titleFromPrompt(prompt) : null);

  return (
    <div className="iv-phase iv-phase0">
      <div className="iv-phase0-head">
        <p className="iv-kicker">Guided build · start</p>
        <h1 className="iv-h1">Describe what you want to build.</h1>
        <p className="iv-lede">
          A sentence is enough — Prism asks a few quick questions, shows you real
          design directions, then writes a build brief you approve.
        </p>
      </div>

      <label className="iv-field iv-prompt-field">
        <span className="iv-field-label">Your idea</span>
        <textarea
          className="iv-textarea"
          rows={4}
          value={prompt}
          placeholder="e.g. A booking app for a boutique watch atelier — appointments, a catalog, and member accounts."
          onChange={(e) => setPrompt(e.target.value)}
          aria-label="Describe what you want to build"
        />
      </label>

      <div className="iv-attach">
        <p className="iv-attach-kicker">Seed the look (optional)</p>
        <div className="iv-attach-row">
          <button
            type="button"
            className="iv-attach-btn"
            onClick={() => screenshotRef.current?.click()}
          >
            <span className="iv-attach-title">Screenshot</span>
            <span className="iv-attach-hint">Match an app you like</span>
          </button>
          <input
            ref={screenshotRef}
            type="file"
            accept="image/*"
            className="iv-visually-hidden"
            onChange={(e) => void onImage('screenshot', e.target.files?.[0])}
          />
          <button type="button" className="iv-attach-btn" onClick={() => logoRef.current?.click()}>
            <span className="iv-attach-title">Logo</span>
            <span className="iv-attach-hint">Pull your brand colours</span>
          </button>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="iv-visually-hidden"
            onChange={(e) => void onImage('logo', e.target.files?.[0])}
          />
          <div className="iv-attach-url">
            <input
              type="url"
              className="iv-url-input"
              value={url}
              placeholder="Paste a site URL"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onReadUrl())}
              aria-label="Seed brand from a website URL"
            />
            <button
              type="button"
              className="iv-url-read"
              onClick={onReadUrl}
              disabled={!url.trim() || urlBusy}
            >
              {urlBusy ? 'Reading…' : 'Read'}
            </button>
          </div>
        </div>
        {urlNote ? <p className="iv-attach-note">{urlNote}</p> : null}
      </div>

      {seedPalette || seedsUsed.length ? (
        <div className="iv-seedchip" aria-label="Brand seed captured">
          <span className="iv-seedchip-kicker">Brand seed</span>
          {seedName ? <span className="iv-seedchip-name">{seedName}</span> : null}
          {seedPalette ? (
            <span className="iv-seedchip-swatches" aria-hidden>
              {[seedPalette.primary, seedPalette.secondary, seedPalette.accent]
                .filter(Boolean)
                .map((c, i) => (
                  <span key={i} className="iv-seedchip-swatch" style={{ background: c as string }} />
                ))}
            </span>
          ) : null}
          <span className="iv-seedchip-count">
            {seedsUsed.length} seed{seedsUsed.length === 1 ? '' : 's'} · used in your brief
          </span>
        </div>
      ) : null}

      {/* UXV-F1 — the repo importer surfaces on Phase 0 so "Import from
          GitHub" is reachable without hunting through the card deck. The
          panel itself (analyze stream, fidelity, applyImport) is unchanged. */}
      <div className="iv-attach iv-import-entry">
        <p className="iv-attach-kicker">Already have this app on GitHub?</p>
        {githubImport?.requested ? (
          <GithubImportPanel />
        ) : (
          <button
            type="button"
            className="iv-attach-btn"
            onClick={() => setGithub(true, '')}
            aria-label="Import an existing GitHub repo"
          >
            <span className="iv-attach-title">Import a repo</span>
            <span className="iv-attach-hint">Prism analyzes it and drafts your plan</span>
          </button>
        )}
      </div>

      <div className="iv-phase0-actions">
        <PrimaryButton3D
          label="Start guided build"
          sublabel="~6 quick questions"
          kind="go"
          disabled={!canProceed}
          onClick={startCards}
          ariaLabel="Start the guided build questions"
        />
        <button
          type="button"
          className="iv-ghostbtn"
          disabled={!canProceed}
          onClick={fastForward}
        >
          Skip questions — just build
        </button>
      </div>
    </div>
  );
}
