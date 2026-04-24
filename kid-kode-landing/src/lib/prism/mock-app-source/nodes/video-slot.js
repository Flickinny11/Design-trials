// Prism node: video-slot — playable hero tile. Renders the atlas crop and
// wires the pointertap → playVideo hook declared in
// intent.behaviorSpec.interactions (§-SPEC-ENRICH).
//
// This module is shared by video-slot-1..4 (all 4 nodes carry codeRef
// "nodes/video-slot.js"). Playback itself is delegated to a downstream
// listener (see T-VID-03): the node emits a "video:play" event on the
// ctx.events bus with { nodeId, src } read from intent.behaviorSpec.
// No HTMLVideoElement mount happens here — keeping the module surface
// atlas-sprite-only preserves the invariant that visual chrome is
// atlas-sourced, not CSS/DOM-painted.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events, intent } = ctx;

  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  // Lift-hover (Method 2 GSAP tween) — matches feature-card-bg's idiom so
  // the hero tile row reads as a coherent interactive group.
  container.on('pointerover', () => gsap.to(container, { y: transform.y - 4, duration: 0.25, ease: 'power2.out' }));
  container.on('pointerout',  () => gsap.to(container, { y: transform.y,     duration: 0.25 }));

  // Generic interaction dispatch: for every entry in behaviorSpec.interactions
  // with effect==='playVideo' wire pointertap → events.emit('video:play', ...).
  // Reading from intent (not hardcoding src here) keeps this module portable
  // across all 4 video-slot-N nodes.
  const interactions = intent?.behaviorSpec?.interactions ?? [];
  for (const ix of interactions) {
    if (ix && ix.trigger === 'pointertap' && ix.effect === 'playVideo' && typeof ix.src === 'string') {
      container.on('pointertap', () => {
        events?.emit?.('video:play', { nodeId: intent.nodeId, src: ix.src });
      });
    }
  }

  return { container, teardown: () => container.destroy({ children: true }) };
}
