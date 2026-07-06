"use client";

// PrimitivePreview — mount a single catalog primitive on a photo card in an
// owned R3F canvas (W-PHOTO D3 evidence). Used by /photo-lab?prim=<name> to
// capture motion frame-sequences of the carousel-3d + loop-column drivers.
// Exposes window.__PRIM__ { seek, setScroll } for deterministic frame capture.
//
// The card texture is loaded FIRST and applied to the subject material before
// the primitive is built, so multi-cell drivers (which clone the subject) get
// textured echoes rather than blank ones.

import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";
import "@/lib/prism/animatable/primitives"; // side-effect: register all primitives
import { getPrimitive } from "@/lib/prism/animatable/registry";
import type {
  Animatable,
  AnimatableTarget,
} from "@/lib/prism/animatable/contract";

export interface PrimitivePreviewProps {
  name: string;
  /** Texture for the card face (a photo plate). */
  cardUrl?: string;
  /** When set, pins scroll (0..1) for deterministic capture; else time-driven. */
  scrollOverride?: number | null;
}

export function PrimitivePreview({
  name,
  cardUrl = "/prism-mock/photo/celestia-hero/backdrop.png",
  scrollOverride = null,
}: PrimitivePreviewProps) {
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    let ok = true;
    new TextureLoader().load(cardUrl, (t) => {
      if (!ok) {
        t.dispose();
        return;
      }
      t.colorSpace = SRGBColorSpace;
      setTex(t);
    });
    return () => {
      ok = false;
    };
  }, [cardUrl]);

  const built = useMemo(() => {
    const def = getPrimitive(name);
    if (!def || !tex) return null;
    const object = new Group();
    const geo = new PlaneGeometry(1.7, 1.05);
    // Texture already loaded → subject material carries the map, so echoes
    // (clones) inherit the textured look.
    const mat = new MeshBasicMaterial({ map: tex, color: "#ffffff" });
    const subject = new Mesh(geo, mat);
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene: object as never,
      userData: {},
    };
    const inst: Animatable = def.create(target);
    return { object, geo, mat, inst, target };
  }, [name, tex]);

  useEffect(() => {
    if (!built) return;
    return () => {
      built.inst.dispose();
      built.geo.dispose();
      built.mat.dispose();
    };
  }, [built]);
  useEffect(() => () => tex?.dispose(), [tex]);

  useFrame((state) => {
    if (!built) return;
    if (scrollOverride != null) built.target.userData.scroll = scrollOverride;
    else delete built.target.userData.scroll;
    built.inst.seek(state.clock.elapsedTime);
    if (typeof window !== "undefined") {
      (window as unknown as { __PRIM__?: unknown }).__PRIM__ = {
        name,
        seek: (t: number) => built.inst.seek(t),
        setScroll: (v: number | null) => {
          if (v == null) delete built.target.userData.scroll;
          else built.target.userData.scroll = v;
        },
      };
    }
  });

  if (!built) return null;
  return <primitive object={built.object} />;
}
