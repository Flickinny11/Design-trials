'use client';

// PRISM MARKETING — CLIENT ISLAND WRAPPERS (SHELL W6, DL8)
//
// Thin client wrappers that pair each 3D island (next/dynamic ssr:false) with
// its static poster inside the Lazy3D viewport/capability guard. Server pages
// render these directly inside otherwise-static, crawlable markup — the 3D is
// additive and never blocks first paint.

import dynamic from 'next/dynamic';
import Lazy3D from './Lazy3D';
import { MarkPoster } from './posters';
import type { IconKey } from './PremiumIcon3D';

const PremiumIcon3D = dynamic(() => import('./PremiumIcon3D'), { ssr: false });
const TemplateJewel3D = dynamic(() => import('./TemplateJewel3D'), { ssr: false });

/** A single machined 3D icon for a feature card. */
export function FeatureIcon({ icon }: { icon: IconKey }) {
  return (
    <Lazy3D poster={<MarkPoster />}>
      <PremiumIcon3D icon={icon} />
    </Lazy3D>
  );
}

/** A template's signature 3D jewel thumbnail. */
export function TemplateThumb({ accent }: { accent: string }) {
  return (
    <Lazy3D poster={<MarkPoster accent={accent} />}>
      <TemplateJewel3D accent={accent} />
    </Lazy3D>
  );
}
