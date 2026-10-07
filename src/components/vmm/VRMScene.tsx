'use client';

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VRMAvatar } from './VRMAvatar';
import { SCENE, GREEN_SCREEN, LIGHTING, type LightingConfig } from '@/lib/vrm/constants';
import type { GazeTarget } from '@/lib/vrm/constants';
import type { LoadVRMResult } from '@/lib/vrm/loadVRM';

interface VRMSceneProps {
  vrmUrl: string | null;
  gazeEnabled: boolean;
  autoBlinkEnabled: boolean;
  idleSwayEnabled: boolean;
  idleSwayIntensity: number;
  gazeDesiredRef: React.RefObject<GazeTarget>;
  gazeCurrentRef: React.RefObject<GazeTarget>;
  mouthValueRef: React.RefObject<number>;
  avatarOffsetRef: React.RefObject<THREE.Vector3>;
  greenScreen?: boolean;
  backgroundImageUrl?: string | null;
  lighting: LightingConfig;
  onLoaded?: (result: LoadVRMResult) => void;
  onError?: (err: Error) => void;
}

function lightPosition(angle: number, height: number): [number, number, number] {
  const rad = THREE.MathUtils.degToRad(angle);
  return [LIGHTING.RADIUS * Math.sin(rad), height, LIGHTING.RADIUS * Math.cos(rad)];
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

export function VRMScene(props: VRMSceneProps) {
  const {
    vrmUrl, gazeEnabled, autoBlinkEnabled, idleSwayEnabled, idleSwayIntensity,
    gazeDesiredRef, gazeCurrentRef, mouthValueRef, avatarOffsetRef,
    greenScreen = false, backgroundImageUrl = null, lighting,
    onLoaded, onError,
  } = props;

  const bgColor = greenScreen ? GREEN_SCREEN.COLOR : SCENE.BACKGROUND;
  const keyPos = lightPosition(lighting.key.angle, LIGHTING.HEIGHTS.key);
  const fillPos = lightPosition(lighting.fill.angle, LIGHTING.HEIGHTS.fill);
  const rimPos = lightPosition(lighting.rim.angle, LIGHTING.HEIGHTS.rim);
  const backPos = lightPosition(lighting.back.angle, LIGHTING.HEIGHTS.back);

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

      <ambientLight intensity={lighting.ambient} color={SCENE.LIGHT_AMBIENT} />

      <directionalLight
        position={keyPos}
        intensity={lighting.key.intensity}
        color={SCENE.LIGHT_KEY}
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
        position={fillPos}
        intensity={lighting.fill.intensity}
        color={SCENE.LIGHT_FILL}
      />
      <pointLight
        position={rimPos}
        intensity={lighting.rim.intensity}
        color={SCENE.LIGHT_RIM}
        distance={5}
      />
      <directionalLight
        position={backPos}
        intensity={lighting.back.intensity}
        color={SCENE.LIGHT_BACK}
      />

      <VRMAvatar
        vrmUrl={vrmUrl} gazeEnabled={gazeEnabled} autoBlinkEnabled={autoBlinkEnabled}
        idleSwayEnabled={idleSwayEnabled} idleSwayIntensity={idleSwayIntensity}
        gazeDesiredRef={gazeDesiredRef} gazeCurrentRef={gazeCurrentRef}
        mouthValueRef={mouthValueRef} avatarOffsetRef={avatarOffsetRef}
        onLoaded={onLoaded} onError={onError}
      />
    </Canvas>
  );
}
