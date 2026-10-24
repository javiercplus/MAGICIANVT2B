// Ported from VMagicMirror v5.0.0 source (C# / Unity).
// HeadIkIntegrator.cs, EyeLookAt.cs, AnimMorphEasedTarget.cs, VRMLoader.cs

import type * as THREE from 'three';

export const GAZE = {
  MOUSE_DIVISOR: 1000,
  // Web Y is inverted from Unity (top=0). Positive y = look down.
  Y_BIAS: 0.3,
  Y_UP_DAMPING: 0.7,
  X_CLAMP: 1,
  Y_CLAMP_LOW: -0.5,
  Y_CLAMP_HIGH: 1.0,
  LOOKAT_Z_OFFSET: 0.6,
  LERP_SPEED: 6.0,
  HEAD_IK_BODY_WEIGHT: 0.2,
  HEAD_IK_HEAD_WEIGHT: 0.5,
  HEAD_ROT_LIMIT_DEG: 40,
  HEAD_RATE: 0.5,
  EYE_YAW_PITCH_PER_RATE_DEG: 20,
  EYE_ANGLE_LIMIT_DEG: 25,
  EYE_RATE_MAG_CLAMP: 1.2,
  EYE_LERP_SPEED: 4.0,
} as const;

export const STAND_POSE = {
  // Avatar's "right" = viewer's LEFT (avatar faces camera).
  // rightUpperArm extends -X; to bring DOWN use +Z. Left mirrors.
  // 70° leaves ~20° outward opening for natural stand.
  RIGHT_ARM_Z_RAD:  Math.PI * 70 / 180,
  LEFT_ARM_Z_RAD:  -Math.PI * 70 / 180,
  RIGHT_LOWER_ARM_X_RAD: -Math.PI * 10 / 180,
  LEFT_LOWER_ARM_X_RAD:  -Math.PI * 10 / 180,
  RIGHT_LOWER_ARM_Z_RAD: 0,
  LEFT_LOWER_ARM_Z_RAD:  0,
} as const;

export const GREEN_SCREEN = {
  COLOR: '#00b140',
  COLOR_PURE: '#00ff00',
} as const;

export const DRAG = {
  SENSITIVITY: 0.002,
} as const;

export const LIPSYNC = {
  TRANSITION_CURVE_END_TIME: 0.1,
  CANCEL_SPEED: 8.0,
  WEIGHT_THRESHOLD: 0.02,
  DB_MIN: -40,
  DB_MAX: -20,
  VOLUME_FACTOR_CLAMP_MIN: 0.3,
  // Smoothing rates (per second). Attack opens the mouth quickly when sound
  // arrives; release lets it close slowly/smoothly over a few seconds.
  ATTACK_SPEED: 14.0,
  RELEASE_SPEED: 13.0,
  VOWEL_PRESETS: ['aa', 'ee', 'ih', 'oh', 'ou'] as const,
  MOUTH_OPEN_PRESET: 'aa',
} as const;

export const AUTO_BLINK = {
  INTERVAL_MIN_SEC: 3,
  INTERVAL_MAX_SEC: 12,
  CLOSE_DURATION_SEC: 0.05,
  KEEP_CLOSED_DURATION_SEC: 0.04,
  OPEN_DURATION_SEC: 0.10,
  BLINK_PRESET: 'blink' as const,
} as const;

export const SCENE = {
  CAMERA_DISTANCE: 1.3,
  CAMERA_HEIGHT_OFFSET: 0.0,
  BACKGROUND: '#0b0b12',
  FLOOR_COLOR: '#15151f',
  LIGHT_AMBIENT: '#6a7090',
  LIGHT_FRONT: '#ffffff',
  LIGHT_TOP: '#c7d2fe',
} as const;

export const ZOOM = {
  MIN: 0.5,
  MAX: 3,
  DEFAULT: 1,
  WHEEL_SENSITIVITY: 0.001,
} as const;

// Camera lens controls, kept separate from zoom (which is a projection scale).
export const CAMERA = {
  FOV_MIN: 15,
  FOV_MAX: 90,
  FOV_DEFAULT: 30,
  ROTATE_SENSITIVITY: 0.006,
  PITCH_LIMIT_RAD: Math.PI / 6,
} as const;

export interface ModelRotation {
  x: number; // pitch (radians)
  y: number; // yaw (radians)
}

// Home framing captured when a VRM is loaded. Zoom dollies the camera along
// this target ray; FOV only changes the lens angle.
export interface CameraHome {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export const DEFAULT_MODEL_ROTATION: ModelRotation = { x: 0, y: 0 };

export interface LightingConfig {
  front: number;      // front light intensity, 0..3
  top: number;        // top light intensity, 0..3
  frontAngle: number; // azimuth in degrees, 0 = straight in front, -/+ = orbit
  topAngle: number;   // azimuth in degrees for the top light
}

export const DEFAULT_LIGHTING: LightingConfig = {
  front: 1.4,
  top: 1.0,
  frontAngle: 0,
  topAngle: 0,
};

export type ToneMappingMode = 'neutral' | 'aces' | 'agx' | 'linear' | 'none';

export interface AdjustConfig {
  brightness: number;     // 0..2, 1 = neutral (100%)
  saturation: number;     // 0..2, 1 = neutral (100%)
  contrast: number;       // 0..2, 1 = neutral (100%)
  hue: number;            // -180..180 degrees, 0 = neutral
  temperature: number;    // -1..1, 0 = neutral (negative cool, positive warm)
  exposure: number;       // 0..2, 1 = neutral (100%)
  toneMapping: ToneMappingMode;
}

// Every color control defaults to its neutral 100% value.
export const DEFAULT_ADJUST: AdjustConfig = {
  brightness: 1,
  saturation: 1,
  contrast: 1,
  hue: 0,
  temperature: 0,
  exposure: 1,
  toneMapping: 'neutral',
};

// === Wind ===================================================================
// Drives the VRM spring bones (hair, skirt, ribbons) with a world-space breeze.
export interface WindConfig {
  enabled: boolean;
  strength: number;  // 0..3
  direction: number; // degrees, 0 = +X, 90 = +Z
  gusts: number;     // 0..1 turbulence amount
}

export const DEFAULT_WIND: WindConfig = {
  enabled: false,
  strength: 0.6,
  direction: 90,
  gusts: 0.35,
};

// === MToon ==================================================================
// Global look for all MToon materials. "enabled" applies the values below;
// disabling restores the author's original material values.
export interface MToonConfig {
  enabled: boolean;
  toony: number;        // shadingToonyFactor 0..1 (higher = harder toon steps)
  shadingShift: number; // offset added to the authored shadingShiftFactor
  gi: number;           // giEqualizationFactor 0..1 (1 = anime-like flat light)
  rim: number;          // parametric rim strength 0..1
  rimPower: number;     // rim fresnel power 1..8
  rimColor: string;     // rim tint
  colorBoost: number;   // saturation multiplier for lit/shade colors
}

export const DEFAULT_MTOON: MToonConfig = {
  enabled: true,
  toony: 0.9,
  shadingShift: 0,
  gi: 0.9,
  rim: 0,
  rimPower: 4,
  rimColor: '#ffffff',
  colorBoost: 1,
};

export const LIGHTING = {
  // Soft base so the avatar is never pitch black; not user-configurable.
  AMBIENT_INTENSITY: 0.35,
  // Front light: in front of the avatar at face/chest height.
  FRONT_POSITION: [0, 1.4, 2.5] as [number, number, number],
  // Top light: above the avatar, slightly forward for a natural shadow.
  TOP_POSITION: [0, 3.5, 0.8] as [number, number, number],
} as const;

export type GazeTarget = {
  x: number;
  y: number;
};

// === Optimization Panel =====================================================

export type PhysicsQuality = 'low' | 'medium' | 'high';

// Spring-bone solver update interval in seconds. 0 = every frame (full quality).
export const PHYSICS_INTERVAL: Record<PhysicsQuality, number> = {
  low: 0.1,    // 10 Hz
  medium: 0.05, // 20 Hz
  high: 0,      // every frame
};

export interface OptimizationConfig {
  fpsLimit: number;        // 15..60 (render loop cap)
  renderScale: number;     // 0.25..1 internal render-target resolution
  antiAlias: boolean;      // FXAA post-process (compensates low renderScale)
  msaa: boolean;           // 4x MSAA on the post-processing render targets
  pixelRatio: number;      // 0.5..1.5 renderer.setPixelRatio
  physicsQuality: PhysicsQuality;
  morphOptimization: boolean;
  mtoonLowPower: boolean;
}

export const DEFAULT_OPTIMIZATION: OptimizationConfig = {
  fpsLimit: 60,
  renderScale: 1,
  antiAlias: false,
  msaa: false,
  pixelRatio: 1,
  physicsQuality: 'high',
  morphOptimization: false,
  mtoonLowPower: false,
};

export interface Telemetry {
  fps: number;
  textures: number;
  calls: number;
  geometries: number;
}

// Custom MToon shader effects. Injected via onBeforeCompile so VRM features
// (bones, morphs, outlines) stay intact. See src/lib/vrm/materialFX.ts.
export type ShaderPreset =
  | 'off' | 'hologram' | 'dissolve' | 'glow' | 'scanline'
  | 'outline' | 'chromatic' | 'pixel';

export interface ShaderConfig {
  effects: ShaderPreset[]; // enabled effects (multi-select); empty = off
  intensity: number;   // 0..1 master mix
  color: string;       // tint / glow color (hex)
  dissolve: number;    // 0..1 (dissolve preset)
  scanline: number;    // 0..1 scanline density
  bloom: number;       // UnrealBloom strength, 0 = off
  bloomRadius: number; // 0..1
  bloomThreshold: number; // >1 => solo emissive HDR (no blancos/fondo)
}

export const DEFAULT_SHADER: ShaderConfig = {
  effects: [],
  intensity: 0.5,
  color: '#38f0ff',
  dissolve: 0,
  scanline: 0.35,
  bloom: 0.6,
  bloomRadius: 0.4,
  bloomThreshold: 1.1,
};

// === Face / blend shapes =====================================================

export type FacePreset =
  | 'neutral' | 'fun' | 'happy' | 'sad' | 'angry' | 'surprised' | 'relaxed';

// Only emotion/state blend shapes are exposed in the Face tab. Mouth vowels
// (aa/ih/ou/ee/oh), blink and look-at channels are deliberately excluded: they
// are driven by lipsync, auto-blink and gaze.
export const FACE_EMOTIONS: readonly FacePreset[] = [
  'neutral', 'fun', 'happy', 'relaxed', 'surprised', 'sad', 'angry',
];

// Map a VRM expression name to an emotion/state. Handles standard preset names
// as well as custom "face control" states such as "Fcl_ALL_Neutral", "FC_Happy".
export function matchFaceEmotion(name: string): FacePreset | null {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n.includes('allneutral') || n.includes('neutral')) return 'neutral';
  if (n.includes('allfun') || n.includes('fun')) return 'fun';
  if (n.includes('happy')) return 'happy';
  if (n.includes('relaxed')) return 'relaxed';
  if (n.includes('surprised') || n.includes('surprise')) return 'surprised';
  if (n.includes('sad')) return 'sad';
  if (n.includes('angry') || n.includes('anger')) return 'angry';
  return null;
}
