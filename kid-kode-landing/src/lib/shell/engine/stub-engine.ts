// PRISM SHELL — STUB ENGINE (CANVAS RENDERER) — SHELL W1, 2026-07-04
//
// The visual half of the W1 engine stand-in: a 2D-canvas node field that
// renders the protocol core's state (mode / selection / focus) so the
// builder's preview frame has a live, interactive interior while the real
// engine adapter is pending (W0 report §6.7). It draws VECTORS ONLY — dots,
// rings, hairlines, a device outline — never text and never DOM inside the
// frame; all readouts live in the shell's DOM frame chrome, keeping the
// boundary layering honest even in stub form.
//
// This file is shell-scope (src/lib/shell/**): it is NOT engine-interior
// code and is replaced wholesale by the real adapter (real-engine-adapter.ts)
// when the engine session merges.

import type { PrismViewMode } from '../../../../packages/shared-interfaces/src/prism-shell';
import { getStubProject } from '../project-stub';
import type { PrismEngineHost } from './engine-host';
import { StubEngineCore } from './stub-engine-core';
import { getStubEdges, getStubLayout } from './stub-graph';

// premium.ts identity hexes via the shell token layer (DL2 — one palette).
const FIELD_BLACK = '#000000';
const CHROME_HI = 'rgba(246, 248, 251, 0.92)';
const CHROME_DIM = 'rgba(232, 236, 242, 0.55)';
const HAIRLINE = 'rgba(232, 236, 242, 0.055)';
const HAIRLINE_STRONG = 'rgba(232, 236, 242, 0.16)';
const EDGE = 'rgba(232, 236, 242, 0.10)';
const SIGNAL_RED = '#ff2a38';
const RED_GLOW = 'rgba(255, 42, 56, 0.35)';

const MORPH_K = 6.5; // exponential settle rate for layout morphs (1/s)
const FOCUS_MS = 700;

interface NodeVis {
  id: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: number;
}

export class StubEngineHost implements PrismEngineHost {
  readonly kind = 'stub' as const;

  private readonly listeners = new Set<(wire: string) => void>();
  private readonly core: StubEngineCore;

  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private lastT = 0;
  private painted = false;

  private nodes: NodeVis[] = [];
  private hoverId: string | null = null;
  private focus: { x: number; y: number; start: number } | null = null;
  private reducedMotion = false;

  constructor() {
    this.core = new StubEngineCore(
      (wire) => {
        for (const l of this.listeners) l(wire);
      },
      {
        onMountRequest: (containerId) => this.attach(containerId),
        onUnmountRequest: () => this.teardownVisual(),
        onModeTarget: (mode) => this.retarget(mode),
        onFocusPulse: (targetId) => this.pulseToward(targetId),
      },
    );
    const layout = getStubLayout(this.core.mode);
    this.nodes = layout.map((p, i) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      tx: p.x,
      ty: p.y,
      phase: i * 1.37,
    }));
  }

  // ── PrismEngineHost ────────────────────────────────────────────────────────

  send(wire: string): void {
    this.core.receive(wire);
  }

  onEvent(listener: (wire: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.teardownVisual();
    this.core.dispose();
    this.listeners.clear();
  }

  // ── Visual lifecycle ───────────────────────────────────────────────────────

  private attach(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      // Container missing = a shell wiring bug; surface it through the
      // contract error channel instead of throwing across the boundary.
      this.core.receive('{"malformed to trigger contract error": true}');
      return;
    }
    this.container = container;
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('data-prism-stub-engine', 'true');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'Prism engine preview (stub) — node field; click a node to select it',
    );
    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerleave', this.onPointerLeave);

    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private teardownVisual(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    if (this.canvas) {
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
      this.canvas.remove();
    }
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.painted = false;
  }

  private resize(): void {
    if (!this.canvas || !this.container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = this.container;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
  }

  private retarget(mode: PrismViewMode): void {
    const layout = getStubLayout(mode);
    for (const node of this.nodes) {
      const p = layout.find((l) => l.id === node.id);
      if (p) {
        node.tx = p.x;
        node.ty = p.y;
      }
    }
  }

  private pulseToward(targetId: string): void {
    // Node targets pulse toward the node; hub targets toward the centroid of
    // the hub's member nodes (directory from project-stub); unknown ids pulse
    // to center — the camera still visibly moves.
    let x = 0.5;
    let y = 0.5;
    const node = this.nodes.find((v) => v.id === targetId);
    if (node) {
      x = node.tx;
      y = node.ty;
    } else {
      const memberIds = getStubProject('layout-source')
        .nodes.filter((n) => n.hubId === targetId)
        .map((n) => n.id);
      const members = this.nodes.filter((v) => memberIds.includes(v.id));
      if (members.length > 0) {
        x = members.reduce((s, m) => s + m.tx, 0) / members.length;
        y = members.reduce((s, m) => s + m.ty, 0) / members.length;
      }
    }
    this.focus = { x, y, start: performance.now() };
  }

  // ── Pointer interaction (origin:'user' selection) ─────────────────────────

  private hitTest(clientX: number, clientY: number): string | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    let best: string | null = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const dx = (n.x - px) * rect.width;
      const dy = (n.y - py) * rect.height;
      const d = Math.hypot(dx, dy);
      if (d < 16 && d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  }

  private onPointerMove = (e: PointerEvent): void => {
    const hit = this.hitTest(e.clientX, e.clientY);
    this.hoverId = hit;
    if (this.canvas) this.canvas.style.cursor = hit ? 'pointer' : 'default';
  };

  private onPointerDown = (e: PointerEvent): void => {
    const hit = this.hitTest(e.clientX, e.clientY);
    this.core.userSelect(hit);
  };

  private onPointerLeave = (): void => {
    this.hoverId = null;
  };

  // ── Render loop ────────────────────────────────────────────────────────────

  private frame = (t: number): void => {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const dt = Math.min((t - this.lastT) / 1000, 0.1);
    this.lastT = t;

    // Layout morph — exponential settle (mass decelerating into place, DL6).
    const k = this.reducedMotion ? 20 : MORPH_K;
    const ease = 1 - Math.exp(-dt * k);
    for (const n of this.nodes) {
      n.x += (n.tx - n.x) * ease;
      n.y += (n.ty - n.y) * ease;
    }

    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = FIELD_BLACK;
    ctx.fillRect(0, 0, W, H);

    // Camera focus pulse — brief zoom toward the target, easing back (DL6).
    if (this.focus && !this.reducedMotion) {
      const p = (t - this.focus.start) / FOCUS_MS;
      if (p >= 1) {
        this.focus = null;
      } else {
        const amp = Math.sin(Math.PI * p) * 0.1;
        const cx = this.focus.x * W;
        const cy = this.focus.y * H;
        ctx.translate(cx, cy);
        ctx.scale(1 + amp, 1 + amp);
        ctx.translate(-cx, -cy);
      }
    }

    this.drawBackdrop(ctx, W, H, t);
    this.drawEdges(ctx, W, H);
    this.drawNodes(ctx, W, H, t);

    if (!this.painted) {
      this.painted = true;
      // First real frame is up — the contract's `mounted` may now fire.
      this.core.markPainted();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const mode = this.core.mode;
    ctx.lineWidth = Math.max(1, W / 1600);
    if (mode === 'canvas') {
      // Machined working grid — crisp hairlines (DL7).
      ctx.strokeStyle = HAIRLINE;
      const step = Math.max(W, H) / 24;
      ctx.beginPath();
      for (let x = step; x < W; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let y = step; y < H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
    } else if (mode === 'galaxy') {
      // Orbital field — three elliptic orbits, slow phase drift.
      ctx.strokeStyle = HAIRLINE_STRONG;
      const drift = this.reducedMotion ? 0 : Math.sin(t / 9000) * 0.03;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(
          W / 2,
          H / 2,
          W * (0.18 + i * 0.11),
          H * (0.14 + i * 0.1),
          drift + i * 0.22,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    } else {
      // preview-app — the built app inside a device outline.
      const dw = Math.min(W * 0.46, H * 0.62);
      const dh = H * 0.74;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      const r = Math.min(24, dw * 0.08);
      ctx.strokeStyle = HAIRLINE_STRONG;
      ctx.beginPath();
      ctx.roundRect(dx, dy, dw, dh, r);
      ctx.stroke();
      // live jewel — top corner
      ctx.fillStyle = SIGNAL_RED;
      ctx.beginPath();
      ctx.arc(dx + r, dy + r * 0.9, Math.max(2.5, W / 500), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawEdges(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = Math.max(1, W / 1600);
    ctx.beginPath();
    for (const [a, b] of getStubEdges()) {
      const na = this.nodes.find((n) => n.id === a);
      const nb = this.nodes.find((n) => n.id === b);
      if (!na || !nb) continue;
      ctx.moveTo(na.x * W, na.y * H);
      ctx.lineTo(nb.x * W, nb.y * H);
    }
    ctx.stroke();
  }

  private drawNodes(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const base = Math.max(4, W / 260);
    for (const n of this.nodes) {
      const breathe = this.reducedMotion ? 0 : Math.sin(t / 1200 + n.phase) * base * 0.08;
      const selected = this.core.selectedNodeId === n.id;
      const hovered = this.hoverId === n.id;
      const r = base * (selected ? 1.25 : hovered ? 1.18 : 1) + breathe;
      const x = n.x * W;
      const y = n.y * H;

      // glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
      glow.addColorStop(0, selected ? RED_GLOW : 'rgba(232,236,242,0.14)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // core dot
      ctx.fillStyle = selected ? SIGNAL_RED : hovered ? CHROME_HI : CHROME_DIM;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // selection ring — settling pulse
      if (selected) {
        const pulse = this.reducedMotion ? 0 : (Math.sin(t / 420) + 1) / 2;
        ctx.strokeStyle = SIGNAL_RED;
        ctx.lineWidth = Math.max(1, W / 1200);
        ctx.beginPath();
        ctx.arc(x, y, r * (1.9 + pulse * 0.35), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
