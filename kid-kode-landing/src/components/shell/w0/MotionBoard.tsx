'use client';

// SHELL W0 — DL6 motion evidence board. Three interactive samples proving the
// weight-curve vocabulary: sprung mass (hover), decisive settle (click),
// gravity drop (click). Every transition runs on a --pp-ease-* curve —
// NOTHING linear (DL6). Pure DOM/CSS; the curves are the tokens themselves.

import { useState } from 'react';
import { PP_MOTION } from '@/components/shell/design/prism-premium-tokens';

export default function MotionBoard() {
  const [settled, setSettled] = useState(false);
  const [dropped, setDropped] = useState(false);

  return (
    <div className="sw0-motion-grid">
      <div className="sw0-motion-cell">
        <p className="sw0-board-caption">Sprung weight — hover / press</p>
        <div className="sw0-motion-stage" style={{ cursor: 'default' }}>
          <button type="button" className="sw0-weight-btn">
            Deploy
          </button>
        </div>
        <span className="sw0-motion-curve">{PP_MOTION.easeWeight} · {PP_MOTION.base}ms</span>
      </div>

      <div className="sw0-motion-cell">
        <p className="sw0-board-caption">Decisive settle — click to dock</p>
        <div
          className="sw0-motion-stage"
          role="button"
          tabIndex={0}
          aria-pressed={settled}
          onClick={() => setSettled((s) => !s)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setSettled((s) => !s);
          }}
        >
          <div className="sw0-settle-slot" />
          <div className={`sw0-settle-card${settled ? ' sw0-settle-card--down' : ''}`}>
            save · settles
          </div>
        </div>
        <span className="sw0-motion-curve">{PP_MOTION.easeSettle} · {PP_MOTION.settle}ms</span>
      </div>

      <div className="sw0-motion-cell">
        <p className="sw0-board-caption">Gravity — click to drop</p>
        <div
          className="sw0-motion-stage"
          role="button"
          tabIndex={0}
          aria-pressed={dropped}
          onClick={() => setDropped((d) => !d)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setDropped((d) => !d);
          }}
        >
          <div className={`sw0-gravity-chip${dropped ? ' sw0-gravity-chip--dropped' : ''}`} />
          <div className="sw0-gravity-floor" />
        </div>
        <span className="sw0-motion-curve">{PP_MOTION.easeGravity} · {PP_MOTION.settle}ms</span>
      </div>
    </div>
  );
}
