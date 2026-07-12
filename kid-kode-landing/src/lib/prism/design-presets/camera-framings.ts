// W-VIS D3 — camera-framing library: 12 numeric framings, mood-tagged.
// Positions subject-relative (units of subject bounding radius, +Z toward
// default camera). Every framing is render-proven with a committed thumb
// (scripts/wvis/d3-proof-bundles.mjs).

import type { CameraFramingPreset } from './types';

export const CAMERA_FRAMINGS: readonly CameraFramingPreset[] = [
  {
    id: 'cam-hero-three-quarter',
    name: 'Hero three-quarter',
    moods: ['product', 'dramatic'],
    intent: 'The default flagship product view — three-quarter, slightly above eye line, subject ~60% of frame height.',
    fov: 38, position: [2.6, 1.7, 3.4], lookAt: [0, 0.45, 0], subjectHeightFraction: 0.6,
    thumbUrl: '/design-presets/thumbs/cam-hero-three-quarter.webp',
  },
  {
    id: 'cam-face-on-pedestal',
    name: 'Face-on pedestal',
    moods: ['gallery', 'monumental', 'quiet'],
    intent: 'Frontal museum elevation — symmetric, level, formal.',
    fov: 34, position: [0, 0.9, 4.4], lookAt: [0, 0.55, 0], subjectHeightFraction: 0.55,
    thumbUrl: '/design-presets/thumbs/cam-face-on-pedestal.webp',
  },
  {
    id: 'cam-low-angle-monument',
    name: 'Low-angle monument',
    moods: ['monumental', 'dramatic'],
    intent: 'Camera below the subject looking up — scale, authority, drama.',
    fov: 44, position: [1.4, -0.5, 3.2], lookAt: [0, 0.75, 0], subjectHeightFraction: 0.72,
    thumbUrl: '/design-presets/thumbs/cam-low-angle-monument.webp',
  },
  {
    id: 'cam-top-down-flatlay',
    name: 'Top-down flat lay',
    moods: ['editorial', 'clinical'],
    intent: 'Straight-down catalog table view — layout reads as 2D composition.',
    fov: 40, position: [0, 4.6, 0.35], lookAt: [0, 0, 0], subjectHeightFraction: 0.5,
    thumbUrl: '/design-presets/thumbs/cam-top-down-flatlay.webp',
  },
  {
    id: 'cam-editorial-offset-left',
    name: 'Editorial offset left',
    moods: ['editorial', 'product'],
    intent: 'Subject pushed to the left third, generous right negative space for type.',
    fov: 36, position: [1.9, 1.15, 3.8], lookAt: [1.15, 0.5, 0], subjectHeightFraction: 0.5,
    thumbUrl: '/design-presets/thumbs/cam-editorial-offset-left.webp',
  },
  {
    id: 'cam-editorial-offset-right',
    name: 'Editorial offset right',
    moods: ['editorial', 'product'],
    intent: 'Mirror of offset-left — subject right third, copy space left.',
    fov: 36, position: [-1.9, 1.15, 3.8], lookAt: [-1.15, 0.5, 0], subjectHeightFraction: 0.5,
    thumbUrl: '/design-presets/thumbs/cam-editorial-offset-right.webp',
  },
  {
    id: 'cam-macro-detail',
    name: 'Macro detail',
    moods: ['product', 'warm'],
    intent: 'Tight close crop on surface detail — material worship, shallow context.',
    fov: 30, position: [1.1, 0.85, 1.6], lookAt: [0, 0.5, 0], subjectHeightFraction: 0.95,
    thumbUrl: '/design-presets/thumbs/cam-macro-detail.webp',
  },
  {
    id: 'cam-wide-stage',
    name: 'Wide stage',
    moods: ['gallery', 'quiet', 'monumental'],
    intent: 'Pulled-back establishing view — subject small on a big stage, architecture breathes.',
    fov: 46, position: [3.4, 2.1, 6.4], lookAt: [0, 0.5, 0], subjectHeightFraction: 0.3,
    thumbUrl: '/design-presets/thumbs/cam-wide-stage.webp',
  },
  {
    id: 'cam-dutch-drama',
    name: 'Dutch drama',
    moods: ['kinetic', 'dramatic', 'noir'],
    intent: 'Slight dutch tilt + near position — motion energy for kinetic type and reveals.',
    fov: 42, position: [2.0, 1.3, 2.6], lookAt: [-0.35, 0.62, 0], subjectHeightFraction: 0.68,
    thumbUrl: '/design-presets/thumbs/cam-dutch-drama.webp',
  },
  {
    id: 'cam-profile-silhouette',
    name: 'Profile silhouette',
    moods: ['noir', 'editorial'],
    intent: 'Pure side elevation — pairs with rim/backlit rigs for silhouette reads.',
    fov: 36, position: [4.2, 0.85, 0.15], lookAt: [0, 0.55, 0], subjectHeightFraction: 0.58,
    thumbUrl: '/design-presets/thumbs/cam-profile-silhouette.webp',
  },
  {
    id: 'cam-elevated-showcase',
    name: 'Elevated showcase',
    moods: ['product', 'clinical'],
    intent: 'High three-quarter looking down — dashboards, bento boards, arranged sets.',
    fov: 38, position: [2.2, 3.2, 2.9], lookAt: [0, 0.15, 0], subjectHeightFraction: 0.52,
    thumbUrl: '/design-presets/thumbs/cam-elevated-showcase.webp',
  },
  {
    id: 'cam-orbital-start',
    name: 'Orbital start',
    moods: ['kinetic', 'product'],
    intent: 'The opening frame of a slow orbit — 30° off frontal, ready to drift.',
    fov: 40, position: [1.75, 1.25, 3.1], lookAt: [0, 0.5, 0], subjectHeightFraction: 0.58,
    thumbUrl: '/design-presets/thumbs/cam-orbital-start.webp',
  },
];

export function getCameraFraming(id: string): CameraFramingPreset | undefined {
  return CAMERA_FRAMINGS.find((c) => c.id === id);
}
