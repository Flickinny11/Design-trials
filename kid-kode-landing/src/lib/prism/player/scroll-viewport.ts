// Momentum-scroll viewport (§1.5). Mouse wheel / trackpad / touch-drag / keyboard
// all feed into the same velocity integrator. GSAP handles the decay so the
// release feels natural on trackpads and touch.

import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

const WHEEL_TWEEN_S = 0.8;

export interface ScrollViewport {
  root: PIXI.Container;         // what the player adds to the stage
  content: PIXI.Container;      // where nodes are parented
  setContentHeight(h: number): void;
  scrollTo(y: number, opts?: { duration?: number }): void;
  getScrollY(): number;
  destroy(): void;
}

interface Options {
  canvas: HTMLCanvasElement;
  viewportWidth: number;
  viewportHeight: number;
  contentHeight: number;
}

export function createScrollViewport(opts: Options): ScrollViewport {
  const { canvas } = opts;

  const root = new PIXI.Container();
  const content = new PIXI.Container();
  root.addChild(content);

  // Clip content to the viewport using a mask graphic. ALLOWED-GRAPHICS: mask only.
  const mask = new PIXI.Graphics().rect(0, 0, opts.viewportWidth, opts.viewportHeight).fill(0xffffff);
  root.addChild(mask);
  content.mask = mask;

  let contentHeight = opts.contentHeight;
  let scrollY = 0;

  function clamp(y: number) {
    const max = Math.max(0, contentHeight - opts.viewportHeight);
    return Math.min(Math.max(y, 0), max);
  }

  function applyScroll() {
    content.y = -scrollY;
  }

  // Single in-flight tween. Any new scrollTo / wheel input kills the previous
  // so they don't stack, and accumulates its remaining delta into the next
  // target (that's what makes a trackpad burst feel like one continuous
  // momentum throw rather than eight discrete steps).
  let activeTween: gsap.core.Tween | null = null;
  let tweenTarget: number = 0;

  function runTween(target: number, duration: number) {
    if (activeTween) activeTween.kill();
    tweenTarget = target;
    activeTween = gsap.to({ y: scrollY }, {
      y: target, duration, ease: 'power2.out',
      onUpdate(this: gsap.core.Tween) {
        const next = (this.targets()[0] as { y: number }).y;
        scrollY = next;
        applyScroll();
      },
      onComplete() { activeTween = null; },
    });
  }

  function scrollTo(y: number, { duration = 0.3 }: { duration?: number } = {}) {
    const target = clamp(y);
    if (duration <= 0) {
      if (activeTween) { activeTween.kill(); activeTween = null; }
      scrollY = target; applyScroll(); return;
    }
    runTween(target, duration);
  }

  // Wheel / trackpad. Momentum-eased via GSAP (§10.12): each wheel event
  // accumulates its deltaY into the running target so successive events
  // compound naturally, and a single ease-out tween carries scrollY to that
  // target. 0.8s is long enough that a trackpad burst feels inertial rather
  // than discrete, but short enough that a big mouse-wheel pulse doesn't
  // feel laggy.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const basis = activeTween ? tweenTarget : scrollY;
    const target = clamp(basis + e.deltaY);
    runTween(target, WHEEL_TWEEN_S);
  };

  // Touch drag with flick inertia.
  let touchStartY = 0, touchLastY = 0, touchLastT = 0, touchVelocity = 0, dragging = false;
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragging = true;
    touchStartY = touchLastY = e.touches[0].clientY;
    touchLastT = performance.now();
    touchVelocity = 0;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!dragging) return;
    const y = e.touches[0].clientY;
    const dy = touchLastY - y;
    scrollY = clamp(scrollY + dy);
    const now = performance.now();
    const dt = Math.max(1, now - touchLastT);
    touchVelocity = dy / dt;                              // px/ms
    touchLastY = y;
    touchLastT = now;
    applyScroll();
  };
  const onTouchEnd = () => {
    if (!dragging) return;
    dragging = false;
    const flick = touchVelocity * 1000;                   // px/s
    if (Math.abs(flick) < 40) return;
    const duration = Math.max(0.5, Math.abs(flick) / 1000);
    scrollTo(scrollY + flick * 0.35, { duration });
  };

  // Keyboard.
  const onKey = (e: KeyboardEvent) => {
    const step = opts.viewportHeight * 0.85;
    switch (e.key) {
      case 'ArrowDown': scrollTo(scrollY + 60); break;
      case 'ArrowUp':   scrollTo(scrollY - 60); break;
      case 'PageDown':  scrollTo(scrollY + step); break;
      case 'PageUp':    scrollTo(scrollY - step); break;
      case 'Home':      scrollTo(0); break;
      case 'End':       scrollTo(contentHeight); break;
      default: return;
    }
    e.preventDefault();
  };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('keydown', onKey);
  canvas.tabIndex = 0;                                     // so it can receive key events

  return {
    root,
    content,
    setContentHeight(h) { contentHeight = h; },
    scrollTo,
    getScrollY() { return scrollY; },
    destroy() {
      if (activeTween) { activeTween.kill(); activeTween = null; }
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('keydown', onKey);
      root.destroy({ children: true });
    },
  };
}
