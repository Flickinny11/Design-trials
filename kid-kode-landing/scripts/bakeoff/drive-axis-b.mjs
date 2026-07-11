#!/usr/bin/env node
// W-BAKE-B — axis driver: spawns run-gen-b.mjs for each applicable contestant,
// capping concurrent LANES so we spread load across providers without tripping
// rate limits (each lane also has its own intra-lane concurrency). One process
// to monitor. The global $120 cap + per-lane caps are enforced inside
// run-gen-b.mjs; this driver just schedules lanes.
//
// Usage: node scripts/bakeoff/drive-axis-b.mjs --axis functional|design
//          [--max-lanes 4] [--only id1,id2] [--runs N]

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTESTANTS } from './contestants-b.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const AXIS = argOf('--axis', null);
const MAX_LANES = Number(argOf('--max-lanes', '4'));
const RUNS = argOf('--runs', null);
const ONLY = argOf('--only', null)?.split(',');
if (!['functional', 'design'].includes(AXIS)) { console.error('need --axis functional|design'); process.exit(2); }

let lanes = CONTESTANTS.filter((c) => c.axes.includes(AXIS));
if (ONLY) lanes = lanes.filter((c) => ONLY.includes(c.id));
// Order cheapest-first so the most evidence lands before any cap bites; premium
// lanes (which may truncate) run last.
const cost = (c) => (c.usdPerMTokOut ?? 0) + (c.usdPerMTokIn ?? 0);
lanes.sort((a, b) => cost(a) - cost(b));

console.log(`[drive ${AXIS}] ${lanes.length} lanes, max ${MAX_LANES} concurrent: ${lanes.map((l) => l.id).join(', ')}`);

function runLane(c) {
  return new Promise((resolve) => {
    const a = [path.join(HERE, 'run-gen-b.mjs'), '--contestant', c.id, '--axis', AXIS];
    if (RUNS) a.push('--runs', RUNS);
    const p = spawn('node', a, { cwd: path.resolve(HERE, '..', '..'), stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const cap = (buf) => { tail = (tail + buf.toString()).slice(-2000); };
    p.stdout.on('data', cap); p.stderr.on('data', cap);
    p.on('close', (code) => {
      const last = tail.trim().split('\n').slice(-1)[0] ?? '';
      console.log(`[lane ${c.id}] exit ${code} :: ${last}`);
      resolve();
    });
  });
}

const queue = [...lanes];
let active = 0;
await new Promise((done) => {
  const pump = () => {
    if (queue.length === 0 && active === 0) return done();
    while (active < MAX_LANES && queue.length) {
      const c = queue.shift();
      active += 1;
      runLane(c).then(() => { active -= 1; pump(); });
    }
  };
  pump();
});
console.log(`[drive ${AXIS}] ALL LANES COMPLETE`);
