// Camera rail driver — applies a CompiledHubView.cameraRail to a THREE
// PerspectiveCamera every frame with damped easing. Owns the only place
// where the pure rail data meets a Three.js camera object.
//
// Spec refs:
//   §6 SC-032  preview-hub camera is constrained to a damped cinematic rail.
//   §5/§7 INV-23  Compiled-preview camera is constrained, damped, bounded.
//
// Construction: the runtime mount passes the camera + initial rail; the
// driver exposes:
//   - tick():    integrate one frame of damping toward the current target pose
//   - setRail(): hot-swap the rail (e.g. mode change, hub switch)
//   - setProgress(t): externally control where on the rail to converge to
//   - dispose(): release any retained state
//
// Pure helpers are exported so tests can verify the camera write without
// spinning up a real renderer.

import type { PerspectiveCamera } from 'three';
import {
  evaluateCameraRail,
  stepCameraPoseDamped,
} from '@/lib/prism-graph/camera-rail';
import type {
  CompiledCameraPose,
  CompiledCameraRail,
} from '@/lib/prism-graph/compiled-view';

/** Pure-ish: write a CompiledCameraPose into a THREE.PerspectiveCamera.
 *  No allocation beyond the lookAt internals. Reads no global state. */
export function applyCompiledPoseToCamera(
  camera: PerspectiveCamera,
  pose: CompiledCameraPose,
): void {
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
  if (Math.abs(camera.fov - pose.fov) > 1e-6) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}

export interface CameraRailDriverOptions {
  /** THREE camera the driver writes to. */
  camera: PerspectiveCamera;
  /** Initial rail. May be replaced later via setRail(). */
  rail: CompiledCameraRail;
  /** Optional progress provider. Defaults to a constant 1.0 (rest at `end`
   *  pose) so the camera converges to the in-pose cinematic position. */
  getProgress?: () => number;
  /** Optional seed pose. Defaults to the rail's `start` pose so the first
   *  tick eases in from the wider framing. */
  initialPose?: CompiledCameraPose;
}

export interface CameraRailDriverHandle {
  /** Step one frame of damping toward the current target pose and apply
   *  the result to the camera. */
  tick(): void;
  /** Swap the rail (e.g. on hub change). The current eased pose is kept so
   *  the transition is smooth rather than a jump. */
  setRail(rail: CompiledCameraRail): void;
  /** Override the progress provider. */
  setProgress(getProgress: () => number): void;
  /** Read the current eased pose (testing/diagnostics). */
  getCurrentPose(): CompiledCameraPose;
  dispose(): void;
}

export function createCameraRailDriver(
  opts: CameraRailDriverOptions,
): CameraRailDriverHandle {
  let rail: CompiledCameraRail = opts.rail;
  let getProgress: () => number = opts.getProgress ?? (() => 1);
  let current: CompiledCameraPose = opts.initialPose ?? rail.start;

  // Seed the camera at the initial pose so the first frame doesn't show a
  // stale viewport before damping kicks in.
  applyCompiledPoseToCamera(opts.camera, current);

  function tick(): void {
    const targetPose = evaluateCameraRail(rail, getProgress());
    current = stepCameraPoseDamped(current, targetPose, rail.damping);
    applyCompiledPoseToCamera(opts.camera, current);
  }

  function setRail(next: CompiledCameraRail): void {
    rail = next;
  }

  function setProgress(next: () => number): void {
    getProgress = next;
  }

  function getCurrentPose(): CompiledCameraPose {
    return current;
  }

  function dispose(): void {
    // No retained resources beyond the camera ref the caller owns.
  }

  return { tick, setRail, setProgress, getCurrentPose, dispose };
}
