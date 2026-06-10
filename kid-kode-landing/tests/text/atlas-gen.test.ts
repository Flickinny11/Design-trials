// P1 TEXT SYSTEM (A2) — server atlas-gen: disk cache + manifest gate +
// in-flight dedupe (criterion 27 server side).
//
// Under test (src/server/fonts/atlas-gen.ts `generateOrGetAtlas`):
//   - first call for a pair is a 'miss' that runs the generator ONCE and
//     writes <slug>-<weight>.msdf.{png,json} into the cache dir;
//   - the second call is a 'hit' that never re-invokes the generator;
//   - concurrent first calls dedupe to a single generator run;
//   - families/weights absent from the manifest reject with UnknownFontError
//     BEFORE any generator work;
//   - a failed bake writes nothing and is retryable.
//
// The real msdf-bmfont-xml bake + TTF fetch are replaced by an injected stub
// generator and a per-test tmp cache dir — zero network, zero font I/O.
// (`server-only` is aliased to a no-op in vitest.config.mjs.)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { generateOrGetAtlas, UnknownFontError, slugifyFamily } from '@/server/fonts/atlas-gen';
import type { FontManifestEntry, MsdfFontData } from '@/lib/prism/text/contract';

const MANIFEST: FontManifestEntry[] = [
  { family: 'Testface', category: 'Sans Serif', weights: [400, 700], core: false },
  { family: 'Spaced Out Display', category: 'Display', weights: [400], core: false },
];

const FAKE_JSON: MsdfFontData = {
  pages: ['testface-400.msdf.png'],
  chars: [{ id: 65, x: 0, y: 0, width: 10, height: 12, xoffset: 0, yoffset: 0, xadvance: 11, page: 0 }],
  common: { lineHeight: 58, base: 46, scaleW: 2048, scaleH: 2048 },
};
const FAKE_PNG = Buffer.from('not-actually-a-png-but-bytes-on-disk');

let cacheDir: string;

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'prism-atlas-gen-'));
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

function makeGenerator() {
  return vi.fn(async (_family: string, _weight: number) => ({
    png: FAKE_PNG,
    json: structuredClone(FAKE_JSON),
  }));
}

describe('atlas-gen — cache hit/miss', () => {
  it('first call is a miss: generator runs once, both cache halves land on disk', async () => {
    const generator = makeGenerator();
    const result = await generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator });

    expect(result.cache).toBe('miss');
    expect(generator).toHaveBeenCalledTimes(1);
    expect(generator).toHaveBeenCalledWith('Testface', 400);
    expect(result.pngPath).toBe(join(cacheDir, 'testface-400.msdf.png'));
    expect(existsSync(result.pngPath)).toBe(true);
    expect(readFileSync(result.pngPath)).toEqual(FAKE_PNG);
    const onDisk = JSON.parse(readFileSync(join(cacheDir, 'testface-400.msdf.json'), 'utf8'));
    expect(onDisk.common.lineHeight).toBe(58);
    expect(result.json.chars[0].id).toBe(65);
  });

  it('second call is a hit: generator does NOT re-run, json comes from disk', async () => {
    const generator = makeGenerator();
    await generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator });
    const second = await generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator });

    expect(second.cache).toBe('hit');
    expect(generator).toHaveBeenCalledTimes(1);
    expect(second.json.common.scaleW).toBe(2048);
    expect(second.pngPath).toBe(join(cacheDir, 'testface-400.msdf.png'));
  });

  it('weights are distinct cache entries', async () => {
    const generator = makeGenerator();
    await generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator });
    const w700 = await generateOrGetAtlas('Testface', 700, { cacheDir, manifest: MANIFEST, generator });

    expect(w700.cache).toBe('miss');
    expect(generator).toHaveBeenCalledTimes(2);
    expect(existsSync(join(cacheDir, 'testface-700.msdf.png'))).toBe(true);
  });

  it('multi-word families slug into the cache filename', async () => {
    const generator = makeGenerator();
    expect(slugifyFamily('Spaced Out Display')).toBe('spaced-out-display');
    const result = await generateOrGetAtlas('Spaced Out Display', 400, { cacheDir, manifest: MANIFEST, generator });
    expect(result.pngPath).toBe(join(cacheDir, 'spaced-out-display-400.msdf.png'));
  });
});

describe('atlas-gen — in-flight dedupe', () => {
  it('concurrent first calls share ONE generator run', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const generator = vi.fn(async () => {
      await gate;
      return { png: FAKE_PNG, json: structuredClone(FAKE_JSON) };
    });

    const p1 = generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator });
    const p2 = generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator });
    release();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(generator).toHaveBeenCalledTimes(1);
    expect(r1.cache).toBe('miss');
    expect(r2.cache).toBe('miss');
    expect(r2.pngPath).toBe(r1.pngPath);
  });
});

describe('atlas-gen — manifest gate + failure honesty', () => {
  it('unknown family rejects with UnknownFontError before the generator runs', async () => {
    const generator = makeGenerator();
    await expect(
      generateOrGetAtlas('Definitely Not A Font', 400, { cacheDir, manifest: MANIFEST, generator }),
    ).rejects.toBeInstanceOf(UnknownFontError);
    expect(generator).not.toHaveBeenCalled();
  });

  it('listed family with an unlisted weight rejects with UnknownFontError', async () => {
    const generator = makeGenerator();
    await expect(
      generateOrGetAtlas('Spaced Out Display', 900, { cacheDir, manifest: MANIFEST, generator }),
    ).rejects.toBeInstanceOf(UnknownFontError);
    expect(generator).not.toHaveBeenCalled();
  });

  it('a failed bake writes nothing and the pair is retryable', async () => {
    const generator = vi
      .fn()
      .mockRejectedValueOnce(new Error('bake exploded'))
      .mockResolvedValueOnce({ png: FAKE_PNG, json: structuredClone(FAKE_JSON) });

    await expect(
      generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator }),
    ).rejects.toThrow('bake exploded');
    expect(existsSync(join(cacheDir, 'testface-400.msdf.png'))).toBe(false);
    expect(existsSync(join(cacheDir, 'testface-400.msdf.json'))).toBe(false);

    const retry = await generateOrGetAtlas('Testface', 400, { cacheDir, manifest: MANIFEST, generator });
    expect(retry.cache).toBe('miss');
    expect(generator).toHaveBeenCalledTimes(2);
  });
});
