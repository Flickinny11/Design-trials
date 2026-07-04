// SHELL W0 — DL3 typography evidence board (server component).
//
// Renders ONE candidate pairing on three real shell comps (dashboard card,
// chat header, launchpad) so the founder judges faces on product surfaces,
// not on lorem specimens. The chat-header model label is read from the
// model-config source — no hardcoded model strings in components (spec 7.4).

import type { CSSProperties } from 'react';
import { getDefaultModel } from '@/lib/shell/model-config';

export interface TypeBoardProps {
  /** e.g. "A — Fraunces × JetBrains Mono" */
  name: string;
  /** Variable-axis summary shown beside the name. */
  axes: string;
  /** CSS font-family value for the display face (a next/font variable). */
  displayFamily: string;
  /** CSS font-family value for the mono face (a next/font variable). */
  monoFamily: string;
  winner?: boolean;
}

export default function TypeBoard({ name, axes, displayFamily, monoFamily, winner }: TypeBoardProps) {
  const model = getDefaultModel();
  const boardVars = {
    '--tb-display': displayFamily,
    '--tb-mono': monoFamily,
  } as CSSProperties;

  return (
    <div className={`sw0-typeboard${winner ? ' sw0-typeboard--winner' : ''}`} style={boardVars}>
      {winner ? <span className="sw0-winner-tag">Selected — wired</span> : null}
      <div className="sw0-typeboard-head">
        <h3 className="sw0-pairing-name">{name}</h3>
        <span className="sw0-pairing-axes">{axes}</span>
      </div>
      <div className="sw0-comps">
        <div className="sw0-panel sw0-comp-card">
          <span className="sw0-status-chip">Building · wave 3</span>
          <h4 className="sw0-card-title">Aurora Watch Atelier</h4>
          <div className="sw0-card-meta">
            <span>148 nodes</span>
            <span>6 hubs</span>
            <span>edited 2m ago</span>
          </div>
        </div>
        <div className="sw0-panel sw0-comp-chat">
          <span className="sw0-chat-model">{model.label}</span>
          <h4 className="sw0-chat-title">Refining the acquire flow</h4>
          <div className="sw0-chat-step">
            <b>Reading</b> home-hub.json · 40 nodes · 128ms
          </div>
        </div>
        <div className="sw0-panel sw0-comp-launchpad">
          <h4 className="sw0-launch-headline">What will you build today?</h4>
          <div className="sw0-launch-input">
            <span>A boutique for hand-thrown ceramics…</span>
            <span className="sw0-launch-cta">Build</span>
          </div>
        </div>
      </div>
    </div>
  );
}
