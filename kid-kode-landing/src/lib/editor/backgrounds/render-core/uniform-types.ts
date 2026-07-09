// W-BG render-core — shared uniform typing.
//
// `uniform(0)` from three/tsl types its `.value` as unknown; the render cores
// hand these to hosts (R3F layers + the runtime mounter) that write numeric
// values every frame. This view type keeps those writes typed without
// re-declaring TSL's node generics.

export interface BgNumericUniform {
  value: number;
}
