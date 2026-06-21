#!/usr/bin/env node
// Reliable graph patcher for the ORRERY fidelity pass. Loads the live graph,
// applies a list of ops, writes canonical 2-space JSON (+ trailing newline) so
// every patch produces a clean, reviewable diff.
//
// Usage: node scripts/fidelity/graph-edit.mjs <ops.json>
// Ops (array):
//   { "nodeId": "id", "set": { "a.b.c": value, ... } }   deep-set dot paths on a node
//   { "nodeId": "id", "merge": { ...partial } }            shallow-merge top-level node fields
//   { "addNode": { ...full node } }                        append a node
//   { "removeNode": "id" }                                 delete a node by id
//   { "top": { "rootNodes.hubRegistry": value } }          deep-set on the root object
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAPH = resolve(__dirname, '../../public/prism-mock/home/live-graph.json');

function deepSet(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function main() {
  const opsPath = process.argv[2];
  if (!opsPath) { console.error('need ops.json path'); process.exit(1); }
  const ops = JSON.parse(readFileSync(resolve(process.cwd(), opsPath), 'utf8'));
  const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));
  const byId = new Map(graph.nodes.map((n) => [n.nodeId, n]));
  let applied = 0;
  const log = [];

  for (const op of ops) {
    if (op.addNode) {
      if (byId.has(op.addNode.nodeId)) { log.push(`SKIP add (exists): ${op.addNode.nodeId}`); continue; }
      graph.nodes.push(op.addNode);
      byId.set(op.addNode.nodeId, op.addNode);
      log.push(`ADD ${op.addNode.nodeId}`); applied++;
      continue;
    }
    if (op.removeNode) {
      const idx = graph.nodes.findIndex((n) => n.nodeId === op.removeNode);
      if (idx < 0) { log.push(`SKIP remove (missing): ${op.removeNode}`); continue; }
      graph.nodes.splice(idx, 1); byId.delete(op.removeNode);
      log.push(`REMOVE ${op.removeNode}`); applied++;
      continue;
    }
    if (op.top) {
      for (const [path, val] of Object.entries(op.top)) deepSet(graph, path, val);
      log.push(`TOP ${Object.keys(op.top).join(',')}`); applied++;
      continue;
    }
    const node = byId.get(op.nodeId);
    if (!node) { log.push(`SKIP (missing node): ${op.nodeId}`); continue; }
    if (op.set) for (const [path, val] of Object.entries(op.set)) deepSet(node, path, val);
    if (op.merge) Object.assign(node, op.merge);
    log.push(`PATCH ${op.nodeId}`); applied++;
  }

  writeFileSync(GRAPH, JSON.stringify(graph, null, 2) + '\n');
  console.log(log.join('\n'));
  console.log(`\nApplied ${applied}/${ops.length} ops. nodes=${graph.nodes.length}`);
}

main();
