// SHELL W5 — PREVIEW SEED (browser-proof helper, guarded)
//
// Seeds a real built project + E14 preview token into the DEFAULT .data dirs
// (the dev server's tenancy + token store) so a browser can open the shareable
// preview URL and confirm the built app RENDERS in the Prism runtime (§11.1-3).
// Guarded by W5_SEED=1 so it never runs in the normal suite. Writes the preview
// URL to /tmp/w5-preview.json.

import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';

const RUN = process.env.W5_SEED === '1';
const ORIGIN = process.env.W5_ORIGIN || 'http://localhost:3100';

function brief(title: string, directionId: string, sections: string): BuildBrief {
  return {
    v: 1,
    title,
    prompt: `A premium ${title} landing built to its chosen direction.`,
    brandProfile: {
      v: 1,
      name: title,
      palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' },
      toneDescriptors: ['precise', 'luxury'],
    },
    chosenDirectionId: directionId,
    lines: [
      { id: 'l-summary', key: 'summary', label: 'Summary', value: `${title}. Precision-crafted, confident, premium.` },
      { id: 'l-archetype', key: 'archetype', label: 'Archetype', value: 'landing page' },
      { id: 'l-sections', key: 'sections', label: 'Sections', value: sections },
    ],
    integrations: [],
    deployTarget: 'prism-cloud',
    seedsUsed: [{ kind: 'prompt', detail: 'Phase-0 prompt' }],
    answers: [],
    branchCount: 0,
    fastPath: false,
  };
}

describe.runIf(RUN)('W5 preview seed', () => {
  it('seeds a built project + preview URL into .data', async () => {
    const store = await import('@/server/tenancy/tenant-store');
    const { runConductor } = await import('@/server/conductor/conductor');

    const tenantId = 'w5-demo';
    const project = await store.createProject(tenantId, { name: 'Nova Atelier' });
    await store.saveBrief(tenantId, project.id, brief('Nova Atelier', 'atelier-noir', 'Features, Collection, Pricing'));

    for await (const _ of runConductor(
      { projectId: project.id },
      { tenantId, appOrigin: ORIGIN },
    )) {
      void _;
    }

    const deploys = await store.listDeploys(tenantId, project.id);
    const deploy = deploys![deploys!.length - 1];
    const out = {
      tenantId,
      projectId: project.id,
      token: deploy.token,
      previewUrl: deploy.previewUrl,
    };
    writeFileSync('/tmp/w5-preview.json', JSON.stringify(out, null, 2));
    // eslint-disable-next-line no-console
    console.log('W5_PREVIEW_URL', deploy.previewUrl);
  });
});
