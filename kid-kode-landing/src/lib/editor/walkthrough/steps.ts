'use client';

// GUIDED-TIPS — the authored walkthrough sequence (P0, pure DATA).
//
// Seven steps that walk a first-time, non-technical user across the core editor
// surfaces while Prism DRIVES the screen (driven cursor + spotlight + 3D popup):
//   1 welcome    — the 3-mode toggle (the spine of the editor)        [dom]
//   2 galaxy     — the universe of hubs                               [scene]
//   3 canvas     — the authoring surface + toolbar                    [dom]
//   4 inspector  — per-node properties (selects a node to reveal it)  [dom]
//   5 build      — adding nodes / elements                            [dom]
//   6 preview    — the running app                                    [scene]
//   7 relaunch   — the lightbulb re-triggers this anytime             [dom]
//
// Each step names the in-scene 3D artifact primitive (C7) and the composition of
// named primitives/techniques its popup entrance uses (C8). Selectors are
// resolved live by the host; a missing one degrades to a centred popup.

import type { WalkthroughStep } from './types';

export const WALKTHROUGH_STEPS: ReadonlyArray<WalkthroughStep> = [
  {
    id: 'welcome',
    kicker: 'WELCOME TO PRISM',
    title: 'Three views, one living scene',
    body: 'Prism is one continuous 3D scene with three views. This control switches between them — Galaxy, Canvas, and your running Preview App. Let me show you around.',
    viewMode: 'galaxy',
    highlightMode: 'dom',
    targetSelector: '[data-component="view-mode-toggle"]',
    artifact: { primitive: 'prism-spectrum', subject: 'card', accent: 'brass' },
    composition: ['prism-spectrum', 'glass frame', 'holographic glint', 'kinetic-text entrance'],
    a11yLabel: 'Guided tour step 1 of 7: Welcome — the view-mode switcher.',
  },
  {
    id: 'galaxy',
    kicker: 'GALAXY',
    title: 'Your whole app, as a universe',
    body: 'Galaxy view shows every hub of your app as a world you can fly between. The camera is fully free here — explore the structure of everything you have built.',
    viewMode: 'galaxy',
    highlightMode: 'scene',
    artifact: { primitive: 'glass-refraction', subject: 'sphere', accent: 'ice' },
    composition: ['glass-refraction', 'dispersion edge', 'scene spotlight dim'],
    a11yLabel: 'Guided tour step 2 of 7: Galaxy view — navigate the universe of hubs.',
  },
  {
    id: 'canvas',
    kicker: 'CANVAS',
    title: 'Where you compose a hub',
    body: 'Canvas view is the authoring surface for one hub. This toolbar holds your tools — add artifacts, drop prebuilt elements, place 3D objects, and shape the scene.',
    viewMode: 'canvas',
    highlightMode: 'dom',
    targetSelector: '[data-component="canvas-toolbar"]',
    artifact: { primitive: 'holographic', subject: 'card', accent: 'brass' },
    composition: ['holographic', 'glass card', 'glitch-in reveal'],
    a11yLabel: 'Guided tour step 3 of 7: Canvas view — the authoring toolbar.',
  },
  {
    id: 'inspector',
    kicker: 'INSPECTOR',
    title: 'Tune any element',
    body: 'Select anything and the Inspector opens here — visuals, materials, behavior, animation, and connections. Every knob updates the live scene in real time.',
    viewMode: 'canvas',
    prepare: 'select-first-node',
    highlightMode: 'dom',
    targetSelector: '[data-component="inspector"]',
    artifact: { primitive: 'dispersion', subject: 'card', accent: 'ice' },
    composition: ['dispersion', 'frosted-glass panel', 'kinetic-text entrance'],
    a11yLabel: 'Guided tour step 4 of 7: Inspector — edit a selected element.',
  },
  {
    id: 'build',
    kicker: 'BUILD',
    title: 'Add to your world',
    body: 'Add new nodes, or drop in prebuilt 3D elements and objects from the libraries. Everything you add becomes part of the same living scene.',
    viewMode: 'canvas',
    highlightMode: 'dom',
    targetSelector: '[data-component="add-node-button"]',
    artifact: { primitive: 'glitch-displace', subject: 'card', accent: 'brass' },
    composition: ['glitch-displace', 'holographic glint', 'glass frame'],
    a11yLabel: 'Guided tour step 5 of 7: Build — add nodes and elements.',
  },
  {
    id: 'preview',
    kicker: 'PREVIEW APP',
    title: 'See it running',
    body: 'Preview App is the same scene, running as your real app — editor chrome falls away and you can navigate it like a visitor would. This is what you ship.',
    viewMode: 'preview-app',
    highlightMode: 'scene',
    artifact: { primitive: 'split-stagger', subject: 'text', accent: 'brass' },
    composition: ['split-stagger kinetic-text', 'glass frame', 'scene spotlight dim'],
    a11yLabel: 'Guided tour step 6 of 7: Preview App — the running app.',
  },
  {
    id: 'relaunch',
    kicker: 'ANYTIME',
    title: 'Open this tour whenever',
    body: 'That is the tour. Tap the glowing lightbulb in the top-right corner whenever you want to run it again. Now go build something extraordinary.',
    viewMode: 'galaxy',
    highlightMode: 'dom',
    targetSelector: '[data-component="guided-tips-lightbulb"]',
    artifact: { primitive: 'holo-glass', subject: 'sphere', accent: 'brass' },
    composition: ['holo-glass', 'iridescent fresnel', 'holographic glint'],
    a11yLabel: 'Guided tour step 7 of 7: Re-launch from the lightbulb anytime.',
  },
];

export const WALKTHROUGH_STEP_COUNT = WALKTHROUGH_STEPS.length;
