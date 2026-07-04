// SHELL W1A — tenant store isolation walls (I11, data layer).
//
// Module-level proof that the store itself fails closed — the HTTP-level
// two-user probe (scripts/verify-tenant-isolation.mjs) proves the same
// property end-to-end through the real routes.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let dir: string;
let store: typeof import('../../src/server/tenancy/tenant-store');

const A = 'tenant-alpha';
const B = 'tenant-beta';

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'prism-tenancy-'));
  process.env.PRISM_TENANCY_DIR = dir;
  store = await import('../../src/server/tenancy/tenant-store');
});

afterAll(() => {
  delete process.env.PRISM_TENANCY_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('tenant-store isolation (I11)', () => {
  it('projects are visible ONLY under their owner tenant', async () => {
    const pa = await store.createProject(A, { name: 'Alpha One' });
    const pb = await store.createProject(B, { name: 'Beta One' });

    expect((await store.listProjects(A)).map((p) => p.id)).toEqual([pa.id]);
    expect((await store.listProjects(B)).map((p) => p.id)).toEqual([pb.id]);

    // Cross-tenant get: NOT FOUND, indistinguishable from nonexistent.
    expect(await store.getProject(B, pa.id)).toBeNull();
    expect(await store.getProject(A, pb.id)).toBeNull();
    expect(await store.getProject(A, 'proj-does-not-exist')).toBeNull();
  });

  it('graph save/get fail closed across tenants', async () => {
    const pa = (await store.listProjects(A))[0];
    const saved = await store.saveGraph(A, pa.id, { nodes: [{ id: 'n1' }] });
    expect(saved?.graphRef).toContain(pa.id);

    expect(await store.getGraph(A, pa.id)).toEqual({ nodes: [{ id: 'n1' }] });
    expect(await store.getGraph(B, pa.id)).toBeNull();
    expect(await store.saveGraph(B, pa.id, { stolen: true })).toBeNull();
    // And the owner's graph is untouched by the failed foreign write.
    expect(await store.getGraph(A, pa.id)).toEqual({ nodes: [{ id: 'n1' }] });
  });

  it('versions snapshot immutably and stay tenant-scoped', async () => {
    const pa = (await store.listProjects(A))[0];
    const v = await store.createVersion(A, pa.id, 'checkpoint');
    expect(v?.graphSnapshotRef).toContain(v!.id);

    // Mutate the live graph — the E1 snapshot pointer must be unaffected
    // (listVersions still returns the checkpoint; its ref is immutable).
    await store.saveGraph(A, pa.id, { nodes: [] });
    const versions = await store.listVersions(A, pa.id);
    expect(versions?.map((x) => x.id)).toEqual([v!.id]);

    expect(await store.listVersions(B, pa.id)).toBeNull();
    expect(await store.createVersion(B, pa.id, 'steal')).toBeNull();
  });

  it('assets are content-addressed and tenant-scoped', async () => {
    const pa = (await store.listProjects(A))[0];
    const data = Buffer.from('prism-asset-bytes');
    const asset = await store.putAsset(A, pa.id, {
      name: 'hero.bin',
      mimeType: 'application/octet-stream',
      data,
    });
    expect(asset?.id).toMatch(/^[a-f0-9]{64}$/);

    const roundTrip = await store.getAsset(A, pa.id, asset!.id);
    expect(roundTrip?.data.equals(data)).toBe(true);

    expect(await store.getAsset(B, pa.id, asset!.id)).toBeNull();
    expect(await store.putAsset(B, pa.id, { name: 'x', mimeType: 'a/b', data })).toBeNull();
  });

  it('traversal-shaped ids throw before any fs access', async () => {
    await expect(store.listProjects('../escape')).rejects.toThrow(/invalid tenant/);
    await expect(store.getProject(A, '../../etc')).rejects.toThrow(/invalid project/);
    await expect(store.getProject('a/b', 'proj-x')).rejects.toThrow(/invalid tenant/);
  });
});
