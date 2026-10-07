'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { loadVRMFromUrl, type LoadVRMResult } from '@/lib/vrm/loadVRM';
import {
  gazeToHeadEuler,
  gazeToEyeEuler,
  smoothDampGaze,
  computeAutoBlink,
  randomNextBlinkDelay,
  applyStandPose,
} from '@/lib/vrm/gazeMath';
import { GAZE, LIPSYNC, AUTO_BLINK, SCENE } from '@/lib/vrm/constants';
import type { GazeTarget } from '@/lib/vrm/constants';

interface VRMAvatarProps {
  vrmUrl: string | null;
  gazeEnabled: boolean;
  autoBlinkEnabled: boolean;
  idleSwayEnabled: boolean;
  idleSwayIntensity: number;
  gazeDesiredRef: React.RefObject<GazeTarget>;
  gazeCurrentRef: React.RefObject<GazeTarget>;
  mouthValueRef: React.RefObject<number>;
  avatarOffsetRef: React.RefObject<THREE.Vector3>;
  onLoaded?: (result: LoadVRMResult) => void;
  onError?: (err: Error) => void;
}

// Loads a VRM, adds it to the R3F scene, and updates bones/expressions
// every frame for gaze tracking, lipsync, and auto-blink.
export function VRMAvatar(props: VRMAvatarProps) {
  const {
    vrmUrl, gazeEnabled, autoBlinkEnabled, idleSwayEnabled, idleSwayIntensity,
    gazeDesiredRef, gazeCurrentRef, mouthValueRef, avatarOffsetRef,
    onLoaded, onError,
  } = props;

  const [scene, setScene] = useState<THREE.Group | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const leftEyeBoneRef = useRef<THREE.Bone | null>(null);
  const rightEyeBoneRef = useRef<THREE.Bone | null>(null);
  const hipsBoneRef = useRef<THREE.Bone | null>(null);
  const spineBoneRef = useRef<THREE.Bone | null>(null);
  const blinkStateRef = useRef({
    elapsed: 0,
    nextDelay: randomNextBlinkDelay(),
  });

  const { camera } = useThree();

  useEffect(() => {
    if (!vrmUrl) {
      vrmRef.current = null;
      headBoneRef.current = null;
      neckBoneRef.current = null;
      leftEyeBoneRef.current = null;
      rightEyeBoneRef.current = null;
      hipsBoneRef.current = null;
      spineBoneRef.current = null;
      return;
    }

    let cancelled = false;
    loadVRMFromUrl(vrmUrl)
      .then((result: LoadVRMResult) => {
        if (cancelled) return;
        const { scene: vrmScene, vrm } = result;
        vrmRef.current = vrm;
        headBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('head') ?? null;
        neckBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('neck') ?? null;
        leftEyeBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('leftEye') ?? null;
        rightEyeBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('rightEye') ?? null;
        hipsBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('hips') ?? null;
        spineBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('spine') ?? null;
        applyStandPose(vrm);

        vrmScene.updateMatrixWorld(true);
        const head = headBoneRef.current;
        if (head) {
          const headWorldPos = new THREE.Vector3();
          head.getWorldPosition(headWorldPos);
          camera.position.set(0, headWorldPos.y - 0.05, headWorldPos.z + SCENE.CAMERA_DISTANCE);
          camera.lookAt(0, headWorldPos.y - 0.15, headWorldPos.z);
          camera.updateProjectionMatrix();
        }
        setScene(vrmScene);
        onLoaded?.(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError?.(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      setScene(null);
      vrmRef.current = null;
      headBoneRef.current = null;
      neckBoneRef.current = null;
      leftEyeBoneRef.current = null;
      rightEyeBoneRef.current = null;
      hipsBoneRef.current = null;
      spineBoneRef.current = null;
    };
  }, [vrmUrl]);

  useFrame((_, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;
    const dt = Math.min(delta, 1 / 30);

    // Apply avatar offset (from middle-click drag)
    const offset = avatarOffsetRef.current;
    if (offset && scene) {
      scene.position.set(offset.x, offset.y, offset.z);
    }

    // Gaze tracking: lerp toward desired (or forward if disabled)
    const desired = gazeEnabled
      ? gazeDesiredRef.current
      : ({ x: 0, y: 0 } as GazeTarget);
    gazeCurrentRef.current = smoothDampGaze(
      gazeCurrentRef.current, desired, GAZE.LERP_SPEED, dt
    );

    const head = headBoneRef.current;
    if (head) head.quaternion.setFromEuler(gazeToHeadEuler(gazeCurrentRef.current));

    const neck = neckBoneRef.current;
    if (neck) {
      const neckLimit = GAZE.HEAD_ROT_LIMIT_DEG * (1 - GAZE.HEAD_RATE);
      neck.quaternion.setFromEuler(gazeToHeadEuler(gazeCurrentRef.current, neckLimit));
    }

    const leftEye = leftEyeBoneRef.current;
    const rightEye = rightEyeBoneRef.current;
    if (leftEye && rightEye) {
      const euler = gazeToEyeEuler(gazeCurrentRef.current);
      leftEye.quaternion.setFromEuler(euler);
      rightEye.quaternion.setFromEuler(euler);
    }

    // Lipsync
    try {
      vrm.expressionManager?.setValue(LIPSYNC.MOUTH_OPEN_PRESET, mouthValueRef.current ?? 0);
    } catch {}

    // Auto-blink
    if (autoBlinkEnabled) {
      const bs = blinkStateRef.current;
      bs.elapsed += dt;
      const result = computeAutoBlink(bs.elapsed, bs.nextDelay);
      if (result) {
        if (result.isComplete) {
          bs.elapsed = 0;
          bs.nextDelay = randomNextBlinkDelay();
        }
        try { vrm.expressionManager?.setValue(AUTO_BLINK.BLINK_PRESET, result.value); } catch {}
      } else {
        try { vrm.expressionManager?.setValue(AUTO_BLINK.BLINK_PRESET, 0); } catch {}
      }
    }

    // Idle sway (balanceo inactivo)
    const hips = hipsBoneRef.current;
    const spine = spineBoneRef.current;

    if (hips && spine) {
      if (idleSwayEnabled) {
        const time = performance.now() * 0.001;
        const speed = 1.0;
        const swayAmount = idleSwayIntensity;
        hips.rotation.z = Math.sin(time * speed) * swayAmount;
        spine.rotation.z = Math.sin(time * speed + Math.PI) * (swayAmount * 0.5);
      } else {
        hips.rotation.z = 0;
        spine.rotation.z = 0;
      }
    }

    vrm.update(dt);
  });

  return scene ? <primitive object={scene} /> : null;
}
