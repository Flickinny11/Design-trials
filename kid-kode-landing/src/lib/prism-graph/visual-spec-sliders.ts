// T07 stub — implementation pending. Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md
// §13 L477 ("sliders bound to visualSpec fields"). The Playwright/vitest tests
// committed alongside this stub assert the real shape; this throw makes them
// fail until step 7 lands the implementation.
import type { PrismNode } from './types';

export interface VisualSpecSlider {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  group: 'transform' | 'visual' | 'render-mode';
  appliesTo: PrismNode['renderMode'][] | 'all';
}

export function buildVisualSpecSliders(_node: PrismNode): VisualSpecSlider[] {
  throw new Error('T07 not implemented: buildVisualSpecSliders');
}
