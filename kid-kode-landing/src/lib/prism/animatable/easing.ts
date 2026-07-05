// Named easing functions for the 'curve' control. Pure math, no deps.
// All take normalized t in [0,1] and return an eased value (may overshoot for
// back/elastic). Used by primitives via ease(name, t).

import type { EaseName } from './contract';

const c1 = 1.70158;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const n1 = 7.5625;
const d1 = 2.75;

export function bounceOut(t: number): number {
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

const TABLE: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  backOut: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  elasticOut: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1,
  bounceOut,
};

export function ease(name: EaseName, t: number): number {
  const fn = TABLE[name] ?? TABLE.linear;
  return fn(t < 0 ? 0 : t > 1 ? 1 : t);
}
