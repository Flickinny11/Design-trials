ADVANCED_DESIGNS.md — Awwwards-Level Visual Effects Reference
For AI Builder Apps (KripTik AI, Cursor, Bolt, etc.)
Last Updated: February 2026
Difficulty Scale: 6-10 (assumes builder already knows GSAP, Motion, basic Three.js, standard CSS)
PURPOSE: This document catalogs ADVANCED design dependencies, shader techniques, and creative coding patterns that go beyond what AI models typically default to. These are the tools and techniques that separate generic sites from Awwwards winners.
NOT COVERED HERE: Basic CSS animations, standard GSAP usage, basic Three.js scenes, Tailwind utilities, simple SVG animations, standard scroll animations. Those are assumed knowledge.

TABLE OF CONTENTS
WebGL Shader Libraries (DOM-Driven)
GLSL Shader Ecosystem
Three.js Shading Language (TSL) & WebGPU
Post-Processing Effects Pipeline
Page Transition Systems
Advanced Scroll Engines
Cursor & Interaction Libraries
Ray Marching & Signed Distance Functions
Noise & Procedural Generation
Fluid & Physics Simulation
Advanced Shader Techniques Cookbook
No-Code WebGL Tools
3D Asset Pipeline (Unreal/Blender → Web)
View Transitions API (Native)
Integration Recipes
Performance Patterns for Heavy Effects

1. WebGL Shader Libraries (DOM-Driven)
   These libraries apply WebGL shader effects to normal HTML/DOM elements — the secret sauce behind sites where images distort, ripple, and morph on hover without visible canvas elements.
   curtains.js
   What: Converts HTML elements (images, videos, canvases) into WebGL textured planes positioned via CSS. Shaders run on those planes while layout stays in DOM.
   Install: npm install curtainsjs
   Size: ~45KB minified
   Key Concept: You write HTML/CSS normally. curtains.js creates WebGL planes behind those elements and maps their content as textures. Shaders modify the textures. CSS still controls position/size.
   Difficulty: 7/10
   Use Cases: Image hover distortion, video texture manipulation, scroll-driven displacement, liquid transitions between images
   Key Classes: Curtains, Plane, ShaderPass, RenderTarget, Texture
   import { Curtains, Plane } from 'curtainsjs';

const curtains = new Curtains({ container: "canvas" });
const params = {
vertexShaderID: "plane-vs",
fragmentShaderID: "plane-fs",
uniforms: {
time: { name: "uTime", type: "1f", value: 0 },
mousePos: { name: "uMouse", type: "2f", value: [0, 0] }
}
};
const plane = new Plane(curtains, document.querySelector(".image-wrapper"), params);
plane.onRender(() => {
plane.uniforms.time.value++;
});
// Fragment shader for displacement hover effect
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler0;
uniform float uTime;
uniform vec2 uMouse;

void main() {
vec2 uv = vTextureCoord;
float dist = distance(uv, uMouse);
float strength = smoothstep(0.3, 0.0, dist);
uv += strength * 0.05 * vec2(sin(uTime * 0.01), cos(uTime * 0.01));
gl_FragColor = texture2D(uSampler0, uv);
}
Docs: https://www.curtainsjs.com/
Key Patterns: Displacement maps as secondary textures, mouse-reactive uniforms, scroll-position uniforms, transition between two textures with dissolve shaders
@vfx-js/core (VFX-JS)
What: Applies WebGL shader effects to ANY DOM element — <img>, <video>, <span>, <div>. Preset effects + custom GLSL.
Install: npm install @vfx-js/core
React: npm install react-vfx (wraps elements in <VFXImg>, <VFXVideo>, <VFXSpan>)
Difficulty: 5/10 (presets) → 8/10 (custom shaders)
Built-in Presets: glitch, rgbShift, rgbGlitch, rainbow, hueShift, sinewave, pixelate, halftone, spring, duotone, tritone
// React usage with presets
import { VFXProvider, VFXImg, VFXSpan } from 'react-vfx';

<VFXProvider>
  <VFXImg src="hero.jpg" shader="rgbShift" />
  <VFXSpan shader="glitch">GLITCH TEXT</VFXSpan>
</VFXProvider>

// Custom GLSL shader
<VFXImg src="photo.jpg" shader={`
precision mediump float;
uniform vec2 resolution;
uniform vec2 offset;
uniform float time;
uniform sampler2D src;

void main() {
vec2 uv = (gl_FragCoord.xy - offset) / resolution;
uv.y = 1.0 - uv.y;
float wave = sin(uv.y * 20.0 + time * 3.0) * 0.01;
gl_FragColor = texture2D(src, uv + vec2(wave, 0.0));
}
`} />
Docs: https://github.com/fand/vfx-js
Key Advantage: Zero canvas management. Just wrap DOM elements. Effects are shader-powered but feel like CSS classes.
OGL (Minimal WebGL Framework)
What: Minimal WebGL library (~15KB). No bloat. Direct GPU access. Used by many Awwwards winners.
Install: npm install ogl
Difficulty: 8/10
Key Difference from Three.js: No scene graph overhead. Direct buffer/shader management. Better for 2D shader art, post-processing planes, and custom renderers.
import { Renderer, Camera, Program, Mesh, Plane } from 'ogl';

const renderer = new Renderer();
const gl = renderer.gl;
document.body.appendChild(gl.canvas);

const camera = new Camera(gl);
camera.position.z = 1;

const geometry = new Plane(gl);
const program = new Program(gl, {
vertex: `attribute vec2 position; attribute vec2 uv; varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position, 0, 1); }`,
fragment: `precision highp float; varying vec2 vUv; uniform float uTime;
    void main() {
      vec3 color = 0.5 + 0.5 * cos(uTime + vUv.xyx + vec3(0,2,4));
      gl_FragColor = vec4(color, 1.0);
    }`,
uniforms: { uTime: { value: 0 } }
});

const mesh = new Mesh(gl, { geometry, program });

requestAnimationFrame(function update(t) {
requestAnimationFrame(update);
program.uniforms.uTime.value = t * 0.001;
renderer.render({ scene: mesh, camera });
});
Docs: https://github.com/oframe/ogl
Best For: Lightweight background effects, fullscreen shader planes, 2D WebGL art, when Three.js is overkill

2. GLSL Shader Ecosystem
   glslify — npm Module System for GLSL
   What: Node.js-style require() for GLSL shaders. Import noise, lighting, easing functions from npm packages.
   Install: npm install glslify
   Bundler Integration: Works with webpack (glslify-loader), browserify, rollup, vite (vite-plugin-glslify)
   Difficulty: 7/10
   // Import noise from npm package
   #pragma glslify: noise = require(glsl-noise/simplex/3d)
   #pragma glslify: ease = require(glsl-easings/cubic-in-out)

void main() {
float n = noise(vec3(vUv * 10.0, uTime));
float e = ease(n);
gl_FragColor = vec4(vec3(e), 1.0);
}
Key glslify Packages (npm)
Package
Purpose
Install
glsl-noise
Perlin, Simplex, Worley noise
npm i glsl-noise
glsl-easings
30+ easing functions in GLSL
npm i glsl-easings
glsl-sdf-primitives
Ray marching SDF shapes
npm i glsl-sdf-primitives
glsl-sdf-ops
Union, intersection, smooth blend
npm i glsl-sdf-ops
glsl-raytrace
Ray march loop helper
npm i glsl-raytrace
glsl-camera-ray
Camera ray direction calculation
npm i glsl-camera-ray
glsl-film-grain
Cinematic film grain
npm i glsl-film-grain
glsl-lut
Color lookup table application
npm i glsl-lut
glsl-fog
Distance fog functions
npm i glsl-fog
glsl-specular-phong
Phong specular lighting
npm i glsl-specular-phong
glsl-diffuse-lambert
Lambert diffuse lighting
npm i glsl-diffuse-lambert
gl-noise (Standalone, No glslify Required)
Install: npm install gl-noise
What: GLSL noise collection that works WITHOUT glslify. Direct import. Includes Perlin, Simplex, Voronoi, FBM.
Advantage: Works with any WebGL framework (Three.js, OGL, raw WebGL) without build tool dependency.
import { Perlin, Simplex, Voronoi, loadShaders } from 'gl-noise';

const chunks = [Perlin, Simplex, Voronoi];
loadShaders(["./shader.frag"], chunks).then(([fragSource]) => {
// fragSource now has noise functions injected
});
// In your shader — functions are auto-available after loadShaders
float p = gln_perlin(uv * 5.0);
float s = gln_simplex(vec3(uv, time));
float v = gln_voronoi(uv * 3.0).x;

3. Three.js Shading Language (TSL) & WebGPU
   TSL is the future of Three.js shaders. Write shader logic in JavaScript that compiles to both WGSL (WebGPU) and GLSL (WebGL). Write once, run anywhere. No more raw shader strings.
   Setup
   import { WebGPURenderer } from 'three/webgpu';
   import { color, positionLocal, normalLocal, sin, time, mix, Fn, uniform, uv, vec3, float } from 'three/tsl';
   import { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';

// CRITICAL: WebGPU requires async init
const renderer = new WebGPURenderer({ antialias: true });
await renderer.init(); // MANDATORY — fails silently without this
Browser Support (as of Feb 2026)
Chrome: ✅ Full WebGPU
Safari 26+: ✅ (shipped Sept 2025)
Firefox: ✅
~95% coverage with automatic WebGL fallback
TSL Patterns
// Pulsing color material
const material = new MeshStandardNodeMaterial();
const pulse = sin(time.mul(2.0)).mul(0.5).add(0.5);
material.colorNode = color(1, 0, 0).mul(pulse);

// Vertex displacement (waves)
const displacement = sin(positionLocal.x.mul(5.0).add(time)).mul(0.2);
material.positionNode = positionLocal.add(normalLocal.mul(displacement));

// Custom function with Fn()
const myEffect = Fn(([uv_input, t]) => {
const wave = sin(uv_input.x.mul(10.0).add(t)).mul(0.5).add(0.5);
return mix(color(0x0000ff), color(0xff0000), wave);
});
material.colorNode = myEffect(uv(), time);

// Uniform (updatable from JS)
const intensity = uniform(float(1.0));
material.colorNode = color(1, 0, 0).mul(intensity);
// Later in animation loop:
intensity.value = Math.sin(performance.now() * 0.001);
GPU Compute Shaders (Millions of Particles)
import { instancedArray, storage, uniform } from 'three/tsl';

// CPU particles cap at ~50K. GPU compute does MILLIONS.
const particleCount = 1000000;
const positions = instancedArray(particleCount, 'vec3');
const velocities = instancedArray(particleCount, 'vec3');

// Compute shader updates all particles on GPU
const computeUpdate = Fn(() => {
const pos = positions.element(instanceIndex);
const vel = velocities.element(instanceIndex);
pos.addAssign(vel.mul(deltaTime));
});

// Render loop with async (required for compute)
async function animate() {
await renderer.computeAsync(computeUpdate);
await renderer.renderAsync(scene, camera);
requestAnimationFrame(animate);
}
TSL with React Three Fiber
import { extend } from '@react-three/fiber';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';

extend({ MeshBasicNodeMaterial, MeshStandardNodeMaterial });

function ShaderSphere() {
const matRef = useRef();
useFrame(() => {
// TSL uniform updates happen here
});
return (
<mesh>
<sphereGeometry args={[1, 64, 64]} />
<meshStandardNodeMaterial ref={matRef} />
</mesh>
);
}
Key TSL Functions Reference
Function
Purpose
positionLocal, positionWorld
Vertex position access
normalLocal, normalWorld
Normal vector access
uv()
UV coordinates
time
Auto-incrementing time uniform
sin(), cos(), abs(), pow()
Math operations
mix(a, b, t)
Linear interpolation
smoothstep(edge0, edge1, x)
Smooth step
Fn(callback)
Custom TSL function definition
uniform(type)
JS-updatable uniform
color(hex)
Color node
texture(map)
Texture sampling
instancedArray(count, type)
GPU buffer for compute
storageTexture(w, h)
Read/write texture for compute

4. Post-Processing Effects Pipeline
   postprocessing (pmndrs)
   What: High-performance post-processing for Three.js. Merges multiple effects into minimal passes (vs Three.js EffectComposer which uses one pass per effect).
   Install: npm install postprocessing
   Performance: 2-5x faster than Three.js built-in EffectComposer for multi-effect chains
   Difficulty: 6/10
   import {
   EffectComposer, EffectPass, RenderPass,
   BloomEffect, ChromaticAberrationEffect, GlitchEffect,
   NoiseEffect, VignetteEffect, GodRaysEffect,
   DepthOfFieldEffect, SMAAEffect, ToneMappingEffect,
   ScanlineEffect, PixelationEffect, ShockWaveEffect,
   DotScreenEffect, GridEffect, ColorDepthEffect,
   SSAOEffect, OutlineEffect
   } from 'postprocessing';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Stack multiple effects in ONE pass (key performance advantage)
composer.addPass(new EffectPass(camera,
new BloomEffect({ intensity: 1.5, luminanceThreshold: 0.4 }),
new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.002, 0.002) }),
new VignetteEffect({ darkness: 0.5 }),
new NoiseEffect({ premultiply: true })
));

// In render loop — replace renderer.render()
composer.render();
Full Effects List
Effect
Visual
Awwwards Usage
BloomEffect
Glow around bright areas
Hero sections, neon themes
ChromaticAberrationEffect
RGB color split at edges
Glitch aesthetics, hover states
GlitchEffect
Digital distortion
Transitions, error states
GodRaysEffect
Volumetric light beams
Dramatic reveals
DepthOfFieldEffect
Bokeh blur by depth
Product showcases, focus
SSAOEffect
Ambient occlusion
Realistic 3D scenes
VignetteEffect
Dark edges
Cinematic framing
NoiseEffect
Film grain
Texture, vintage
ScanlineEffect
CRT scan lines
Retro, cyberpunk
PixelationEffect
Pixel art reduction
Stylistic transitions
ShockWaveEffect
Expanding ripple
Click effects, impacts
DotScreenEffect
Halftone dots
Print/comic style
GridEffect
Grid overlay
Tech/matrix themes
ColorDepthEffect
Reduce color palette
Stylized rendering
OutlineEffect
Edge outlines on objects
Selection highlights
ToneMappingEffect
HDR tone mapping
Color grading
LUT1DEffect / LUT3DEffect
Color lookup tables
Film color grading
HueSaturationEffect
Color adjustments
Mood control
React Three Fiber Integration
import { EffectComposer, Bloom, ChromaticAberration, Glitch } from '@react-three/postprocessing';
import { GlitchMode } from 'postprocessing';

<EffectComposer>
  <Bloom intensity={1.5} luminanceThreshold={0.4} />
  <ChromaticAberration offset={[0.002, 0.002]} />
  <Glitch
    delay={[1.5, 3.5]}
    duration={[0.6, 1.0]}
    strength={[0.3, 1.0]}
    mode={GlitchMode.SPORADIC}
  />
</EffectComposer>

5. Page Transition Systems
   Barba.js v2
   What: PJAX-based page transitions. Prevents full page reload — fetches new page via AJAX, swaps containers, runs transition animations. Makes multi-page sites feel like SPAs.
   Install: npm install @barba/core
   Size: ~4KB gzipped
   Difficulty: 6/10
   import barba from '@barba/core';
   import gsap from 'gsap';

barba.init({
transitions: [{
name: 'fade',
leave(data) {
return gsap.to(data.current.container, {
opacity: 0, y: -50, duration: 0.5
});
},
enter(data) {
return gsap.from(data.next.container, {
opacity: 0, y: 50, duration: 0.5
});
}
}]
});

// Namespace-based transitions (different animation per page type)
barba.init({
transitions: [{
name: 'portfolio-detail',
from: { namespace: ['portfolio'] },
to: { namespace: ['project'] },
leave(data) {
const thumbnail = data.current.container.querySelector('.project-thumb');
return gsap.to(thumbnail, { scale: 3, duration: 0.8 });
},
enter(data) {
const hero = data.next.container.querySelector('.project-hero');
return gsap.from(hero, { scale: 3, duration: 0.8 });
}
}]
});
Lifecycle Hooks: beforeLeave → leave → afterLeave → beforeEnter → enter → afterEnter
Docs: https://barba.js.org/
Integration: Works with GSAP, Locomotive Scroll, curtains.js. Reinitialize scroll/WebGL on afterEnter.
View Transitions API (see Section 14)
Native browser alternative — no library needed for basic cross-fade and morph transitions.

6. Advanced Scroll Engines
   Locomotive Scroll v5
   What: Complete rewrite from v4. Built on Lenis. TypeScript-first. Smooth scrolling + viewport detection + parallax.
   Install: npm install locomotive-scroll@beta (v5)
   Size: 9.4KB gzipped
   Difficulty: 5/10
   Key Changes from v4: Dual IntersectionObserver strategy, parallax auto-disabled on mobile, custom scroll containers
   import LocomotiveScroll from 'locomotive-scroll';

const scroll = new LocomotiveScroll({
lenisOptions: {
lerp: 0.1, // smoothness (0.01 = very smooth, 1 = instant)
duration: 1.2, // scroll duration
smoothWheel: true
}
});

// Parallax via HTML attributes
// <div data-scroll data-scroll-speed="2">Parallax element</div>
// <div data-scroll data-scroll-speed="-1">Reverse parallax</div>

// Scroll events
scroll.on('scroll', ({ scroll, limit }) => {
const progress = scroll.y / limit.y; // 0 to 1
// Drive shader uniforms, camera position, etc.
});
GSAP ScrollTrigger Sync:
import LocomotiveScroll from 'locomotive-scroll';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const scroll = new LocomotiveScroll();
scroll.on('scroll', ScrollTrigger.update);

ScrollTrigger.scrollerProxy(document.body, {
scrollTop(value) {
return arguments.length
? scroll.scrollTo(value, { duration: 0, disableLerp: true })
: scroll.scroll.instance.scroll.y;
},
getBoundingClientRect() {
return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}
});
Lenis (Standalone)
Install: npm install lenis
Size: ~5KB
What: Just the smooth scroll engine. No parallax or viewport detection. Used as foundation by Locomotive Scroll v5.
import Lenis from 'lenis';

const lenis = new Lenis({
duration: 1.2,
easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
orientation: 'vertical',
smoothWheel: true
});

function raf(time) {
lenis.raf(time);
requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

7. Cursor & Interaction Libraries
   mouse-follower (Cuberto)
   What: The cursor library behind many Awwwards-winning Cuberto sites. Magnetic snap, skew on movement, custom states, text cursor, icon cursor.
   Install: npm install mouse-follower
   Requires: GSAP (npm install gsap)
   Difficulty: 5/10
   import MouseFollower from 'mouse-follower';
   import gsap from 'gsap';
   MouseFollower.registerGSAP(gsap);

const cursor = new MouseFollower({
speed: 0.55,
ease: 'expo.out',
skewing: 3, // Distort cursor on movement
skewingText: 2,
skewingIcon: 2,
skewingMedia: 2,
skewingDelta: 0.001,
skewingDeltaMax: 0.15
});

// Data attributes on HTML elements
// <a data-cursor-text="View">Link</a> → Text inside cursor
// <a data-cursor-icon="arrow">Link</a> → Icon inside cursor
// <a data-cursor="-hidden">Link</a> → Hide cursor
// <a data-cursor="-exclusion">Link</a> → Blend mode exclusion
// <a data-cursor-color="#ff0000">Link</a> → Change cursor color
// <div data-cursor-stick>Element</div> → Magnetic snap
magnetic-elements
Install: npm install magnetic-elements
What: Makes DOM elements magnetically attract toward cursor on proximity
import { MagneticElement } from 'magnetic-elements';

document.querySelectorAll('.magnetic-btn').forEach(el => {
new MagneticElement(el, {
strength: 30, // Pull strength in px
ease: 0.15, // Smooth factor
distance: 0.5 // Trigger distance as ratio of element size
});
});
Cursify (React/Next.js)
Install: npm install cursify
What: React-native cursor animation library with presets: Spotlight, Magnetic, ThreeD, Character, Springy, Glow
import { CursorProvider, MagneticCursor } from 'cursify';

<CursorProvider>
  <MagneticCursor />
  {/* Your app */}
</CursorProvider>
Custom Cursor Pattern (No Library)
// The pattern most Awwwards sites use — lerped custom cursor
const cursor = document.querySelector('.cursor');
let mouseX = 0, mouseY = 0, cursorX = 0, cursorY = 0;

document.addEventListener('mousemove', (e) => {
mouseX = e.clientX;
mouseY = e.clientY;
});

function render() {
// Lerp for smooth following
cursorX += (mouseX - cursorX) * 0.1;
cursorY += (mouseY - cursorY) * 0.1;
cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
requestAnimationFrame(render);
}
render();

// Magnetic effect on hover
document.querySelectorAll('[data-magnetic]').forEach(el => {
el.addEventListener('mousemove', (e) => {
const rect = el.getBoundingClientRect();
const x = e.clientX - rect.left - rect.width / 2;
const y = e.clientY - rect.top - rect.height / 2;
el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
});
el.addEventListener('mouseleave', () => {
el.style.transform = 'translate(0, 0)';
});
});

8. Ray Marching & Signed Distance Functions
   Ray marching with SDFs runs ENTIRELY in a fragment shader. No geometry, no vertices, no meshes. The entire scene is defined mathematically. This is how Shadertoy demos work, and the technique behind many high-end web effects.
   Core Algorithm
   float rayMarch(vec3 ro, vec3 rd) {
   float d = 0.0;
   for (int i = 0; i < 100; i++) {
   vec3 p = ro + rd * d;
   float ds = sceneSDF(p);
   if (ds < 0.001) return d; // Hit surface
   d += ds;
   if (d > 100.0) break; // Too far
   }
   return -1.0; // No hit
   }
   SDF Primitives (from Inigo Quilez — the definitive reference)
   // Sphere
   float sdSphere(vec3 p, float r) {
   return length(p) - r;
   }

// Box
float sdBox(vec3 p, vec3 b) {
vec3 q = abs(p) - b;
return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Torus
float sdTorus(vec3 p, vec2 t) {
vec2 q = vec2(length(p.xz) - t.x, p.y);
return length(q) - t.y;
}

// Round Box (smooth edges)
float sdRoundBox(vec3 p, vec3 b, float r) {
vec3 q = abs(p) - b + r;
return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
SDF Boolean Operations
// Union — combine shapes
float opUnion(float d1, float d2) { return min(d1, d2); }

// Intersection — where both shapes overlap
float opIntersection(float d1, float d2) { return max(d1, d2); }

// Subtraction — cut one from another
float opSubtraction(float d1, float d2) { return max(-d1, d2); }

// SMOOTH union — the magic sauce for organic/liquid effects
float opSmoothUnion(float d1, float d2, float k) {
float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
return mix(d2, d1, h) - k * h * (1.0 - h);
}
Normal Calculation (for lighting)
vec3 calcNormal(vec3 p) {
vec2 e = vec2(0.001, 0.0);
return normalize(vec3(
sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
));
}
Using SDFs on the Web
Shadertoy (shadertoy.com): Live GLSL editor. Prototype effects, then port to Three.js ShaderMaterial or OGL.
glsl-sdf-primitives + glsl-sdf-ops (npm via glslify): Pre-built SDF functions.
Three.js ShaderMaterial: Fullscreen quad with custom fragment shader.
// Three.js fullscreen SDF scene
const material = new THREE.ShaderMaterial({
uniforms: {
uTime: { value: 0 },
uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
uMouse: { value: new THREE.Vector2(0, 0) }
},
vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
fragmentShader: sdfFragmentShader // Your ray marching shader
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
Key Reference: https://iquilezles.org/articles/distfunctions/
Complete SDF library with 50+ primitive shapes, operations, and deformations.

9. Noise & Procedural Generation
   JavaScript Noise Libraries
   Library
   Install
   Features
   simplex-noise
   npm install simplex-noise
   Fast 2D/3D/4D simplex noise. Tree-shakeable.
   open-simplex-noise
   npm install open-simplex-noise
   OpenSimplex algorithm (avoids Perlin artifacts)
   noisejs
   npm install noisejs
   Classic 2D Perlin + Simplex
   import { createNoise2D, createNoise3D, createNoise4D } from 'simplex-noise';

const noise2D = createNoise2D();
const noise3D = createNoise3D();

// Displacement map generation
for (let x = 0; x < width; x++) {
for (let y = 0; y < height; y++) {
const value = noise2D(x * 0.01, y * 0.01); // -1 to 1
// Use for vertex displacement, color variation, particle positioning
}
}

// Animated noise (use time as z-axis)
function animate(t) {
const value = noise3D(x * 0.01, y * 0.01, t * 0.001);
// Flowing, organic animation
}
GLSL Noise Functions
// Fractal Brownian Motion — layered noise for natural terrain/clouds
float fbm(vec2 p) {
float value = 0.0;
float amplitude = 0.5;
float frequency = 1.0;
for (int i = 0; i < 6; i++) {
value += amplitude * noise(p * frequency);
frequency *= 2.0;
amplitude *= 0.5;
}
return value;
}

// Domain warping — feed noise into noise for surreal organic patterns
float domainWarp(vec2 p) {
vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2)),
fbm(p + 4.0 * q + vec2(8.3, 2.8)));
return fbm(p + 4.0 * r);
}
Noise Use Cases for Web
Flowing backgrounds: Animate noise over time for organic movement
Terrain generation: FBM noise → heightmap → Three.js displacement
Particle flow fields: Noise determines particle velocity at each position
Mesh distortion: Noise → vertex displacement for breathing/pulsing geometry
Texture generation: Procedural marble, wood, clouds, fire

10. Fluid & Physics Simulation
    WebGL-Fluid-Simulation
    What: GPU-based Navier-Stokes fluid simulation. Interactive — responds to mouse/touch.
    Source: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
    Size: Standalone, no npm (fork and integrate)
    Difficulty: 7/10 (integration), 3/10 (drop-in background)
    Performance: 60fps on mobile
    WebGPU Fluid (kishimisu)
    Source: https://github.com/kishimisu/WebGPU-Fluid-Simulation
    What: Jos Stam fluid dynamics using WebGPU compute shaders. Higher particle counts than WebGL version.
    Rapier (WASM Physics)
    Install: npm install @dimforge/rapier3d (3D) or @dimforge/rapier2d (2D)
    What: Rust-based physics engine compiled to WASM. Fast rigid body, joints, collision. Used with Three.js for interactive 3D physics.
    Difficulty: 7/10
    import RAPIER from '@dimforge/rapier3d';

await RAPIER.init();
const gravity = { x: 0, y: -9.81, z: 0 };
const world = new RAPIER.World(gravity);

// Rigid body
const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 10, 0);
const body = world.createRigidBody(bodyDesc);

// Collider
const colliderDesc = RAPIER.ColliderDesc.ball(0.5);
world.createCollider(colliderDesc, body);

// Step simulation
function animate() {
world.step();
const pos = body.translation();
mesh.position.set(pos.x, pos.y, pos.z);
requestAnimationFrame(animate);
}
Cannon-es (Pure JS Physics)
Install: npm install cannon-es
What: Fork of cannon.js with ES module support. Pure JavaScript (no WASM). Good for simple physics scenes.
LiquidFun (Google)
What: Box2D extension with particle-based fluid simulation
Source: https://google.github.io/liquidfun/

11. Advanced Shader Techniques Cookbook
    Displacement Mapping on Hover
    // Uses a displacement texture to push pixels around on mouse hover
    uniform sampler2D uTexture;
    uniform sampler2D uDisplacement;
    uniform float uHover; // 0.0 → 1.0 on hover
    uniform vec2 uMouse;

void main() {
vec2 uv = vUv;
vec4 disp = texture2D(uDisplacement, uv);
float dist = distance(uv, uMouse);
float strength = smoothstep(0.4, 0.0, dist) * uHover;
vec2 distortedUV = uv + disp.rg * strength * 0.1;
gl_FragColor = texture2D(uTexture, distortedUV);
}
RGB Shift / Chromatic Aberration
uniform sampler2D tDiffuse;
uniform float uStrength;

void main() {
vec2 uv = vUv;
vec2 dir = uv - vec2(0.5);
float dist = length(dir);

float r = texture2D(tDiffuse, uv + dir * uStrength * dist).r;
float g = texture2D(tDiffuse, uv).g;
float b = texture2D(tDiffuse, uv - dir * uStrength * dist).b;

gl_FragColor = vec4(r, g, b, 1.0);
}
Liquid / Metaball Effect
// Metaballs via SDF smooth union
float metaballs(vec2 uv) {
float d = 999.0;
for (int i = 0; i < NUM_BALLS; i++) {
float ball = length(uv - ballPositions[i]) - ballRadii[i];
d = opSmoothUnion(d, ball, 0.3); // Smooth blend factor
}
return d;
}

void main() {
float d = metaballs(vUv);
float edge = smoothstep(0.01, 0.0, d);
gl_FragColor = vec4(vec3(edge), 1.0);
}
Scroll-Driven Vertex Waves
// Vertex shader — mesh undulates based on scroll progress
uniform float uScroll; // 0.0 to 1.0

void main() {
vec3 pos = position;
float wave = sin(pos.x * 3.0 + uScroll * 6.28) * 0.2;
wave += sin(pos.y * 2.0 + uScroll * 3.14) * 0.15;
pos.z += wave * uScroll;
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
Image-to-Particles Dissolve
// Fragment shader — particles scatter based on noise
uniform float uProgress; // 0.0 (image) to 1.0 (scattered)
uniform sampler2D uTexture;
uniform sampler2D uNoise;

void main() {
vec4 noise = texture2D(uNoise, vUv);
float threshold = noise.r;

if (threshold < uProgress) {
discard; // Particle has "left"
}

float edge = smoothstep(uProgress, uProgress + 0.05, threshold);
vec4 texColor = texture2D(uTexture, vUv);
gl_FragColor = mix(vec4(1.0, 0.5, 0.0, 1.0), texColor, edge);
}
Fisheye / Lens Distortion
vec2 fisheye(vec2 uv, float strength) {
vec2 centered = uv * 2.0 - 1.0;
float d = length(centered);
float z = sqrt(1.0 - d * d * strength);
vec2 distorted = centered / z;
return distorted * 0.5 + 0.5;
}
Heat Distortion / Refraction
uniform sampler2D uScene;
uniform sampler2D uNoise;
uniform float uTime;

void main() {
vec2 noise = texture2D(uNoise, vUv + uTime * 0.05).rg;
vec2 distortion = (noise - 0.5) * 0.03;
gl_FragColor = texture2D(uScene, vUv + distortion);
}

12. No-Code WebGL Tools
    Unicorn Studio
    What: No-code WebGL design tool. 35+ WebGL effects with motion and interactivity. Exports embed code.
    Output: 36KB gzipped JavaScript library + project JSON
    Integrations: Framer, Webflow, raw HTML embed
    Use Case: When you need WebGL backgrounds/effects without writing shaders
    Spline (spline.design)
    What: 3D design tool that exports to web. Real-time 3D scenes with interactions.
    Export: React component, embeddable iframe, or downloadable scene
    Install: npm install @splinetool/react-spline
    import Spline from '@splinetool/react-spline';

<Spline scene="https://prod.spline.design/YOUR_SCENE_ID/scene.splinecode" />
Rive (rive.app)
What: Real-time animation tool. Alternative to Lottie with state machines, interactivity, and much smaller file sizes.
Install: npm install @rive-app/react-canvas
Advantage over Lottie: Interactive state machines, bone/mesh deformation, runtime control, 10x smaller files

13. 3D Asset Pipeline (Unreal/Blender → Web)
    Blender → Web Pipeline
    Model in Blender → Export as .glb (binary glTF, smallest)
    Optimize: Use Draco compression (-dc flag in gltf-pipeline)
    Textures: Compress to KTX2 format for GPU-native loading

# Install optimization tools

npm install -g gltf-pipeline

# Draco compression

gltf-pipeline -i scene.glb -o scene-compressed.glb -d

# KTX2 texture compression (install gltf-transform)

npx @gltf-transform/cli optimize scene.glb scene-optimized.glb --texture-compress ktx2
Loading Optimized Assets
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/gh/pmndrs/drei-assets/basis/');
ktx2Loader.detectSupport(renderer);

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setKTX2Loader(ktx2Loader);

gltfLoader.load('scene-optimized.glb', (gltf) => {
scene.add(gltf.scene);
});
Unreal Engine → Web (Pixel Streaming)
Concept: Run Unreal scene on a GPU server, stream rendered frames to browser via WebRTC
Use Case: Architectural walkthroughs, automotive configurators, photorealistic product viewers
AWS Pixel Streaming: Deploy via Epic's Pixel Streaming plugin + EC2 GPU instances
Alternative: Ready Player Me for avatar creation → export to glTF → Three.js
Gaussian Splatting for Web
What: Capture real-world scenes as point clouds, render in real-time on web
Libraries: gsplat.js, @mkkellogg/gaussian-splats-3d
Install: npm install @mkkellogg/gaussian-splats-3d
Use Case: Photorealistic environment captures, virtual tours

14. View Transitions API (Native)
    No library needed. Native browser API for smooth page transitions. Baseline available since Oct 2025.
    Same-Document (SPA)
    // Wrap any DOM update in startViewTransition
    document.startViewTransition(() => {
    updateDOM(); // Your state change
    });

// React hook
function useViewTransition() {
return (callback) => {
if (!document.startViewTransition) {
callback(); return;
}
document.startViewTransition(callback);
};
}
Named Transitions (Element Morphing)
/* Source element _/
.product-card { view-transition-name: product-hero; }
/_ Target element (same name = browser morphs between them) */
.product-detail-image { view-transition-name: product-hero; }

/* Customize the morph animation _/
::view-transition-old(product-hero) {
animation: fade-out 0.3s ease;
}
::view-transition-new(product-hero) {
animation: fade-in 0.3s ease;
}
Cross-Document (MPA — No JavaScript)
/_ Add to BOTH pages — that's it */
@view-transition { navigation: auto; }

.hero-image { view-transition-name: hero; }
Browser Support (Feb 2026)
Same-document: Chrome 111+, Edge 111+, Firefox 133+, Safari 18+ ✅
Cross-document: Chrome 126+, Edge 126+, Safari 18.2+ (Firefox coming)
Graceful degradation: DOM updates still work, just no animation

15. Integration Recipes
    Recipe: Awwwards-Level Portfolio Site
    Stack:

- Barba.js (page transitions)
- Locomotive Scroll v5 (smooth scroll + parallax)
- GSAP + ScrollTrigger (scroll-driven animations)
- curtains.js (image hover distortion)
- mouse-follower (custom cursor)
- postprocessing or View Transitions API
  Recipe: Product Landing with 3D Hero
  Stack:
- Three.js + React Three Fiber (@react-three/fiber)
- @react-three/drei (helpers)
- postprocessing (bloom, depth of field)
- Lenis (smooth scroll)
- TSL (custom material effects)
- GSAP (UI animations)
  Recipe: WebGL-Heavy Immersive Experience
  Stack:
- OGL or Three.js (renderer)
- Custom GLSL shaders (via glslify)
- Ray marching SDFs (fullscreen fragment shader)
- simplex-noise (procedural generation)
- Barba.js (scene transitions)
- WebGPU + TSL (compute shaders for particles)
  Recipe: Quick Visual Upgrade (Minimal Code)
  Stack:
- VFX-JS / react-vfx (shader effects on DOM elements)
- View Transitions API (page transitions)
- Lenis (smooth scroll)
- CSS only: mix-blend-mode, clip-path, backdrop-filter

16. Performance Patterns for Heavy Effects
    GPU & Rendering
    transform over top/left — Always. GPU-accelerated compositing.
    will-change: transform — Use sparingly. Only on elements about to animate.
    requestAnimationFrame — All animation loops. Never setInterval.
    InstancedMesh — Repeated geometry (trees, particles, bricks) = 1 draw call.
    OffscreenCanvas — Move heavy rendering to Web Worker.
    Debounce scroll/resize — Don't recalculate on every frame.
    Three.js / WebGL Specific
    Dispose resources: geometry.dispose(), material.dispose(), texture.dispose() on cleanup.
    Texture compression: KTX2 for GPU-native decoding. DRACO for geometry.
    LOD (Level of Detail): THREE.LOD — swap high/low poly based on camera distance.
    Frustum culling: Enabled by default. Don't disable unless you know why.
    stats-gl: FPS/memory monitoring (npm install stats-gl)
    Spector.js: WebGL call inspector for debugging draw calls.
    Shader Performance
    Minimize texture lookups — Each texture2D() call is expensive.
    Avoid branching in fragment shaders — GPUs execute both branches.
    Use smoothstep over if — Branchless alternative.
    Lower precision when possible — mediump over highp on mobile.
    Limit ray march steps — 64-100 is usually enough. More = slower.
    WebGPU Specific
    Bind groups: Batch frequently-updated uniforms (time, camera) together. Static data (textures) in separate groups.
    Storage textures: For compute shaders doing read/write (fluid sim, image processing).
    Async rendering: await renderer.renderAsync() for compute shader synchronization.
    Feature detection: Always check navigator.gpu?.requestAdapter() before using WebGPU features.
    Lazy Loading
    // Lazy load heavy WebGL on scroll into view
    const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
    if (entry.isIntersecting) {
    import('./heavy-webgl-scene.js').then(module => module.init());
    observer.disconnect();
    }
    });
    }, { threshold: 0.1 });

observer.observe(document.querySelector('#webgl-container'));

REFERENCE LINKS
Shader Galleries & Learning
Shadertoy: https://shadertoy.com — GLSL prototyping sandbox
The Book of Shaders: https://thebookofshaders.com — GLSL fundamentals
Inigo Quilez SDF: https://iquilezles.org/articles/distfunctions/ — Definitive SDF reference
Codrops: https://tympanus.net/codrops/ — 1000+ creative web demos (open source)
TSL & WebGPU
Maxime Heckel TSL Guide: https://blog.maximeheckel.com — Field guide to TSL
Three.js TSL Examples: https://threejs.org/examples/?q=webgpu — Official WebGPU demos
Threlte (Svelte + Three.js): https://threlte.xyz/docs/learn/advanced/webgpu
Communities
Awwwards: https://awwwards.com — See what's winning now
Codrops Collective: Weekly curated creative web links
three.js Discord: Real-time help with Three.js/TSL/WebGPU
ShaderToy Discord: GLSL shader community

17. Prism Cinematic Floor (R1 realism) — W-PHOTO

The reusable pieces that keep realtime PBR from "looking digital", split into
NODE-LOCAL pieces (applied inside a node factory / owned scene) and a FULL-FRAME
POST chain (owned canvases only — never the engine SceneRoot/LightingRig,
I-ENGINE). First-party to this repo; no external install.

Render-route planner (src/lib/render-routes)
What: Picks R1 realtime-PBR / R2 photo-composite / R3 baked-hybrid / R4 splat per
element from {interaction, realism, byte budget, motion, source}.
Use: `planRoute(deriveInputsFromIntent({text}))` → `routeToRealization(route)`.
Doc: src/lib/render-routes/ROUTE-PLANNER.md (decision table).

Cinematic floor library (src/lib/prism/cinematic-floor)
What: NODE-LOCAL R1 pieces.

- makeImperfectionMap / makeImperfectionOverlay / applyImperfection — procedural
  dust + micro-scratch + smudge breakup (roughness map or transparent overlay).
  Perfection reads digital; a faint imperfection makes a highlight trustworthy.
- makeContactShadow — a soft grounded contact-shadow plate (radial AO falloff)
  that sits an object on its surface without a real shadow-casting light.
- buildStudioIBL / installStudioIBL — PMREM prefilter of RoomEnvironment (studio
  IBL, no remote HDRI). Reflect a real environment in the material.
  Registered as catalog primitives: `contact-shadow`, `imperfection-veil`
  (src/lib/prism/animatable/primitives). Node-attachable via cinematicPrimitives.

CinematicFloorPost (src/components/photo/CinematicFloorPost.tsx)
What: FULL-FRAME post chain on an OWNED canvas — three r184 node PostProcessing:
depth-of-field (opt-in) → bloom → warm colour grade (gain/contrast/saturation,
the runtime LUT stand-in) → vignette → film grain. Tone mapping is AgX (HDR /
artistic) or Khronos PBR Neutral (accurate sRGB) on the owned renderer.
Key: EffectComposer is legacy WebGL-only; the node PostProcessing path is the
WebGPU-forward one. See §4 (Post-Processing) for the underlying TSL display nodes
(BloomNode/DepthOfFieldNode/FilmNode/Lut3DNode).

Photo composite pipeline (src/lib/photo-pipeline + scripts/build-photo-composite.mjs)
What: The R2 method — FLUX generate → bria cutout → depth-anything depth → local
soft shadow plate → filmic grade → a layered parallax scene (`layered-photo-scene`
primitive) with differentiated parallax + independent float loops. Realism lives
in the imagery + detached shadow + grade, not geometry.

This document is designed for AI model context injection. Keep it in your project root or feed it to your AI builder's system prompt. Every tool listed here is npm-installable and programmatically usable — no manual drag-and-drop required.
