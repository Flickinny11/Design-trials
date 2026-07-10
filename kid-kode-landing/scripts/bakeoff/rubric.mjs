// W-BAKE — the ONE design-judge rubric (D3 judge, D4 ground truth, D4 critic
// candidates all use THIS text + THESE calibration exemplars — the OD12b
// critic-agreement study requires "same rubric prompt, same few-shot
// exemplars" across ground truth and every candidate).

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './contestants.mjs';

export const EXEMPLARS = [
  path.join(ROOT, 'design-grammar', 'exemplars', 'oversized-type-editorial-01.webp'),
  path.join(ROOT, 'design-grammar', 'exemplars', 'cinematic-video-hero-01.webp'),
];

export const RUBRIC = [
  'You are the DESIGN JUDGE for the Prism model bakeoff. Score each numbered frame 0-100 against',
  'the case visualSpec provided and the Prism Design Law. Be a hard grader: 85+ means founder-shippable',
  'flagship quality; 60-84 competent but flawed; 30-59 clearly deficient; <30 broken or void.',
  '',
  'DESIGN LAW (DL1-16, abridged): DL1 dark-first. DL2 RED/BLACK/WHITE palette discipline (ink surfaces,',
  'paper text, ONE signal red accent; default-blue drift is an automatic MUST-FIX). DL3 typographic',
  'discipline. DL4 no flat glassmorphism. DL6 motion with weight. DL7 engineered precision over soft blur.',
  'DL9 AI-slop tells forbidden. DL10/11 rendered materiality (real light response, not flat fills).',
  'DL12 primary buttons read as physical objects. DL16 rich, never void (a flat empty region is a defect).',
  '',
  'MUST-FIX defect vocabulary (enumerate every one you see, with a REGION anchor like "upper-left',
  'quadrant", "center card", "background field"): FLAT_VOID, ALL_BLACK_ELEMENT, DEFAULT_BLUE_DRIFT,',
  'DEAD_LIGHTING, BROKEN_COMPOSITION, GARBLED_TEXT, MISSING_SPEC_ELEMENT, OFF_PALETTE, BLANK_RENDER,',
  'LOW_CONTRAST, SCALE_ERROR.',
  '',
  'The FIRST TWO images are CALIBRATION EXEMPLARS from the committed design-grammar corpus — treat them',
  'as the ~90 quality bar. They are NOT scored. Score only the numbered frames after them.',
  '',
  'A black, blank, or near-empty frame is scored as rendered (BLANK_RENDER, score <= 10).',
].join('\n');

export function loadCases() {
  const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
  return new Map(
    readdirSync(path.join(VISUAL, 'cases')).filter((f) => f.endsWith('.json')).map((f) => {
      const c = JSON.parse(readFileSync(path.join(VISUAL, 'cases', f), 'utf8'));
      return [c.caseId, c];
    }),
  );
}

export function specBrief(cases, caseId) {
  const c = cases.get(caseId);
  if (!c) return '(spec unavailable)';
  const vs = c.node?.intent?.visualSpec ?? {};
  return [
    `${c.title} [${c.category}] — ${c.node?.intent?.caption ?? ''}`,
    `colors: ${JSON.stringify(vs.colors ?? {}).slice(0, 300)}`,
    `effects: ${String(typeof vs.effects === 'string' ? vs.effects : JSON.stringify(vs.effects ?? '')).slice(0, 450)}`,
  ].join('\n');
}

export const VERDICT_SHAPE = '{ "frames": [ { "frame": "F1", "score": <0-100>, "mustFix": [ { "defect": "...", "region": "..." } ], "notes": "<=25 words" } ] }';
