// Bespoke 3D icon registry for the liquid-glass toolbar — one custom, colored,
// animated 3D icon per tool (DESIGN LAW B.1). ZERO emoji / Lucide / line-drawings
// / lightning / box / generic glyphs. A few (text, changeArtifact, build) are
// photoreal ENGRAVINGS.

import { createElement, type ReactNode } from 'react';
import {
  TransformIcon,
  SelectionIcon,
  AddIcon,
  LibraryIcon,
  ImageIcon,
  ObjectIcon,
  BackgroundIcon,
  ChangeArtifactIcon,
  PromptEditIcon,
  TextIcon,
  AnimationIcon,
  FunctionIcon,
  LightingIcon,
  BuildIcon,
} from './glyphs';

type IconComp = (props: { accent: string }) => ReactNode;

const REGISTRY: Record<string, IconComp> = {
  transform: TransformIcon,
  selection: SelectionIcon,
  add: AddIcon,
  library: LibraryIcon,
  image: ImageIcon,
  object3d: ObjectIcon,
  background: BackgroundIcon,
  changeArtifact: ChangeArtifactIcon,
  promptEdit: PromptEditIcon,
  text: TextIcon,
  animation: AnimationIcon,
  function: FunctionIcon,
  lighting: LightingIcon,
  build: BuildIcon,
};

/** The bespoke 3D icon node for a tool, or undefined (→ placeholder stud). */
export function iconFor(id: string, accent: string): ReactNode | undefined {
  const Comp = REGISTRY[id];
  return Comp ? createElement(Comp, { accent }) : undefined;
}
