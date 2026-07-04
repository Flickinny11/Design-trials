// SHELL W0 — foundations evidence route (dev-only; PRISM-FRONTEND-SHELL-SPEC
// §12 W0). Renders the Prism Premium token layer, the three DL3 typography
// candidates on real shell comps, the premium.ts-language 3D icon set, and
// the DL6 motion vocabulary. This route is the wave's evidence surface — it
// is NOT a product surface and 404s in production builds.
//
// Prime Boundary note (§0): everything here is React/DOM shell work in a new
// route; the canvas editor at `/` and all engine-interior files are
// untouched. The only 3D is the bounded, lazy icon showpiece island that
// DL4/DL5 explicitly demand.

import { notFound } from 'next/navigation';
import './shell-w0.css';
import '@/components/shell/design/prism-premium.css';
import {
  fraunces,
  jetbrainsMono,
  martianMono,
  newsreader,
  playfair,
  splineSansMono,
} from './fonts';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import TokenBoard from '@/components/shell/w0/TokenBoard';
import TypeBoard from '@/components/shell/w0/TypeBoard';
import MotionBoard from '@/components/shell/w0/MotionBoard';
import IconShowpiece from '@/components/shell/w0/IconShowpiece';

export const metadata = {
  title: 'Prism Shell — W0 Foundations',
};

const CANDIDATE_CLASSES = [
  fraunces.variable,
  jetbrainsMono.variable,
  playfair.variable,
  martianMono.variable,
  newsreader.variable,
  splineSansMono.variable,
].join(' ');

export default function ShellW0Page() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main
      className={`sw0-root ${shellDisplay.variable} ${shellMono.variable} ${CANDIDATE_CLASSES}`}
    >
      <header className="sw0-header">
        <h1 className="sw0-wordmark">
          Prism<span className="sw0-dot">.</span>
        </h1>
        <span className="sw0-kicker">Shell W0 · Foundations</span>
        <span className="sw0-kicker sw0-kicker--red">Dark-first · RBW</span>
      </header>

      <section className="sw0-section" id="tokens">
        <h2 className="sw0-section-title">Prism Premium tokens</h2>
        <p className="sw0-section-sub">
          The shell token layer extends the canonical premium.ts red/black/white system:
          true-black OLED base with machined grey elevation (DL1/DL2), crisp 1px hairlines,
          a 4px machining grid and exact radii (DL7).
        </p>
        <TokenBoard />
      </section>

      <section className="sw0-section" id="typography">
        <h2 className="sw0-section-title">Typography — three pairings for sign-off</h2>
        <p className="sw0-section-sub">
          DL3: expressive neo-serif display over a data-grade monospace utility voice.
          Variable, self-hosted, zero grotesques. Each pairing renders the same three shell
          comps — dashboard card, chat header, launchpad — desktop and mobile. Pairing A is
          wired as the shell default pending founder sign-off.
        </p>
        <div className="sw0-typeboards">
          <TypeBoard
            name="A — Fraunces × JetBrains Mono"
            axes="opsz 9–144 · wght 100–900 · SOFT · WONK — mono wght 100–800"
            displayFamily="var(--pair-a-display)"
            monoFamily="var(--pair-a-mono)"
            winner
          />
          <TypeBoard
            name="B — Playfair Display × Martian Mono"
            axes="wght 400–900 — mono wdth 75–112.5 · wght 100–800"
            displayFamily="var(--pair-b-display)"
            monoFamily="var(--pair-b-mono)"
          />
          <TypeBoard
            name="C — Newsreader × Spline Sans Mono"
            axes="opsz 6–72 · wght 200–800 — mono wght 300–700"
            displayFamily="var(--pair-c-display)"
            monoFamily="var(--pair-c-mono)"
          />
        </div>
      </section>

      <section className="sw0-section" id="icons">
        <h2 className="sw0-section-title">Custom 3D icon system</h2>
        <p className="sw0-section-sub">
          DL5: no icon packs, ever. Six geometric forms machined in the premium.ts material
          language — gunmetal, brushed chrome, signal-red jewels, one smoked-glass prism —
          lit by a procedural studio environment so the shading is real and moving. Lazy,
          bounded island (DL8); zero remote assets.
        </p>
        <IconShowpiece />
      </section>

      <section className="sw0-section" id="motion">
        <h2 className="sw0-section-title">Motion with weight</h2>
        <p className="sw0-section-sub">
          DL6: micro-interactions carry physical mass — sprung lift, decisive settle,
          gravity. Nothing linear on hero interactions; the curves below are the shipped
          tokens.
        </p>
        <MotionBoard />
      </section>

      <footer className="sw0-footer">
        <span>contract v1 · prism-shell.ts</span>
        <span>collab types v1 · decision E</span>
        <span>brand schema v1</span>
        <span>model source · src/lib/shell/model-config.ts</span>
      </footer>
    </main>
  );
}
