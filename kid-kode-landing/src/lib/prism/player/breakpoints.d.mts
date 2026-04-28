export type BreakpointName = 'desktop-wide' | 'desktop' | 'tablet' | 'mobile';

export const BREAKPOINT_ORDER: ReadonlyArray<BreakpointName>;

export function classifyBreakpoint(width: number): BreakpointName;

export interface VisualTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}

export interface ResolvableVisual {
  transform: VisualTransform;
  transformByBreakpoint?: Partial<Record<BreakpointName, VisualTransform>>;
  visibleAtBreakpoints?: ReadonlyArray<BreakpointName>;
}

export function resolveTransform(visual: ResolvableVisual, active: BreakpointName): VisualTransform;

export function isVisibleAtBreakpoint(visual: Pick<ResolvableVisual, 'visibleAtBreakpoints'>, active: BreakpointName): boolean;
