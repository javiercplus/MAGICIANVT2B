'use client';

import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import {
  encodeOscTypedMessage,
  encodeOscMessage,
  encodeOscBundle,
  decodeOscPacket,
  type OscMessage,
} from './osc';

export interface VmcBonePose {
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export type VmcHeadPose = VmcBonePose;

// === VMagicMirror / Vear / Luppet / HANA_Tool 52 ARKit Perfect Sync BlendShapeClip names ===
export const PERFECT_SYNC_CLIP_NAMES = [
  'BrowInnerUp',
  'BrowDownLeft',
  'BrowDownRight',
  'BrowOuterUpLeft',
  'BrowOuterUpRight',
  'EyeLookUpLeft',
  'EyeLookUpRight',
  'EyeLookDownLeft',
  'EyeLookDownRight',
  'EyeLookInLeft',
  'EyeLookInRight',
  'EyeLookOutLeft',
  'EyeLookOutRight',
  'EyeBlinkLeft',
  'EyeBlinkRight',
  'EyeSquintRight',
  'EyeSquintLeft',
  'EyeWideLeft',
  'EyeWideRight',
  'CheekPuff',
  'CheekSquintLeft',
  'CheekSquintRight',
  'NoseSneerLeft',
  'NoseSneerRight',
  'JawOpen',
  'JawForward',
  'JawLeft',
  'JawRight',
  'MouthFunnel',
  'MouthPucker',
  'MouthLeft',
  'MouthRight',
  'MouthRollUpper',
  'MouthRollLower',
  'MouthShrugUpper',
  'MouthShrugLower',
  'MouthClose',
  'MouthSmileLeft',
  'MouthSmileRight',
  'MouthFrownLeft',
  'MouthFrownRight',
  'MouthDimpleLeft',
  'MouthDimpleRight',
  'MouthUpperUpLeft',
  'MouthUpperUpRight',
  'MouthLowerDownLeft',
  'MouthLowerDownRight',
  'MouthPressLeft',
  'MouthPressRight',
  'MouthStretchLeft',
  'MouthStretchRight',
  'TongueOut',
] as const;

export type PerfectSyncClipName = (typeof PERFECT_SYNC_CLIP_NAMES)[number];

const PERFECT_SYNC_BY_LOWER: Record<string, PerfectSyncClipName> = (() => {
  const map: Record<string, PerfectSyncClipName> = {};
  for (const name of PERFECT_SYNC_CLIP_NAMES) {
    map[name.toLowerCase()] = name;
  }
  return map;
})();

export function normalizeExpressionKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolvePerfectSyncClipName(name: string): PerfectSyncClipName | null {
  const key = normalizeExpressionKey(name);
  return PERFECT_SYNC_BY_LOWER[key] ?? null;
}

export function isPerfectSyncClipName(name: string): boolean {
  return resolvePerfectSyncClipName(name) !== null;
}

// Mirror Left <-> Right for Perfect Sync ARKit blendshapes when mirrorLeftRight is active
export function swapLeftRightPerfectSyncName(name: PerfectSyncClipName): PerfectSyncClipName {
  if (name.endsWith('Left')) {
    return (name.slice(0, -4) + 'Right') as PerfectSyncClipName;
  }
  if (name.endsWith('Right')) {
    return (name.slice(0, -5) + 'Left') as PerfectSyncClipName;
  }
  return name;
}

// Fallback mapping from 52 ARKit Perfect Sync blendshapes -> standard VRM 1.0 / VRM 0.x expressions
// Used when `perfectSyncFallback` is enabled and the loaded VRM model does not have the native
// Perfect Sync BlendShapeClip for a given ARKit channel.
export const PERFECT_SYNC_FALLBACK_MAP: Partial<Record<PerfectSyncClipName, string[]>> = {
  EyeBlinkLeft: ['blinkLeft', 'Blink_L', 'Fcl_EYE_Close_L'],
  EyeBlinkRight: ['blinkRight', 'Blink_R', 'Fcl_EYE_Close_R'],
  EyeLookUpLeft: ['lookUp', 'LookUp'],
  EyeLookUpRight: ['lookUp', 'LookUp'],
  EyeLookDownLeft: ['lookDown', 'LookDown'],
  EyeLookDownRight: ['lookDown', 'LookDown'],
  EyeLookInLeft: ['lookRight', 'LookRight'],
  EyeLookOutRight: ['lookRight', 'LookRight'],
  EyeLookInRight: ['lookLeft', 'LookLeft'],
  EyeLookOutLeft: ['lookLeft', 'LookLeft'],
  JawOpen: ['aa', 'A', 'Fcl_MTH_A'],
  MouthFunnel: ['oh', 'O', 'Fcl_MTH_O'],
  MouthPucker: ['ou', 'U', 'Fcl_MTH_U'],
  MouthStretchLeft: ['ee', 'E', 'Fcl_MTH_E'],
  MouthStretchRight: ['ee', 'E', 'Fcl_MTH_E'],
  MouthSmileLeft: ['happy', 'Joy', 'Fcl_ALL_Joy', 'FC_Happy', 'relaxed', 'Fun'],
  MouthSmileRight: ['happy', 'Joy', 'Fcl_ALL_Joy', 'FC_Happy', 'relaxed', 'Fun'],
  MouthFrownLeft: ['sad', 'Sorrow', 'Fcl_ALL_Sorrow', 'FC_Sad'],
  MouthFrownRight: ['sad', 'Sorrow', 'Fcl_ALL_Sorrow', 'FC_Sad'],
  BrowDownLeft: ['angry', 'Angry', 'Fcl_ALL_Angry', 'FC_Angry'],
  BrowDownRight: ['angry', 'Angry', 'Fcl_ALL_Angry', 'FC_Angry'],
  BrowInnerUp: ['surprised', 'Surprised', 'Fcl_ALL_Surprised'],
  EyeWideLeft: ['surprised', 'Surprised', 'Fcl_ALL_Surprised'],
  EyeWideRight: ['surprised', 'Surprised', 'Fcl_ALL_Surprised'],
};

export interface VmcReceiveConfig {
  enabled: boolean;
  port: number;
  applyUpperBody: boolean;
  applyHand: boolean;
  applyLeg: boolean;
  applyEye: boolean;       // Dedicated Eye Bone tracking toggle (default false to keep gaze tracking active)
  applyRoot: boolean;
  applyHipsPosition: boolean;
  applySpineBase: boolean; // VMagicMirror: "Apply Base Spine Bones Tracking Result"
  applyBlendShape: boolean;
  usePerfectSync: boolean; // VMagicMirror: "Use Perfect Sync" (52 ARKit BlendShapeClips via External Tracking / VMC)
  perfectSyncFallback: boolean; // Fallback to standard VRM expressions when model lacks Perfect Sync clips
  smoothPose: boolean;     // VMagicMirror: "Smooth Received Pose"
  // Axis Inversion / Coordinate Calibration
  invertX: boolean;        // Pitch (X rotation)
  invertY: boolean;        // Yaw (Y rotation)
  invertZ: boolean;        // Roll (Z rotation)
  mirrorLeftRight: boolean; // Swap Left <-> Right bones
}

export interface VmcSendConfig {
  enabled: boolean;
  host: string;
  port: number;
  sendBonePoses: boolean;
  sendFingerBonePoses: boolean;
  sendBlendShapeData: boolean;
  sendCustomBlendShape: boolean;
  sendPerfectSync: boolean; // Emit 52 ARKit Perfect Sync blendshapes via /VMC/Ext/Blend/Val
  convertToVrm0BlendShapeName: boolean;
  limitDataRate30: boolean;
}

export interface VmcConfig {
  receive: VmcReceiveConfig;
  send: VmcSendConfig;
}

// Default Axis configuration:
// Unity VMC senders (VRM Posing Desktop, VSeeFace, LuppetX, VMagicMirror) use
// VRM 0.x / Unity Humanoid coordinates (Left-Handed, Avatar faces +Z).
// In Three.js (Right-Handed):
// - VRM 1.0 faces +Z -> relative to Unity VRM0, X is flipped: quaternion is (qx, -qy, -qz, qw), i.e., invertY=true, invertZ=true.
// - VRM 0.x normalized bones face -Z -> relative to Unity VRM0, Z is flipped: we normalize VRM 0.x to VRM 1.0 frame before applying the axis settings so the same defaults work for both VRM 0.x and VRM 1.0!
export const DEFAULT_VMC_CONFIG: VmcConfig = {
  receive: {
    enabled: false,
    port: 39539,
    applyUpperBody: true,
    applyHand: true,
    applyLeg: true,
    applyEye: false, // Default false: preserves smooth mouse gaze tracking and prevents eye inversion from posers
    applyRoot: false,
    applyHipsPosition: false,
    applySpineBase: false,
    applyBlendShape: true,
    usePerfectSync: true,
    perfectSyncFallback: true,
    smoothPose: true,
    invertX: false,
    invertY: true,
    invertZ: true,
    mirrorLeftRight: false,
  },
  send: {
    enabled: false,
    host: '127.0.0.1',
    port: 39539,
    sendBonePoses: true,
    sendFingerBonePoses: true,
    sendBlendShapeData: true,
    sendCustomBlendShape: true,
    sendPerfectSync: true,
    convertToVrm0BlendShapeName: true,
    limitDataRate30: false,
  },
};

// Unity HumanBodyBones <-> three-vrm VRMHumanBoneName mapping
export const VRM_TO_UNITY_BONE: Record<string, string> = {
  hips: 'Hips',
  leftUpperLeg: 'LeftUpperLeg',
  rightUpperLeg: 'RightUpperLeg',
  leftLowerLeg: 'LeftLowerLeg',
  rightLowerLeg: 'RightLowerLeg',
  leftFoot: 'LeftFoot',
  rightFoot: 'RightFoot',
  spine: 'Spine',
  chest: 'Chest',
  upperChest: 'UpperChest',
  neck: 'Neck',
  head: 'Head',
  leftShoulder: 'LeftShoulder',
  rightShoulder: 'RightShoulder',
  leftUpperArm: 'LeftUpperArm',
  rightUpperArm: 'RightUpperArm',
  leftLowerArm: 'LeftLowerArm',
  rightLowerArm: 'RightLowerArm',
  leftHand: 'LeftHand',
  rightHand: 'RightHand',
  leftToes: 'LeftToes',
  rightToes: 'RightToes',
  leftEye: 'LeftEye',
  rightEye: 'RightEye',
  jaw: 'Jaw',
  leftThumbMetacarpal: 'LeftThumbProximal',
  leftThumbProximal: 'LeftThumbIntermediate',
  leftThumbDistal: 'LeftThumbDistal',
  leftIndexProximal: 'LeftIndexProximal',
  leftIndexIntermediate: 'LeftIndexIntermediate',
  leftIndexDistal: 'LeftIndexDistal',
  leftMiddleProximal: 'LeftMiddleProximal',
  leftMiddleIntermediate: 'LeftMiddleIntermediate',
  leftMiddleDistal: 'LeftMiddleDistal',
  leftRingProximal: 'LeftRingProximal',
  leftRingIntermediate: 'LeftRingIntermediate',
  leftRingDistal: 'LeftRingDistal',
  leftLittleProximal: 'LeftLittleProximal',
  leftLittleIntermediate: 'LeftLittleIntermediate',
  leftLittleDistal: 'LeftLittleDistal',
  rightThumbMetacarpal: 'RightThumbProximal',
  rightThumbProximal: 'RightThumbIntermediate',
  rightThumbDistal: 'RightThumbDistal',
  rightIndexProximal: 'RightIndexProximal',
  rightIndexIntermediate: 'RightIndexIntermediate',
  rightIndexDistal: 'RightIndexDistal',
  rightMiddleProximal: 'RightMiddleProximal',
  rightMiddleIntermediate: 'RightMiddleIntermediate',
  rightMiddleDistal: 'RightMiddleDistal',
  rightRingProximal: 'RightRingProximal',
  rightRingIntermediate: 'RightRingIntermediate',
  rightRingDistal: 'RightRingDistal',
  rightLittleProximal: 'RightLittleProximal',
  rightLittleIntermediate: 'RightLittleIntermediate',
  rightLittleDistal: 'RightLittleDistal',
};

export const UNITY_TO_VRM_BONE: Record<string, VRMHumanBoneName> = (() => {
  const map: Record<string, VRMHumanBoneName> = {};
  for (const [vrmBone, unityBone] of Object.entries(VRM_TO_UNITY_BONE)) {
    map[unityBone] = vrmBone as VRMHumanBoneName;
    map[unityBone.toLowerCase()] = vrmBone as VRMHumanBoneName;
    map[vrmBone] = vrmBone as VRMHumanBoneName;
    map[vrmBone.toLowerCase()] = vrmBone as VRMHumanBoneName;
  }
  return map;
})();

export function swapLeftRightBoneName(boneName: VRMHumanBoneName): VRMHumanBoneName {
  if (boneName.startsWith('left')) {
    return ('right' + boneName.slice(4)) as VRMHumanBoneName;
  }
  if (boneName.startsWith('right')) {
    return ('left' + boneName.slice(5)) as VRMHumanBoneName;
  }
  return boneName;
}

export type VmcBoneCategory = 'upperBody' | 'hand' | 'leg' | 'eye';

export const BONE_CATEGORY: Record<string, VmcBoneCategory> = {
  hips: 'upperBody',
  spine: 'upperBody',
  chest: 'upperBody',
  upperChest: 'upperBody',
  neck: 'upperBody',
  head: 'upperBody',
  leftEye: 'eye',
  rightEye: 'eye',
  jaw: 'upperBody',
  leftShoulder: 'upperBody',
  rightShoulder: 'upperBody',
  leftUpperArm: 'upperBody',
  rightUpperArm: 'upperBody',
  leftLowerArm: 'upperBody',
  rightLowerArm: 'upperBody',
  leftHand: 'upperBody',
  rightHand: 'upperBody',

  leftUpperLeg: 'leg',
  rightUpperLeg: 'leg',
  leftLowerLeg: 'leg',
  rightLowerLeg: 'leg',
  leftFoot: 'leg',
  rightFoot: 'leg',
  leftToes: 'leg',
  rightToes: 'leg',

  leftThumbMetacarpal: 'hand',
  leftThumbProximal: 'hand',
  leftThumbDistal: 'hand',
  leftIndexProximal: 'hand',
  leftIndexIntermediate: 'hand',
  leftIndexDistal: 'hand',
  leftMiddleProximal: 'hand',
  leftMiddleIntermediate: 'hand',
  leftMiddleDistal: 'hand',
  leftRingProximal: 'hand',
  leftRingIntermediate: 'hand',
  leftRingDistal: 'hand',
  leftLittleProximal: 'hand',
  leftLittleIntermediate: 'hand',
  leftLittleDistal: 'hand',
  rightThumbMetacarpal: 'hand',
  rightThumbProximal: 'hand',
  rightThumbDistal: 'hand',
  rightIndexProximal: 'hand',
  rightIndexIntermediate: 'hand',
  rightIndexDistal: 'hand',
  rightMiddleProximal: 'hand',
  rightMiddleIntermediate: 'hand',
  rightMiddleDistal: 'hand',
  rightRingProximal: 'hand',
  rightRingIntermediate: 'hand',
  rightRingDistal: 'hand',
  rightLittleProximal: 'hand',
  rightLittleIntermediate: 'hand',
  rightLittleDistal: 'hand',
};

export const ALL_VRM_BONES = Object.keys(VRM_TO_UNITY_BONE) as VRMHumanBoneName[];

export function isFingerBone(vrmBoneName: string): boolean {
  return BONE_CATEGORY[vrmBoneName] === 'hand';
}

// VRM 1.0 -> VRM 0.x BlendShape name conversion (per VMagicMirror spec)
const VRM1_TO_VRM0_BLENDSHAPE: Record<string, string> = {
  happy: 'Joy',
  angry: 'Angry',
  sad: 'Sorrow',
  relaxed: 'Fun',
  surprised: 'Surprised',
  aa: 'A',
  ih: 'I',
  ou: 'U',
  ee: 'E',
  oh: 'O',
  blink: 'Blink',
  blinkLeft: 'Blink_L',
  blinkRight: 'Blink_R',
  lookUp: 'LookUp',
  lookDown: 'LookDown',
  lookLeft: 'LookLeft',
  lookRight: 'LookRight',
  neutral: 'Neutral',
};

// Incoming VMC BlendShape name (VRM 0.x or VRM 1.0) -> VRM 1.0 expression candidates
const VMC_TO_VRM_EXPRESSIONS: Record<string, string[]> = {
  joy: ['happy', 'Joy', 'Fcl_ALL_Joy', 'FC_Happy'],
  happy: ['happy', 'Joy', 'Fcl_ALL_Joy', 'FC_Happy'],
  angry: ['angry', 'Angry', 'Fcl_ALL_Angry', 'FC_Angry'],
  sorrow: ['sad', 'Sorrow', 'Fcl_ALL_Sorrow', 'FC_Sad'],
  sad: ['sad', 'Sorrow', 'Fcl_ALL_Sorrow', 'FC_Sad'],
  fun: ['relaxed', 'fun', 'Fun', 'Fcl_ALL_Fun'],
  relaxed: ['relaxed', 'fun', 'Fun', 'Fcl_ALL_Fun'],
  surprised: ['surprised', 'Surprised', 'Fcl_ALL_Surprised'],
  surprise: ['surprised', 'Surprised', 'Fcl_ALL_Surprised'],
  a: ['aa', 'A', 'Fcl_MTH_A'],
  aa: ['aa', 'A', 'Fcl_MTH_A'],
  i: ['ih', 'I', 'Fcl_MTH_I'],
  ih: ['ih', 'I', 'Fcl_MTH_I'],
  u: ['ou', 'U', 'Fcl_MTH_U'],
  ou: ['ou', 'U', 'Fcl_MTH_U'],
  e: ['ee', 'E', 'Fcl_MTH_E'],
  ee: ['ee', 'E', 'Fcl_MTH_E'],
  o: ['oh', 'O', 'Fcl_MTH_O'],
  oh: ['oh', 'O', 'Fcl_MTH_O'],
  blink: ['blink', 'Blink', 'Fcl_EYE_Close'],
  blink_l: ['blinkLeft', 'Blink_L', 'Fcl_EYE_Close_L'],
  blinkleft: ['blinkLeft', 'Blink_L', 'Fcl_EYE_Close_L'],
  blink_r: ['blinkRight', 'Blink_R', 'Fcl_EYE_Close_R'],
  blinkright: ['blinkRight', 'Blink_R', 'Fcl_EYE_Close_R'],
  lookup: ['lookUp', 'LookUp'],
  lookdown: ['lookDown', 'LookDown'],
  lookleft: ['lookLeft', 'LookLeft'],
  lookright: ['lookRight', 'LookRight'],
  neutral: ['neutral', 'Neutral', 'Fcl_ALL_Neutral'],
};

const STANDARD_VRM_EXPRESSIONS = new Set(Object.keys(VRM1_TO_VRM0_BLENDSHAPE));

export function mapReceivedBlendShapeNames(
  name: string,
  options?: {
    usePerfectSync?: boolean;
    perfectSyncFallback?: boolean;
    mirrorLeftRight?: boolean;
  },
): {
  isPerfectSync: boolean;
  perfectSyncClip: PerfectSyncClipName | null;
  primaryCandidates: string[];
  fallbackCandidates: string[];
} {
  const usePerfectSync = options?.usePerfectSync ?? true;
  const perfectSyncFallback = options?.perfectSyncFallback ?? true;
  const mirrorLeftRight = options?.mirrorLeftRight ?? false;

  const psClipRaw = resolvePerfectSyncClipName(name);
  if (psClipRaw) {
    const psClip = mirrorLeftRight ? swapLeftRightPerfectSyncName(psClipRaw) : psClipRaw;
    if (!usePerfectSync) {
      return {
        isPerfectSync: true,
        perfectSyncClip: psClip,
        primaryCandidates: [],
        fallbackCandidates: perfectSyncFallback ? (PERFECT_SYNC_FALLBACK_MAP[psClip] ?? []) : [],
      };
    }
    const camelCase = psClip.charAt(0).toLowerCase() + psClip.slice(1);
    const primary = Array.from(new Set([psClip, camelCase, name]));
    const fallback = perfectSyncFallback ? (PERFECT_SYNC_FALLBACK_MAP[psClip] ?? []) : [];
    return {
      isPerfectSync: true,
      perfectSyncClip: psClip,
      primaryCandidates: primary,
      fallbackCandidates: fallback,
    };
  }

  const key = name.toLowerCase().trim();
  const mapped = VMC_TO_VRM_EXPRESSIONS[key];
  if (mapped) {
    const primary = mapped.includes(name) ? mapped : [name, ...mapped];
    return {
      isPerfectSync: false,
      perfectSyncClip: null,
      primaryCandidates: primary,
      fallbackCandidates: [],
    };
  }

  return {
    isPerfectSync: false,
    perfectSyncClip: null,
    primaryCandidates: [name],
    fallbackCandidates: [],
  };
}

// VRM expression name -> ARKit blendshape names expected by VMagicMirror / VTube Studio / Perfect Sync receivers.
const BLENDSHAPE_MAP: Record<string, PerfectSyncClipName[]> = {
  blink: ['EyeBlinkLeft', 'EyeBlinkRight'],
  blinkLeft: ['EyeBlinkLeft'],
  blinkRight: ['EyeBlinkRight'],
  aa: ['JawOpen'],
  ih: ['MouthStretchLeft', 'MouthStretchRight'],
  ou: ['MouthPucker'],
  ee: ['MouthSmileLeft', 'MouthSmileRight', 'MouthStretchLeft', 'MouthStretchRight'],
  oh: ['MouthFunnel'],
  happy: ['MouthSmileLeft', 'MouthSmileRight'],
  sad: ['MouthFrownLeft', 'MouthFrownRight'],
  angry: ['BrowDownLeft', 'BrowDownRight'],
  surprised: ['BrowInnerUp', 'EyeWideLeft', 'EyeWideRight'],
  lookLeft: ['EyeLookInRight', 'EyeLookOutLeft'],
  lookRight: ['EyeLookInLeft', 'EyeLookOutRight'],
  lookUp: ['EyeLookUpLeft', 'EyeLookUpRight'],
  lookDown: ['EyeLookDownLeft', 'EyeLookDownRight'],
};

// Coordinate conversion for VMC Send (Three.js VRM 1.0 -> Unity VMC):
// VRM 1.0 right-handed (+Z forward, -X avatar right) -> Unity left-handed (+Z forward, +X avatar right)
// Flipping X axis converts between Three.js VRM 1.0 and Unity VMC:
// Position: (-x, y, z)
// Quaternion: (qx, -qy, -qz, qw)
export function threeToVMCQuaternion(q: {
  x: number; y: number; z: number; w: number;
}): { x: number; y: number; z: number; w: number } {
  return { x: q.x, y: -q.y, z: -q.z, w: q.w };
}

export function threeToVMCPosition(p: {
  x: number; y: number; z: number;
}): { x: number; y: number; z: number } {
  return { x: -p.x, y: p.y, z: p.z };
}

// Shared, mutable store for outgoing & incoming VMC data
export const vmcState = {
  enabled: false,
  loaded: false,
  elapsedTime: 0,
  root: { px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 } as VmcBonePose,
  head: { px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 } as VmcHeadPose,
  bones: {} as Record<string, VmcBonePose>,
  blendshapes: {} as Record<string, number>,
};

export const vmcReceivedState = {
  lastPacketTime: 0,
  packetCount: 0,
  root: null as VmcBonePose | null,
  bones: {} as Record<string, VmcBonePose>,
  stagingBlendshapes: {} as Record<string, number>,
  blendshapes: {} as Record<string, number>,
  perfectSyncActiveCount: 0, // Number of active ARKit Perfect Sync channels received
};

export function isVmcReceivingActive(now = performance.now()): boolean {
  return vmcReceivedState.lastPacketTime > 0 && now - vmcReceivedState.lastPacketTime < 2500;
}

export function clearVmcReceivedState(): void {
  vmcReceivedState.lastPacketTime = 0;
  vmcReceivedState.root = null;
  vmcReceivedState.bones = {};
  vmcReceivedState.stagingBlendshapes = {};
  vmcReceivedState.blendshapes = {};
  vmcReceivedState.perfectSyncActiveCount = 0;
}

// Process a raw UDP datagram received from a VMC Performer/Sender app
export function processIncomingVmcBuffer(buffer: Uint8Array): void {
  try {
    const messages = decodeOscPacket(buffer);
    if (messages.length === 0) return;

    let gotAnyVmc = false;
    for (let i = 0; i < messages.length; i++) {
      if (handleOscMessage(messages[i])) {
        gotAnyVmc = true;
      }
    }

    if (gotAnyVmc) {
      vmcReceivedState.lastPacketTime = performance.now();
      vmcReceivedState.packetCount++;
    }
  } catch {
    // Ignore malformed datagrams instead of breaking the receive loop.
  }
}

function handleOscMessage(msg: OscMessage): boolean {
  const { address, args } = msg;

  // Standard VMC Bone Transform: /VMC/Ext/Bone/Pos (string name, float px, py, pz, qx, qy, qz, qw)
  if (address === '/VMC/Ext/Bone/Pos' && args.length >= 8) {
    const rawName = String(args[0]);
    const vrmBone = UNITY_TO_VRM_BONE[rawName] ?? UNITY_TO_VRM_BONE[rawName.toLowerCase()];
    if (!vrmBone) return true;

    const px = Number(args[1]) || 0;
    const py = Number(args[2]) || 0;
    const pz = Number(args[3]) || 0;
    const qx = Number(args[4]) || 0;
    const qy = Number(args[5]) || 0;
    const qz = Number(args[6]) || 0;
    const qw = Number(args[7]);

    vmcReceivedState.bones[vrmBone] = {
      px, py, pz,
      qx, qy, qz,
      qw: Number.isFinite(qw) ? qw : 1,
    };
    return true;
  }

  // Legacy / Assistant Head transform: /VMC/Transform/Head (float px, py, pz, qx, qy, qz, qw)
  if (address === '/VMC/Transform/Head' && args.length >= 7) {
    const offset = typeof args[0] === 'string' ? 1 : 0;
    if (args.length < offset + 7) return false;
    vmcReceivedState.bones.head = {
      px: Number(args[offset]) || 0,
      py: Number(args[offset + 1]) || 0,
      pz: Number(args[offset + 2]) || 0,
      qx: Number(args[offset + 3]) || 0,
      qy: Number(args[offset + 4]) || 0,
      qz: Number(args[offset + 5]) || 0,
      qw: Number.isFinite(Number(args[offset + 6])) ? Number(args[offset + 6]) : 1,
    };
    return true;
  }

  // Root Transform: /VMC/Ext/Root/Pos (string name, float px, py, pz, qx, qy, qz, qw)
  if (address === '/VMC/Ext/Root/Pos' && args.length >= 8) {
    const px = Number(args[1]) || 0;
    const py = Number(args[2]) || 0;
    const pz = Number(args[3]) || 0;
    const qx = Number(args[4]) || 0;
    const qy = Number(args[5]) || 0;
    const qz = Number(args[6]) || 0;
    const qw = Number(args[7]);
    vmcReceivedState.root = {
      px, py, pz,
      qx, qy, qz,
      qw: Number.isFinite(qw) ? qw : 1,
    };
    return true;
  }

  // VMC BlendShape value: /VMC/Ext/Blend/Val (string name, float val)
  if (address === '/VMC/Ext/Blend/Val' && args.length >= 2) {
    const name = String(args[0]);
    const val = Math.max(0, Math.min(1, Number(args[1]) || 0));
    vmcReceivedState.stagingBlendshapes[name] = val;
    vmcReceivedState.blendshapes[name] = val;
    if (isPerfectSyncClipName(name)) {
      recountPerfectSyncChannels();
    }
    return true;
  }

  // VMC BlendShape commit: /VMC/Ext/Blend/Apply
  if (address === '/VMC/Ext/Blend/Apply') {
    vmcReceivedState.blendshapes = { ...vmcReceivedState.stagingBlendshapes };
    recountPerfectSyncChannels();
    return true;
  }

  // Legacy / Assistant Blendshape: /VMC/Blendshape/<name> (float val)
  if (address.startsWith('/VMC/Blendshape/') && args.length >= 1) {
    const name = address.slice('/VMC/Blendshape/'.length);
    const val = Math.max(0, Math.min(1, Number(args[0]) || 0));
    vmcReceivedState.blendshapes[name] = val;
    if (isPerfectSyncClipName(name)) {
      recountPerfectSyncChannels();
    }
    return true;
  }

  // Heartbeat / status messages (/VMC/Ext/OK, /VMC/Ext/T)
  if (address.startsWith('/VMC/')) {
    return true;
  }

  return false;
}

function recountPerfectSyncChannels(): void {
  let count = 0;
  for (const key of Object.keys(vmcReceivedState.blendshapes)) {
    if (isPerfectSyncClipName(key)) count++;
  }
  vmcReceivedState.perfectSyncActiveCount = count;
}

// Build standard VMC Protocol Performer packets (bundled for efficiency)
export function buildVmcSendDatagrams(
  state: typeof vmcState,
  sendConfig: VmcSendConfig,
): Uint8Array[] {
  const messages: Uint8Array[] = [];

  // 1. Status & relative time (/VMC/Ext/OK, /VMC/Ext/T)
  messages.push(
    encodeOscTypedMessage('/VMC/Ext/OK', [
      { type: 'i', value: state.loaded ? 1 : 0 },
      { type: 'i', value: 3 }, // Calibrated = 3
      { type: 'i', value: 0 }, // Normal = 0
      { type: 'i', value: 1 }, // Tracking OK = 1
    ]),
  );
  messages.push(
    encodeOscTypedMessage('/VMC/Ext/T', [{ type: 'f', value: state.elapsedTime }]),
  );

  // 2. Root & Bone poses
  if (sendConfig.sendBonePoses) {
    const rp = threeToVMCPosition({ x: state.root.px, y: state.root.py, z: state.root.pz });
    const rq = threeToVMCQuaternion({ x: state.root.qx, y: state.root.qy, z: state.root.qz, w: state.root.qw });
    messages.push(
      encodeOscTypedMessage('/VMC/Ext/Root/Pos', [
        { type: 's', value: 'root' },
        { type: 'f', value: rp.x },
        { type: 'f', value: rp.y },
        { type: 'f', value: rp.z },
        { type: 'f', value: rq.x },
        { type: 'f', value: rq.y },
        { type: 'f', value: rq.z },
        { type: 'f', value: rq.w },
      ]),
    );

    for (const [vrmBone, pose] of Object.entries(state.bones)) {
      if (!sendConfig.sendFingerBonePoses && isFingerBone(vrmBone)) continue;
      const unityName = VRM_TO_UNITY_BONE[vrmBone];
      if (!unityName) continue;

      const bp = threeToVMCPosition({ x: pose.px, y: pose.py, z: pose.pz });
      const bq = threeToVMCQuaternion({ x: pose.qx, y: pose.qy, z: pose.qz, w: pose.qw });

      messages.push(
        encodeOscTypedMessage('/VMC/Ext/Bone/Pos', [
          { type: 's', value: unityName },
          { type: 'f', value: bp.x },
          { type: 'f', value: bp.y },
          { type: 'f', value: bp.z },
          { type: 'f', value: bq.x },
          { type: 'f', value: bq.y },
          { type: 'f', value: bq.z },
          { type: 'f', value: bq.w },
        ]),
      );
    }

    // Also include /VMC/Transform/Head for compatibility with VTube Studio / simple receivers
    const hq = threeToVMCQuaternion({
      x: state.head.qx, y: state.head.qy, z: state.head.qz, w: state.head.qw,
    });
    const hp = threeToVMCPosition({
      x: state.head.px, y: state.head.py, z: state.head.pz,
    });
    messages.push(
      encodeOscMessage('/VMC/Transform/Head', [
        hp.x, hp.y, hp.z,
        hq.x, hq.y, hq.z, hq.w,
      ]),
    );
  }

  // 3. BlendShape data (/VMC/Ext/Blend/Val + /VMC/Ext/Blend/Apply)
  if (sendConfig.sendBlendShapeData) {
    const perfectSyncSent = new Set<PerfectSyncClipName>();

    for (const [name, weight] of Object.entries(state.blendshapes)) {
      const isStandard = STANDARD_VRM_EXPRESSIONS.has(name);
      const psClip = resolvePerfectSyncClipName(name);

      if (psClip) {
        if (!sendConfig.sendPerfectSync) continue;
        const w = Math.min(1, Math.max(0, Number.isFinite(weight) ? weight : 0));
        perfectSyncSent.add(psClip);
        messages.push(
          encodeOscTypedMessage('/VMC/Ext/Blend/Val', [
            { type: 's', value: psClip },
            { type: 'f', value: w },
          ]),
        );
        const camelTarget = psClip.charAt(0).toLowerCase() + psClip.slice(1);
        if (w > 0.01) {
          messages.push(encodeOscMessage(`/VMC/Blendshape/${camelTarget}`, [w]));
        }
        continue;
      }

      if (!sendConfig.sendCustomBlendShape && !isStandard) continue;

      const w = Math.min(1, Math.max(0, Number.isFinite(weight) ? weight : 0));
      const outName = sendConfig.convertToVrm0BlendShapeName
        ? (VRM1_TO_VRM0_BLENDSHAPE[name] ?? name)
        : name;

      messages.push(
        encodeOscTypedMessage('/VMC/Ext/Blend/Val', [
          { type: 's', value: outName },
          { type: 'f', value: w },
        ]),
      );

      // Synthesize Perfect Sync / VTube Studio ARKit blendshapes from standard VRM expressions if not already present on the model
      const psTargets = BLENDSHAPE_MAP[name];
      if (psTargets && w > 0.01) {
        for (const target of psTargets) {
          if (sendConfig.sendPerfectSync && !perfectSyncSent.has(target)) {
            messages.push(
              encodeOscTypedMessage('/VMC/Ext/Blend/Val', [
                { type: 's', value: target },
                { type: 'f', value: w },
              ]),
            );
          }
          const camelTarget = target.charAt(0).toLowerCase() + target.slice(1);
          messages.push(encodeOscMessage(`/VMC/Blendshape/${camelTarget}`, [w]));
        }
      }
    }

    messages.push(encodeOscTypedMessage('/VMC/Ext/Blend/Apply', []));
  }

  // Chunk into OSC #bundles of <= 35 messages so UDP datagrams stay safely below MTU
  const datagrams: Uint8Array[] = [];
  const CHUNK_SIZE = 35;
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    datagrams.push(encodeOscBundle(chunk));
  }

  return datagrams;
}
