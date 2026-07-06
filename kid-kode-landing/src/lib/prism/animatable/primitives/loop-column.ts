// loop-column — a seamless wrap-around column crawl (W-PHOTO D3). The driver the
// gap report flagged missing for infinite-filmstrip-gallery: N cells stacked in
// a column that drifts continuously and wraps with NO visible seam (a cell
// exiting one end re-enters the other). Never-resting drift; scroll steers the
// rate, a time drift keeps it moving at rest.
//
// scroll/card/hard; duration Infinity. Cells are deep echoes of the subject
// (shared geometry, cloned materials). Distinct from scroll-marquee (horizontal
// belt steered by velocity impulse): loop-column is a vertical, always-moving
// seamless conveyor. DOM-free.

import { Box3, Vector3 } from "three";
import type { PrimitiveDefinition } from "../contract";
import { defineAnimatable } from "../base";
import { num, str } from "../contract";
import { makeEcho, type Echo } from "../echo";

const SCHEMA = [
  {
    id: "cells",
    label: "Cells",
    type: "fader",
    min: 3,
    max: 10,
    step: 1,
    default: 5,
  },
  {
    id: "gap",
    label: "Gap",
    type: "fader",
    min: 0,
    max: 1.5,
    step: 0.05,
    default: 0.25,
    unit: "x",
  },
  {
    id: "speed",
    label: "Speed",
    type: "fader",
    min: 0,
    max: 2,
    step: 0.02,
    default: 0.5,
    unit: "x",
  },
  {
    id: "scrollBoost",
    label: "Scroll boost",
    type: "fader",
    min: 0,
    max: 4,
    step: 0.1,
    default: 2,
  },
  {
    id: "direction",
    label: "Direction",
    type: "dropdown",
    options: [
      { value: "up", label: "Up" },
      { value: "down", label: "Down" },
    ],
    default: "up",
  },
] as const;

export const loopColumnPrimitive: PrimitiveDefinition = {
  name: "loop-column",
  label: "Loop Column",
  category: "scroll",
  difficulty: "hard",
  subject: "card",
  defaultDriver: "scroll",
  schema: SCHEMA,
  description:
    "A seamless wrap-around column: cells crawl continuously and re-enter with no " +
    "visible seam (infinite filmstrip). Never-resting drift; scroll steers the rate.",
  create: defineAnimatable(
    { name: "loop-column", category: "scroll", schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const box = new Box3().setFromObject(subject);
      const sz = new Vector3();
      box.getSize(sz);
      const cellH = Math.max(0.001, sz.y || 1);

      const echoes: Echo[] = [];
      let count = 0;
      const build = () => {
        for (const e of echoes) {
          target.object.remove(e.root);
          e.dispose();
        }
        echoes.length = 0;
        count = Math.round(num(params.cells, 5));
        for (let i = 1; i < count; i++) {
          const e = makeEcho(subject);
          target.object.add(e.root);
          echoes.push(e);
        }
      };
      build();

      const baseY = subject.position.y;

      function span(): number {
        return cellH * (1 + num(params.gap, 0.25));
      }

      function place(
        obj: { position: { y: number } },
        index: number,
        offset: number,
        L: number,
      ): void {
        // cell's home slot minus the moving offset, wrapped into [-L/2, L/2].
        let y = index * span() - offset;
        y = ((y % L) + L) % L; // → [0, L)
        y -= L / 2; // centre the column
        obj.position.y = baseY + y;
      }

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          const L = count * span();
          const dir = str(params.direction, "up") === "down" ? -1 : 1;
          const s = target.userData.scroll;
          const scrollTerm =
            typeof s === "number" && Number.isFinite(s)
              ? (s - 0.5) * num(params.scrollBoost, 2) * L
              : 0;
          // Continuous drift + scroll steer (never rests).
          const offset =
            dir * (t * num(params.speed, 0.5) * span() + scrollTerm);
          place(subject, 0, offset, L);
          for (let i = 0; i < echoes.length; i++)
            place(echoes[i].root, i + 1, offset, L);
        },
        onParamChange: (id: string) => {
          if (id === "cells") build();
        },
        dispose: () => {
          for (const e of echoes) {
            target.object.remove(e.root);
            e.dispose();
          }
          echoes.length = 0;
          subject.position.y = baseY;
        },
      };
    },
  ),
};
