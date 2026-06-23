// Bespoke 3D icon registry for the liquid-glass toolbar.
//
// WAVE 3 fills this in: one bespoke, colored, animated 3D icon mesh per tool
// (extruded shapes with bevels + gradients + shadows + idle motion). ZERO
// emoji, ZERO Lucide/line-drawings, ZERO lightning/box/generic glyphs
// (DESIGN LAW B.1 defect gate). Until then this returns undefined so the
// ToolButton3D placeholder stud renders.

import type { ReactNode } from 'react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function iconFor(_id: string, _accent: string): ReactNode | undefined {
  return undefined;
}
