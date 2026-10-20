'use client';

import { encodeOscMessage, encodeOscBlendshape } from './osc';

export interface VmcHeadPose {
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

// Shared, mutable store that the avatar updates every frame and the VMC sender
// reads (single avatar app).
export const vmcState = {
  enabled: false,
  head: { px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 } as VmcHeadPose,
  blendshapes: {} as Record<string, number>,
};

// VRM expression name -> ARKit blendshape names expected by VTube Studio.
const BLENDSHAPE_MAP: Record<string, string[]> = {
  blink: ['eyeBlinkLeft', 'eyeBlinkRight'],
  blinkLeft: ['eyeBlinkLeft'],
  blinkRight: ['eyeBlinkRight'],
  aa: ['jawOpen'],
  happy: ['mouthSmileLeft', 'mouthSmileRight'],
  angry: ['browDownLeft', 'browDownRight'],
  surprised: ['browInnerUp'],
  lookLeft: ['eyeLookInLeft', 'eyeLookOutRight'],
  lookRight: ['eyeLookInRight', 'eyeLookOutLeft'],
  lookUp: ['eyeLookUpLeft', 'eyeLookUpRight'],
  lookDown: ['eyeLookDownLeft', 'eyeLookDownRight'],
};

// Three.js (right-handed) -> VMC/Unity (left-handed), both Y-up.
export function threeToVMCQuaternion(q: {
  x: number; y: number; z: number; w: number;
}): { x: number; y: number; z: number; w: number } {
  return { x: q.x, y: q.y, z: -q.z, w: -q.w };
}

export interface VmcPacketBundle {
  head: Uint8Array;
  blendshapes: Uint8Array[];
}

export function buildVmcPackets(state: typeof vmcState): VmcPacketBundle {
  const q = threeToVMCQuaternion({
    x: state.head.qx, y: state.head.qy, z: state.head.qz, w: state.head.qw,
  });
  const head = encodeOscMessage('/VMC/Transform/Head', [
    state.head.px, state.head.py, state.head.pz,
    q.x, q.y, q.z, q.w,
  ]);

  const blendshapes: Uint8Array[] = [];
  for (const [name, weight] of Object.entries(state.blendshapes)) {
    const targets = BLENDSHAPE_MAP[name];
    if (!targets || weight <= 0.01) continue;
    const w = Math.min(1, Math.max(0, weight));
    for (const target of targets) blendshapes.push(encodeOscBlendshape(target, w));
  }

  return { head, blendshapes };
}
