'use client';

// EDITOR-EXP C9 — ColorPicker was extracted to `shared-editors/` so BOTH the
// node-editor Inspector and the CanvasToolbar object flyout mount the SAME
// editor (architecture-inversion fix). This shim preserves the historical
// `panels/ColorPicker` import path; the real component lives in
// `@/components/editor/shared-editors/ColorPicker`.
export { ColorPicker } from '@/components/editor/shared-editors/ColorPicker';
