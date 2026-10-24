'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VRMAvatar } from './VRMAvatar';
import { PostFX } from './PostFX';
import { RenderSettings, TelemetryProbe } from './TelemetryProbe';
import {
  SCENE, ZOOM, CAMERA, GREEN_SCREEN, LIGHTING,
  type LightingConfig, type AdjustConfig, type ShaderConfig, type OptimizationConfig, type Telemetry,
  type WindConfig, type MToonConfig, type ModelRotation, type GazeTarget, type CameraHome,
} from '@/lib/vrm/constants';
import type { LoadVRMResult } from '@/lib/vrm/loadVRM';

const INITIAL_CAMERA = {
  position: [0, 1.3, 1.3] as [number, number, number],
  fov: CAMERA.FOV_DEFAULT,
  near: 0.01,
  far: 100,
};

interface VRMSceneProps {
  vrmUrl: string | null;
  gazeEnabled: boolean;
  autoBlinkEnabled: boolean;
  randomEyesEnabled: boolean;
  randomEyesIntensity: number;
  idleSwayEnabled: boolean;
  idleSwayIntensity: number;
  gazeDesiredRef: React.RefObject<GazeTarget>;
  gazeCurrentRef: React.RefObject<GazeTarget>;
  mouthValueRef: React.RefObject<number>;
  avatarOffsetRef: React.RefObject<THREE.Vector3>;
  faceWeights: Record<string, number>;
  rotationRef: React.RefObject<ModelRotation>;
  cameraHomeRef: React.RefObject<CameraHome | null>;
  greenScreen?: boolean;
  chromaColor?: string;
  backgroundImageUrl?: string | null;
  lighting: LightingConfig;
  adjust: AdjustConfig;
  shader: ShaderConfig;
  optimization: OptimizationConfig;
  mtoon: MToonConfig;
  wind: WindConfig;
  zoom: number;
  fov: number;
  orthographic: boolean;
  meshVisibility?: Record<string, boolean>;
  onZoomChange?: (z: number) => void;
  onTelemetry?: (t: Telemetry) => void;
  onLoaded?: (result: LoadVRMResult) => void;
  onError?: (err: Error) => void;
}

function BackgroundImage({ url }: { url: string }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let texture: THREE.Texture | null = null;
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      texture = tex;
      scene.background = tex;
    });
    return () => {
      if (texture) {
        texture.dispose();
        if (scene.background === texture) scene.background = null;
      }
    };
  }, [url, scene, gl]);
  return null;
}

// Zoom dollies the camera; FOV changes the lens angle.
const _forward = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _baseDir = new THREE.Vector3();

function updateCamera(
  camera: THREE.Camera,
  zoom: number,
  fov: number,
  width: number,
  height: number,
  home: CameraHome | null,
): void {
  const aspect = height > 0 ? width / height : 1;

  let distance = 0;
  if (home) {
    _baseDir.copy(home.position).sub(home.target);
    const baseDistance = _baseDir.length();
    const safeZoom = Math.max(0.1, zoom);
    distance = baseDistance / safeZoom;
    _baseDir.normalize();
    camera.position.copy(home.target).addScaledVector(_baseDir, distance);
    camera.lookAt(home.target);
  }

  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const cam = camera as THREE.PerspectiveCamera;
    const projectionZoom = home ? 1 : Math.max(0.1, zoom);
    if (Math.abs(cam.zoom - projectionZoom) > 1e-4) cam.zoom = projectionZoom;
    if (Math.abs(cam.fov - fov) > 1e-4) cam.fov = fov;
    if (Math.abs(cam.aspect - aspect) > 1e-4) cam.aspect = aspect;
    cam.updateProjectionMatrix();
    return;
  }

  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    const cam = camera as THREE.OrthographicCamera;

    if (!home) {
      _forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
      distance = Math.max(0.2, -_origin.copy(cam.position).dot(_forward));
    }

    const baseHalfHeight = Math.tan(THREE.MathUtils.degToRad(fov) * 0.5) * distance;
    const halfHeight = home ? baseHalfHeight : baseHalfHeight / Math.max(0.1, zoom);
    const halfWidth = halfHeight * aspect;

    const changed =
      Math.abs(cam.left + halfWidth) > 1e-4 ||
      Math.abs(cam.right - halfWidth) > 1e-4 ||
      Math.abs(cam.top - halfHeight) > 1e-4 ||
      Math.abs(cam.bottom + halfHeight) > 1e-4 ||
      Math.abs(cam.zoom - 1) > 1e-4;

    if (changed) {
      cam.left = -halfWidth;
      cam.right = halfWidth;
      cam.top = halfHeight;
      cam.bottom = -halfHeight;
      cam.near = -100;
      cam.far = 100;
      cam.zoom = 1;
      cam.updateProjectionMatrix();
    }
  }
}

interface CameraRigProps {
  zoom: number;
  fov: number;
  orthographic: boolean;
  cameraHomeRef: React.RefObject<CameraHome | null>;
  onZoomChange?: (z: number) => void;
}

function CameraRig({ zoom, fov, orthographic, cameraHomeRef, onZoomChange }: CameraRigProps) {
  const { camera, gl, size, set } = useThree();

  const [persp] = useState(() => {
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    (cam as THREE.Camera & { manual?: boolean }).manual = true;
    return cam;
  });
  const [ortho] = useState(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    (cam as THREE.Camera & { manual?: boolean }).manual = true;
    return cam;
  });
  const activeRef = useRef<THREE.Camera | null>(null);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const target = orthographic ? ortho : persp;
    const previous = activeRef.current;

    if (previous && previous !== target) {
      target.position.copy(previous.position);
      target.quaternion.copy(previous.quaternion);
    } else if (!previous) {
      target.position.copy(camera.position);
      target.quaternion.copy(camera.quaternion);
    }

    activeRef.current = target;
    updateCamera(target, zoom, fov, size.width, size.height, cameraHomeRef.current);
    if (camera !== target) set({ camera: target });
  }, [orthographic, fov, zoom, size.width, size.height, set, camera, cameraHomeRef]);

  useFrame(() => {
    const active = activeRef.current;
    if (!active) return;
    updateCamera(active, zoom, fov, size.width, size.height, cameraHomeRef.current);
  });

  useEffect(() => {
    if (!onZoomChange) return;
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * ZOOM.WHEEL_SENSITIVITY);
      const next = THREE.MathUtils.clamp(zoomRef.current * factor, ZOOM.MIN, ZOOM.MAX);
      onZoomChange(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl, onZoomChange]);

  return null;
}

const TONE_MAPPING: Record<AdjustConfig['toneMapping'], THREE.ToneMapping> = {
  neutral: THREE.NeutralToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  linear: THREE.LinearToneMapping,
  none: THREE.NoToneMapping,
};

// Orbits a light's base position around the avatar's vertical axis. 0° keeps
// the authored position; positive values swing the light to the avatar's left.
function orbitLightPosition(
  base: readonly [number, number, number],
  angleDeg: number,
): [number, number, number] {
  const angle = THREE.MathUtils.degToRad(angleDeg);
  const radius = Math.hypot(base[0], base[2]);
  const startAngle = Math.atan2(base[0], base[2]);
  const x = Math.sin(startAngle + angle) * radius;
  const z = Math.cos(startAngle + angle) * radius;
  return [x, base[1], z];
}

// Owns renderer-level color management.
function RendererColorSettings({ adjust }: { adjust: AdjustConfig }) {
  const { gl } = useThree();

  useEffect(() => {
    /* eslint-disable react-hooks/immutability */
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = TONE_MAPPING[adjust.toneMapping] ?? THREE.NeutralToneMapping;
    gl.toneMappingExposure = adjust.exposure;
    /* eslint-enable react-hooks/immutability */
  }, [gl, adjust.toneMapping, adjust.exposure]);

  return null;
}

export function VRMScene(props: VRMSceneProps) {
  const {
    vrmUrl, gazeEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity,
    gazeDesiredRef, gazeCurrentRef, mouthValueRef, avatarOffsetRef, faceWeights, rotationRef, cameraHomeRef,
    greenScreen = false, chromaColor = GREEN_SCREEN.COLOR, backgroundImageUrl = null,
    lighting, adjust, shader, optimization, mtoon, wind,
    zoom, fov, orthographic, meshVisibility, onZoomChange,
    onTelemetry, onLoaded, onError,
  } = props;

  const bgColor = greenScreen ? chromaColor : SCENE.BACKGROUND;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={INITIAL_CAMERA}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: TONE_MAPPING[adjust.toneMapping],
        toneMappingExposure: adjust.exposure,
      }}
    >
      {greenScreen ? (
        <color attach="background" args={[bgColor]} />
      ) : backgroundImageUrl ? (
        <BackgroundImage url={backgroundImageUrl} />
      ) : (
        <color attach="background" args={[bgColor]} />
      )}

      <ambientLight intensity={LIGHTING.AMBIENT_INTENSITY} color={SCENE.LIGHT_AMBIENT} />

      <directionalLight
        position={orbitLightPosition(LIGHTING.FRONT_POSITION, lighting.frontAngle)}
        intensity={lighting.front}
        color={SCENE.LIGHT_FRONT}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.01}
        shadow-camera-far={10}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={1.5}
        shadow-camera-bottom={-1.5}
      />
      <directionalLight
        position={orbitLightPosition(LIGHTING.TOP_POSITION, lighting.topAngle)}
        intensity={lighting.top}
        color={SCENE.LIGHT_TOP}
      />

      <VRMAvatar
        vrmUrl={vrmUrl} gazeEnabled={gazeEnabled} autoBlinkEnabled={autoBlinkEnabled}
        randomEyesEnabled={randomEyesEnabled} randomEyesIntensity={randomEyesIntensity}
        idleSwayEnabled={idleSwayEnabled} idleSwayIntensity={idleSwayIntensity}
        shaderConfig={shader} optimization={optimization} mtoon={mtoon} wind={wind}
        rotationRef={rotationRef}
        cameraHomeRef={cameraHomeRef}
        gazeDesiredRef={gazeDesiredRef} gazeCurrentRef={gazeCurrentRef}
        mouthValueRef={mouthValueRef} avatarOffsetRef={avatarOffsetRef}
        faceWeights={faceWeights}
        meshVisibility={meshVisibility}
        onLoaded={onLoaded} onError={onError}
      />

      <PostFX
        brightness={adjust.brightness} saturation={adjust.saturation} contrast={adjust.contrast}
        hue={adjust.hue} temperature={adjust.temperature}
        bloomStrength={shader.bloom} bloomRadius={shader.bloomRadius} bloomThreshold={shader.bloomThreshold}
        shader={shader}
        fpsLimit={optimization.fpsLimit}
        renderScale={optimization.renderScale}
        pixelRatio={optimization.pixelRatio}
        antiAlias={optimization.antiAlias}
        msaa={optimization.msaa}
      />

      <RendererColorSettings adjust={adjust} />
      <RenderSettings pixelRatio={optimization.pixelRatio} />
      <TelemetryProbe intervalMs={500} onSample={onTelemetry ?? (() => {})} />

      <CameraRig zoom={zoom} fov={fov} orthographic={orthographic} cameraHomeRef={cameraHomeRef} onZoomChange={onZoomChange} />
    </Canvas>
  );
}
