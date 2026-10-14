'use client';

import { useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VRMAvatar } from './VRMAvatar';
import { PostFX } from './PostFX';
import { RenderSettings, TelemetryProbe } from './TelemetryProbe';
import { SCENE, ZOOM, GREEN_SCREEN, LIGHTING, type LightingConfig, type AdjustConfig, type ShaderConfig, type OptimizationConfig, type Telemetry } from '@/lib/vrm/constants';
import type { GazeTarget } from '@/lib/vrm/constants';
import type { LoadVRMResult } from '@/lib/vrm/loadVRM';

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
  greenScreen?: boolean;
  chromaColor?: string;
  backgroundImageUrl?: string | null;
  lighting: LightingConfig;
  adjust: AdjustConfig;
  shader: ShaderConfig;
  optimization: OptimizationConfig;
  zoom: number;
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

function applyCameraZoom(camera: THREE.Camera, zoom: number) {
  const cam = camera as THREE.PerspectiveCamera;
  if (Math.abs(cam.zoom - zoom) > 1e-4) {
    cam.zoom = zoom;
    cam.updateProjectionMatrix();
  }
}

function CameraRig({ zoom, onZoomChange }: { zoom: number; onZoomChange?: (z: number) => void }) {
  const { camera, gl } = useThree();

  useFrame(() => {
    applyCameraZoom(camera, zoom);
  });

  useEffect(() => {
    if (!onZoomChange) return;
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * ZOOM.WHEEL_SENSITIVITY);
      const next = THREE.MathUtils.clamp(zoom * factor, ZOOM.MIN, ZOOM.MAX);
      onZoomChange(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl, zoom, onZoomChange]);

  return null;
}

export function VRMScene(props: VRMSceneProps) {
  const {
    vrmUrl, gazeEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity,
    gazeDesiredRef, gazeCurrentRef, mouthValueRef, avatarOffsetRef,
    greenScreen = false, chromaColor = GREEN_SCREEN.COLOR, backgroundImageUrl = null, lighting, adjust, shader, optimization, zoom, onZoomChange,
    onTelemetry, onLoaded, onError,
  } = props;

  const bgColor = greenScreen ? chromaColor : SCENE.BACKGROUND;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0, 1.3, 1.3], near: 0.01, far: 100 }}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
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
        position={LIGHTING.FRONT_POSITION}
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
        position={LIGHTING.TOP_POSITION}
        intensity={lighting.top}
        color={SCENE.LIGHT_TOP}
      />

      <VRMAvatar
        vrmUrl={vrmUrl} gazeEnabled={gazeEnabled} autoBlinkEnabled={autoBlinkEnabled}
        randomEyesEnabled={randomEyesEnabled} randomEyesIntensity={randomEyesIntensity}
        idleSwayEnabled={idleSwayEnabled} idleSwayIntensity={idleSwayIntensity}
        shaderConfig={shader} optimization={optimization}
        gazeDesiredRef={gazeDesiredRef} gazeCurrentRef={gazeCurrentRef}
        mouthValueRef={mouthValueRef} avatarOffsetRef={avatarOffsetRef}
        onLoaded={onLoaded} onError={onError}
      />

      <PostFX
        brightness={adjust.brightness} saturation={adjust.saturation} contrast={adjust.contrast}
        bloomStrength={shader.bloom} bloomRadius={shader.bloomRadius} bloomThreshold={shader.bloomThreshold}
        shader={shader}
        fpsLimit={optimization.fpsLimit}
        renderScale={optimization.renderScale}
        pixelRatio={optimization.pixelRatio}
        antiAlias={optimization.antiAlias}
      />

      <RenderSettings pixelRatio={optimization.pixelRatio} />
      <TelemetryProbe intervalMs={500} onSample={onTelemetry ?? (() => {})} />

      <CameraRig zoom={zoom} onZoomChange={onZoomChange} />
    </Canvas>
  );
}
