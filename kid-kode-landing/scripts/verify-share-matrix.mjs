#!/usr/bin/env node
// SHELL W7 — SHARE / PERMISSION MATRIX PROOF (spec §12 W7 gate)
//
// "Matrix test: each role's allowed/denied actions asserted server-side." This
// seeds a real enterprise org, shares ONE project to three members at three
// roles (view · comment · edit), and asserts — through the real tRPC edge —
// that each role can do exactly what the permission matrix permits and NOTHING
// more. Owner-only actions (rename, setShare) are denied to every grantee; a
// viewer cannot save the graph; an editor can; a non-member sees NOT_FOUND.
//
// Hermetic (own next dev, throwaway auth/tenancy dirs). Enterprise tier set by
// writing the throwaway sqlite (billing sets it in prod). Headless HTTP only.
//
// Run: node scripts/verify-share-matrix.mjs   (wired as verify:share-matrix)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PRISM_MATRIX_PROBE_PORT ?? 4798);
const BASE = `http://localhost:${PORT}`;
const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m';
const results = [];
function check(id, desc, pass, detail = '') {
  results.push({ id, pass });
  console.log(`[${pass ? G + 'PASS' : R + 'FAIL'}${X}] ${id.padEnd(30)} ${desc}${detail ? `\n        ${D}${detail}${X}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeJar() {
  const cookies = new Map();
  return {
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';'); const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() { return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}
async function req(method, path, { jar, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method, redirect: 'manual',
    headers: { origin: BASE, ...(body ? { 'content-type': 'application/json' } : {}), ...(jar ? { cookie: jar.header() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar?.absorb(res);
  let json = null; const text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, text };
}
const enc = (o) => encodeURIComponent(JSON.stringify(o));
const q = (proc, input, jar) => req('GET', `/api/trpc/${proc}?batch=1&input=${enc({ 0: input })}`, { jar });
const mut = (proc, input, jar) => req('POST', `/api/trpc/${proc}?batch=1`, { jar, body: { 0: input } });
const data = (r) => r.json?.[0]?.result?.data;
const codeOf = (r) => r.json?.[0]?.error?.data?.code;
const ok = (r) => !r.json?.[0]?.error;

async function signup(jar, name, email, password) {
  return req('POST', '/api/auth/sign-up/email', { jar, body: { name, email, password } });
}
async function waitForServer(t = 180_000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(`${BASE}/sign-in`)).ok) return true; } catch {} await sleep(750); }
  return false;
}

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'prism-matrix-probe-'));
  const AUTH_DB = join(scratch, 'auth.sqlite');
  console.log(`[matrix] scratch: ${scratch}`);
  const app = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, PRISM_AUTH_DB: AUTH_DB, PRISM_TENANCY_DIR: join(scratch, 'tenancy'), NEXT_TELEMETRY_DISABLED: '1' },
  });
  app.stderr.on('data', () => {});
  const cleanup = () => { try { app.kill('SIGTERM'); } catch {} try { rmSync(scratch, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);
  if (!(await waitForServer())) { console.error('[matrix] app never came up'); process.exit(1); }

  const owner = makeJar(), viewer = makeJar(), commenter = makeJar(), editor = makeJar(), outsider = makeJar();
  await signup(owner, 'Owner', 'owner@m.test', 'owner-pass-123');
  await signup(viewer, 'Viewer', 'viewer@m.test', 'viewer-pass-123');
  await signup(commenter, 'Commenter', 'commenter@m.test', 'commenter-pass-1');
  await signup(editor, 'Editor', 'editor@m.test', 'editor-pass-123');
  await signup(outsider, 'Outsider', 'outsider@m.test', 'outsider-pass-1');

  // Elevate owner to enterprise.
  for (let i = 0; i < 20; i++) {
    try { const db = new DatabaseSync(AUTH_DB); db.exec('PRAGMA busy_timeout=3000'); db.prepare("UPDATE user SET planTier='enterprise' WHERE email='owner@m.test'").run(); db.close(); break; }
    catch { await sleep(300); }
  }

  const ids = {};
  for (const [k, jar] of [['viewer', viewer], ['commenter', commenter], ['editor', editor]]) {
    ids[k] = data(await q('tenancy.me', null, jar))?.user?.id;
  }

  const orgId = data(await mut('sharing.org.create', { name: 'Matrix Org' }, owner))?.id;
  for (const email of ['viewer@m.test', 'commenter@m.test', 'editor@m.test']) {
    await mut('sharing.org.members.add', { orgId, email }, owner);
  }
  const projectId = data(await mut('tenancy.project.create', { name: 'Matrix Project' }, owner))?.id;
  await mut('tenancy.graph.save', { projectId, graph: { nodes: [{ id: 'n1', caption: 'owned' }] } }, owner);
  const shareRes = await mut('sharing.project.setShare', {
    projectId, orgId,
    grants: [
      { subjectType: 'user', subjectUserId: ids.viewer, role: 'view' },
      { subjectType: 'user', subjectUserId: ids.commenter, role: 'comment' },
      { subjectType: 'user', subjectUserId: ids.editor, role: 'edit' },
    ],
  }, owner);
  check('setup.share', 'owner grants view/comment/edit to three members', data(shareRes)?.grants?.length === 3);

  // Expected effective role per member.
  for (const [k, jar, role, collab] of [
    ['viewer', viewer, 'view', false],
    ['commenter', commenter, 'comment', false],
    ['editor', editor, 'edit', true],
  ]) {
    const acc = data(await q('sharing.project.access', { projectId }, jar));
    check(`role.${k}`, `${k} resolves to role='${role}'`, acc?.role === role, `role=${acc?.role}`);
    check(`caps.${k}.view`, `${k} can VIEW`, acc?.capabilities?.view === true);
    check(`caps.${k}.edit`, `${k} edit=${role === 'edit'}`, acc?.capabilities?.edit === (role === 'edit'));
    check(`caps.${k}.collab`, `${k} collaborate=${collab}`, acc?.capabilities?.collaborate === collab);
    check(`caps.${k}.manage`, `${k} CANNOT manage sharing (owner-only)`, acc?.capabilities?.manageSharing === false);
  }

  // Enforcement (not just the capability bag):
  // graph.get — every member (view+) may READ.
  for (const [k, jar] of [['viewer', viewer], ['commenter', commenter], ['editor', editor]]) {
    const g = await q('tenancy.graph.get', { projectId }, jar);
    check(`enforce.${k}.read`, `${k} CAN read the shared graph`, data(g)?.graph?.nodes?.[0]?.caption === 'owned', `code=${codeOf(g)}`);
  }
  // graph.save — only editor+owner may WRITE.
  const vSave = await mut('tenancy.graph.save', { projectId, graph: { nodes: [{ id: 'n1', caption: 'viewer-edit' }] } }, viewer);
  check('enforce.viewer.save', 'viewer save is FORBIDDEN', codeOf(vSave) === 'FORBIDDEN', `code=${codeOf(vSave)}`);
  const cSave = await mut('tenancy.graph.save', { projectId, graph: { nodes: [{ id: 'n1', caption: 'commenter-edit' }] } }, commenter);
  check('enforce.commenter.save', 'commenter save is FORBIDDEN', codeOf(cSave) === 'FORBIDDEN', `code=${codeOf(cSave)}`);
  const eSave = await mut('tenancy.graph.save', { projectId, graph: { nodes: [{ id: 'n1', caption: 'editor-edit' }] } }, editor);
  check('enforce.editor.save', 'editor save SUCCEEDS (edit grants modify)', ok(eSave) && typeof data(eSave)?.graphRef === 'string');
  // Owner sees the editor's write (shared write landed in owner's space).
  const afterEdit = await q('tenancy.graph.get', { projectId }, owner);
  check('enforce.editor.persisted', "editor's write is visible to the owner", data(afterEdit)?.graph?.nodes?.[0]?.caption === 'editor-edit');

  // Owner-only actions denied to grantees (manageSharing / rename).
  const eShare = await mut('sharing.project.setShare', { projectId, orgId, grants: [] }, editor);
  check('enforce.editor.setShare', 'editor CANNOT re-share (owner-only)', codeOf(eShare) === 'NOT_FOUND' || codeOf(eShare) === 'FORBIDDEN', `code=${codeOf(eShare)}`);
  const eRename = await mut('tenancy.project.rename', { projectId, name: 'hijack' }, editor);
  check('enforce.editor.rename', 'editor CANNOT rename (owner-only)', codeOf(eRename) === 'NOT_FOUND', `code=${codeOf(eRename)}`);
  const eDelete = await mut('tenancy.project.delete', { projectId }, editor);
  check('enforce.editor.delete', 'editor CANNOT delete (owner-only)', codeOf(eDelete) === 'NOT_FOUND', `code=${codeOf(eDelete)}`);

  // Outsider (non-member): every path is NOT_FOUND — no leak.
  for (const [proc, kind] of [['sharing.project.access', 'q'], ['tenancy.project.get', 'q'], ['tenancy.graph.get', 'q']]) {
    const r = kind === 'q' ? await q(proc, { projectId }, outsider) : await mut(proc, { projectId }, outsider);
    check(`outsider.${proc.split('.').pop()}`, `outsider ${proc} is NOT_FOUND`, codeOf(r) === 'NOT_FOUND', `code=${codeOf(r)}`);
  }
  const oSave = await mut('tenancy.graph.save', { projectId, graph: { x: 1 } }, outsider);
  check('outsider.save', 'outsider save is NOT_FOUND', codeOf(oSave) === 'NOT_FOUND', `code=${codeOf(oSave)}`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n[matrix] ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.error(`[matrix] MATRIX PROBE FAILED: ${failed.map((f) => f.id).join(', ')}`); process.exit(1); }
  console.log('[matrix] PERMISSION MATRIX GREEN (spec §6.9, W7 gate)');
  process.exit(0);
}

main().catch((err) => { console.error('[matrix] probe crashed:', err); process.exit(1); });
