'use client';

// PRISM MARKETING — THE FORGE (SHELL W9 HERO / DL11 DL12 DL13 DL16)
//
// The landing's flagship WebGPU scene: a dispersive glass prism — the brand
// object — levitating over a machined guilloche pedestal on a black-marble
// plinth, inside a live GALAXY of GPU-compute particles that spiral inward and
// condense into it. The product story made literal: a cloud of possibility
// streaming into one built, verified object. Everything here is the product's
// own capability — three/webgpu (WebGL2 fallback), TSL compute (the engine's
// FluidParticleVolume idiom), real chromatic dispersion (a WebGPU-first
// material feature), and OUR OWN baked PBR sets (DL13: onyx-guilloche +
// nero-marquina, baked by the Replicate FLUX pipeline in the gitignored root
// .assetgen/ — provenance in notes/verification/shell-w9/assetgen-provenance.md).
//
// Cinematic camera: a slow orbital drift + pointer parallax, and a scroll-
// driven dolly — as the visitor scrolls off the fold the camera rises and
// pushes past the prism. Reduced-motion holds a composed still (static-luxe).

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { InstancedMesh, SpriteNodeMaterial, PostProcessing } from 'three/webgpu';
import {
  Fn,
  instancedArray,
  instanceIndex,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  hash,
  mix,
  sin,
  cos,
  time,
  pass,
} from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { useForgeBackend } from './MarketingCanvas';
import { ForgeEnvironment, ForgeLights } from './ForgeEnvironment';
import { useGeneratedPBR } from './use-generated-pbr';
import {
  CHROME,
  GUNMETAL,
  RED_HOT,
  SIGNAL_RED,
} from '@/components/shell/design/prism-premium-tokens';

const MAX_DT = 1 / 30;

// ── Galaxy geometry constants ───────────────────────────────────────────────
const GPU_COUNT = 140_000; // compute path (WebGPU)
const GL2_COUNT = 9_000; // stateless fallback (WebGL2)
const RIM = 4.6; // outer spawn radius
const CORE = 0.62; // condensation radius (just outside the prism)

const CHROME_C = new THREE.Color(CHROME);
const RED_C = new THREE.Color(SIGNAL_RED);
const HOT_C = new THREE.Color(RED_HOT);

// Shared sprite look for both backends: a soft luminous mote, chrome-white at
// the rim grading to signal red as it nears the core (the brand heat).
// `radiusNode` must be the particle's current orbital radius (drives color).
function applyGalaxyLook(material: SpriteNodeMaterial, radiusNode: ReturnType<typeof float>) {
  const closeness = float(1).sub(radiusNode.div(RIM).clamp(0, 1));
  const radial = uv().distance(vec2(0.5, 0.5)).oneMinus().clamp(0, 1);
  const cool = vec3(CHROME_C.r, CHROME_C.g, CHROME_C.b).mul(0.5);
  const warm = mix(vec3(RED_C.r, RED_C.g, RED_C.b), vec3(HOT_C.r, HOT_C.g, HOT_C.b), closeness);
  material.colorNode = mix(cool, warm, closeness.pow(1.6)).mul(closeness.mul(1.9).add(0.35));
  material.opacityNode = radial.mul(radial).mul(closeness.mul(0.75).add(0.18));
  material.transparent = true;
  material.depthWrite = false;
  material.blending = THREE.AdditiveBlending;
  material.toneMapped = false;
  material.scaleNode = vec2(0.02, 0.02);
}

function makeInstancedSprites(material: SpriteNodeMaterial, count: number) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  // Identity instance matrices — positionNode drives placement (engine idiom).
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
  return { geo, mesh };
}

// ── WebGPU path: true stateful compute inflow ───────────────────────────────
interface GalaxyGpu {
  mesh: InstancedMesh;
  material: SpriteNodeMaterial;
  computeInit: unknown;
  computeUpdate: unknown;
  uniforms: { dt: ReturnType<typeof uniform> };
  dispose: () => void;
}

function buildGalaxyGpu(): GalaxyGpu {
  // State per particle: vec4(radius, angle, height, jitter).
  const params = instancedArray(GPU_COUNT, 'vec4');
  const u = { dt: uniform(1 / 60) };

  const seedHash = (salt: number) => hash(instanceIndex.add(float(salt * GPU_COUNT)));

  const computeInit = Fn(() => {
    // Radius biased outward (sqrt distribution reads as a real disc), angle
    // uniform, height a thin lens that fattens toward the rim.
    const r = seedHash(1).sqrt().mul(RIM - CORE).add(CORE);
    const a = seedHash(2).mul(Math.PI * 2);
    const h = seedHash(3).sub(0.5).mul(0.34).mul(r.div(RIM));
    const j = seedHash(4);
    params.element(instanceIndex).assign(vec4(r, a, h, j));
  })().compute(GPU_COUNT);

  const computeUpdate = Fn(() => {
    const p = params.element(instanceIndex).toVar();
    // Keplerian sweep: inner orbits faster — a majestic differential disc.
    const sweep = u.dt.mul(float(0.55).div(p.x.mul(p.x.sqrt()).max(0.2)));
    // Inward bleed — the condensation accelerates near the core.
    const bleed = u.dt.mul(0.22).mul(float(1.4).div(p.x.add(0.4)));
    const rNext = p.x.sub(bleed);
    // Respawn at the rim (with per-particle jitter) once condensed.
    const r = rNext.lessThan(CORE).select(float(RIM).add(p.w.mul(0.5)), rNext);
    params.element(instanceIndex).assign(vec4(r, p.y.add(sweep), p.z, p.w));
  })().compute(GPU_COUNT);

  const material = new SpriteNodeMaterial();
  const attr = params.toAttribute();
  material.positionNode = vec3(attr.x.mul(cos(attr.y)), attr.z, attr.x.mul(sin(attr.y)));
  applyGalaxyLook(material, attr.x);

  const { geo, mesh } = makeInstancedSprites(material, GPU_COUNT);
  const dispose = () => {
    try {
      geo.dispose();
      material.dispose();
      mesh.dispose();
      (params as unknown as { dispose?: () => void }).dispose?.();
    } catch {
      /* never throw on teardown */
    }
  };
  return { mesh, material, computeInit, computeUpdate, uniforms: u, dispose };
}

function GalaxyCompute({ reduced }: { reduced: boolean }) {
  const gl = useThree((s) => s.gl);
  const failed = useRef(false);
  const gpu = useMemo<GalaxyGpu | null>(() => {
    try {
      const r = gl as unknown as { backend?: { isWebGPUBackend?: boolean } };
      if (!r.backend?.isWebGPUBackend) return null;
      const built = buildGalaxyGpu();
      const rr = gl as unknown as { computeAsync?: (n: unknown) => Promise<void> };
      rr.computeAsync?.(built.computeInit)?.catch(() => {});
      return built;
    } catch (err) {
      if (!failed.current) {
        failed.current = true;
        // eslint-disable-next-line no-console
        console.warn('[HeroForge] GPU compute unavailable, using stateless galaxy:', err);
      }
      return null;
    }
  }, [gl]);
  useEffect(() => {
    if (!gpu) return;
    return () => gpu.dispose();
  }, [gpu]);
  useFrame((_, dt) => {
    if (!gpu || reduced) return; // reduced-motion: hold the still disc
    try {
      (gpu.uniforms.dt.value as number) = Math.min(dt, MAX_DT);
      const r = gl as unknown as {
        compute?: (n: unknown) => void;
        computeAsync?: (n: unknown) => Promise<void>;
      };
      if (r.compute) r.compute(gpu.computeUpdate);
      else r.computeAsync?.(gpu.computeUpdate)?.catch(() => {});
    } catch {
      /* a transient compute error must not break the frame loop */
    }
  });
  if (!gpu) return <GalaxyStateless reduced={reduced} />;
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={gpu.mesh} />;
}

// ── WebGL2 fallback: the disc as a pure function of (instanceIndex, time) ───
// No storage buffers, no compute — everything derives in the vertex stage, so
// it runs on the GLSL backend. Sparser but visually one family. Reduced-motion
// freezes the sweep by zeroing the time factor.
function GalaxyStateless({ reduced }: { reduced: boolean }) {
  const built = useMemo(() => {
    const material = new SpriteNodeMaterial();
    const h1 = hash(instanceIndex.add(float(GL2_COUNT)));
    const h2 = hash(instanceIndex.add(float(GL2_COUNT * 2)));
    const h3 = hash(instanceIndex.add(float(GL2_COUNT * 3)));
    const r = h1.sqrt().mul(RIM - CORE).add(CORE);
    const sweepRate = float(0.55).div(r.mul(r.sqrt()).max(0.2));
    const t = reduced ? float(0) : time;
    const ang = h2.mul(Math.PI * 2).add(sweepRate.mul(t));
    const y = h3.sub(0.5).mul(0.34).mul(r.div(RIM));
    material.positionNode = vec3(r.mul(cos(ang)), y, r.mul(sin(ang)));
    applyGalaxyLook(material, r);
    const { geo, mesh } = makeInstancedSprites(material, GL2_COUNT);
    return { mesh, geo, material };
  }, [reduced]);
  useEffect(
    () => () => {
      built.geo.dispose();
      built.material.dispose();
      built.mesh.dispose();
    },
    [built],
  );
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={built.mesh} />;
}

// ── The prism + pedestal ────────────────────────────────────────────────────
function PrismCenterpiece({ reduced }: { reduced: boolean }) {
  const spin = useRef<THREE.Group>(null);
  const prismGeo = useMemo(() => {
    // A true optical prism: 3-sided cylinder, non-indexed for flat faces so the
    // dispersion has crisp facets to work with.
    const g = new THREE.CylinderGeometry(0.82, 0.82, 1.7, 3, 1).toNonIndexed();
    g.computeVertexNormals();
    return g;
  }, []);
  const glass = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: '#fbf7f7',
      metalness: 0,
      roughness: 0.028,
      transmission: 1,
      ior: 1.66,
      thickness: 1.15,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      attenuationColor: new THREE.Color('#ff7a72'),
      attenuationDistance: 5.5,
      envMapIntensity: 1.6,
      // Thin-film interference on the facets — the dispersive rainbow that reads
      // as an optical prism even over a dark scene (surface effect, not refractive).
      iridescence: 1,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [120, 460],
      specularIntensity: 1,
    });
    // Real chromatic dispersion — present in the installed r184 webgpu build.
    (m as unknown as { dispersion?: number }).dispersion = 0.4;
    return m;
  }, []);
  const core = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: RED_HOT,
        emissive: new THREE.Color(RED_HOT),
        emissiveIntensity: 3.4,
        metalness: 0.1,
        roughness: 0.35,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      prismGeo.dispose();
      glass.dispose();
      core.dispose();
    },
    [prismGeo, glass, core],
  );
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (spin.current) {
      spin.current.rotation.y = reduced ? 0.55 : t * 0.24;
      spin.current.position.y = reduced ? 1.06 : 1.06 + Math.sin(t * 0.8) * 0.05;
    }
  });
  return (
    <group ref={spin} position={[0, 1.06, 0]}>
      <mesh geometry={prismGeo} material={glass} />
      <mesh material={core} scale={0.3}>
        <octahedronGeometry args={[0.7, 0]} />
      </mesh>
    </group>
  );
}

function Pedestal() {
  const guilloche = useGeneratedPBR('onyx-guilloche', {
    repeat: [1, 1],
    clearcoat: 0.4,
    clearcoatRoughness: 0.32,
    envMapIntensity: 1.05,
    normalScale: 1.2,
  });
  const marble = useGeneratedPBR('nero-marquina', {
    repeat: [1.6, 1.6],
    metalness: 0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.9,
    normalScale: 0.7,
  });
  const gunmetal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: GUNMETAL, metalness: 0.92, roughness: 0.34 }),
    [],
  );
  const chrome = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: CHROME,
        metalness: 1,
        roughness: 0.16,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
      }),
    [],
  );
  useEffect(
    () => () => {
      gunmetal.dispose();
      chrome.dispose();
    },
    [gunmetal, chrome],
  );
  return (
    <group>
      {/* Black-marble plinth slab */}
      <mesh material={marble} position={[0, -0.36, 0]}>
        <boxGeometry args={[4.4, 0.22, 4.4]} />
      </mesh>
      {/* Machined gunmetal drum */}
      <mesh material={gunmetal} position={[0, -0.1, 0]}>
        <cylinderGeometry args={[1.5, 1.62, 0.3, 72]} />
      </mesh>
      {/* Chrome seam ring */}
      <mesh material={chrome} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.42, 0.022, 14, 96]} />
      </mesh>
      {/* Engine-turned guilloche dial — OUR generated PBR (DL13) */}
      <mesh material={guilloche} position={[0, 0.11, 0]}>
        <cylinderGeometry args={[1.38, 1.38, 0.08, 72]} />
      </mesh>
    </group>
  );
}

// ── Cinematic camera + scroll rig ───────────────────────────────────────────
function CameraRig({
  progress,
  pointer,
  reduced,
}: {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
}) {
  const size = useThree((s) => s.size);
  const look = useMemo(() => new THREE.Vector3(0, 0.72, 0), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }, dt) => {
    const t = clock.getElapsedTime();
    const p = reduced ? 0 : progress.current;
    const px = reduced ? 0 : pointer.current.x;
    const py = reduced ? 0 : pointer.current.y;
    // Compose the subject off to the RIGHT on wide screens (aiming the camera
    // left of the pedestal pushes it right in frame) so the left-hand copy
    // column reads clear over it; centered on narrow / portrait viewports.
    const aspect = size.width / Math.max(1, size.height);
    const xShift = aspect > 1.15 ? -2.0 : aspect > 0.92 ? -0.9 : 0;
    // Base orbit: a slow drift around the pedestal; scroll rises + pushes in.
    const drift = reduced ? 0 : Math.sin(t * 0.1) * 0.3;
    const az = -0.42 + drift + px * 0.16;
    const radius = 7.1 - p * 1.9;
    const height = 1.75 + p * 2.6 + py * -0.3;
    target.set(Math.sin(az) * radius, height, Math.cos(az) * radius);
    const ease = reduced ? 1 : Math.min(1, dt * 2.4);
    camera.position.lerp(target, ease);
    lookTarget.set(xShift, 0.72 + p * 0.3, 0);
    look.lerp(lookTarget, ease);
    camera.lookAt(look);
  });
  return null;
}

// ── Bloom post pipeline (both backends; defensive) ──────────────────────────
function ForgePost() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const post = useMemo<{ render: () => void; dispose?: () => void } | null>(() => {
    try {
      const scenePass = pass(scene, camera);
      const beauty = scenePass.getTextureNode();
      const glow = bloom(beauty, 0.55, 0.22, 0.82);
      const p = new PostProcessing(gl as never);
      (p as unknown as { outputNode: unknown }).outputNode = (
        beauty as unknown as { add: (n: unknown) => unknown }
      ).add(glow);
      return p as unknown as { render: () => void; dispose?: () => void };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[HeroForge] bloom unavailable, rendering direct:', err);
      return null;
    }
  }, [gl, scene, camera]);
  useEffect(() => {
    if (!post) return;
    return () => post.dispose?.();
  }, [post]);
  // Priority 1 takes over R3F's render; render through the post chain (or
  // straight through when the chain could not build).
  useFrame(({ gl: g, scene: s, camera: c }) => {
    if (post) {
      try {
        post.render();
        return;
      } catch {
        /* fall through to direct render */
      }
    }
    g.render(s, c);
  }, 1);
  return null;
}

// ── The island ──────────────────────────────────────────────────────────────
export default function HeroForgeScene({
  progress,
  pointer,
  reduced,
}: {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
}) {
  const backend = useForgeBackend();
  return (
    <>
      <ForgeEnvironment intensity={0.85} />
      <ForgeLights />
      <CameraRig progress={progress} pointer={pointer} reduced={reduced} />
      <group position={[0.55, -0.9, 0]}>
        <Pedestal />
        <PrismCenterpiece reduced={reduced} />
        {/* White rim from behind — edge-lights the glass facets so the prism
            reads as glass, not a dark gem. */}
        {/* eslint-disable-next-line react/no-unknown-property */}
        <pointLight position={[-0.6, 2.6, -3.2]} intensity={26} distance={12} color="#f4f7ff" />
        {/* Red bloom from the hot core, spilling onto the pedestal + inner motes. */}
        {/* eslint-disable-next-line react/no-unknown-property */}
        <pointLight position={[0, 1.1, 0.2]} intensity={9} distance={5.5} color={RED_HOT} />
        <group position={[0, 1.02, 0]} rotation={[0.1, 0, 0.045]}>
          {backend === 'webgpu' ? (
            <GalaxyCompute reduced={reduced} />
          ) : (
            <GalaxyStateless reduced={reduced} />
          )}
        </group>
      </group>
      <ForgePost />
    </>
  );
}
