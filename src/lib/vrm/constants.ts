// Ported from VMagicMirror v5.0.0 source (C# / Unity).
// HeadIkIntegrator.cs, EyeLookAt.cs, AnimMorphEasedTarget.cs, VRMLoader.cs

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
  LIGHT_KEY: '#ffffff',
  LIGHT_FILL: '#8893b3',
  LIGHT_RIM: '#7c5cff',
  LIGHT_BACK: '#b8c5e6',
} as const;

export interface LightConfig {
  angle: number;     // azimuth degrees, 0 = front (+Z), 90 = right (+X)
  intensity: number; // 0..3
}

export interface LightingConfig {
  ambient: number;
  key: LightConfig;
  fill: LightConfig;
  rim: LightConfig;
  back: LightConfig;
}

export const DEFAULT_LIGHTING: LightingConfig = {
  ambient: 0.4,
  key: { angle: 30, intensity: 1.5 },
  fill: { angle: 210, intensity: 0.5 },
  rim: { angle: 180, intensity: 0.6 },
  back: { angle: 0, intensity: 0.3 },
};

export const LIGHTING = {
  RADIUS: 2.5,
  HEIGHTS: {
    key: 2.0,
    fill: 1.0,
    rim: 1.4,
    back: 2.6,
  },
} as const;

export type GazeTarget = {
  x: number;
  y: number;
};
