import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { glitchDisplacePrimitive } from '@/lib/prism/animatable/primitives/glitch-displace';
import { makeTarget, runConformance } from './_conformance';

// Max absolute x-offset of any vertex versus its rest x (read from a fresh,
// un-seeked geometry baseline captured before the instance mutates positions).
function maxXOffset(pos: BufferAttribute, baseX: Float32Array): number {
  const arr = pos.array as Float32Array;
  let m = 0;
  for (let i = 0, v = 0; i < arr.length; i += 3, v++) {
    const d = Math.abs(arr[i] - baseX[v]);
    if (d > m) m = d;
  }
  return m;
}

describe('glitch-displace primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(glitchDisplacePrimitive).dispose();
  });

  it('plays: slices tear early and heal to whole at the end', () => {
    const target = makeTarget(glitchDisplacePrimitive);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
    // Snapshot the rest x positions BEFORE the instance touches geometry.
    const baseX = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) baseX[i] = (pos.array as Float32Array)[i * 3];

    const inst = glitchDisplacePrimitive.create(target);
    const dur = inst.duration();

    // Early in the timeline: large amplitude => some vertex is visibly offset.
    inst.seek(dur * 0.08);
    const early = maxXOffset(pos, baseX);

    // End of the timeline: amplitude decays to ~0 => surface heals to whole.
    inst.seek(dur);
    const late = maxXOffset(pos, baseX);

    expect(early).toBeGreaterThan(0.01);
    expect(early).toBeGreaterThan(late + 0.005);

    inst.dispose();
    // dispose restores the base positions exactly.
    expect(maxXOffset(pos, baseX)).toBeLessThan(1e-6);
  });

  it('controls change output: higher intensity means larger tear offset', () => {
    const target = makeTarget(glitchDisplacePrimitive);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
    const baseX = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) baseX[i] = (pos.array as Float32Array)[i * 3];

    const inst = glitchDisplacePrimitive.create(target);
    const dur = inst.duration();

    inst.setControl('intensity', 0.05);
    inst.seek(dur * 0.05);
    const small = maxXOffset(pos, baseX);

    inst.setControl('intensity', 1);
    inst.seek(dur * 0.05);
    const large = maxXOffset(pos, baseX);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
