// W-PROD — planner ↔ cascade integration (hermetic: global fetch stubbed,
// env keys, PRISM_KEYS_DIR pointed at an empty dir). Proves resolveBlueprint
// goes LIVE through the provider cascade when Anthropic is absent, carries
// honest provider provenance, applies the refined copy over the SAME
// deterministic structure, and falls back to the stub when the whole
// cascade fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveBlueprint, CONDUCTOR_MODEL } from '@/server/conductor/planner';
import { buildDeterministicBlueprint } from '@/server/conductor/blueprint';
import { resolveDirection } from '@/server/conductor/directions';
import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';

function fixtureBrief(): BuildBrief {
  return {
    v: 1,
    title: 'Warm, inviting website for my bakery',
    prompt: 'a warm, inviting website for my bakery with an online cake ordering form',
    brandProfile: {
      v: 1,
      name: 'Mia’s Bakery',
      palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' },
      toneDescriptors: ['warm', 'inviting'],
    },
    chosenDirectionId: 'walnut-studio',
    lines: [
      { id: 'l-summary', key: 'summary', label: 'Summary', value: 'Bakery storefront with cake ordering.' },
      { id: 'l-archetype', key: 'archetype', label: 'Archetype', value: 'storefront' },
      { id: 'l-sections', key: 'sections', label: 'Sections', value: 'Catalog / library, About Us' },
    ],
    integrations: [],
    deployTarget: 'prism-cloud',
    seedsUsed: [{ kind: 'prompt', detail: 'WPROD cascade planner test' }],
    answers: [],
    branchCount: 0,
    fastPath: false,
  };
}

const ENV_KEYS = ['CEREBRAS_API_KEY', 'FIREWORKS_API_KEY', 'DEEPINFRA_API_KEY', 'GROQ_API_KEY'];
let emptyDir: string;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  emptyDir = mkdtempSync(path.join(tmpdir(), 'wprod-planner-'));
  for (const k of [...ENV_KEYS, 'PRISM_KEYS_DIR', 'PRISM_INFERENCE_FAIL', 'ANTHROPIC_API_KEY']) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.PRISM_KEYS_DIR = emptyDir;
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(emptyDir, { recursive: true, force: true });
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const REFINED = {
  headline: 'Cakes worth crossing town for',
  subhead: 'Order your custom cake in minutes.',
  ctaLabel: 'Order a cake',
  sectionTitles: ['Our Catalog', 'About Mia'],
};

function jsonCompletion(obj: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(obj) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
  } as unknown as Response;
}

describe('W-PROD — resolveBlueprint through the provider cascade', () => {
  it('goes live via the first keyed provider with honest provenance and bounded copy', async () => {
    process.env.FIREWORKS_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => jsonCompletion(REFINED)));

    const brief = fixtureBrief();
    const direction = resolveDirection(brief);
    const stub = buildDeterministicBlueprint(brief, direction);
    const live = await resolveBlueprint(brief, direction);

    expect(live.origin).toBe('live');
    expect(live.provider).toBe('fireworks');
    expect(live.providerModel).toContain('gpt-oss-120b');
    // Same deterministic structure — hub count and ids unchanged.
    expect(live.hubs.map((h) => h.hubId)).toEqual(stub.hubs.map((h) => h.hubId));
    // Refined copy landed on the home headline node.
    const headline = live.hubs.flatMap((h) => h.nodes).find((n) => n.id === 'home-headline');
    expect(headline && headline.render.kind === 'text' ? headline.render.content : null).toBe(
      REFINED.headline,
    );
  });

  it('falls back to the stub when every cascade provider fails', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response),
    );
    const brief = fixtureBrief();
    const direction = resolveDirection(brief);
    const plan = await resolveBlueprint(brief, direction);
    expect(plan.origin).toBe('stub');
    expect(plan.provider).toBeUndefined();
  });

  it('stays on the stub with no keys at all (no network calls)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const brief = fixtureBrief();
    const direction = resolveDirection(brief);
    const plan = await resolveBlueprint(brief, direction);
    expect(plan.origin).toBe('stub');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(CONDUCTOR_MODEL.length).toBeGreaterThan(0);
  });
});
