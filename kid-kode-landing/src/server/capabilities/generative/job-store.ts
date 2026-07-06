// PRISM SHELL-W10 — generative JOB store. Server-only.
//
// 3D generation is long-running (submit → poll → asset ref). The route's `submit`
// creates a job record and kicks off a background worker (not awaited); `poll`
// reads the record. State lives BOTH in an in-process map (fast, mutated live by
// the worker) AND on disk (.data/generative-jobs.json) so a poll survives an HMR
// re-evaluation of the route module in dev. No secrets are ever stored — a job
// carries only non-secret params, coarse progress, the resulting asset REFERENCE
// (a public URL), and the recorded cost basis.
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { GenerativeJob } from '../../../lib/capabilities/generative';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'generative-jobs.json');

// Module-global map (survives within a warm server process; re-hydrated from disk
// on cold start / HMR). Keyed by jobId.
const g = globalThis as unknown as { __prismGenJobs?: Map<string, GenerativeJob> };
const jobs: Map<string, GenerativeJob> = g.__prismGenJobs ?? (g.__prismGenJobs = new Map());

let hydrated = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const arr = JSON.parse(raw) as GenerativeJob[];
    for (const j of arr) if (!jobs.has(j.jobId)) jobs.set(j.jobId, j);
  } catch {
    /* first run — no file yet */
  }
}

async function persist(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Keep the file bounded — newest 200 jobs.
  const arr = [...jobs.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 200);
  await fs.writeFile(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

export async function putJob(job: GenerativeJob): Promise<GenerativeJob> {
  await hydrate();
  jobs.set(job.jobId, job);
  await persist();
  return job;
}

/** Patch a job in place (used by the background worker for progress/result). */
export async function patchJob(jobId: string, patch: Partial<GenerativeJob>): Promise<GenerativeJob | null> {
  await hydrate();
  const cur = jobs.get(jobId);
  if (!cur) return null;
  const next: GenerativeJob = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(jobId, next);
  await persist();
  return next;
}

export async function getJob(jobId: string): Promise<GenerativeJob | null> {
  await hydrate();
  return jobs.get(jobId) ?? null;
}

/** Jobs for a node/project, newest first (drives the panel's job list + sourceJob picker). */
export async function listJobs(filter?: { projectId?: string; nodeId?: string }): Promise<GenerativeJob[]> {
  await hydrate();
  return [...jobs.values()]
    .filter((j) => (!filter?.projectId || j.projectId === filter.projectId) && (!filter?.nodeId || j.nodeId === filter.nodeId))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
