---
name: prism-pixijs
description: PixiJS v8 patterns for sprite-based UI, atlas-driven rendering, scroll viewports with momentum, and event handling. Load when implementing the Prism Runtime Player, node createNode functions, or any rendering logic.
---

# PixiJS v8 Patterns for Prism

## Init (WebGPU preferred, WebGL2 fallback)

```js
import * as PIXI from 'pixi.js';

const app = new PIXI.Application();
await app.init({
  canvas: document.getElementById('prism-canvas'),
  preference: 'webgpu',       // WebGPU first, falls back to WebGL2 automatically
  backgroundColor: 0x0a0a0a,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  resizeTo: window,           // responsive to viewport resize
});
```

## Atlas Loading (from in-memory bytes, not network)

Because the .prism file is loaded and unzipped in-browser, the atlas is ArrayBuffer in memory. To turn it into a PIXI.Texture:

```js
async function loadAtlasFromBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  const texture = PIXI.Texture.from(bitmap);
  return texture;
}

function getRegionTexture(atlasTexture, region) {
  // region: { x, y, w, h }
  const frame = new PIXI.Rectangle(region.x, region.y, region.w, region.h);
  return new PIXI.Texture({ source: atlasTexture.source, frame });
}
```

The atlas is loaded once per app boot. All subsequent `getRegionTexture` calls share the same GPU texture memory — this is the batching win.

## Scroll Viewport with Momentum (mock spec section 1.5)

```js
class ScrollViewport {
  constructor(app, viewportWidth, viewportHeight, contentHeight) {
    this.root = new PIXI.Container();
    this.content = new PIXI.Container();
    this.root.addChild(this.content);

    const mask = new PIXI.Graphics()
      .rect(0, 0, viewportWidth, viewportHeight)
      .fill(0xFFFFFF);
    this.root.addChild(mask);
    this.content.mask = mask;

    this.maxScroll = Math.max(0, contentHeight - viewportHeight);
    this.scrollY = 0;
    this.velocity = 0;

    this.setupWheel(app);
    this.setupTouch(app);
    this.setupKeyboard();
    app.ticker.add((ticker) => this.update(ticker.deltaMS));
  }

  setupWheel(app) {
    app.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.velocity += e.deltaY * 0.5;
    }, { passive: false });
  }

  setupTouch(app) {
    let dragging = false, lastY = 0, lastTime = 0;
    this.root.eventMode = 'static';
    this.root.hitArea = new PIXI.Rectangle(0, 0, 99999, 99999);
    this.root.on('pointerdown', (e) => { dragging = true; lastY = e.global.y; lastTime = performance.now(); this.velocity = 0; });
    this.root.on('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.global.y - lastY;
      this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY - dy));
      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) this.velocity = -(dy / dt) * 16;
      lastY = e.global.y; lastTime = now;
    });
    this.root.on('pointerup', () => { dragging = false; });
    this.root.on('pointerupoutside', () => { dragging = false; });
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown': this.velocity += 40; break;
        case 'ArrowUp':   this.velocity -= 40; break;
        case 'PageDown':  this.velocity += 400; break;
        case 'PageUp':    this.velocity -= 400; break;
        case 'Home':      this.scrollTo(0); break;
        case 'End':       this.scrollTo(this.maxScroll); break;
      }
    });
  }

  update(deltaMS) {
    if (Math.abs(this.velocity) > 0.01) {
      this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + this.velocity * (deltaMS / 16)));
      this.velocity *= 0.92;
    }
    this.content.y = -this.scrollY;
  }

  scrollTo(y, durationMs = 400) {
    gsap.to(this, { scrollY: y, duration: durationMs / 1000, ease: 'power2.inOut' });
  }
}
```

## Interactive Sprites

```js
const btn = new PIXI.Sprite(getRegionTexture(atlas, node.visual.region));
btn.eventMode = 'static';
btn.cursor = 'pointer';
btn.on('pointerover', () => { /* hover state */ });
btn.on('pointerout', () => { /* exit hover */ });
btn.on('pointerdown', () => { /* press state */ });
btn.on('pointerup', () => { /* release */ });
btn.on('pointertap', () => { /* action fires */ });
```

`eventMode: 'static'` in v8 replaces the old `interactive: true` from v7. `'dynamic'` is for sprites that move every frame.

## MSDF BitmapText (for DYNAMIC text only)

```js
await PIXI.Assets.load({
  alias: 'inter-msdf',
  src: '/prism-assets/font-inter.msdf.json',
  data: { fontType: 'msdf' },
});

const counter = new PIXI.BitmapText({
  text: '0',
  style: { fontFamily: 'inter-msdf', fontSize: 48, fill: 0xFFFFFF },
});
counter.position.set(300, 400);
container.addChild(counter);

counter.text = String(clickCount);
```

DO NOT use `new PIXI.Text(...)`.

## Container Responsive Layout

For each hub's content container, apply breakpoint-specific transforms on resize:

```js
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const breakpoint = w >= 1440 ? 'wide' : w >= 1024 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile';
  layoutHub(breakpoint, w, window.innerHeight);
});

function layoutHub(breakpoint, w, h) {
  for (const node of activeNodes) {
    if (node.intent.visibleAtBreakpoints && !node.intent.visibleAtBreakpoints.includes(breakpoint)) {
      node.container.visible = false;
      continue;
    }
    node.container.visible = true;
    const t = node.intent.transformByBreakpoint?.[breakpoint] ?? node.intent.transform;
    node.container.position.set(t.x, t.y);
    node.container.width = t.width;
    node.container.height = t.height;
  }
}
```

## Common Pitfalls (v8-specific)

- `texture.baseTexture` → `texture.source` in v8
- `Graphics.drawRect(...)` → `Graphics().rect(...).fill(...)` (builder pattern)
- `interactive: true` → `eventMode: 'static'`
- `click` event → `pointertap`
- `hitArea` now required on Graphics used as hit zones
- Text requires `.style = new PIXI.TextStyle({...})` or inline style object; but you're not using `PIXI.Text` anyway

## Cleanup

Always call `container.destroy({ children: true, texture: false })` when a node is unmounted. `texture: false` because atlas textures are shared — destroying them would break other nodes.
