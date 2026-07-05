'use client';

// SharedViewport — a transparent DOM "window" that registers itself with the
// SharedTileRenderer. The rig draws this viewport's primitive into the element's
// screen rect via a scissored viewport on the one shared canvas. No per-tile
// <canvas>, so mounting/unmounting many of these never churns a GL context.

import { useEffect, useRef, type CSSProperties } from 'react';
import { sharedRig, type TileHandle } from './shared-tile-renderer';
import type {
  Animatable,
  ParamState,
  PrimitiveDefinition,
} from '@/lib/prism/animatable/contract';

interface Props {
  def: PrimitiveDefinition;
  params?: Partial<ParamState>;
  playing: boolean;
  frozenPhase?: number;
  onInstance?: (inst: Animatable | null) => void;
  className?: string;
  style?: CSSProperties;
}

export default function SharedViewport({
  def,
  params,
  playing,
  frozenPhase,
  onInstance,
  className,
  style,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<TileHandle | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const onInstRef = useRef(onInstance);
  onInstRef.current = onInstance;
  const didMount = useRef(false);

  // Register once on mount; unregister on unmount.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const handle = sharedRig.register({
      element: el,
      def,
      params,
      getPlaying: () => playingRef.current,
      frozenPhase,
      onInstance: (inst) => onInstRef.current?.(inst),
    });
    handleRef.current = handle;
    return () => {
      handle.unregister();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild on a real def change (skip the mount run — register already built it).
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    handleRef.current?.rebuild(def, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  return (
    <div
      ref={elRef}
      data-shared-viewport={def.name}
      className={className}
      style={{ background: 'transparent', ...style }}
    />
  );
}
