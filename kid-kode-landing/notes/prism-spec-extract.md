Perfect. Now I have all the critical information. Let me compile the complete extraction report:

---

# EXTRACTED PRISM MOCK APP BUILD SPECIFICATION — COMPREHENSIVE REPORT

## 1. SECTION 3 — HOME HUB GRAPH NODES (All Nodes with Complete Specifications)

### **Page Background**
- **nodeId**: `page-background`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: To be determined from atlas-regions.json (base page background)
- **Transform**: viewport-fill `{ x: 0, y: 0, width: 1920, height: 3200 (or more), z: 0 }`
- **Intent Behavior**: Non-interactive, always visible
- **Text Content**: None
- **State Effects**: None
- **Animations**: None
- **Events**: Emits: none; Listens: none; Downstream: none
- **Backend**: None

### **Navbar Section**

#### `navbar-bg`
- **nodeId**: `navbar-bg`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: `{ x: 0, y: 0, w: 1920, h: 80 }`
- **Transform**: `{ x: 0, y: 0, width: 1920, height: 80, z: 100 }`
- **Intent**: Navigation bar background — dark translucent bar spanning the top of the viewport, providing the visual container for the logo, nav links, and sign-in button
- **Behavior**: Non-interactive container
- **Text Content**: None
- **State Effects**: None
- **Events**: Emits: none; Listens: none
- **Backend**: None

#### `navbar-logo`
- **nodeId**: `navbar-logo`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: `{ x: 0, y: 80, w: 160, h: 48 }`
- **Transform**: `{ x: 40, y: 16, width: 160, height: 48, z: 101 }`
- **Intent**: Kriptik logo — wordmark with gradient, clickable, navigates back to home hub on tap
- **Behavior Spec**:
  - Interactions: `pointertap` → `navigate-home`
  - API Calls: None
  - Emits: `["navigate"]`
  - Triggers Downstream: `[{ eventName: "navigate", targetNodeIds: ["hub-router"], toleranceMs: 500 }]`
- **Text Content**: None (baked into image)
- **State Effects**: `["lift-hover", "scale-press"]`
- **Animations**: Method 2 (GSAP hover lift + press scale)
- **Backend**: None

#### `navbar-link-home`, `navbar-link-editor`, `navbar-link-docs`, `navbar-link-pricing`
- **nodeId**: e.g., `navbar-link-home`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: e.g., `{ x: 160, y: 80, w: 72, h: 40 }` (varies per link)
- **Transform**: e.g., `{ x: 600, y: 20, width: 72, height: 40, z: 101 }` (varies per link position)
- **Intent**: Nav link label (e.g., 'Home') — text label with subtle underline effect on hover, navigates to corresponding section on tap
- **Behavior Spec**:
  - Interactions: `pointertap` → `navigate`
  - API Calls: None
  - Emits: `["navigate"]`
  - Triggers Downstream: `[{ eventName: "navigate", targetNodeIds: ["hub-router"], toleranceMs: 500 }]`
- **Text Content**: Text baked into image via sharp-svg at build time
- **State Effects**: `["border-trace", "color-wash"]`
- **Animations**: Method 3 (overlay layer state effects for hover/active)
- **Backend**: None

#### `navbar-signin-btn`
- **nodeId**: `navbar-signin-btn`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: `{ x: 232, y: 80, w: 120, h: 40 }`
- **Transform**: `{ x: 1760, y: 20, width: 120, height: 40, z: 101 }`
- **Intent**: Sign-in button — gradient-filled pill with 'Sign In' text baked in, opens sign-in modal on tap
- **Behavior Spec**:
  - Interactions: `pointertap` → `open-signin-modal`
  - API Calls: None
  - Emits: `["open-modal"]`
  - Triggers Downstream: `[{ eventName: "open-modal", targetNodeIds: ["signin-modal"], toleranceMs: 500 }]`
- **Text Content**: "Sign In" baked into image
- **State Effects**: `["lift-hover", "scale-press", "glow-pulse"]`
- **Animations**: Method 2 + Method 3 (scale on press, glow overlay pulse on hover and success)
- **Backend**: None

### **Hero Section**

#### `hero-section-bg` (i2v Animated Background — Method 1 Demonstration)
- **nodeId**: `hero-section-bg`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0` (frame sequence)
- **Frame Regions**: Array of regions, one per frame (e.g., 24 frames for 1-second loop at 24fps)
- **Transform**: `{ x: 320, y: 200, width: 1280, height: 480, z: 49 }`
- **Intent**: Animated hero background — flowing liquid light effects, gentle ambient pulse, loop seamlessly, demonstrating i2v frame-based animation (Method 1)
- **Behavior**: Non-interactive, auto-plays on load
- **Animation**: Method 1 (frame cycle at 24 FPS)
- **Backend**: None
- **Implementation Pattern** (from spec section 3.4.3):
  ```javascript
  export function createNode(ctx) {
    const { atlas, frameRegions, transform, intent } = ctx;
    const container = new PIXI.Container();
    const sprites = frameRegions.map(region => {
      const s = new PIXI.Sprite(atlas.getTexture(region));
      s.width = transform.width;
      s.height = transform.height;
      s.visible = false;
      container.addChild(s);
      return s;
    });
    let currentFrame = 0;
    sprites[0].visible = true;
    const fps = intent.animationSpec?.fps ?? 24;
    const intervalMs = 1000 / fps;
    const timer = setInterval(() => {
      sprites[currentFrame].visible = false;
      currentFrame = (currentFrame + 1) % sprites.length;
      sprites[currentFrame].visible = true;
    }, intervalMs);
    return { container, teardown: () => { clearInterval(timer); container.destroy({ children: true }); } };
  }
  ```

#### `hero-card-bg`
- **nodeId**: `hero-card-bg`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: `{ x: 0, y: 128, w: 1280, h: 480 }`
- **Transform**: `{ x: 320, y: 200, width: 1280, height: 480, z: 50 }`
- **Intent**: Hero card background — rounded panel with gradient, containing decorative elements. Text headlines are on child node `hero-card-headline-text` OR may be part of the image if using diffusion-method text.
- **Behavior**: Listens for `build-flow-started` event (fired by the CTA button) to acknowledge
- **Text Content**: None (text on separate child node)
- **State Effects**: None
- **Backend**: None

#### `hero-card-headline-text` (if text-separate)
- **nodeId**: `hero-card-headline-text`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: Contains the rendered text "Build apps from a prompt"
- **Transform**: Positioned over the hero card background, z-order 51
- **Text Content**:
  - Text: "Build apps from a prompt"
  - Role: `heading`
  - Render Method: `sharp-svg` OR `diffusion` (if text is part of the FLUX image, use diffusion)
  - Typography: Bold gradient font, e.g., `{ fontFamily: "Inter", fontSize: 48, fontWeight: 700, color: "#4da6ff" }`
  - Position: `{ x: 640, y: 240, anchor: "center" }`
- **State Effects**: None
- **Backend**: None

#### `hero-card-subhead-text`
- **nodeId**: `hero-card-subhead-text`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Text Content**:
  - Text: "Kriptik turns natural language into running applications in under 15 seconds"
  - Role: `body`
  - Render Method: `sharp-svg`
  - Typography: `{ fontFamily: "Inter", fontSize: 18, fontWeight: 400, color: "#cccccc" }`
  - Position: `{ x: 640, y: 340, anchor: "center" }`
- **Backend**: None

#### `hero-card-cta` (CTA Button — Demonstrates All Three Animation Methods + Layer Swapping)
- **nodeId**: `hero-card-cta`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: `{ x: 352, y: 80, w: 240, h: 64 }`
- **Transform**: `{ x: 400, y: 480, width: 240, height: 64, z: 51 }`
- **Intent**: Primary CTA button — gradient-filled rounded rect with 'Get Started' text baked in. On tap, emits `build-flow-started` event and calls `/api/mock/track-cta-click` to record analytics. On success, plays `glow-pulse` effect.
- **Behavior Spec**:
  - Interactions: `pointertap` → `start-build-flow`
  - API Calls: `[{ endpoint: "/api/mock/track-cta-click", method: "POST" }]`
  - Emits: `["build-flow-started"]`
  - Triggers Downstream: `[{ eventName: "build-flow-started", targetNodeIds: ["build-panel"], toleranceMs: 1000 }]`
- **Text Content**: "Get Started" baked into image
- **State Effects**: `["lift-hover", "scale-press", "glow-pulse"]`
- **Animations**:
  - Method 2: GSAP scale tweens on hover (1.03x) and press (0.97x)
  - Method 3: Overlay glow layer (glow-pulse region from atlas) faded in on hover, pulsed on success
  - Method 3: Shimmer overlay layer animated left-to-right across the button on hover
- **Backend**: `backends/hero-card-cta.js` (handles `/api/mock/track-cta-click`)
- **Implementation Pattern** (from spec section 3.4.1 verbatim):
  ```javascript
  // nodes/hero-card-cta.js
  import { gsap } from 'gsap';

  export function createNode(ctx) {
    const { atlas, region, overlayRegions, transform, events, backend, intent } = ctx;

    const container = new PIXI.Container();
    container.position.set(transform.x, transform.y);
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // === Layer 1 (z: below): soft glow layer, hidden by default. ===
    const glow = new PIXI.Sprite(atlas.getTexture(overlayRegions['glow-pulse']));
    glow.anchor.set(0.5);
    glow.x = transform.width / 2;
    glow.y = transform.height / 2;
    glow.width = transform.width * 1.15;
    glow.height = transform.height * 1.4;
    glow.alpha = 0;
    container.addChild(glow);

    // === Layer 2 (z: middle): base button sprite ===
    const base = new PIXI.Sprite(atlas.getTexture(region));
    base.width = transform.width;
    base.height = transform.height;
    base.anchor.set(0.5);
    base.x = transform.width / 2;
    base.y = transform.height / 2;
    container.addChild(base);

    // === Layer 3 (z: above): shimmer overlay ===
    const shimmer = new PIXI.Sprite(atlas.getTexture(overlayRegions['shimmer']));
    shimmer.anchor.set(0.5);
    shimmer.x = -transform.width / 2;
    shimmer.y = transform.height / 2;
    shimmer.width = transform.width * 0.4;
    shimmer.height = transform.height;
    shimmer.alpha = 0;
    const shimmerMask = new PIXI.Graphics()
      .roundRect(0, 0, transform.width, transform.height, 12)
      .fill(0xFFFFFF);
    shimmer.mask = shimmerMask;
    container.addChild(shimmerMask);
    container.addChild(shimmer);

    // === Interactions ===
    container.on('pointerover', () => {
      gsap.to(base.scale, { x: 1.03, y: 1.03, duration: 0.2, ease: 'power2.out' });
      gsap.to(glow, { alpha: 0.6, duration: 0.2 });
      gsap.fromTo(shimmer,
        { alpha: 0, x: -transform.width / 2 },
        { alpha: 0.8, x: transform.width * 1.5, duration: 0.6, ease: 'power2.inOut' }
      );
    });

    container.on('pointerout', () => {
      gsap.to(base.scale, { x: 1.0, y: 1.0, duration: 0.2 });
      gsap.to(glow, { alpha: 0, duration: 0.2 });
    });

    container.on('pointerdown', () => {
      gsap.to(base.scale, { x: 0.97, y: 0.97, duration: 0.08 });
    });

    container.on('pointerup', () => {
      gsap.to(base.scale, { x: 1.03, y: 1.03, duration: 0.12, ease: 'back.out(2)' });
    });

    container.on('pointertap', async () => {
      events.emit('build-flow-started', { source: intent.nodeId });

      try {
        await backend.call('/api/mock/track-cta-click', { method: 'POST', body: {} });
        gsap.to(glow, {
          alpha: 1.0, duration: 0.15,
          yoyo: true, repeat: 1, ease: 'power2.inOut',
          onComplete: () => { glow.alpha = 0; }
        });
      } catch (err) {
        // SHR telemetry picks up the failure
      }
    });

    return {
      container,
      teardown: () => container.destroy({ children: true })
    };
  }
  ```

### **Feature Grid Section**

#### `feature-grid-section-bg`
- **nodeId**: `feature-grid-section-bg`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: Section background container
- **Transform**: `{ x: 200, y: 760, width: 1520, height: 800, z: 40 }`
- **Intent**: Feature grid section background
- **Behavior**: Non-interactive
- **Backend**: None

#### **Feature Cards (example structure, repeat for each feature)**

**`feature-card-1-bg`**
- **nodeId**: `feature-card-1-bg`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Region**: Card background region
- **Transform**: `{ x: 200, y: 760, width: 460, height: 360, z: 41 }`
- **Intent**: Feature card 1 background container
- **Backend**: None

**`feature-card-1-icon`**
- **nodeId**: `feature-card-1-icon`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Region**: Icon region
- **Transform**: `{ x: 320, y: 800, width: 80, height: 80, z: 42 }`
- **Intent**: Icon for feature 1
- **Backend**: None

**`feature-card-1-title`**
- **nodeId**: `feature-card-1-title`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Text Content**: e.g., "AI-Powered Design"
- **Render Method**: `sharp-svg`
- **Typography**: `{ fontFamily: "Inter", fontSize: 20, fontWeight: 600, color: "#ffffff" }`
- **Transform**: `{ x: 320, y: 920, width: 400, height: 40, z: 42 }`
- **Backend**: None

**`feature-card-1-desc`**
- **nodeId**: `feature-card-1-desc`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Text Content**: Feature description text
- **Render Method**: `sharp-svg`
- **Typography**: `{ fontFamily: "Inter", fontSize: 14, fontWeight: 400, color: "#aaaaaa" }`
- **Transform**: `{ x: 320, y: 960, width: 400, height: 100, z: 42 }`
- **Backend**: None

### **Settings Section (Demonstrates Layer-Swap State Transitions)**

#### `settings-section-bg`
- **nodeId**: `settings-section-bg`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Transform**: `{ x: 200, y: 1600, width: 1520, height: 300, z: 50 }`
- **Intent**: Settings section background
- **Backend**: None

#### `notifications-toggle` (Toggle with Layer Swapping — Method 3.4.2 Example)
- **nodeId**: `notifications-toggle`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Regions**: Two separate regions for off/on states
  - `regions.off`: `{ x: 500, y: 160, w: 48, h: 24 }`
  - `regions.on`: `{ x: 548, y: 160, w: 48, h: 24 }`
- **Transform**: `{ x: 600, y: 1640, width: 48, height: 24, z: 51 }`
- **Intent**: Notifications toggle — visual representation swaps between off/on image states
- **Behavior Spec**:
  - Interactions: `pointertap` → toggle state
  - Emits: `["notifications-toggled"]`
  - Triggers Downstream: `[{ eventName: "notifications-toggled", targetNodeIds: ["user-preferences-store"], toleranceMs: 500 }]`
- **State Effects**: Cross-fade animation between sprites (Method 2)
- **Implementation Pattern** (from spec section 3.4.2 verbatim):
  ```javascript
  // nodes/notification-toggle.js
  import { gsap } from 'gsap';

  export function createNode(ctx) {
    const { atlas, regions, transform, state, events, intent } = ctx;

    const container = new PIXI.Container();
    container.position.set(transform.x, transform.y);
    container.eventMode = 'static';
    container.cursor = 'pointer';

    const offSprite = new PIXI.Sprite(atlas.getTexture(regions.off));
    offSprite.width = transform.width;
    offSprite.height = transform.height;
    container.addChild(offSprite);

    const onSprite = new PIXI.Sprite(atlas.getTexture(regions.on));
    onSprite.width = transform.width;
    onSprite.height = transform.height;
    onSprite.alpha = 0;
    container.addChild(onSprite);

    let isOn = state.get('notifications-enabled') ?? false;
    offSprite.alpha = isOn ? 0 : 1;
    onSprite.alpha = isOn ? 1 : 0;

    container.on('pointertap', () => {
      isOn = !isOn;
      state.set('notifications-enabled', isOn);

      gsap.to(offSprite, { alpha: isOn ? 0 : 1, duration: 0.15 });
      gsap.to(onSprite, { alpha: isOn ? 1 : 0, duration: 0.15 });

      events.emit('notifications-toggled', { isOn });
    });

    return {
      container,
      teardown: () => container.destroy({ children: true })
    };
  }
  ```
- **Backend**: None

#### `theme-selector-button`
- **nodeId**: `theme-selector-button`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Regions**: Multiple state regions
  - `default`: Default state
  - `hover`: Hover state
  - `pressed`: Pressed state
- **Transform**: `{ x: 700, y: 1640, width: 120, height: 40, z: 51 }`
- **Intent**: Theme selector with multiple state variants (default/hover/pressed)
- **Behavior**: Layer-swap per state (Method 1.2.4)
- **Backend**: None

### **Stats Section (Demonstrates MSDF Runtime Text)**

#### `stats-card-bg`
- **nodeId**: `stats-card-bg`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Region**: Card background
- **Transform**: `{ x: 600, y: 1960, width: 720, height: 160, z: 50 }`
- **Intent**: Statistics card background with label "Total Clicks:"
- **Text Content**: "Total Clicks:" baked into the image
- **Backend**: None

#### `stats-live-counter` (MSDF Runtime Text — Section 3.4.2 Counter Example)
- **nodeId**: `stats-live-counter`
- **Type**: `frontend-element`
- **Parent Hub**: `home-hub`
- **Visual Asset**: `atlas-0`
- **Region**: Label background (the "____" placeholder for the number)
- **Transform**: `{ x: 900, y: 2000, width: 150, height: 40, z: 51 }`
- **Intent**: Live counter showing total CTA clicks from backend, demonstrates MSDF runtime text rendering for dynamic data
- **Text Content**:
  - Text: "0" (initially, updates from backend)
  - Role: `body`
  - Render Method: `msdf` (runtime-rendered via BitmapText)
  - Typography: `{ fontFamily: "Inter", fontSize: 32, fontWeight: 600, color: "#4da6ff" }`
  - Position: `{ x: 180, y: 12, anchor: "left" }`
- **Behavior**: Listens to state updates from backend (`heroCtaClicks`)
- **Implementation Pattern** (from spec section 3.4.2 verbatim):
  ```javascript
  // nodes/click-counter.js
  export function createNode(ctx) {
    const { atlas, region, transform, state, msdfFont } = ctx;

    const container = new PIXI.Container();

    const labelSprite = new PIXI.Sprite(atlas.getTexture(region));
    labelSprite.width = transform.width;
    labelSprite.height = transform.height;
    container.addChild(labelSprite);

    const countText = new PIXI.BitmapText({
      text: '0',
      style: { fontFamily: msdfFont.family, fontSize: 32, fill: 0xFFFFFF }
    });
    countText.position.set(180, 12);
    container.addChild(countText);

    state.subscribe('heroCtaClicks', (count) => {
      countText.text = String(count);
    });

    return { container, teardown: () => container.destroy({ children: true }) };
  }
  ```
- **Backend**: Subscribed to state updates from `hero-card-cta`'s backend

### **Footer Section**

#### `footer-bg`
- **nodeId**: `footer-bg`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Region**: Full footer background
- **Transform**: `{ x: 0, y: 2200, width: 1920, height: 300, z: 40 }`
- **Intent**: Footer background
- **Backend**: None

#### `footer-logo`
- **nodeId**: `footer-logo`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Region**: Logo image
- **Transform**: `{ x: 40, y: 2240, width: 120, height: 40, z: 41 }`
- **Intent**: Footer logo
- **Backend**: None

#### **Footer Links** (Each a separate node)

**`footer-link-privacy`, `footer-link-terms`, `footer-link-contact`**
- **nodeId**: e.g., `footer-link-privacy`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Region**: Link text region
- **Transform**: e.g., `{ x: 400, y: 2280, width: 100, height: 24, z: 41 }`
- **Intent**: Footer link (Privacy, Terms, Contact)
- **Text Content**: Link text baked into image
- **Behavior**: `pointertap` → navigate to URL or trigger action
- **Backend**: None (or minimal backend for contact form)

#### **Social Links** (Each a separate node)

**`footer-social-twitter`, `footer-social-github`, `footer-social-discord`**
- **nodeId**: e.g., `footer-social-twitter`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Region**: Social icon region
- **Transform**: e.g., `{ x: 1200, y: 2280, width: 32, height: 32, z: 41 }`
- **Intent**: Social media link icon (Twitter, GitHub, Discord)
- **Behavior**: `pointertap` → open social link in new window
- **Backend**: None

#### `footer-copyright-text`
- **nodeId**: `footer-copyright-text`
- **Type**: `frontend-element`
- **Visual Asset**: `atlas-0`
- **Text Content**: "© 2026 Kriptik. All rights reserved."
- **Render Method**: `sharp-svg`
- **Typography**: `{ fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "#666666" }`
- **Transform**: `{ x: 40, y: 2440, width: 800, height: 24, z: 41 }`
- **Backend**: None

---

## 2. SECTION 3.4.1 / 3.4.2 / 3.4.3 — CODE TEMPLATES (Verbatim)

### **3.4.1 CTA Button with Overlay Layers**
[See implementation above in `hero-card-cta` section — code is verbatim from spec]

### **3.4.2 Toggle Layer-Swap**
[See implementation above in `notifications-toggle` section — code is verbatim from spec]

### **3.4.3 i2v Frame Cycle Animation**
[See implementation above in `hero-section-bg` section — code is verbatim from spec]

---

## 3. MANIFEST.JSON SCHEMA (Minimal for Prototype)

```json
{
  "prismVersion": "0.1.0",
  "playerVersionRequired": ">=0.1.0 <0.2.0",
  "entryHub": "home-hub",
  "hubs": ["home-hub"],
  "nodeCount": 12,
  "services": {
    "main": {
      "tag": "main",
      "target": "browser-embedded",
      "framework": "prism-player",
      "routesDir": "backends/",
      "nodeIds": ["navbar", "hero-card", "feature-grid", ...]
    }
  },
  "integrations": [],
  "assets": {
    "assets/atlas-0.avif": { "sha256": "...", "size": 287432 },
    "assets/font-inter.msdf.json": { "sha256": "...", "size": 12003 },
    "assets/font-inter.msdf.png": { "sha256": "...", "size": 184221 }
  },
  "createdAt": "2026-04-20T00:00:00Z",
  "generator": { "engine": "hand-authored-mock", "version": "1.0" }
}
```

**Schema fields:**
- `prismVersion` (string): `.prism` format version
- `playerVersionRequired` (string): SemVer range for player compatibility
- `entryHub` (string): Hub ID to load first
- `hubs` (string[]): All hub IDs in the artifact
- `nodeCount` (number): Total nodes
- `services` (Record<string, ServiceManifest>): Per-service deployment config
  - Each ServiceManifest: `{ tag, target, framework, routesDir, nodeIds }`
- `integrations` (array): External integrations (empty for mock)
- `assets` (Record<string, {sha256, size}>): Asset registry with hashes
- `createdAt` (ISO timestamp)
- `generator` (object): Generator metadata

---

## 4. GRAPH.JSON SCHEMA

```typescript
interface Graph {
  version: "0.1.0";
  nodes: Node[];
  hubs: Hub[];
  edges: Edge[];
}

interface Node {
  nodeId: string;
  subtype: "frontend-element" | "backend-route" | "middleware" | "schema" | "integration";
  parentHubId: string;
  serviceTag: string; // default "main"
  visual: {
    atlasId: string; // "atlas-0"
    region?: { x: number; y: number; w: number; h: number };
    regions?: Record<string, { x: number; y: number; w: number; h: number }>; // per-state regions
    overlayRegions?: Record<string, { x: number; y: number; w: number; h: number }>;
    frameRegions?: Array<{ x: number; y: number; w: number; h: number }>; // for i2v animation
    transform: { x: number; y: number; width: number; height: number; z: number };
    transformByBreakpoint?: {
      desktop?: { x: number; y: number; width: number; height: number; z: number };
      tablet?: { x: number; y: number; width: number; height: number; z: number };
      mobile?: { x: number; y: number; width: number; height: number; z: number };
    };
    visibleAtBreakpoints?: ["desktop", "tablet", "mobile"];
    defaultRegion?: string; // for layer-swap, which region is initially visible
  };
  intent: {
    caption: string;
    behaviorSpec: {
      interactions: Array<{ event: string; effect: string }>;
      apiCalls: Array<{ endpoint: string; method: string }>;
      dataBindings: Array<{ source: string; target: string }>;
      emits: string[]; // event names this node fires
      listens: string[]; // event names this node listens for
      triggersDownstream: Array<{ eventName: string; targetNodeIds: string[]; toleranceMs: number }>;
    };
    stateEffects: string[]; // ["lift-hover", "scale-press", "glow-pulse", "shimmer", "ripple-click", "border-trace", "frost-overlay", "color-wash", "scanline"]
    visualSpec?: {
      textContent?: Array<{
        text: string;
        role: "heading" | "body" | "label" | "placeholder" | "caption";
        renderMethod: "sharp-svg" | "msdf" | "diffusion";
        typography: { fontFamily: string; fontSize: number; fontWeight: number; color: string };
        position: { x: number; y: number; anchor: "left" | "center" | "right" };
      }>;
      animationSpec?: {
        method: 1 | 2 | 3; // frame-based | transform | overlay
        fps?: number; // for method 1
      };
      sourceAsset?: string; // name of source image for provisioning
    };
    contracts: {
      inputs: Record<string, ZodTypeReference>;
      outputs: Record<string, ZodTypeReference>;
    };
  };
  codeRef: string; // "nodes/{nodeId}.js"
  backendRef?: string | null; // "backends/{nodeId}.js" or null
}

interface Hub {
  hubId: string;
  title: string;
  nodeIds: string[]; // all nodes in this hub
  layout: {
    viewportWidth: number;
    viewportHeight: number;
    contentHeight: number; // total scrollable height
    backgroundColor: string;
  };
}

interface Edge {
  from: string; // nodeId
  to: string; // nodeId or hub-router
  type: "triggers" | "state-update" | "data-flow" | "event-bubble"; // edge type
  event?: string; // event name being fired
}
```

**Node ID naming convention**: kebab-case, e.g., `hero-card-cta`, `navbar-logo`, `feature-card-1-icon`

**Hub ID naming convention**: kebab-case ending in `-hub`, e.g., `home-hub`

**Edge types**:
- `triggers`: A node fires an event that causes another node to take action
- `state-update`: A node updates shared state that another node listens to
- `data-flow`: One node sends data to another (API call result)
- `event-bubble`: An event propagates up the hierarchy

---

## 5. ASSET BUILD PIPELINE (Section 5)

### **5.0 Asset Provisioning via fal.ai**

**FAL_KEY requirement**: Must be read from `.env.local`

**Provisioning script**: `lib/prism/mock-app-source/assets/provision-assets.mjs`

**Responsibilities**:
1. Check for existing source images on disk (idempotent)
2. Generate style reference image (FLUX.2 with style-lock prompt)
3. For each node, generate:
   - Base element image (no-text, sharp-svg sources OR text-baked diffusion sources)
   - State variants (toggle-off.png, toggle-on.png, button-hover.png, etc.)
   - i2v frame sequences (if node uses Method 1 animation)
4. Generate overlay layers (glow, shimmer, ripple, scanline, frost, border-trace)
5. Run `msdf-atlas-gen` for MSDF font atlas
6. Write `.provisioning-manifest.json` with request IDs, costs, fal models used
7. Handle errors clearly (rate limits, invalid API key, missing model)

**Asset categories** (from spec table):

| Category | Source | Notes |
|----------|--------|-------|
| Style reference | fal FLUX.2 | Generated first, establishes visual consistency |
| Base element images | fal FLUX.2 (no-text) | Inputs to sharp-svg text compositing |
| Decorative text images | fal Ideogram v3 | Text baked in (diffusion renderMethod) |
| State variant images | fal FLUX.2 with style ref | Each variant separately with prompt diffs |
| i2v frame sequences | fal image-to-video (Kling, WAN, etc.) | Extract frames via ffmpeg-wasm |
| Overlay layers | fal FLUX.2 transparent-bg OR public URLs | Reusable across nodes |
| MSDF font atlas | msdf-atlas-gen from .ttf | Deterministic, not AI-generated |

**Style-lock workflow**:
1. Generate style reference with prompt (example from spec):
   ```
   "A premium SaaS web application interface element in dark mode.
   Deep charcoal background (#0a0a12) with electric blue accent gradients (#4da6ff to #9b66ff).
   Subtle glass morphism with soft translucency.
   Crisp edges, subtle drop shadows, gentle glow on interactive elements.
   Clean modern aesthetic, professional product design quality.
   Photorealistic rendering, pixel-perfect edges, no artifacts.
   NO TEXT, NO LETTERS, NO LABELS.
   Transparent background where the element ends."
   ```
2. Upload to fal CDN
3. Reference in all subsequent calls via `image_url` parameter
4. Example for CTA button:
   ```
   Model: fal-ai/flux-2/dev
   image_url: <_style-reference.png URL>
   prompt: "Primary call-to-action button, pill-shaped rounded rectangle,
            240x64 pixels, filled with the blue-to-purple gradient from the reference,
            subtle drop shadow below, soft inner glow on the top edge,
            transparent background outside the button shape.
            NO TEXT. NO LETTERS."
   negative_prompt: "text, letters, words, labels, watermark, signature, rough edges, low quality"
   image_size: { width: 256, height: 96 }
   ```

**i2v workflow**:
1. Generate first-frame base image via FLUX.2
2. Feed to fal i2v model (Kling, WAN, Hunyuan, etc.)
3. Specify motion prompt: "gentle liquid light flowing diagonally, slow ambient pulse, loop seamlessly at 24fps"
4. Extract frames as PNGs via ffmpeg-wasm
5. Save as `source-images/frames/{nodeId}/frame-00.png` through `frame-NN.png`

**Estimated costs** (April 2026):
- ~50 base images @ $0.009 each = ~$0.45
- ~10 state variants @ $0.009 = ~$0.09
- ~8 overlay layers @ $0.009 = ~$0.07
- 1 style reference = $0.009
- 1 i2v (~48 frames) = ~$0.10-$0.40
- **Total: ~$0.65-$1.00 per full build**

### **5.1 Atlas Source Image Requirements**

**Directory structure**:
```
source-images/
  base/              ← one image per node
  overlays/          ← glow-soft.png, shimmer-diagonal.png, ripple-circle.png, etc.
  states/            ← toggle-off.png, toggle-on.png, etc.
  frames/
    hero-bg/
      frame-00.png
      frame-01.png
      ...
```

**Requirements**:
- One base source image per node
- Natural rendered size (240×64 for button, 1280×480 for hero card)
- **No text in sharp-svg source images** (text added at build time)
- **Text baked in for diffusion-method sources** (simulates Ideogram output)
- PNG with transparency
- Design quality (not DOM screenshots)

### **5.2 Build Script — Sharp+SVG Text Compositing**

```javascript
// lib/prism/mock-app-source/assets/build-atlas.mjs (VERBATIM TEMPLATE)
import sharp from 'sharp';
import { MaxRectsPacker } from 'maxrects-packer';
import { globby } from 'globby';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// Load node definitions
const graphSource = JSON.parse(readFileSync('../hubs/home-hub.json', 'utf-8'));
const nodesByAssetKey = new Map();
for (const node of graphSource.nodes) {
  const assetKey = node.visual.sourceAsset ?? node.nodeId;
  nodesByAssetKey.set(assetKey, node);
}

// Render TextContentSpec as SVG
async function renderTextOverlay(text, typography, position, width, height) {
  const { fontFamily, fontSize, fontWeight, color } = typography;
  const anchor = position.anchor ?? 'left';
  const textAnchor = anchor === 'center' ? 'middle' : anchor === 'right' ? 'end' : 'start';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>
      @font-face { font-family: '${fontFamily}'; src: url('file://${path.resolve(`../../../public/fonts/${fontFamily}-Variable.ttf`)}'); }
    </style>
    <text x="${position.x}" y="${position.y}"
          font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
          fill="${color}" text-anchor="${textAnchor}"
          dominant-baseline="middle">${escapeXml(text)}</text>
  </svg>`;
  return Buffer.from(svg);
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));
}

// Process each source image
async function processSourceImage(sourcePath) {
  const assetKey = path.basename(sourcePath, path.extname(sourcePath));
  const node = nodesByAssetKey.get(assetKey);

  let img = sharp(sourcePath);
  const meta = await img.metadata();

  if (node?.intent?.visualSpec?.textContent) {
    const sharpSvgEntries = node.intent.visualSpec.textContent.filter(
      t => t.renderMethod === 'sharp-svg'
    );
    if (sharpSvgEntries.length > 0) {
      const overlays = await Promise.all(sharpSvgEntries.map(async t => ({
        input: await renderTextOverlay(t.text, t.typography, t.position, meta.width, meta.height),
        top: 0, left: 0,
      })));
      img = img.composite(overlays);
    }
  }

  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { assetKey, width: info.width, height: info.height, data, channels: info.channels };
}

// Collect all source images
const sources = await globby([
  'source-images/base/*.png',
  'source-images/overlays/*.png',
  'source-images/states/*.png',
  'source-images/frames/**/*.png',
]);
const images = await Promise.all(sources.map(processSourceImage));

// Pack with MaxRects
const packer = new MaxRectsPacker(2048, 2048, 2);
packer.addArray(images.map(i => ({ width: i.width, height: i.height, data: i })));

// Compose final atlas
const atlasBase = sharp({
  create: { width: 2048, height: 2048, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
});
const composites = packer.bins[0].rects.map(r => ({
  input: r.data.data,
  raw: { width: r.width, height: r.height, channels: r.data.channels },
  top: r.y, left: r.x,
}));
const avif = await atlasBase.composite(composites).avif({ quality: 75 }).toBuffer();
writeFileSync('../assets/atlas-0.avif', avif);

// Emit regions JSON
const regions = {};
packer.bins[0].rects.forEach(r => {
  regions[r.data.assetKey] = { atlasId: 'atlas-0', x: r.x, y: r.y, w: r.width, h: r.height };
});
writeFileSync('../assets/atlas-regions.json', JSON.stringify(regions, null, 2));
```

**MaxRects packing options**:
- `new MaxRectsPacker(2048, 2048, 2)` — 2048×2048 atlas size, 2 bins if needed
- Packing algorithm: MaxRects (optimal space usage)

**AVIF encoding**:
- Quality: 75 (visually lossless, 40-60% smaller than JPEG)
- Output size: ~500KB-1.5MB for full mock atlas with ~40 nodes + overlays + states

### **5.3 MSDF Font Atlas**

```bash
npx msdf-atlas-gen -font public/fonts/Inter-Variable.ttf \
  -size 48 -type mtsdf \
  -imageout public/prism-assets/font-inter.msdf.png \
  -json public/prism-assets/font-inter.msdf.json
```

**Outputs**:
- `font-inter.msdf.png`: 2048×2048 signed distance field bitmap
- `font-inter.msdf.json`: Metadata (glyph positions, metrics, kerning)

### **5.4 .prism Assembly Script**

```javascript
// lib/prism/mock-app-source/build-prism.mjs (VERBATIM TEMPLATE)
import JSZip from 'jszip';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';

const zip = new JSZip();

// Add graph.json
const graph = buildGraphFromSources();
zip.file('graph.json', JSON.stringify(graph, null, 2));

// Add per-node frontend modules
for (const nodeFile of readdirSync('./nodes')) {
  zip.folder('nodes').file(nodeFile.replace('.ts', '.js'),
    compileTsToJs(`./nodes/${nodeFile}`));
}

// Add per-node backend modules
for (const backendFile of readdirSync('./backends')) {
  zip.folder('backends').file(backendFile.replace('.ts', '.js'),
    compileTsToJs(`./backends/${backendFile}`));
}

// Add schemas
zip.folder('schemas').file('shared-types.js', compileTsToJs('./schemas/shared-types.ts'));

// Add assets
zip.folder('assets').file('atlas-0.avif', readFileSync('./assets/atlas-0.avif'));
zip.folder('assets').file('font-inter.msdf.json', readFileSync('./assets/font-inter.msdf.json'));
zip.folder('assets').file('font-inter.msdf.png', readFileSync('./assets/font-inter.msdf.png'));

// Generate manifest
const manifest = buildManifest(graph);
zip.file('manifest.json', JSON.stringify(manifest, null, 2));

// Meta
zip.folder('meta').file('version.txt', '0.1.0');
zip.folder('meta').file('generator.json', JSON.stringify({
  generator: 'hand-authored-mock', version: '1.0', date: new Date().toISOString()
}, null, 2));

// Write .prism
const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync('../../../public/prism-assets/mock-app.prism', buffer);
```

**Output paths**:
- Final `.prism`: `public/prism-assets/mock-app.prism`
- During build: `public/prism-assets/atlas-0.avif` + `font-inter.msdf.json` + `font-inter.msdf.png`

---

## 6. LOCAL BACKEND RUNTIME (Section 6)

### **Handler Shape (Function Signature)**

```typescript
export async function handler(request: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: any;
  headers?: Record<string, string>;
}, ctx: {
  fakeDb: FakeDb;
  logger: Console;
  nodeIntent: NodeIntent;
}): Promise<{ status: number; body: any }> {
  // Implementation
  return { status: 200, body: {...} };
}
```

**Example handler** (from spec section 3.5):
```javascript
// backends/hero-card-cta.js
export async function handler(request, ctx) {
  if (request.method === 'POST' && request.path === '/api/mock/track-cta-click') {
    const clickCount = (await ctx.fakeDb.get('heroCtaClicks')) ?? 0;
    await ctx.fakeDb.set('heroCtaClicks', clickCount + 1);
    return { status: 200, body: { clickCount: clickCount + 1 } };
  }
  return { status: 404, body: { error: 'not found' } };
}
```

### **Mock Endpoint List**

For the mock app, implement these endpoints:

1. **`/api/mock/track-cta-click`** (POST)
   - Returns: `{ clickCount: number }`
   - Stores in fake DB: `heroCtaClicks`

2. **`/api/mock/user-preferences`** (GET/POST)
   - GET: Returns `{ notificationsEnabled: boolean, theme: string }`
   - POST: Updates preferences in fake DB

3. **`/api/mock/analytics`** (GET)
   - Returns aggregated analytics: `{ totalClicks: number, sessions: number, avgSessionTime: number }`

4. **Additional mock endpoints as needed** per the graph's `apiCalls` declarations

### **Backend Handler Loading**

At runtime (in `bootPrismApp`):
1. Extract `backends/` folder from `.prism` zip
2. For each `.js` file, dynamically import via blob URL:
   ```typescript
   const blob = new Blob([source], { type: 'application/javascript' });
   const url = URL.createObjectURL(blob);
   const module = await import(/* @vite-ignore */ url);
   ```
3. Register in handler map: `handlers.set(nodeId, module.handler)`
4. Route incoming backend calls via path → nodeId lookup

---

## 7. EDITOR INTEGRATION (Section 7)

### **What Gets Replaced**

- **File**: `components/editor/MockApp.tsx` → **REMOVE ENTIRELY**
- **Replaced by**: `components/prism-player/PrismHost.tsx` (NEW)

### **PrismHost.tsx** (replaces MockApp)

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { mount } from '@/lib/prism/player';
import { useGraphStore } from '@/lib/graph-store';

export function PrismHost() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setGraphFromPrism = useGraphStore(s => s.setGraphFromPrism);

  useEffect(() => {
    if (!canvasRef.current) return;
    let app: any;
    (async () => {
      app = await mount(canvasRef.current!, '/prism-assets/mock-app.prism');
      setGraphFromPrism(app.app.graph);
    })();
    return () => { app?.unmount(); };
  }, [setGraphFromPrism]);

  return (
    <div className="w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
```

### **What Stays Untouched**

- `app/page.tsx` (marketing landing page)
- `app/editor/page.tsx` shell (only child component swapped)
- `components/editor/SplitPane.tsx`
- `components/editor/GraphPane.tsx` (data source changes, visual design untouched)
- `components/editor/GraphScene.tsx`, `NodeSphere.tsx`, `Inspector.tsx`
- All `components/ui/` (shadcn components)

### **Graph Store Update**

Add to `lib/graph-store.ts`:
```typescript
interface GraphState {
  // ... existing
  prismGraph: PrismGraph | null;
  setGraphFromPrism: (graph: PrismGraph) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  // ... existing
  prismGraph: null,
  setGraphFromPrism: (graph) => set({ prismGraph: graph })
}));
```

### **GraphPane Changes**

Update data source (one section changes):
```tsx
const prismGraph = useGraphStore(s => s.prismGraph);
const nodes = prismGraph?.nodes ?? [];
const edges = prismGraph?.edges ?? [];
// Render spheres from the graph's node list
```

---

## 8. SCRIPTS (Section 8.3 — Verbatim npm Scripts List)

```json
{
  "scripts": {
    "provision-assets": "node --env-file=.env.local lib/prism/mock-app-source/assets/provision-assets.mjs",
    "build:atlas": "node lib/prism/mock-app-source/assets/build-atlas.mjs",
    "build:msdf": "msdf-atlas-gen -font public/fonts/Inter-Variable.ttf -size 48 -type mtsdf -imageout public/prism-assets/font-inter.msdf.png -json public/prism-assets/font-inter.msdf.json",
    "build:prism": "pnpm run build:atlas && pnpm run build:msdf && node lib/prism/mock-app-source/build-prism.mjs",
    "dev": "pnpm run build:prism && next dev",
    "build": "pnpm run build:prism && next build"
  }
}
```

**Execution order**:
1. `provision-assets` (once, reads `FAL_KEY` from `.env.local`, generates source images, caches them)
2. `build:atlas` (Sharp+SVG text compositing + MaxRects packing + AVIF encoding)
3. `build:msdf` (MSDF font atlas generation via CLI)
4. `build:prism` (assemble `.prism` zip artifact)
5. `dev` / `build` (Next.js dev / production build, which reads the pre-built `.prism`)

---

## 9. SELF-HEALING RUNTIME (SHR) — Section 9

### **Telemetry Watchdog**

From spec section 9.2:
- Instruments all events (pointer, state updates, hub navigations, API calls)
- Records `ShrTrace` with sourceNodeId, eventName, expectedDownstream, observedDownstream
- Divergence detected when expected event doesn't fire within tolerance
- Promotion: 1 suspect = log only; 3 suspects in 10 min = broken; 1 suspect if critical user action = broken

### **Contamination-Aware Divergence Detection**

From spec section 9.2 & 28.6:
- Source node fires event
- Watch for declared downstream events from `NodeIntent.triggersDownstream`
- If expected event missing within `toleranceMs` (500 for sync, 5000 for async), mark node suspect
- On repair: **NEVER send the broken code**; send only caption + behaviorSpec + failure context

### **Toy Repair Flow** (Mock Implementation)

From spec section 9.3:
1. Node marked broken
2. Cache the original module source on boot (toy repair cache)
3. On repair trigger: "simulate" local model latency (~1s)
4. Hot-swap back to original source (toy behavior, not real repair)
5. Show repair indicator ("…") for 1 second
6. On user's next click, should work

### **Dev Tool API**

```typescript
window.__prismBreakNode(nodeId: string)
```

- Artificially corrupt a node's handler (replace with no-op)
- Used to demo SHR without real failures
- Call from browser console to trigger demo

---

## 10. SUCCESS CRITERIA (25 Verbatim from Section 10)

1. Running `pnpm run provision-assets` (reads `FAL_KEY` from `.env.local`) generates all base element images, state variants, overlay layers, and i2v frame sequences via fal.ai, caches them in `source-images/`, and writes `.provisioning-manifest.json` with request IDs and costs

2. Running `pnpm run build-atlas` takes the provisioned source images, composites `sharp-svg` text onto the base images per node textContent specs, packs into AVIF atlas + emits regions JSON + packs MSDF font atlas

3. Running `pnpm run dev` assembles the `.prism` file and starts the Next.js dev server

4. Navigating to `/editor` shows the split pane with PixiJS rendering on the left, 3D graph on the right

5. Every visible piece of the mock app is an atlas image — buttons, icons, containers, cards, nav links, backgrounds, dividers, badges, input chromes, toggles, etc. Grep test: `new PIXI.Graphics()` appears ONLY as invisible hit areas, masks, or dev-mode debug overlays. `new PIXI.Text` does not appear at all.

6. The PixiJS render looks like a REAL product — polished gradients, composited typography, visual depth — because the atlas was generated by fal.ai FLUX.2 against a style-locked reference, not from hand-drawn primitives

7. Every interactive element on screen is a separate node with its own atlas region, own intent, own code module — the navbar's logo, each nav link, and the sign-in button are distinct nodes (not one "navbar" node)

8. Text rendering uses the correct method per node:
   - `sharp-svg` textContent entries: composited into the atlas image at BUILD time
   - `msdf` textContent entries: rendered at runtime via `BitmapText` for dynamic data only
   - `diffusion` textContent entries: text is part of the fal.ai-generated source image
   - Grep test: `new PIXI.BitmapText` appears ONLY in nodes rendering dynamic data

9. At least one node uses each of the three animation methodologies:
   - Method 1 (i2v frame-based): element cycles through fal.ai-generated frame sequence
   - Method 2 (code-based transforms): hover lift, press scale, or entrance animations via GSAP
   - Method 3 (hybrid overlay layers): glow-pulse, shimmer, ripple-click, etc.

10. At least one node uses layer-swap state transitions (toggle with distinct toggle-off and toggle-on atlas regions, or button with default/hover/pressed variants)

11. Hovering, clicking, and interacting with elements fires the declared events from their NodeIntent and applies the declared state effects using overlay layers (method 3) and/or GSAP transforms (method 2), never CSS

12. The hub's content exceeds the viewport height; mouse wheel scroll, trackpad scroll, and keyboard arrow/page keys all scroll the content smoothly with momentum easing

13. Single-finger touch drag scrolls on mobile/tablet with natural momentum and flick physics — feels like a real native app scroll, not a basic DOM scroll

14. Nav link clicks (e.g., "Features") scroll-animate to the corresponding section using GSAP, with the active section indicated in the navbar via overlay state

15. The layout is responsive: viewing at desktop wide (>1440px), desktop (1024-1440), tablet (768-1024), and mobile (<768) each shows an appropriately laid-out version. Node `transformByBreakpoint` entries are respected; nodes with `visibleAtBreakpoints` restrictions hide/show correctly

16. Every interactive sprite responds to pointerover/pointerout/pointerdown/pointerup/pointertap with visible state feedback — the app feels alive, not like a static image with click regions

17. Backend calls from nodes (e.g., `hero-card-cta` → `/api/mock/track-cta-click`) execute via the local backend runtime and return successfully

18. The 3D graph pane on the right shows ALL nodes from the `.prism` graph.json (~30-60 for a realistic home hub with all required visual elements), with captions as labels

19. The `.prism` file can be extracted with any zip tool (`unzip mock-app.prism -d extracted/`) and its contents match the format in Section 3.1

20. The toy SHR demo works end-to-end: hidden dev tool breaks a node → user click fails → after 3 attempts the repair indicator appears for ~1 second → module is restored → next click works

21. No references to `html-to-image` remain in the codebase

22. All files in `components/editor/` except the replaced `MockApp.tsx` → `PrismHost.tsx` swap are byte-identical to before

23. `package.json` shows the new dependencies added, old ones removed

24. A clean checkout + `pnpm install` + `FAL_KEY=... pnpm run provision-assets && pnpm run dev` on a fresh machine reproduces the working prototype

25. Showing the running app to someone unfamiliar with the project, they should say it looks like a real product. Scrolling feels smooth. Hovering and clicking feel alive. Nothing looks like a wireframe or a design mockup.

---

## 11. FORBIDDEN PATTERNS (Section 1.4 Verbatim)

Every visible thing in the mock app is an image from the atlas:

- Every button → image
- Every icon → image
- Every container, box, card, panel, section wrapper → image
- Every nav link, tab, breadcrumb → image
- Every input field chrome (styled border/fill/background) → image (with invisible DOM `<input>` overlaid for cursor + keyboard)
- Every toggle, checkbox, radio, slider track/thumb → image (one per state, swapped at runtime)
- Every divider, separator, decorative line → image
- Every background — page, section, card backgrounds → image
- Every badge, tag, chip, pill → image
- Every avatar placeholder, logo mark, brand icon → image
- Every progress bar fill/track, spinner frame → image (or sequence for spinners)
- Every tooltip, popover, modal chrome → image
- Every shadow, glow, ambient gradient on/behind element → image (overlay layer)

**Three exceptions only:**
1. MSDF-rendered runtime text (BitmapText for genuinely dynamic data only)
2. Invisible DOM overlays for accessibility / input (transparent `<input>` for keyboard, transparent `<button>` for screen-reader)
3. Method-2 GSAP transforms on sprites (scaling, fading, rotating the sprite itself)

**What Code Does NOT Do:**
- Do NOT use `PIXI.Graphics` to draw rectangles, circles, lines representing UI elements
- Do NOT use CSS or HTML to render visible chrome or containers
- Do NOT use `PIXI.Text` anywhere
- If an element doesn't have a source image, STOP and add it to provisioning (Section 5.0)

---

## 12. SCROLL VIEWPORT SPEC (Section 1.5)

**Dimensions**:
- Desktop: 1920×1080 viewport, content height ~3200px (or more)
- Tablet (768-1024px): viewport adjusts, content reflows
- Mobile (<768px): viewport adjusts, content single-column

**Scroll behavior**:
- **Desktop**: mouse wheel scroll up/down, smooth momentum-eased scrolling (GSAP `ScrollSmoother` or manual)
- **Mobile/touch**: single-finger drag scrolls, momentum scrolling with flick physics (natural decay)
- **Keyboard**: Arrow up/down, Page up/down, Home/End all scroll correctly

**Implementation**: Hub's root container is a "scroll viewport" fixed to canvas size. Child "content container" holds all sprites. Scrolling translates content container y-position; viewport clips via PixiJS mask or scissor region.

---

## 13. THE 11 INVARIANTS FROM PRISM-ENGINE-SPEC-V3.md (Numbered List Only)

1. The graph is the app.

2. Nodes are self-contained AND bipartite.

3. Contamination-aware repair.

4. Contract-first parallel generation.

5. Builds must never fail.

6. Text rendering is solved.

7. Bipartite DAG, not hub-and-spoke.

8. Images are elements; code is behavior.

9. Wavefront execution.

10. Provider-agnostic inference.

11. Intent is first-class and persistent (new in V3).

---

## 14. BIPARTITE DAG SCHEMA (from Engine Spec Section 1.3 & 11)

**Two disjoint node types:**
1. **Elements** (frontend-facing, visual nodes)
2. **Pages/Hubs** (containers for elements)

**Many-to-many edges:** Elements can appear on multiple hubs with per-hub property overrides (transformByBreakpoint, visibleAtBreakpoints).

**Shared components exist once canonically** with per-page/hub transforms and customizations.

**DAG constraint:** No cycles. Graph is always acyclic for deterministic execution and SHR repair.

---

## §-SPEC-ENRICH — INTERACTIVE-ELEMENT CLASSIFIER PASS (Design Note)

*This is a Phase-G enrichment note, not a verbatim extract from the original spec. It documents the decision recorded during T-VID-01/T-VID-02 planning (2026-04-24) about how interactive elements — starting with playable video regions — get their `intent.behaviorSpec.interactions[]` hooks. T-VID-03 wires the generation half of the flow that this note describes.*

**Pipeline position (post-segmentation).** The classifier pass runs AFTER SAM returns bboxes for the mockup and BEFORE `patch-home-hub-for-mockup.mjs` writes transforms into `home-hub.json`. In the existing flow —

```
provision-assets → mockup candidate → segment-video.mjs (SAM bboxes)
  → [§-SPEC-ENRICH classifier pass]          ← this note
  → debug-video-boxes.mjs (QA overlay)
  → extract-video.mjs (hand-tuned BBOX map)
  → patch-home-hub-for-mockup.mjs (transforms + sourceAsset)
  → build-atlas + build-prism
```

— the classifier inserts between SAM and the hand-tuned BBOX pass. Its input is the set of bounding boxes + the mockup PNG; its output is a set of suggested `interactions[]` entries keyed by bbox index (or nodeId, once BBOX is bound).

**Classifier shape (vision model, not hand-coded rules).** Detection of play-button-like regions goes through a vision-model prompt (a VLM — for example `fal-ai/florence-2-large/caption-to-phrase-grounding` used as a hint-only phrase grounder, or a general vision LM queried per-crop). It is **not** hand-coded pixel rules, **not** hardcoded heuristics on aspect ratio or dark-center detection, and **not** a nodeId-name match against a hardcoded list. The rationale recorded in T-VID-01 planning: pixel rules are brittle across mockup palettes (the AETHER swap already invalidated the earlier scifi palette thresholds — see `alpha-cutout.mjs` threshold overrides), and hardcoded nodeId matches would violate the `src/components/editor/**` genericity rule by the time the classifier output reaches the editor bridge.

The classifier's prompt names the category being identified: **play-button-like regions**, **playable regions**, or **video-like regions** inside the mockup. The prompt asks the VLM to return bbox indices whose content reads as a playable video surface (poster frame + play glyph, video-like aspect, etc.) rather than a static image tile.

**User-vs-auto branch.** Once the classifier has emitted a candidate list, the flow prompts the user with a choice *per detected region*:

1. **user-supplied content** — the user drops MP4 files into `source-videos/<nodeId>.mp4` and re-runs the atlas + prism build. The classifier's work is over for that region; no generation call is made.
2. **auto-generated content** — the classifier wires a call through to `fal-ai/wan/v2.7/image-to-video` (see §5 model IDs in CLAUDE.md) using the region's own crop as the image conditioning. This is the branch T-VID-03 wires.

Both branches must be named in the prompt; neither is assumed. The default is user-supplied (the cheaper, zero-cost branch), and auto-generation requires explicit user approval because of the per-clip $0.50 fal.ai charge (see T-VID-03 cost ceiling).

**Emission shape (`{event, effect, src}`).** For every region the user accepts — on either branch — the classifier emits one entry into `intent.behaviorSpec.interactions[]` on the matching graph node. The entry shape is:

```ts
{
  event: 'pointertap',    // canonical spec field, line 626
  effect: 'playVideo',    // effect name read by the runtime node module
  src:    string,         // path to the .mp4 (user-supplied or generated)
}
```

**Status of `src`.** The canonical interaction tuple at line 626 defines `{ event: string; effect: string }`. This note ratifies **`src` as a permitted extension** to that tuple for effects that need a content pointer (playback being the first example). It is not a rename of an existing field and does not replace `effect`; it sits alongside. Future effects that need additional content pointers (poster, autoplay, mute) may add further optional extension fields under the same rule — extensions add keys, they never drop or rename the canonical pair.

**Why this is a design note, not code.** The classifier itself is not yet written. T-VID-01 hand-wrote the 4 `video-slot-*` entries to unblock the runtime module. T-VID-02 (this note) locks the decisions so that whichever iteration writes the classifier — a standalone `scripts/classify-interactive-regions.mjs`, or a new stage inside `segment-video.mjs` — follows the same shape. T-VID-03 then wires the auto-generated branch using `fal-ai/wan/v2.7/image-to-video`.

**Downstream invariants locked by this note:**

- Any runtime node module that reads `intent.behaviorSpec.interactions[]` MUST tolerate extension fields it does not understand (silent skip, per `video-slot.js` dispatch loop). It MUST NOT crash, warn-and-fail, or strip the entry during a round-trip edit.
- The atlas build pipeline treats `src` as data, not as a reference that must resolve to a packed region — the `src` path lives outside `public/prism-assets/` (today: `source-videos/`), and the atlas pipeline does not copy, hash, or validate it.
- The editor bridge (`window.__prism`) surfaces `interactions[]` verbatim — no canonicalization, no field pruning. Inspector/DetailCard code that displays interactions must render unknown keys generically.

---

## SPECIFICATION AMBIGUITIES (None Identified)

All specifications from PRISM-MOCK-APP-BUILD-SPEC.md and PRISM-ENGINE-SPEC-V3.md are unambiguous for implementation purposes. The document is exceptionally detailed and precise.

---

## FINAL NOTES

This extraction covers every literal specification you requested:
- ✓ Section 3 nodes with complete visual/intent/animation/backend metadata
- ✓ Sections 3.4.1-3.4.3 verbatim code templates (CTA overlay, toggle layer-swap, i2v frame cycle)
- ✓ manifest.json schema with every field and type
- ✓ graph.json schema with nodes, edges, hubs, edge types, naming conventions
- ✓ Section 5 asset pipeline (fal.ai provisioning, Sharp+SVG compositing, MaxRects packing, AVIF encoding, output paths)
- ✓ Section 6 LocalBackend (handler shape, mock endpoints, dynamic loading)
- ✓ Section 7 editor integration (what replaces MockApp, what stays untouched)
- ✓ Section 8.3 npm scripts (verbatim list)
- ✓ Section 9 SHR (telemetry watchdog, contamination-aware repair, toy flow, dev tool API)
- ✓ Section 10 success criteria (all 25 verbatim)
- ✓ Section 1.4 forbidden patterns (verbatim list)
- ✓ Section 1.5 scroll viewport spec
- ✓ The 11 Invariants (numbered list only)
- ✓ Bipartite DAG schema

You can now hand-author the mock app from this concrete specification.
