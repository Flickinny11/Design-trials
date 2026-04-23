// Prism node: navbar-link-{home,editor,docs,pricing} — single base sprite
// with runtime GSAP effects for hover / active / pressed. Previously ran a
// three-state layer-swap from independently-generated FAL images, but those
// states drifted (each was a separate generation, different angle, different
// scene), so hover looked like a completely different element. Now a single
// base sprite lifts/brightens on hover via GSAP and holds an "active tint"
// when latched as the hub-router's active link.
//
// §10.14 — listens for `active-section-changed` and latches an amber tint
// on the base sprite when activeNavLinkId matches. The tint + subtle scale
// lift are the latched state; pointer events layer their own effects on top.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events, intent, msdfFont } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  // Single base sprite. Brightness + y-offset + tint animate per state.
  const base = new PIXI.Sprite(atlas.getTexture(region));
  base.width = transform.width;
  base.height = transform.height;
  container.addChild(base);

  // MSDF label (sharp-svg text on the atlas handles the build-time label if
  // present; msdf handles runtime-rendered text. navbar-links use sharp-svg
  // per the graph; this is a no-op unless the graph declares msdf entries).
  const msdfEntries = (intent?.visualSpec?.textContent ?? []).filter((t) => t.renderMethod === 'msdf');
  for (const t of msdfEntries) {
    const pos = t.position ?? { x: transform.width / 2, y: transform.height / 2, anchor: 'center' };
    const txt = new PIXI.BitmapText({
      text: t.text,
      style: {
        fontFamily: msdfFont?.family ?? 'Inter-Variable',
        fontSize: t.typography?.fontSize ?? 14,
        fill: t.typography?.color ?? 0xcbd5ff,
      },
    });
    txt.anchor?.set?.(0.5, 0.5);
    txt.position.set(pos.x, pos.y);
    container.addChild(txt);
  }

  let locked = false;
  const baseY = transform.y;
  const ACTIVE_TINT = 0xffd089;  // warm amber for latched
  const IDLE_TINT = 0xffffff;

  function paintLocked() {
    // Hold the amber tint + subtle lift while latched.
    gsap.to(base, { tint: ACTIVE_TINT, duration: 0.25 });
    gsap.to(container.position, { y: baseY - 1, duration: 0.2 });
  }
  function paintIdle() {
    gsap.to(base, { tint: IDLE_TINT, duration: 0.25 });
    gsap.to(container.position, { y: baseY, duration: 0.2 });
  }

  container.on('pointerover', () => {
    gsap.to(base, { alpha: 1.0, duration: 0.15 });
    gsap.to(container.position, { y: baseY - 3, duration: 0.15, ease: 'power2.out' });
  });
  container.on('pointerout', () => {
    if (locked) paintLocked();
    else {
      gsap.to(base, { alpha: 0.88, duration: 0.15 });
      gsap.to(container.position, { y: baseY, duration: 0.15 });
    }
  });
  container.on('pointerdown', () => {
    gsap.to(base, { alpha: 0.92, duration: 0.08 });
    gsap.to(container.scale, { x: 0.97, y: 0.97, duration: 0.08 });
  });
  container.on('pointerup', () => {
    gsap.to(base, { alpha: 1.0, duration: 0.12 });
    gsap.to(container.scale, { x: 1.0, y: 1.0, duration: 0.12, ease: 'back.out(2)' });
  });
  container.on('pointertap', () => {
    events.emit('navigate', { source: intent.nodeId });
  });

  // Resting alpha
  base.alpha = 0.88;

  const offActive = events.on('active-section-changed', (payload) => {
    const next = !!payload && payload.activeNavLinkId === intent.nodeId;
    if (next === locked) return;
    locked = next;
    if (locked) paintLocked();
    else paintIdle();
  });

  // Debug handle used by tests (T01 / §10.14) and manual devtools inspection.
  container.__debug = {
    getLocked: () => locked,
    getResting: () => (locked ? 'active' : 'default'),
  };

  return {
    container,
    teardown: () => {
      offActive();
      container.destroy({ children: true });
    },
  };
}
