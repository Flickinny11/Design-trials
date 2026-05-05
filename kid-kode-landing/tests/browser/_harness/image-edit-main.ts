// T08 Playwright harness entrypoint — Image-edit tools surface.
//
// Mounts a vanilla-DOM Image-edit panel against the pure-logic module:
//   - `@/lib/prism-graph/image-edit-tools`  (mask refinement, crop, swap)
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L483.

import {
  applyCrop,
  applyMaskRefinement,
  swapMeshForImage,
} from '@/lib/prism-graph/image-edit-tools';
import type { PrismLayer, PrismNode } from '@/lib/prism-graph/types';

let node: PrismNode = {
  nodeId: 'product-hero',
  subtype: 'product',
  parentHubId: 'home',
  serviceTag: 'demo',
  visual: {
    sourceAsset: 'product.png',
    transform: { x: 0, y: 0, width: 400, height: 300, z: 0 },
    shape: 'rounded',
    shapeRadius: 12,
    alpha: 1,
  },
  intent: {
    caption: 'Product hero',
    behaviorSpec: {
      interactions: [{ event: 'click', effect: 'navigate-detail' }],
      apiCalls: [{ endpoint: '/api/product/1', method: 'GET' }],
      dataBindings: [{ source: 'product.name', target: 'title' }],
      emits: ['product-clicked'],
      listens: ['cart-updated'],
      triggersDownstream: [],
    },
    stateEffects: ['cart-add'],
    visualSpec: {
      textContent: [],
      layers: [{ id: 'l1', type: 'sprite' }, { id: 'l2', type: 'overlay' }],
    },
    contracts: { inputs: { id: 'string' }, outputs: { added: 'boolean' } },
  },
  codeRef: 'nodes/product-hero.js',
  backendRef: 'backends/cart',
  renderMode: 'mesh',
  depthMapUrl: null,
  meshUrl: 'meshes/product-hero.glb',
  cinematicPrimitives: [
    { name: 'orbit', params: { speed: 0.5 }, trigger: 'load' },
    { name: 'magnetic-cursor', params: { radius: 80 }, trigger: 'hover' },
  ],
  scenePosition: {
    x: 0, y: 0, z: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    scaleX: 1, scaleY: 1, scaleZ: 1,
  },
};

function el<T extends HTMLElement>(tag: string, attrs: Record<string, string> = {}, text?: string): T {
  const e = document.createElement(tag) as T;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildToolButton(tool: string, action: string, label: string): HTMLDivElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'image-edit-tool', 'data-tool': tool });
  const btn = el<HTMLButtonElement>('button', { type: 'button', 'data-action': action }, label);
  wrap.appendChild(btn);
  return wrap;
}

function buildSwapTool(): HTMLElement {
  const wrap = buildToolButton('swap-mesh-for-image', 'swap', 'Swap Mesh for Image');
  const btn = wrap.querySelector('button')!;
  btn.addEventListener('click', () => {
    node = swapMeshForImage(node);
    refreshNodeReadout();
  });
  return wrap;
}

function buildCropTool(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'image-edit-tool', 'data-tool': 'crop' });
  const inputs = (['x', 'y', 'width', 'height'] as const).map((axis) => {
    const inp = el<HTMLInputElement>('input', {
      type: 'number',
      'data-role': 'crop-input',
      'data-axis': axis,
      value: '0',
    });
    wrap.appendChild(inp);
    return inp;
  });
  const apply = el<HTMLButtonElement>('button', { type: 'button', 'data-action': 'apply-crop' }, 'Apply Crop');
  apply.addEventListener('click', () => {
    const [x, y, w, h] = inputs.map((i) => Number(i.value));
    node = applyCrop(node, { x, y, width: w, height: h });
    refreshNodeReadout();
  });
  wrap.appendChild(apply);
  return wrap;
}

function buildMaskTool(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'image-edit-tool', 'data-tool': 'mask' });
  const targetSel = el<HTMLSelectElement>('select', { 'data-role': 'mask-target-select' });
  for (const layer of node.intent.visualSpec.layers) {
    const opt = el<HTMLOptionElement>('option', { value: layer.id }, layer.id);
    targetSel.appendChild(opt);
  }
  wrap.appendChild(targetSel);

  const shapeSel = el<HTMLSelectElement>('select', { 'data-role': 'mask-shape-select' });
  for (const s of ['circle', 'rounded', 'rect']) {
    const opt = el<HTMLOptionElement>('option', { value: s }, s);
    shapeSel.appendChild(opt);
  }
  wrap.appendChild(shapeSel);

  const radiusInp = el<HTMLInputElement>('input', {
    type: 'number',
    'data-role': 'mask-radius-input',
    value: '32',
  });
  wrap.appendChild(radiusInp);

  const apply = el<HTMLButtonElement>('button', { type: 'button', 'data-action': 'apply-mask' }, 'Apply Mask');
  apply.addEventListener('click', () => {
    const layerId = targetSel.value;
    const shape = shapeSel.value;
    const radius = Number(radiusInp.value);
    node = applyMaskRefinement(node, layerId, { shape, radius });
    refreshNodeReadout();
  });
  wrap.appendChild(apply);
  return wrap;
}

function buildNodeReadout(): HTMLElement {
  const wrap = el<HTMLDivElement>('div', { 'data-role': 'node-readout' });

  const renderMode = el<HTMLSpanElement>('span', { 'data-role': 'node-render-mode' });
  const meshUrl = el<HTMLSpanElement>('span', { 'data-role': 'node-mesh-url' });
  const primCount = el<HTMLSpanElement>('span', { 'data-role': 'node-primitives-count' });
  const behaviorJson = el<HTMLPreElement>('pre', { 'data-role': 'node-behavior-json' });

  wrap.appendChild(renderMode);
  wrap.appendChild(meshUrl);
  wrap.appendChild(primCount);
  wrap.appendChild(behaviorJson);

  for (const axis of ['x', 'y', 'width', 'height'] as const) {
    const span = el<HTMLSpanElement>('span', {
      'data-role': 'visual-transform-readout',
      'data-axis': axis,
    });
    wrap.appendChild(span);
  }

  for (const layer of node.intent.visualSpec.layers) {
    const span = el<HTMLSpanElement>('span', {
      'data-role': 'layer-mask-readout',
      'data-layer': layer.id,
    });
    wrap.appendChild(span);
  }

  return wrap;
}

function refreshNodeReadout(): void {
  const rm = document.querySelector('[data-role=node-render-mode]');
  if (rm) rm.textContent = String(node.renderMode ?? '');
  const mu = document.querySelector('[data-role=node-mesh-url]');
  if (mu) mu.textContent = node.meshUrl === null ? 'null' : String(node.meshUrl ?? '');
  const pc = document.querySelector('[data-role=node-primitives-count]');
  if (pc) pc.textContent = String((node.cinematicPrimitives ?? []).length);
  const bj = document.querySelector('[data-role=node-behavior-json]');
  if (bj) bj.textContent = JSON.stringify(node.intent.behaviorSpec);

  for (const axis of ['x', 'y', 'width', 'height'] as const) {
    const span = document.querySelector(`[data-role=visual-transform-readout][data-axis=${axis}]`);
    if (span) span.textContent = String(node.visual.transform[axis]);
  }

  for (const layer of node.intent.visualSpec.layers as PrismLayer[]) {
    const span = document.querySelector(`[data-role=layer-mask-readout][data-layer=${layer.id}]`);
    if (!span) continue;
    if (!layer.mask) {
      span.textContent = 'none';
    } else {
      span.textContent = `${String(layer.mask.shape ?? '')}:${String(layer.mask.radius ?? '')}`;
    }
  }
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');
  app.appendChild(buildSwapTool());
  app.appendChild(buildCropTool());
  app.appendChild(buildMaskTool());
  app.appendChild(buildNodeReadout());
  refreshNodeReadout();
  document.body.dataset.t08ImageEditReady = '1';
}

boot();
