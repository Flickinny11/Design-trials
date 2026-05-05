// T08 Playwright harness entrypoint — Animation tab surface.
//
// Mounts a vanilla-DOM Animation tab against the pure-logic modules:
//   - `@/lib/prism-graph/animation-presets`     (PowerPoint preset library)
//   - `@/lib/prism-graph/animation-keyframes`   (capture / replay)
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §13 L479 (hybrid mode toggle, presets,
//     keyframe capture).
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L539 (DoD #9: capture + replay
//     parameter snapshots).

import {
  ANIMATION_PRESET_LIBRARY,
  applyAnimationPreset,
  type AnimationPreset,
  type AnimationPresetCategory,
} from '@/lib/prism-graph/animation-presets';
import {
  ANIMATION_TAB_MODES,
  captureKeyframe,
  createKeyframeTimeline,
  replayKeyframeTimeline,
  type AnimationTabMode,
  type KeyframeParams,
  type KeyframeTimeline,
} from '@/lib/prism-graph/animation-keyframes';
import type { CinematicPrimitiveRef } from '@/lib/prism-graph/cinematic-primitives';

const CATEGORIES: AnimationPresetCategory[] = ['entrance', 'emphasis', 'exit', 'motion-path'];

interface State {
  mode: AnimationTabMode;
  liveParams: KeyframeParams;
  timeline: KeyframeTimeline;
  primitives: CinematicPrimitiveRef[];
  lastReplay: KeyframeParams | null;
}

const state: State = {
  mode: 'i2v-frame-scrub',
  liveParams: { scale: 1, opacity: 1, rotation: 0, x: 0, y: 0 },
  timeline: createKeyframeTimeline(),
  primitives: [],
  lastReplay: null,
};

function el<T extends HTMLElement>(tag: string, attrs: Record<string, string> = {}, text?: string): T {
  const e = document.createElement(tag) as T;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildModeToggle(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'animation-mode-toggle' });
  for (const m of ANIMATION_TAB_MODES) {
    const btn = el<HTMLButtonElement>('button', {
      type: 'button',
      'data-role': 'animation-mode-option',
      'data-mode': m,
    }, m);
    btn.addEventListener('click', () => setMode(m));
    wrap.appendChild(btn);
  }
  return wrap;
}

function buildPresetLibrary(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'preset-library' });
  for (const cat of CATEGORIES) {
    const group = el<HTMLDivElement>('section', {
      'data-role': 'preset-group',
      'data-category': cat,
    });
    const title = el<HTMLHeadingElement>('h3', {}, cat);
    group.appendChild(title);
    for (const p of ANIMATION_PRESET_LIBRARY[cat]) {
      const btn = el<HTMLButtonElement>('button', {
        type: 'button',
        'data-role': 'preset-button',
        'data-preset-id': p.id,
        'data-primitive': p.primitive,
        'data-trigger': p.trigger,
      }, p.label);
      btn.addEventListener('click', () => onPresetClick(p));
      group.appendChild(btn);
    }
    wrap.appendChild(group);
  }
  return wrap;
}

function buildTimelinePane(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'timeline-pane' });

  const track = el<HTMLDivElement>('div', { 'data-role': 'keyframe-track' });
  wrap.appendChild(track);

  const captureBtn = el<HTMLButtonElement>('button', {
    type: 'button',
    'data-role': 'capture-keyframe',
  }, 'Capture Keyframe');
  captureBtn.addEventListener('click', () => onCapture(0));
  wrap.appendChild(captureBtn);

  const replayBtn = el<HTMLButtonElement>('button', {
    type: 'button',
    'data-role': 'replay-keyframes',
  }, 'Replay');
  replayBtn.addEventListener('click', () => onReplay());
  wrap.appendChild(replayBtn);

  const count = el<HTMLSpanElement>('span', { 'data-role': 'keyframe-count' }, '0');
  wrap.appendChild(count);

  return wrap;
}

function buildScrubPane(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'scrub-pane' });
  const slider = el<HTMLInputElement>('input', {
    type: 'range',
    min: '0', max: '1', step: '0.01', value: '0',
    'data-role': 'frame-scrub-slider',
  });
  wrap.appendChild(slider);
  return wrap;
}

function buildLiveParamsPane(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'live-params' });
  for (const key of ['scale', 'opacity', 'rotation', 'x', 'y'] as const) {
    const row = el<HTMLDivElement>('div');
    const label = el<HTMLLabelElement>('label', {}, key);
    const input = el<HTMLInputElement>('input', {
      type: 'number',
      step: '0.01',
      'data-role': 'param-input',
      'data-param': key,
      value: String(state.liveParams[key]),
    });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      state.liveParams = { ...state.liveParams, [key]: v };
    });
    row.appendChild(label);
    row.appendChild(input);
    wrap.appendChild(row);
  }
  return wrap;
}

function buildReplayReadoutPane(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'replay-readout-pane' });
  for (const key of ['scale', 'opacity', 'rotation', 'x', 'y'] as const) {
    const span = el<HTMLSpanElement>('span', {
      'data-role': 'replay-readout',
      'data-param': key,
    }, '0');
    wrap.appendChild(span);
  }
  return wrap;
}

function buildPrimitivesList(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'cinematic-primitives' });
  const count = el<HTMLSpanElement>('span', { 'data-role': 'cinematic-primitives-count' }, '0');
  wrap.appendChild(count);
  const list = el<HTMLUListElement>('ul', { 'data-role': 'cinematic-primitive-list' });
  wrap.appendChild(list);
  return wrap;
}

function buildModeIndicator(): HTMLElement {
  return el<HTMLDivElement>('div', {
    'data-role': 'animation-mode-active',
    'data-mode': state.mode,
  }, state.mode);
}

function setMode(m: AnimationTabMode): void {
  state.mode = m;
  const indicator = document.querySelector('[data-role=animation-mode-active]');
  if (indicator) {
    indicator.setAttribute('data-mode', m);
    indicator.textContent = m;
  }
  const timelinePane = document.querySelector<HTMLElement>('[data-role=timeline-pane]');
  const scrubPane = document.querySelector<HTMLElement>('[data-role=scrub-pane]');
  if (timelinePane) timelinePane.style.display = m === 'timeline-keyframe' ? '' : 'none';
  if (scrubPane) scrubPane.style.display = m === 'i2v-frame-scrub' ? '' : 'none';
}

function onPresetClick(p: AnimationPreset): void {
  const ref = applyAnimationPreset(p);
  state.primitives = [...state.primitives, ref];
  refreshPrimitivesList();
}

function refreshPrimitivesList(): void {
  const count = document.querySelector('[data-role=cinematic-primitives-count]');
  if (count) count.textContent = String(state.primitives.length);
  const list = document.querySelector('[data-role=cinematic-primitive-list]');
  if (!list) return;
  list.innerHTML = '';
  state.primitives.forEach((ref, i) => {
    const li = el<HTMLLIElement>('li', {
      'data-role': 'cinematic-primitive-entry',
      'data-name': ref.name,
      'data-trigger': ref.trigger,
      'data-index': String(i),
    });
    li.textContent = `${ref.name} (${ref.trigger})`;
    list.appendChild(li);
  });
}

function onCapture(t: number): void {
  state.timeline = captureKeyframe(state.timeline, t, { ...state.liveParams });
  const count = document.querySelector('[data-role=keyframe-count]');
  if (count) count.textContent = String(state.timeline.keyframes.length);
  const track = document.querySelector('[data-role=keyframe-track]');
  if (track) {
    track.innerHTML = '';
    state.timeline.keyframes.forEach((k, i) => {
      const node = el<HTMLDivElement>('div', {
        'data-role': 'keyframe-marker',
        'data-index': String(i),
        'data-t': String(k.t),
      });
      track.appendChild(node);
    });
  }
}

function onReplay(): void {
  // Replay the first keyframe (t=0). Tests assert the captured snapshot
  // round-trips through replay at the same t.
  const t = state.timeline.keyframes.length > 0 ? state.timeline.keyframes[0].t : 0;
  const replayed = replayKeyframeTimeline(state.timeline, t);
  state.lastReplay = replayed;
  for (const key of ['scale', 'opacity', 'rotation', 'x', 'y'] as const) {
    const span = document.querySelector(`[data-role=replay-readout][data-param=${key}]`);
    if (span) span.textContent = String(replayed[key]);
  }
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');

  app.appendChild(buildModeToggle());
  app.appendChild(buildModeIndicator());
  app.appendChild(buildLiveParamsPane());
  app.appendChild(buildScrubPane());
  app.appendChild(buildTimelinePane());
  app.appendChild(buildReplayReadoutPane());
  app.appendChild(buildPresetLibrary());
  app.appendChild(buildPrimitivesList());

  setMode(state.mode);

  document.body.dataset.t08AnimationReady = '1';
}

boot();
