#!/usr/bin/env node
// Render notes/verification/finish-f4/sweep.json as the F-4 report checklist
// table (control → action → expected → observed → frame → PASS/FAIL).
import { readFileSync } from 'node:fs';

const d = JSON.parse(readFileSync('notes/verification/finish-f4/sweep.json', 'utf8'));

// step-name → primary evidence frame(s). Sections map to the numbered shots
// the sweep takes around each check.
const FRAMES = [
  // mobile rows first (their step text contains the desktop nav phrasing)
  [/^M: mobile arrival/, 'mobile/M01-arrival.png'],
  [/^M: app nav .*s2-movement/, 'mobile/M02-s2-movement.png'],
  [/^M: app nav .*s3-materia/, 'mobile/M03-s3-materia.png'],
  [/^M: app nav .*s4-celestia/, 'mobile/M04-s4-celestia.png'],
  [/^M: app nav .*s5-acquire/, 'mobile/M05-s5-acquire.png'],
  [/^M: app nav .*s6-atelier/, 'mobile/M06-s6-atelier.png'],
  [/boot lands in preview-app/, 'desktop/A01-boot-arrival.png'],
  [/app nav s1-arrival → s2/, 'desktop/A02-s2-movement.png'],
  [/app nav s2-movement → s3/, 'desktop/A03-s3-materia.png'],
  [/app nav s3-materia → s4/, 'desktop/A04-s4-celestia.png'],
  [/app nav s4-celestia → s5/, 'desktop/A05-s5-acquire.png'],
  [/app nav s5-acquire → s6/, 'desktop/A06-s6-atelier.png'],
  [/branded interstitial/, 'desktop/A-veil-interstitial.png'],
  [/atelier — app header AND footer/, 'desktop/A06-s6-atelier.png'],
  [/dial → salmon/, 'desktop/A07-atelier-configured.png'],
  [/RESERVE opens/, 'desktop/A08-reserve-overlay.png'],
  [/ENQUIRE opens/, 'desktop/A09-enquire-overlay.png'],
  [/hero watch opens/, 'desktop/A10-watch-detail-overlay.png'],
  [/Escape \(no overlay\)/, 'desktop/A11-escape-to-canvas.png'],
  [/mode pill → Galaxy/, 'desktop/B01-galaxy-overview.png'],
  [/galaxy filter/, 'desktop/B04-galaxy-filter.png'],
  [/Movement pill flies/, 'desktop/B02-hub-nav.png'],
  [/label ENLARGES/, 'desktop/B03-hover-label.png'],
  [/node click selects; double-click/, 'desktop/B07-node-select-inspector.png'],
  [/Galaxy pill returns/, 'desktop/B02b-overview-return.png'],
  [/⌘K search/, 'desktop/B05-search-palette.png'],
  [/Add Node opens the dialog/, 'desktop/B06-add-node-dialog.png'],
  [/enter Canvas on Arrival/, 'desktop/C01-topology.png · C02-canvas-scene.png'],
  [/cube "transform"/, 'desktop/C03-flyout-transform.png'],
  [/cube "lighting"/, 'desktop/C04-flyout-lighting.png'],
  [/canvas node select/, 'desktop/C05-inspector-open.png'],
  [/all 10 tabs/, 'desktop/C06-inspector-tabs.png'],
  [/staged Visual edit/, 'desktop/C07-staged-edit.png'],
  [/Edit toggle flips/, 'desktop/C08-gizmo-mounted.png'],
  [/transform flyout — mode keys/, 'desktop/C09-transform-staged.png'],
  [/selection flyout/, 'desktop/C10-marquee.png'],
  [/build flyout/, 'desktop/C11-build-flyout.png'],
  [/lighting flyout/, 'desktop/C12-lighting.png'],
  [/function key opens/, 'desktop/C13-function-popup.png'],
  [/keyframe dock/, 'desktop/C14-keyframe-dock.png'],
  [/camera HUD/, 'desktop/C15-journey-rec.png · C16-shipped-frame.png'],
  [/node agent/, 'desktop/C17-node-agent-plan.png'],
  [/Change Artifact/, 'desktop/C18-change-artifact.png · C19-clone-galaxy.png'],
  [/drag-spine/, 'desktop/C20-toolbar-floating-collapsed.png'],
  [/persistence — saveToServer/, 'desktop/D01-after-save-reload.png'],
  [/generic load/, 'desktop/D02-generic-graph-loaded.png'],
  [/E1:/, 'desktop/E01a-transform-staged.png · E01b-transform-persisted.png'],
  [/E2:/, 'desktop/E02a-binding-edited.png · E02b-binding-works-in-preview.png'],
  [/E3:/, 'desktop/E03a-keyframes-authored.png · E03b-keyframes-persisted-scrub.png'],
  [/E4:/, 'desktop/E04a-added-in-canvas.png · E04b-added-in-galaxy.png · E04c-added-in-preview.png'],
  [/E5:/, 'desktop/E05a-deleted.png · E05b-delete-persisted.png'],
  [/fixture restored/, 'desktop/E06-fixture-restored.png'],
  [/M: mobile arrival/, 'mobile/M01-arrival.png'],
  [/M: app nav .*s2-movement/, 'mobile/M02-s2-movement.png'],
  [/M: app nav .*s3-materia/, 'mobile/M03-s3-materia.png'],
  [/M: app nav .*s4-celestia/, 'mobile/M04-s4-celestia.png'],
  [/M: app nav .*s5-acquire/, 'mobile/M05-s5-acquire.png'],
  [/M: app nav .*s6-atelier/, 'mobile/M06-s6-atelier.png'],
  [/M: configurator/, 'mobile/M07-atelier-tap-configured.png'],
  [/M: RESERVE/, 'mobile/M08-reserve-overlay.png'],
  [/M: mobile mode toggle/, 'mobile/M09-mobile-galaxy.png · M10-mobile-canvas.png'],
  [/M: compact chrome/, 'mobile/M11-toolbar-bottom-sheet.png · M12-inspector-bottom-sheet.png'],
  [/M: galaxy fly-in/, 'mobile/M13a-flyin-1s.png … M13d-flyin-6s.png'],
];
const frameFor = (step) => (FRAMES.find(([re]) => re.test(step)) ?? [null, '(state-assert)'])[1];

const rows = [...d.desktop, ...d.mobile, ...(d.global ?? [])];
console.log('| # | Control / capability → action + expected | Observed (machine-checked) | Frame | Verdict |');
console.log('|---|---|---|---|---|');
rows.forEach((r, i) => {
  const detail = Object.fromEntries(Object.entries(r).filter(([k]) => !['step', 'pass'].includes(k)));
  let obs = JSON.stringify(detail);
  if (obs.length > 190) obs = obs.slice(0, 187) + '…';
  obs = obs.replace(/\|/g, '\\|');
  const step = r.step.replace(/\|/g, '\\|');
  console.log(`| ${i + 1} | ${step} | \`${obs}\` | ${frameFor(r.step)} | ${r.pass ? 'PASS' : 'FAIL'} |`);
});
console.log(`\nperf: ${JSON.stringify(d.perf)}`);
console.log(`pageErrors=${d.pageErrors.length} consoleErrors=${d.consoleErrors.length}`);
