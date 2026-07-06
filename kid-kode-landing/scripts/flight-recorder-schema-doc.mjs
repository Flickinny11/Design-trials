#!/usr/bin/env node
// PRISM FLIGHT RECORDER — schema doc GENERATOR (deliverable 1).
//
// Reflects over src/lib/flight-recorder/schema.ts with the TypeScript compiler
// API and emits docs/prism/FLIGHT-RECORDER-SCHEMA.md — so the schema doc is
// GENERATED FROM THE TYPES, never hand-maintained (it can drift only if someone
// forgets to re-run it, which CI can guard). Zero new runtime deps: `typescript`
// is already present (it backs `tsc`).
//
// Usage: node scripts/flight-recorder-schema-doc.mjs [--check]
//   (no flag) writes the doc.
//   --check   fails (exit 1) if the on-disk doc is stale vs the types.

import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SCHEMA = path.join(root, 'src/lib/flight-recorder/schema.ts');
const OUT = path.join(root, 'docs/prism/FLIGHT-RECORDER-SCHEMA.md');

const src = readFileSync(SCHEMA, 'utf8');
const sf = ts.createSourceFile(SCHEMA, src, ts.ScriptTarget.Latest, true);

/** Pull the leading JSDoc/line comment text for a node (best-effort). */
function leadingComment(node) {
  const full = node.getFullText(sf);
  const trivia = full.slice(0, node.getLeadingTriviaWidth(sf));
  const lines = trivia
    .split('\n')
    .map((l) => l.replace(/^\s*\/\*+|\*+\/\s*$|^\s*\*\s?|^\s*\/\/\s?/g, '').trim())
    .filter((l) => l && !/^─+$/.test(l));
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

const interfaces = new Map();
const typeAliases = new Map();
const consts = new Map();

sf.forEachChild((node) => {
  if (ts.isInterfaceDeclaration(node)) {
    const members = node.members.filter(ts.isPropertySignature).map((m) => ({
      name: m.name.getText(sf),
      optional: Boolean(m.questionToken),
      type: m.type ? m.type.getText(sf).replace(/\s+/g, ' ') : 'unknown',
      doc: leadingComment(m),
    }));
    interfaces.set(node.name.text, { doc: leadingComment(node), members });
  } else if (ts.isTypeAliasDeclaration(node)) {
    typeAliases.set(node.name.text, { doc: leadingComment(node), text: node.type.getText(sf).replace(/\s+/g, ' ') });
  } else if (ts.isVariableStatement(node)) {
    for (const d of node.declarationList.declarations) {
      if (d.initializer) consts.set(d.name.getText(sf), d.initializer.getText(sf).replace(/\s+/g, ' '));
    }
  }
});

function table(members) {
  const rows = members.map(
    (m) => `| \`${m.name}\`${m.optional ? '' : ' **(req)**'} | \`${m.type}\` | ${m.doc || ''} |`,
  );
  return ['| Field | Type | Notes |', '| --- | --- | --- |', ...rows].join('\n');
}

const align = consts.get('OTEL_ALIGNMENT') || '';
const semver = (align.match(/semconvVersion:\s*'([^']+)'/) || [])[1] || '(see schema.ts)';
const contentFrom = (align.match(/contentCaptureFrom:\s*'([^']+)'/) || [])[1] || '';
const genStatus = (align.match(/genaiStatus:\s*'([^']+)'/) || [])[1] || '';
const verifiedOn = (align.match(/verifiedOn:\s*'([^']+)'/) || [])[1] || '';
const schemaVer = (consts.get('FLIGHT_RECORDER_SCHEMA_VERSION') || '').replace(/'/g, '').replace(/\s+as\s+const\s*$/, '').trim() || 'prism-fr-v1';

const RECORD_TYPES = ['BuildSessionRecord', 'NodeAttemptRecord', 'EditEventRecord', 'CapabilityUsageRecord', 'VerifySignalRecord', 'UserSignalRecord'];

const lines = [];
lines.push('# Prism Flight Recorder — corpus schema');
lines.push('');
lines.push('> GENERATED from `src/lib/flight-recorder/schema.ts` by');
lines.push('> `scripts/flight-recorder-schema-doc.mjs`. Do not edit by hand — re-run the');
lines.push('> generator. This is the training-corpus contract an acquirer\'s ML engineer reads.');
lines.push('');
lines.push('## Provenance');
lines.push('');
lines.push(`- **Corpus schema version:** \`${schemaVer}\``);
lines.push(`- **OTel Semantic Conventions pinned:** \`${semver}\` (GenAI content-capture shape from \`${contentFrom}\`)`);
lines.push(`- **GenAI conventions status:** \`${genStatus}\` — experimental; treat every \`gen_ai.*\` key as subject to change`);
lines.push(`- **Verified:** ${verifiedOn} (this machine, against opentelemetry.io + the semantic-conventions repo)`);
lines.push('- **Namespaces:** `gen_ai.*` keys are VERBATIM OTel strings (collector-readable); Prism-specific columns live under a separate top-level `prism.*` root, never nested under `gen_ai.*`.');
lines.push('');
lines.push('## Record envelope (every record)');
lines.push('');
const env = interfaces.get('RecordEnvelope');
if (env) {
  if (env.doc) lines.push(`${env.doc}`, '');
  lines.push(table(env.members));
  lines.push('');
}
lines.push('## Record types');
lines.push('');
for (const rt of RECORD_TYPES) {
  const it = interfaces.get(rt);
  if (!it) continue;
  lines.push(`### \`${rt}\``);
  lines.push('');
  if (it.doc) lines.push(it.doc, '');
  const own = it.members.filter((m) => m.name !== 'record_type');
  if (own.length) lines.push(table(own), '');
  else lines.push('_(envelope only)_', '');
}
lines.push('## OTel GenAI attributes (`gen_ai.*`, verbatim)');
lines.push('');
const gen = interfaces.get('GenAiAttributes');
if (gen) {
  if (gen.doc) lines.push(gen.doc, '');
  lines.push(table(gen.members));
  lines.push('');
}
lines.push('## Prism extension attributes (`prism.*`)');
lines.push('');
const pr = interfaces.get('PrismAttributes');
if (pr) {
  if (pr.doc) lines.push(pr.doc, '');
  lines.push(table(pr.members));
  lines.push('');
}
lines.push('## Enumerations');
lines.push('');
for (const [name, t] of typeAliases) {
  if (!/Name|Class|Decision|Touchpoint|Basis|Type/.test(name)) continue;
  const options = t.text.match(/'[^']+'/g);
  if (!options) continue;
  lines.push(`- **\`${name}\`** — ${options.join(', ')}${/string & \{\}/.test(t.text) ? ' _(open enum)_' : ''}`);
}
lines.push('');
lines.push('## Scrub coverage (I-PII / I-SECRETS)');
lines.push('');
lines.push('Scrubbed at WRITE time (`src/lib/flight-recorder/scrub.ts`), proven by');
lines.push('`tests/unit/flight-recorder/scrub.test.ts`:');
lines.push('');
lines.push('- **Redacted with high precision:** emails, phone numbers, US SSN, payment cards, and a broad family of secret/key shapes (provider-prefixed keys `sk-`/`sk-ant-`/`gh*_`/`AIza`/`xox*-`/`sk_live_`/`r8_`, AWS access-key ids, JWTs, bearer tokens, `key=value` secrets, and long hex/base64 blobs). Object fields named like secrets are dropped entirely.');
lines.push('- **Personal names:** redacted precisely when the recorder supplies the actor\'s known identifiers (name + email) — the server always has these. Generic open-vocabulary name NER is a documented SHIP-BRAND enhancement, NOT faked here (data honesty).');
lines.push('');
lines.push('## Consent + quarantine (I-CONSENT)');
lines.push('');
lines.push('Every record carries `consent` + `consent_basis`. `consent=true` records reach the TRAINING sink; `consent=false` records are QUARANTINED to a separate non-training sink so an enterprise opt-out is honored end-to-end. Resolution order: per-call override → tenant flag (seam, wired at SHIP-BRAND) → env default (`PRISM_FR_CONSENT_DEFAULT`).');
lines.push('');
lines.push('## Storage layout');
lines.push('');
lines.push('Append-only NDJSON under `.data/flight-recorder/<family>/<YYYY-MM-DD>/<touchpoint>.ndjson` (gitignored). Partitioned by day + touchpoint. `scripts/flight-recorder-compact.mjs` rolls a day\'s NDJSON into Parquet. An R2 `RemoteObjectSink` is a typed, env-gated seam wired at SHIP-BRAND.');
lines.push('');

const out = lines.join('\n');
const check = process.argv.includes('--check');
if (check) {
  let existing = '';
  try { existing = readFileSync(OUT, 'utf8'); } catch { /* missing */ }
  if (existing.trim() !== out.trim()) {
    console.error('FLIGHT-RECORDER-SCHEMA.md is STALE vs schema.ts — run: node scripts/flight-recorder-schema-doc.mjs');
    process.exit(1);
  }
  console.log('schema doc up to date.');
} else {
  writeFileSync(OUT, out, 'utf8');
  console.log(`wrote ${path.relative(root, OUT)} (${out.length} bytes)`);
}
