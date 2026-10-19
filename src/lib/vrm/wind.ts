'use client';

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { WindConfig } from './constants';

interface SpringJointLike {
  settings: {
    gravityDir: THREE.Vector3;
    gravityPower: number;
  };
}

interface GravityOriginal {
  dir: THREE.Vector3;
  power: number;
}

const originals = new WeakMap<SpringJointLike, GravityOriginal>();
const tmpForce = new THREE.Vector3();
const tmpWind = new THREE.Vector3();

function restore(joints: Set<SpringJointLike>): void {
  for (const joint of joints) {
    const original = originals.get(joint);
    if (!original) continue;
    joint.settings.gravityDir.copy(original.dir);
    joint.settings.gravityPower = original.power;
  }
}

/**
 * Adds a world-space breeze to the VRM spring bones (hair, skirts, ribbons).
 *
 * three-vrm's spring solver only exposes gravity, so wind is composed with the
 * authored gravity:  force = gravityDir * gravityPower + windVector.
 * Gusts modulate the wind over time, and each joint gets a small phase offset
 * so hair does not move as a single rigid block.
 */
export function applyVRMWind(vrm: VRM, config: WindConfig, elapsed: number): void {
  const joints = vrm.springBoneManager?.joints as unknown as Set<SpringJointLike> | undefined;
  if (!joints || joints.size === 0) return;

  if (!config.enabled) {
    restore(joints);
    return;
  }

  const angle = (config.direction * Math.PI) / 180;
  const gust =
    1 +
    config.gusts * (0.55 * Math.sin(elapsed * 1.7) + 0.30 * Math.sin(elapsed * 3.1 + 1.2));

  let index = 0;
  for (const joint of joints) {
    let original = originals.get(joint);
    if (!original) {
      original = {
        dir: joint.settings.gravityDir.clone(),
        power: joint.settings.gravityPower,
      };
      originals.set(joint, original);
    }

    const phase = index * 0.73;
    const turbulence = Math.sin(elapsed * 4.2 + phase) * config.strength * config.gusts * 0.35;
    const strength = Math.max(0, config.strength * gust + turbulence);

    const x = Math.cos(angle) * strength;
    const z = Math.sin(angle) * strength;
    const y = Math.sin(elapsed * 5.0 + phase) * config.strength * config.gusts * 0.12;

    const total = tmpForce
      .copy(original.dir)
      .multiplyScalar(original.power)
      .add(tmpWind.set(x, y, z));

    const magnitude = total.length();
    if (magnitude > 1e-6) {
      joint.settings.gravityDir.copy(total).divideScalar(magnitude);
    }
    joint.settings.gravityPower = magnitude;

    index++;
  }
}

export function resetVRMWind(vrm: VRM): void {
  const joints = vrm.springBoneManager?.joints as unknown as Set<SpringJointLike> | undefined;
  if (joints) restore(joints);
}
