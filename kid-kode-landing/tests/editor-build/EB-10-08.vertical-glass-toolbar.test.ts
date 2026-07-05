// EB-10-08 - vertical photoreal glass toolbar.
//
// The root Canvas editor keeps the full wired toolbar functionality, but every
// density must render the same vertical Three.js glass rail. Compact/narrow
// panes may change flyout housing only; they must not revive the horizontal DOM
// dock or a stock icon-pack toolbar.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { screenYForButton } from '../../src/components/editor/overlays/liquid-toolbar/config';

const repoRoot = join(__dirname, '..', '..');
const toolbarDir = join(repoRoot, 'src', 'components', 'editor', 'overlays', 'liquid-toolbar');
const canvasToolbarSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'overlays', 'CanvasToolbar.tsx'),
  'utf8',
);
const liquidToolbarSrc = readFileSync(join(toolbarDir, 'LiquidGlassToolbar.tsx'), 'utf8');
const toolbarSceneSrc = readFileSync(join(toolbarDir, 'ToolbarScene.tsx'), 'utf8');
const glassPaneSrc = readFileSync(join(toolbarDir, 'GlassRailPane.tsx'), 'utf8');
const glassCubeSrc = readFileSync(join(toolbarDir, 'GlassCubeToolButton.tsx'), 'utf8');
const iconSrc = readFileSync(join(toolbarDir, 'icons', 'PrismIcon3D.tsx'), 'utf8');

const STOCK_ICON_IMPORT =
  /from\s*['"](lucide-react|lucide|react-icons|react-feather|feather-icons|phosphor-react|@phosphor-icons\/[^'"]+|@heroicons\/[^'"]+|heroicons|@tabler\/icons[^'"]*|@fortawesome\/[^'"]+|@iconify\/[^'"]+|@radix-ui\/react-icons|@ant-design\/icons|@mui\/icons-material[^'"]*)['"]/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) acc.push(path);
  }
  return acc;
}

describe('EB-10-08 - vertical glass toolbar', () => {
  it('renders the same vertical LiquidGlassToolbar in regular and compact density', () => {
    expect(canvasToolbarSrc).toMatch(/data-orientation="vertical"/);
    expect(canvasToolbarSrc).toMatch(/<LiquidGlassToolbar/);
    expect(canvasToolbarSrc).toMatch(/density=\{compact \? 'compact' : 'regular'\}/);
    expect(canvasToolbarSrc).not.toMatch(/\{!compact\s*&&\s*\(\s*<LiquidGlassToolbar/);
    expect(canvasToolbarSrc).not.toMatch(/\{compact\s*&&\s*\(/);
    expect(canvasToolbarSrc).not.toMatch(/DockGroupKey|DockKeyStack|dockSlab|dockKeysRef|from 'gsap'/);
  });

  it('keeps the visible rail textless while preserving semantic tool hit targets', () => {
    expect(liquidToolbarSrc).toMatch(/data-component="liquid-glass-toolbar"/);
    expect(liquidToolbarSrc).toMatch(/data-orientation="vertical"/);
    expect(liquidToolbarSrc).toMatch(/data-toolbar-hit-target="glass-cube"/);
    expect(liquidToolbarSrc).toMatch(/data-tool-group=\{group\.id\}/);
    expect(liquidToolbarSrc).toMatch(/aria-label=\{group\.label\}/);
    expect(liquidToolbarSrc).toMatch(/externalHoverIndex=\{hoverIdx\}/);
    expect(liquidToolbarSrc).not.toMatch(/>\s*CANVAS\s*</);
    expect(liquidToolbarSrc).not.toMatch(/TEXT_BUTTONS/);
  });

  it('aligns DOM hit targets and tooltips to a vertical R3F button column', () => {
    const y0 = screenYForButton(0, 14, 560);
    const y7 = screenYForButton(7, 14, 560);
    const y13 = screenYForButton(13, 14, 560);

    expect(y0).toBeGreaterThan(0);
    expect(y13).toBeLessThan(560);
    expect(y0).toBeLessThan(y7);
    expect(y7).toBeLessThan(y13);
  });

  it('uses real Three.js glass pane and cube buttons with hover lift', () => {
    expect(toolbarSceneSrc).toMatch(/<Environment/);
    expect(toolbarSceneSrc).toMatch(/<Lightformer/);
    expect(toolbarSceneSrc).toMatch(/<ambientLight/);
    expect(toolbarSceneSrc).toMatch(/<GlassRailPane/);
    expect(toolbarSceneSrc).toMatch(/<GlassCubeToolButton/);
    expect(toolbarSceneSrc).toMatch(/externallyHovered=\{externalHoverIndex === i\}/);
    expect(toolbarSceneSrc).not.toMatch(/Backdrop height|BACKDROP_TOP|BACKDROP_BOT|soap-film|iridescent/);

    expect(glassPaneSrc).toMatch(/meshPhysicalMaterial/);
    expect(glassPaneSrc).toMatch(/transmission=\{1\}/);
    expect(glassPaneSrc).toMatch(/thickness=\{0\.95\}/);
    expect(glassPaneSrc).toMatch(/ior=\{1\.52\}/);
    expect(glassPaneSrc).toMatch(/EdgesGeometry/);
    expect(glassPaneSrc).toMatch(/lineBasicMaterial/);

    expect(glassCubeSrc).toMatch(/new THREE\.MeshPhysicalMaterial/);
    expect(glassCubeSrc).toMatch(/transmission:\s*1/);
    expect(glassCubeSrc).not.toMatch(/new THREE\.Color\(accent\)\.lerp/);
    expect(glassCubeSrc).toMatch(/Edges/);
    expect(glassCubeSrc).toMatch(/makeSocketShadow/);
    expect(glassCubeSrc).toMatch(/const REST_Z = FRONT_Z -/);
    expect(glassCubeSrc).toMatch(/const HOVER_Z = FRONT_Z \+/);
    expect(glassCubeSrc).toMatch(/PrismIcon3D/);
  });

  it('keeps glass-toolbar icons custom and free of stock icon-pack imports', () => {
    const files = walk(toolbarDir);
    const offenders = files.filter((file) => STOCK_ICON_IMPORT.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);

    for (const id of [
      'transform',
      'selection',
      'add',
      'library',
      'image',
      'object3d',
      'background',
      'changeArtifact',
      'promptEdit',
      'text',
      'animation',
      'function',
      'lighting',
      'build',
    ]) {
      expect(iconSrc).toMatch(new RegExp(`case '${id}'`));
    }
    expect(iconSrc).toMatch(/sphereGeometry|torusGeometry|boxGeometry|RoundedBox/);
    expect(iconSrc).not.toMatch(/<svg|lucide|react-icons|heroicons/);
  });
});
