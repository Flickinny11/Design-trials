// SHELL W0 — token evidence board (server component; pure DOM + --pp-* vars).
import {
  PP_ELEVATION,
  PP_SPACE,
  PP_TEXT,
  RED_DEEP,
  RED_HOT,
  SIGNAL_RED,
  CHROME,
  CHROME_HI,
  CHROME_LO,
} from '@/components/shell/design/prism-premium-tokens';

function SwatchRow({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="sw0-swatch-row">
      {items.map((s) => (
        <div key={s.label} className="sw0-swatch" style={{ background: s.color }}>
          <span className="sw0-swatch-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function TokenBoard() {
  return (
    <div className="sw0-token-grid">
      <div className="sw0-panel">
        <p className="sw0-board-caption">DL1 · Elevation — true-black base, machined steps</p>
        <SwatchRow
          items={Object.entries(PP_ELEVATION).map(([k, v]) => ({ label: `${k} ${v}`, color: v }))}
        />
        <p className="sw0-board-caption" style={{ marginTop: 'var(--pp-space-4)' }}>
          DL2 · The red / the white
        </p>
        <SwatchRow
          items={[
            { label: `red ${SIGNAL_RED}`, color: SIGNAL_RED },
            { label: `deep ${RED_DEEP}`, color: RED_DEEP },
            { label: `hot ${RED_HOT}`, color: RED_HOT },
            { label: `chrome ${CHROME}`, color: CHROME },
            { label: `hi ${CHROME_HI}`, color: CHROME_HI },
            { label: `lo ${CHROME_LO}`, color: CHROME_LO },
          ]}
        />
        <p className="sw0-board-caption" style={{ marginTop: 'var(--pp-space-4)' }}>
          Text ramp
        </p>
        <SwatchRow
          items={Object.entries(PP_TEXT).map(([k, v]) => ({ label: `${k} ${v}`, color: v }))}
        />
      </div>

      <div className="sw0-panel">
        <p className="sw0-board-caption">DL7 · Hairlines — crisp 1px, specular / shadow / active</p>
        <div className="sw0-hairline-demo">
          <div className="sw0-hl" />
          <div className="sw0-hl sw0-hl--strong" />
          <div className="sw0-hl sw0-hl--red" />
        </div>
        <p className="sw0-board-caption" style={{ marginTop: 'var(--pp-space-4)' }}>
          DL7 · Spacing — 4px machining grid
        </p>
        <div className="sw0-space-ruler">
          {Object.entries(PP_SPACE).map(([k, v]) => (
            <div key={k} className="sw0-step" style={{ height: `${v}px` }} title={`${k} = ${v}px`} />
          ))}
        </div>
        <p className="sw0-board-caption" style={{ marginTop: 'var(--pp-space-4)' }}>
          DL7 · Radius — exact geometry
        </p>
        <div className="sw0-radius-row">
          {[2, 4, 6, 10, 16].map((r) => (
            <div key={r} className="sw0-radius-chip" style={{ borderRadius: `${r}px` }}>
              {r}px
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
