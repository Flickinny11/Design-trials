// Prism node: navbar-link-{home,editor,docs,pricing} — 3-state layer-swap
// (default/hover/active) with pointertap emitting 'navigate'.
//
// The 'active' overlay doubles as the hub-router's active-section indicator
// (§10.14). Listening on the `active-section-changed` event bus, a link
// 'latches' when the router's activeNavLinkId matches its own nodeId: the
// 'active' sprite becomes the resting sprite (pointerout reverts to it
// instead of 'default'). pointerover/pointerdown still show their overlays
// on top so interactive feedback stays alive on the latched link.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, regions, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const sprites = {};
  for (const key of ['default', 'hover', 'active']) {
    if (!regions[key]) continue;
    const s = new PIXI.Sprite(atlas.getTexture(regions[key]));
    s.width = transform.width;
    s.height = transform.height;
    s.alpha = key === 'default' ? 1 : 0;
    container.addChild(s);
    sprites[key] = s;
  }

  let locked = false;

  function show(key) {
    for (const [k, s] of Object.entries(sprites)) {
      gsap.to(s, { alpha: k === key ? 1 : 0, duration: 0.15 });
    }
  }

  function resting() {
    return locked && sprites.active ? 'active' : 'default';
  }

  // Baseline container y for the subtle lift-hover (§10.16 — ensures
  // pointerout always produces a visible unwind even when the link is
  // latched in its 'active' state, where alpha-swap alone would stay still).
  const baseY = transform.y;

  container.on('pointerover', () => {
    show('hover');
    gsap.to(container.position, { y: baseY - 2, duration: 0.15, ease: 'power2.out' });
  });
  container.on('pointerout',  () => {
    show(resting());
    gsap.to(container.position, { y: baseY, duration: 0.15 });
  });
  container.on('pointerdown', () => show('active'));
  container.on('pointerup',   () => show('hover'));
  container.on('pointertap',  () => {
    events.emit('navigate', { source: intent.nodeId });
  });

  const offActive = events.on('active-section-changed', (payload) => {
    const next = !!payload && payload.activeNavLinkId === intent.nodeId;
    if (next === locked) return;
    locked = next;
    show(resting());
  });

  // Debug handle used by tests (T01 / §10.14) and manual devtools inspection.
  container.__debug = {
    getLocked: () => locked,
    getResting: () => resting(),
  };

  return {
    container,
    teardown: () => {
      offActive();
      container.destroy({ children: true });
    },
  };
}
