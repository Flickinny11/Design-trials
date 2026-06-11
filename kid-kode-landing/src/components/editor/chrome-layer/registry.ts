'use client';

// PRISM EDITOR CHROME LAYER — slab registry (UI-FIDELITY-2 W1).
//
// Page-lifetime singleton (same survival model as the catalog sharedRig):
// DOM chrome surfaces register themselves here; the in-canvas ChromeSlabLayer
// reads the registry every frame and renders each slab as a real
// SDF-rounded-rect quad with physical materials (Fresnel bevels, refraction,
// brushed metal) in the ONE unified GraphScene canvas. The registry lives
// outside React so the R3F Canvas can remount (contentKey 'assembled' ↔
// 'topology') without losing registrations.
//
// CSS keeps layout + text + input on the DOM twin; the GPU draws the SURFACE.
// Rects are read per frame via getBoundingClientRect (proven pattern from
// shared-tile-renderer) and quantized to physical pixels so SDF edges do not
// shimmer during panel slide animations.

export type ChromeSlabMaterial = 'glass' | 'metal' | 'ceramic' | 'well';

export interface ChromeSlabOptions {
  material: ChromeSlabMaterial;
  /** Corner radii CSS px — single value or [tl, tr, br, bl]. */
  radius?: number | [number, number, number, number];
  /** Keyline border width CSS px (brass-graded). Default 1. */
  borderPx?: number;
  /** 0..1 accent amount (brass emphasis: active keys, hero panels). */
  accent?: number;
  /** Frost strength 0..1 for glass (maps to mip LOD). */
  frost?: number;
  /**
   * Brushed-anisotropy axis for metal: 'x' along width, 'y' along height.
   * Default 'x'.
   */
  brushAxis?: 'x' | 'y';
  /** Extra z-bias inside the layer: higher sorts later (over) — default by registration order. */
  order?: number;
}

export interface ChromeSlabHandle {
  /** Update style options in place (cheap; picked up next frame). */
  update(opts: Partial<ChromeSlabOptions>): void;
  /** Pointer state writes (animated GPU-side with damping). */
  setHover(v: boolean): void;
  setPress(v: boolean): void;
  release(): void;
}

export interface ChromeSlabEntry {
  id: number;
  el: HTMLElement;
  opts: Required<Pick<ChromeSlabOptions, 'material'>> & ChromeSlabOptions;
  hover: number; // target 0|1 (damped on the GPU-side sync)
  press: number;
  /** Damped presentation values (advanced by the layer each frame). */
  hoverK: number;
  pressK: number;
  /** Last written rect (physical-px quantized, CSS-px units). */
  rect: { x: number; y: number; w: number; h: number };
  /**
   * Ancestors with overflow clipping (resolved at registration). The layer
   * intersects their rects per frame and passes the clip window to the
   * shader, so slabs inside scrollable flyouts crop exactly like their DOM
   * twins instead of bleeding past the scroll container.
   */
  clipEls: HTMLElement[];
  /** Per-frame clip window (viewport CSS px). */
  clip: { minX: number; minY: number; maxX: number; maxY: number };
  visible: boolean;
}

function resolveClipAncestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let cur = el.parentElement;
  while (cur && cur !== document.body) {
    const cs = getComputedStyle(cur);
    if (
      cs.overflow !== 'visible' ||
      cs.overflowX !== 'visible' ||
      cs.overflowY !== 'visible' ||
      cs.clipPath !== 'none'
    ) {
      out.push(cur);
    }
    cur = cur.parentElement;
  }
  return out;
}

type Listener = () => void;

class ChromeSlabRegistry {
  private slabs = new Map<number, ChromeSlabEntry>();
  private nextId = 1;
  /** Bumped on add/remove so the layer can resize its instanced buffers. */
  structureVersion = 0;
  /**
   * True once a ChromeSlabLayer has mounted in the canvas. Sticky across the
   * Canvas contentKey remount (the layer re-mounts within a frame or two);
   * the DOM hook gates its CSS suppression on this so panels never go
   * transparent before the GPU is drawing their surfaces.
   */
  layerActive = false;
  private listeners = new Set<Listener>();

  register(el: HTMLElement, opts: ChromeSlabOptions): ChromeSlabHandle {
    const id = this.nextId++;
    const entry: ChromeSlabEntry = {
      id,
      el,
      opts: { borderPx: 1, radius: 12, accent: 0, frost: 0.5, brushAxis: 'x', order: id, ...opts },
      hover: 0,
      press: 0,
      hoverK: 0,
      pressK: 0,
      rect: { x: 0, y: 0, w: 0, h: 0 },
      clipEls: resolveClipAncestors(el),
      clip: { minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 },
      visible: false,
    };
    this.slabs.set(id, entry);
    this.structureVersion++;
    this.emit();
    return {
      update: (patch) => {
        Object.assign(entry.opts, patch);
      },
      setHover: (v) => {
        entry.hover = v ? 1 : 0;
      },
      setPress: (v) => {
        entry.press = v ? 1 : 0;
      },
      release: () => {
        this.slabs.delete(id);
        this.structureVersion++;
        this.emit();
      },
    };
  }

  /** Stable-ordered entries (registration/`order` ascending → draw order). */
  entries(): ChromeSlabEntry[] {
    return [...this.slabs.values()].sort((a, b) => (a.opts.order ?? a.id) - (b.opts.order ?? b.id));
  }

  get size(): number {
    return this.slabs.size;
  }

  onStructure(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}

declare global {
  interface Window {
    __PRISM_CHROME_SLABS__?: ChromeSlabRegistry;
  }
}

/** Page-lifetime singleton (survives R3F Canvas remounts + HMR). */
export function getChromeSlabRegistry(): ChromeSlabRegistry {
  if (typeof window === 'undefined') return new ChromeSlabRegistry();
  if (!window.__PRISM_CHROME_SLABS__) window.__PRISM_CHROME_SLABS__ = new ChromeSlabRegistry();
  return window.__PRISM_CHROME_SLABS__;
}

/** Read an element's rect quantized to the physical-pixel grid (CSS units). */
export function readQuantizedRect(
  el: HTMLElement,
  dpr: number,
  out: { x: number; y: number; w: number; h: number },
): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const q = Math.max(1, Math.round(dpr));
  out.x = Math.round(r.left * q) / q;
  out.y = Math.round(r.top * q) / q;
  out.w = Math.round(r.width * q) / q;
  out.h = Math.round(r.height * q) / q;
  return true;
}
