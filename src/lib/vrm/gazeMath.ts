import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { GAZE, STAND_POSE, type GazeTarget } from './constants';
import { ALL_VRM_BONES } from '@/lib/vmc/vmc';

// Port of HeadIkIntegrator.OnMouseMove, adapted for the web.
// Web screen Y is inverted from Unity (top=0). We keep gaze convention:
//   gaze.y > 0 => mouse below center => avatar looks DOWN
//   gaze.y < 0 => mouse above center => avatar looks UP
// Y_BIAS is ADDED (positive = down) to bias default gaze slightly down.
export function computeGazeTarget(
  mouseX: number,
  mouseY: number,
  viewportWidth: number,
  viewportHeight: number
): GazeTarget {
  const x = (mouseX - viewportWidth * 0.5) / GAZE.MOUSE_DIVISOR;
  let y = (mouseY - viewportHeight * 0.5) / GAZE.MOUSE_DIVISOR;
  y += GAZE.Y_BIAS;
  if (y < 0) y *= GAZE.Y_UP_DAMPING;

  const xClamp = THREE.MathUtils.clamp(x, -GAZE.X_CLAMP, GAZE.X_CLAMP);
  const yClamp = THREE.MathUtils.clamp(y, GAZE.Y_CLAMP_LOW, GAZE.Y_CLAMP_HIGH);
  return { x: xClamp, y: yClamp };
}

// Frame-rate-independent exponential smoothing.
// t = 1 - exp(-speed * dt) makes the time constant FPS-independent.
export function smoothDamp(current: number, desired: number, speed: number, dt: number): number {
  const t = 1 - Math.exp(-speed * dt);
  return current + (desired - current) * t;
}

export function smoothDampGaze(
  current: GazeTarget,
  desired: GazeTarget,
  speed: number,
  dt: number
): GazeTarget {
  const t = 1 - Math.exp(-speed * dt);
  return {
    x: current.x + (desired.x - current.x) * t,
    y: current.y + (desired.y - current.y) * t,
  };
}

// VRM 0.x normalized bones have their X axis mirrored relative to VRM 1.0
// (see applyStandPose below). Because of that, a look-up/look-down pitch applied
// to the normalized head/eye bones comes out inverted, so callers negate it.
export function isVRM0(vrm: VRM): boolean {
  return (vrm as { meta?: { metaVersion?: string } } | null)?.meta?.metaVersion === '0';
}

// Avatar faces +Z (toward camera). Avatar's right = -X world.
// Mouse to viewer's right (+X world = avatar's LEFT) => head turns avatar's
// LEFT = positive Y rotation (Three.js moves +Z forward toward +X).
// Mouse above center (gaze.y < 0) => head looks UP = negative X rotation.
// flipPitch: VRM 0.x only — negate the X (up/down) term, keep yaw.
export function gazeToHeadEuler(
  gaze: GazeTarget,
  limitDeg: number = GAZE.HEAD_ROT_LIMIT_DEG,
  flipPitch = false
): THREE.Euler {
  const limitRad = THREE.MathUtils.degToRad(limitDeg);
  const yaw = gaze.x * limitRad;
  const pitch = (flipPitch ? -1 : 1) * gaze.y * limitRad;
  return new THREE.Euler(pitch, yaw, 0, 'YXZ');
}

export function gazeToEyeEuler(gaze: GazeTarget, flipPitch = false): THREE.Euler {
  const yawRad = gaze.x * THREE.MathUtils.degToRad(GAZE.EYE_YAW_PITCH_PER_RATE_DEG);
  const pitchRad = (flipPitch ? -1 : 1) * gaze.y * THREE.MathUtils.degToRad(GAZE.EYE_YAW_PITCH_PER_RATE_DEG);
  const limit = THREE.MathUtils.degToRad(GAZE.EYE_ANGLE_LIMIT_DEG);
  const yaw = THREE.MathUtils.clamp(yawRad, -limit, limit);
  const pitch = THREE.MathUtils.clamp(pitchRad, -limit, limit);
  return new THREE.Euler(pitch, yaw, 0, 'YXZ');
}

export function computeAutoBlink(
  elapsedSinceBlinkStart: number,
  nextBlinkDelay: number
): { value: number; isComplete: boolean } | null {
  const CLOSE = 0.05;
  const KEEP = 0.04;
  const OPEN = 0.10;
  const total = CLOSE + KEEP + OPEN;

  if (elapsedSinceBlinkStart < nextBlinkDelay) return null;
  const t = elapsedSinceBlinkStart - nextBlinkDelay;
  if (t >= total) return { value: 0, isComplete: true };
  if (t < CLOSE) return { value: t / CLOSE, isComplete: false };
  if (t < CLOSE + KEEP) return { value: 1, isComplete: false };
  const openT = t - CLOSE - KEEP;
  return { value: 1 - openT / OPEN, isComplete: false };
}

export function randomNextBlinkDelay(): number {
  return 3 + Math.random() * 9;
}

// Relaxed stand pose: arms down at sides with slight elbow bend.
// VRM 1.0 loads in T-pose; we rotate upper+lower arm bones.
// Pose persists through vrm.update() since normalized bone quats stay set.
//
// VRM 0.x models face -Z in their local (normalized) frame, so their arms are
// mirrored across X relative to VRM 1.0 (right arm extends +X instead of -X).
// Rotations about X and Z must therefore be negated for VRM 0.x, otherwise the
// arms rotate upward instead of down.
export function applyStandPose(vrm: VRM): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;

  const mirror = isVRM0(vrm) ? -1 : 1;

  const upperArms = [
    { name: 'rightUpperArm' as const, z: mirror * STAND_POSE.RIGHT_ARM_Z_RAD },
    { name: 'leftUpperArm' as const, z: mirror * STAND_POSE.LEFT_ARM_Z_RAD },
  ];
  const lowerArms = [
    { name: 'rightLowerArm' as const, x: mirror * STAND_POSE.RIGHT_LOWER_ARM_X_RAD, z: mirror * STAND_POSE.RIGHT_LOWER_ARM_Z_RAD },
    { name: 'leftLowerArm' as const, x: mirror * STAND_POSE.LEFT_LOWER_ARM_X_RAD, z: mirror * STAND_POSE.LEFT_LOWER_ARM_Z_RAD },
  ];

  for (const { name, z } of upperArms) {
    const norm = humanoid.getNormalizedBoneNode(name);
    if (norm) norm.quaternion.setFromEuler(new THREE.Euler(0, 0, z, 'XYZ'));
    const raw = humanoid.getRawBoneNode(name);
    if (raw) raw.quaternion.setFromEuler(new THREE.Euler(0, 0, z, 'XYZ'));
  }
  for (const { name, x, z } of lowerArms) {
    const norm = humanoid.getNormalizedBoneNode(name);
    if (norm) norm.quaternion.setFromEuler(new THREE.Euler(x, 0, z, 'XYZ'));
    const raw = humanoid.getRawBoneNode(name);
    if (raw) raw.quaternion.setFromEuler(new THREE.Euler(x, 0, z, 'XYZ'));
  }
}

// Fully resets all humanoid bones (head, spine, hips, legs, arms, fingers) to
// default neutral orientation, followed by the natural arm stand pose.
export function resetAllBonesToDefault(vrm: VRM): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;

  for (const boneName of ALL_VRM_BONES) {
    const norm = humanoid.getNormalizedBoneNode(boneName);
    if (norm) norm.quaternion.set(0, 0, 0, 1);
    const raw = humanoid.getRawBoneNode(boneName);
    if (raw) raw.quaternion.set(0, 0, 0, 1);
  }

  applyStandPose(vrm);
}
