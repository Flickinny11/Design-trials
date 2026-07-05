// defineAnimatable — boilerplate-free factory for catalog primitives.
//
// A primitive author implements ONLY `build(target, params) -> BoundPrimitive`
// ({ duration, seek, dispose, onParamChange? }). The factory supplies
// controls()/getParams()/setControl()/serialize() uniformly, so every catalog
// primitive conforms to the Animatable contract identically.
//
// Live params: `build` closes over the SAME `params` object that setControl
// mutates, so seek() reads tweaked values on the very next frame (criterion
// "controls work") with no rebuild. Primitives that must react structurally
// to a param (geometry rebuild, uniform swap) implement onParamChange.

import {
  resolveParams,
  type Animatable,
  type AnimatableTarget,
  type ControlSchema,
  type ControlValue,
  type ParamState,
  type PrimitiveCategory,
  type PrimitiveState,
} from './contract';

export interface BoundPrimitive {
  duration(): number;
  seek(t: number): void;
  dispose(): void;
  /** Optional: react to a live control change (uniforms, geometry). */
  onParamChange?(id: string, value: ControlValue): void;
}

export interface AnimatableMeta {
  name: string;
  category: PrimitiveCategory;
  schema: ControlSchema;
}

export function defineAnimatable(
  meta: AnimatableMeta,
  build: (target: AnimatableTarget, params: ParamState) => BoundPrimitive,
): (target: AnimatableTarget, overrides?: Partial<ParamState>) => Animatable {
  return (target, overrides) => {
    const params = resolveParams(meta.schema, overrides);
    const bound = build(target, params);
    const inst: Animatable = {
      name: meta.name,
      category: meta.category,
      duration: () => bound.duration(),
      seek: (t) => bound.seek(t),
      controls: () => meta.schema,
      getParams: () => ({ ...params }),
      setControl: (id, value) => {
        if (!(id in params)) return;
        params[id] = value;
        bound.onParamChange?.(id, value);
      },
      serialize: (): PrimitiveState => ({
        name: meta.name,
        category: meta.category,
        params: { ...params },
        duration: bound.duration(),
      }),
      dispose: () => bound.dispose(),
    };
    return inst;
  };
}
