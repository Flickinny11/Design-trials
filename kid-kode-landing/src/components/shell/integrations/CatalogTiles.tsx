'use client';

// PRISM SHELL — CATALOG TILES (SHELL W3, S6)
//
// The curated head as premium DOM tiles, grouped by category, each carrying the
// provider's REAL 2D brand mark (DL15) and a one-click Connect that opens the
// white-label Connect modal. Working surface (DL10): clean-but-premium, the 3D
// flourish lives in the hero above.

import type { CatalogTile } from '../../../../packages/shared-interfaces/src/prism-integrations';
import { useIntegrationsStore } from '@/lib/shell/integrations/integrations-store';
import BrandMark2D from './BrandMark2D';

export function TileButton({ tile }: { tile: CatalogTile }) {
  const openConnect = useIntegrationsStore((s) => s.openConnect);
  const connected = useIntegrationsStore((s) =>
    s.connections.some((c) => c.providerId === tile.providerId && c.status !== 'revoked'),
  );
  return (
    <button
      type="button"
      className="ig-tile"
      data-connected={connected ? 'true' : 'false'}
      onClick={() => openConnect(tile)}
      aria-label={`Connect ${tile.label}`}
    >
      <span className="ig-tile-mark">
        <BrandMark2D brandKey={tile.brandMark} size={30} />
      </span>
      <span className="ig-tile-body">
        <span className="ig-tile-label">{tile.label}</span>
        {tile.hint ? <span className="ig-tile-hint">{tile.hint}</span> : null}
      </span>
      <span className="ig-tile-cta" data-connected={connected ? 'true' : 'false'}>
        {connected ? 'Connected' : 'Connect'}
      </span>
    </button>
  );
}

export default function CatalogTiles({ tiles }: { tiles: CatalogTile[] }) {
  // Group by category, preserving catalog order.
  const groups: { category: string; tiles: CatalogTile[] }[] = [];
  for (const t of tiles) {
    let g = groups.find((x) => x.category === t.category);
    if (!g) {
      g = { category: t.category, tiles: [] };
      groups.push(g);
    }
    g.tiles.push(t);
  }
  return (
    <div className="ig-catalog">
      {groups.map((g) => (
        <section key={g.category} className="ig-catalog-group" aria-label={g.category}>
          <h3 className="ig-catalog-cat">{g.category}</h3>
          <div className="ig-tile-grid">
            {g.tiles.map((t) => (
              <TileButton key={t.providerId} tile={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
