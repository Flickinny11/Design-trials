// POL02 — Fresh editor framing starts with the home hub in view.

import { describe, expect, it } from 'vitest';
import { computeHubCenters } from '@/lib/useForceGraph';
import type { EditorHubView } from '@/lib/prism-graph/view-model';

function hub(id: string): EditorHubView {
  return {
    id,
    name: id,
    route: '/',
    glyph: 'circle',
    color: '#5d8bff',
    accentColor: '#a978ff',
    mockupUrl: null,
  };
}

describe('POL02 — editor camera initial framing', () => {
  it('centers a single hub at the camera look target', () => {
    expect(computeHubCenters([hub('home')])).toEqual({
      home: { x: 0, y: 0, z: 0 },
    });
  });

  it('keeps multi-hub graphs spatially separated', () => {
    const centers = computeHubCenters([hub('home'), hub('about')]);
    expect(centers.home).not.toEqual({ x: 0, y: 0, z: 0 });
    expect(centers.about).not.toEqual({ x: 0, y: 0, z: 0 });
    expect(centers.home).not.toEqual(centers.about);
  });
});
