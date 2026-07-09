// W-BG — procedural hub backgrounds in the RUNTIME player.
//
// The editor's GraphScene renders `PrismHub.background` through the R3F
// HubBackgroundStack; the standalone runtime (ConductorRuntime → the E14
// /preview route) had no equivalent, so a generated background would vanish
// in the shipped app. This imperative mounter closes that gap using the SAME
// shared render-core material builders (one shader source of truth):
//
//   gradient-volume   → camera-centred BackSide sphere (render-core)
//   volumetric-nebula → camera-centred raymarch sphere (render-core)
//   particle-field    → instanced sprite field (render-core)
//   fluid-overlay     → feathered advection sheet (render-core)
//   parallax-plane /  → depth-displaced (or flat) textured plate, the same
//     image             TSL wiring as ParallaxPlaneLayer
//   splat             → editor-only (T2 exotic) — dropped here, documented.
//
// The host calls `tick(dt)` from its own rAF (this module never touches
// window/document — runtime discipline) and `dispose()` on unmount. Budget:
// a fixed T1-equivalent (18 raymarch steps / 8k particles) — the preview
// route has no editor device-mode signal; conservative by design.

import {
  Scene,
  PerspectiveCamera,
  Mesh,
  Object3D,
  SphereGeometry,
  PlaneGeometry,
  TextureLoader,
  SRGBColorSpace,
  Texture,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  texture as tslTexture,
  uv,
  vec2,
  vec3,
  float,
  positionLocal,
  smoothstep,
  length as tslLength,
} from "three/tsl";
import type { PrismHubBackgroundLayer } from "@/lib/prism-graph/types";
import { getBackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import {
  createGradientVolumeMaterial,
  createGradientVolumeUniforms,
  GRADIENT_SPHERE_RADIUS,
  type GradientVolumeVariant,
} from "@/lib/editor/backgrounds/render-core/gradient-volume-material";
import {
  createNebulaMaterial,
  createNebulaUniforms,
  NEBULA_SPHERE_RADIUS,
} from "@/lib/editor/backgrounds/render-core/nebula-material";
import {
  createParticleFieldMesh,
  createParticleUniforms,
  PARTICLE_VARIANTS,
  type ParticleVariant,
} from "@/lib/editor/backgrounds/render-core/particle-field-mesh";
import {
  createFluidMaterial,
  createFluidUniforms,
  FLUID_VARIANTS,
  FLUID_PLANE_W,
  FLUID_PLANE_H,
  type FluidVariant,
} from "@/lib/editor/backgrounds/render-core/fluid-material";

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Fixed runtime budget (T1-equivalent: mid raymarch, mid particle count).
const RAYMARCH_STEPS = 18;
const LIGHT_MARCH_STEPS = 2;
const PARTICLE_BUDGET = 8000;
const OCTAVES = 3;

export interface ProceduralBackgroundHandle {
  /** Advance drift clocks + camera-centring. `dt` in SECONDS. */
  tick(dt: number): void;
  dispose(): void;
  readonly layerCount: number;
  readonly kinds: string[];
}

interface MountedLayer {
  object: Object3D;
  /** Advance this layer's time by dt seconds. */
  advance(dt: number): void;
  /** Follow the camera (env shells + camera-locked layers). */
  follow?: (camera: PerspectiveCamera) => void;
  dispose(): void;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" ? v : fallback;
}

export function mountProceduralBackground(
  scene: Scene,
  camera: PerspectiveCamera,
  layers: readonly PrismHubBackgroundLayer[],
): ProceduralBackgroundHandle {
  const procedural = layers.filter((l) => !!l.kind && l.kind !== "splat");
  const overBackdrop = procedural.some(
    (l) => l.kind === "image" || l.kind === "parallax-plane",
  );
  const mounted: MountedLayer[] = [];
  const kinds: string[] = [];

  procedural.forEach((layer, index) => {
    const renderOrder = -3 + index * 0.25;
    const palette = getBackgroundPalette(
      layer.params?.palette as string | undefined,
    );
    const p = layer.params ?? {};
    const density = num(p.density, 0.6);
    const drift = num(p.drift, 0.5);
    const depthSpread = num(p.depthSpread, 0.6);
    const intensity = num(p.intensity, 0.7);
    const opacity = num(layer.opacity, 1);

    try {
      if (layer.kind === "gradient-volume") {
        const uniforms = createGradientVolumeUniforms();
        uniforms.uDensity.value = density;
        uniforms.uIntensity.value = intensity;
        uniforms.uVeil.value = opacity;
        const mat = createGradientVolumeMaterial({
          palette,
          variant: ((p.variant as string) || "wash") as GradientVolumeVariant,
          octaves: OCTAVES,
          overBackdrop,
          uniforms,
        });
        const mesh = new Mesh(
          new SphereGeometry(GRADIENT_SPHERE_RADIUS, 48, 32),
          mat,
        );
        mesh.renderOrder = renderOrder;
        mesh.frustumCulled = false;
        scene.add(mesh);
        mounted.push({
          object: mesh,
          advance: (dt) => {
            uniforms.uTime.value += dt * (0.3 + drift);
          },
          follow: (cam) => mesh.position.copy(cam.position),
          dispose: () => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mat.dispose();
          },
        });
        kinds.push(layer.kind);
      } else if (layer.kind === "volumetric-nebula") {
        const uniforms = createNebulaUniforms();
        uniforms.uDensity.value = density;
        uniforms.uDrift.value = drift;
        uniforms.uIntensity.value = intensity;
        uniforms.uVeil.value = opacity;
        const mat = createNebulaMaterial({
          palette,
          raymarchSteps: RAYMARCH_STEPS,
          lightMarchSteps: LIGHT_MARCH_STEPS,
          overBackdrop,
          uniforms,
        });
        const mesh = new Mesh(
          new SphereGeometry(NEBULA_SPHERE_RADIUS, 48, 32),
          mat,
        );
        mesh.renderOrder = renderOrder;
        mesh.frustumCulled = false;
        scene.add(mesh);
        mounted.push({
          object: mesh,
          advance: (dt) => {
            uniforms.uTime.value += dt;
          },
          follow: (cam) => mesh.position.copy(cam.position),
          dispose: () => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mat.dispose();
          },
        });
        kinds.push(layer.kind);
      } else if (layer.kind === "particle-field") {
        const uniforms = createParticleUniforms();
        const variant = ((p.variant as string) ||
          "starfield") as ParticleVariant;
        const spec = PARTICLE_VARIANTS[variant] ?? PARTICLE_VARIANTS.starfield;
        uniforms.uTwinkle.value = spec.twinkle;
        uniforms.uSize.value = 1 + intensity * 0.6;
        const { mesh } = createParticleFieldMesh({
          palette,
          variant: PARTICLE_VARIANTS[variant] ? variant : "starfield",
          particleBudget: PARTICLE_BUDGET,
          density,
          depthSpread,
          uniforms,
        });
        mesh.renderOrder = renderOrder;
        scene.add(mesh);
        const cameraLocked = layer.attachment === "camera-locked";
        mounted.push({
          object: mesh,
          advance: (dt) => {
            uniforms.uTime.value += dt * (0.4 + drift);
          },
          follow: cameraLocked
            ? (cam) => mesh.position.copy(cam.position)
            : undefined,
          dispose: () => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as { dispose(): void }).dispose();
          },
        });
        kinds.push(layer.kind);
      } else if (layer.kind === "fluid-overlay") {
        const uniforms = createFluidUniforms();
        uniforms.uDensity.value = density;
        uniforms.uIntensity.value = intensity;
        uniforms.uOpacity.value = opacity;
        const variant = ((p.variant as string) || "silk") as FluidVariant;
        const spec = FLUID_VARIANTS[variant] ?? FLUID_VARIANTS.silk;
        const mat = createFluidMaterial({
          palette,
          variant: FLUID_VARIANTS[variant] ? variant : "silk",
          octaves: OCTAVES,
          uniforms,
        });
        const z = num(layer.z, -60);
        const mesh = new Mesh(
          new PlaneGeometry(FLUID_PLANE_W, FLUID_PLANE_H, 1, 1),
          mat,
        );
        mesh.position.set(0, 0, z);
        mesh.renderOrder = renderOrder;
        mesh.frustumCulled = false;
        scene.add(mesh);
        const cameraLocked = layer.attachment === "camera-locked";
        mounted.push({
          object: mesh,
          advance: (dt) => {
            uniforms.uTime.value += dt * spec.speed * (0.3 + drift * 1.4);
          },
          follow: cameraLocked
            ? (cam) =>
                mesh.position.set(
                  cam.position.x,
                  cam.position.y,
                  cam.position.z + z,
                )
            : undefined,
          dispose: () => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mat.dispose();
          },
        });
        kinds.push(layer.kind);
      } else if (
        (layer.kind === "parallax-plane" || layer.kind === "image") &&
        layer.sourceUrl
      ) {
        // Same TSL wiring as ParallaxPlaneLayer: image plate, radial edge
        // feather, optional real-geometry depth displacement.
        const mat = new MeshBasicNodeMaterial({
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        });
        const flat = layer.kind === "image";
        const amplitude = (flat ? 0 : 1) * (8 + depthSpread * 22);
        const geometry = new PlaneGeometry(
          FLUID_PLANE_W,
          FLUID_PLANE_H,
          160,
          96,
        );
        const mesh = new Mesh(geometry, mat);
        mesh.position.set(0, 0, num(layer.z, -40));
        mesh.renderOrder = renderOrder;
        mesh.frustumCulled = false;
        mesh.visible = false; // until the plate texture lands

        const textures: Texture[] = [];
        const loader = new TextureLoader();
        let disposed = false;
        const wire = (imageTex: Texture, depthTex: Texture | null) => {
          if (disposed) return;
          const u = uv() as TNode;
          const d: TNode = tslLength(u.sub(vec2(0.5, 0.5)));
          const feather: TNode = smoothstep(float(0.72), float(0.34), d);
          (mat as unknown as { colorNode: unknown }).colorNode = (
            tslTexture(imageTex) as TNode
          ).rgb;
          (mat as unknown as { opacityNode: unknown }).opacityNode =
            feather.mul(float(opacity));
          if (depthTex && !flat) {
            const depthVal: TNode = (tslTexture(depthTex, u) as TNode).r;
            const disp: TNode = depthVal.sub(0.5).mul(amplitude * 2);
            (mat as unknown as { positionNode: unknown }).positionNode = (
              positionLocal as TNode
            ).add(vec3(0, 0, disp));
          }
          (mat as unknown as { needsUpdate: boolean }).needsUpdate = true;
          mesh.visible = true;
        };
        loader.load(layer.sourceUrl, (imageTex) => {
          imageTex.colorSpace = SRGBColorSpace;
          textures.push(imageTex);
          if (layer.depthMapUrl && !flat) {
            loader.load(
              layer.depthMapUrl,
              (depthTex) => {
                textures.push(depthTex);
                wire(imageTex, depthTex);
              },
              undefined,
              () => wire(imageTex, null),
            );
          } else {
            wire(imageTex, null);
          }
        });
        scene.add(mesh);
        mounted.push({
          object: mesh,
          advance: () => {},
          dispose: () => {
            disposed = true;
            scene.remove(mesh);
            geometry.dispose();
            mat.dispose();
            for (const t of textures) t.dispose();
          },
        });
        kinds.push(layer.kind);
      }
    } catch {
      // One bad layer must never break the app mount (fail-soft, like the
      // driver feed).
    }
  });

  // Initial camera-centring so the first rendered frame is already correct.
  for (const m of mounted) m.follow?.(camera);

  return {
    layerCount: mounted.length,
    kinds,
    tick(dt: number) {
      for (const m of mounted) {
        m.advance(dt);
        m.follow?.(camera);
      }
    },
    dispose() {
      for (const m of mounted) {
        try {
          m.dispose();
        } catch {
          /* ignore */
        }
      }
      mounted.length = 0;
    },
  };
}
